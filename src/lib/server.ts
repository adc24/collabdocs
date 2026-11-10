import { NextRequest, NextResponse } from "next/server";
import { and, desc, eq, inArray, isNotNull, isNull, lt, or } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import {
  users,
  documents,
  documentShares,
  documentStars,
  sessions,
} from "@/db/schema";
import {
  ApiError,
  assertSameOrigin,
  createSession,
  currentUser,
  hashToken,
  limitLogin,
  verifyPassword,
} from "@/lib/security";
import { ensureSeed } from "@/lib/seed";
import { assessmentDownload } from "@/lib/assessment";
import { EMPTY_CONTENT, fromText, validateContent } from "@/lib/content";
import { templateData } from "@/lib/templates";
import type { User } from "@/lib/types";

const titleSchema = z
  .string()
  .trim()
  .min(1, "Give your document a title.")
  .max(160, "Titles can have up to 160 characters.");
const colorSchema = z.enum([
  "paper",
  "lavender",
  "peach",
  "sage",
  "blue",
  "sand",
]);
const userFields = {
  id: users.id,
  name: users.name,
  email: users.email,
  color: users.color,
};
const json = (value: unknown, status = 200) =>
  NextResponse.json(value, {
    status,
    headers: { "Cache-Control": "no-store" },
  });
async function body(request: NextRequest) {
  if (Number(request.headers.get("content-length")) > 1_100_000)
    throw new ApiError(
      413,
      "This document is too large. Maximum size is 1 MB.",
    );
  const text = await request.text();
  if (text.length > 1_100_000)
    throw new ApiError(
      413,
      "This document is too large. Maximum size is 1 MB.",
    );
  try {
    return JSON.parse(text);
  } catch {
    throw new ApiError(400, "Please send a valid JSON request.");
  }
}
async function access(id: string, user: User, allowTrash = false) {
  z.uuid().parse(id);
  const [doc] = await db.select().from(documents).where(eq(documents.id, id));
  if (!doc || (doc.deletedAt && !allowTrash))
    throw new ApiError(404, "This document could not be found.");
  if (doc.ownerId === user.id) return { doc, permission: "owner" as const };
  if (doc.deletedAt)
    throw new ApiError(404, "This document could not be found.");
  const [share] = await db
    .select()
    .from(documentShares)
    .where(
      and(
        eq(documentShares.documentId, id),
        eq(documentShares.userId, user.id),
      ),
    );
  if (!share)
    throw new ApiError(
      404,
      "This document could not be found, or you don’t have access.",
    );
  return { doc, permission: share.permission };
}
async function decorate(rows: (typeof documents.$inferSelect)[], user: User) {
  if (!rows.length) return [];
  const ids = rows.map((d) => d.id);
  const owners = await db
    .select(userFields)
    .from(users)
    .where(inArray(users.id, [...new Set(rows.map((d) => d.ownerId))]));
  const shares = await db
    .select({
      documentId: documentShares.documentId,
      permission: documentShares.permission,
      ...userFields,
    })
    .from(documentShares)
    .innerJoin(users, eq(users.id, documentShares.userId))
    .where(inArray(documentShares.documentId, ids));
  const stars = await db
    .select()
    .from(documentStars)
    .where(
      and(
        eq(documentStars.userId, user.id),
        inArray(documentStars.documentId, ids),
      ),
    );
  return rows.map((doc) => ({
    ...doc,
    owner: owners.find((u) => u.id === doc.ownerId),
    collaborators: shares
      .filter((s) => s.documentId === doc.id)
      .map(({ documentId: _, ...s }) => s),
    starred: stars.some((s) => s.documentId === doc.id),
    permission:
      doc.ownerId === user.id
        ? "owner"
        : shares.find((s) => s.documentId === doc.id && s.id === user.id)
            ?.permission || "viewer",
  }));
}
async function one(id: string, user: User) {
  const { doc } = await access(id, user);
  return (await decorate([doc], user))[0];
}
export async function handleRequest(request: NextRequest) {
  try {
    if (request.method !== "GET") assertSameOrigin(request);
    if (
      request.method === "GET" &&
      request.nextUrl.pathname === "/api/assessment/download"
    )
      return await assessmentDownload(request);
    await ensureSeed();
    const path = request.nextUrl.pathname.split("/").filter(Boolean).slice(1);
    const key = path.join("/");
    const method = request.method;
    if (key === "auth/login" && method === "POST") {
      limitLogin(request);
      const input = z
        .object({
          email: z.email().toLowerCase().max(255),
          password: z.string().min(1).max(200),
        })
        .parse(await body(request));
      const [account] = await db
        .select()
        .from(users)
        .where(eq(users.email, input.email));
      if (!account || !verifyPassword(input.password, account.passwordHash))
        throw new ApiError(
          401,
          "That email and password don’t match. Please try again.",
        );
      await db.delete(sessions).where(lt(sessions.expiresAt, new Date()));
      const previous = request.cookies.get("collabdocs_session")?.value;
      if (previous)
        await db
          .delete(sessions)
          .where(eq(sessions.tokenHash, hashToken(previous)));
      const { passwordHash: _, createdAt: __, ...user } = account;
      const response = json({ user });
      await createSession(response, account.id, request);
      return response;
    }
    if (key === "auth/logout" && method === "POST") {
      const token = request.cookies.get("collabdocs_session")?.value;
      if (token)
        await db
          .delete(sessions)
          .where(eq(sessions.tokenHash, hashToken(token)));
      const response = json({ ok: true });
      response.cookies.delete("collabdocs_session");
      return response;
    }
    const user = await currentUser(request);
    if (key === "auth/session" && method === "GET") return json({ user });
    if (key === "users" && method === "GET")
      return json({ users: await db.select(userFields).from(users) });
    if (key === "documents" && method === "GET") {
      const trash = request.nextUrl.searchParams.get("trash") === "true";
      const shared = await db
        .select({ id: documentShares.documentId })
        .from(documentShares)
        .where(eq(documentShares.userId, user.id));
      const rows = await db
        .select()
        .from(documents)
        .where(
          trash
            ? and(
                eq(documents.ownerId, user.id),
                isNotNull(documents.deletedAt),
              )
            : and(
                isNull(documents.deletedAt),
                or(
                  eq(documents.ownerId, user.id),
                  shared.length
                    ? inArray(
                        documents.id,
                        shared.map((s) => s.id),
                      )
                    : undefined,
                ),
              ),
        )
        .orderBy(desc(documents.updatedAt));
      return json({ documents: await decorate(rows, user) });
    }
    if (key === "documents" && method === "POST") {
      const input = z
        .object({
          title: titleSchema.optional(),
          content: z
            .custom<import("@/lib/types").RichNode>(
              validateContent,
              "Invalid rich-text content.",
            )
            .optional(),
          template: z
            .enum(["blank", "project", "meeting", "brainstorm"])
            .optional(),
          color: colorSchema.optional(),
        })
        .parse(await body(request));
      const template = templateData[input.template || "blank"];
      const [doc] = await db
        .insert(documents)
        .values({
          title: input.title || template.title,
          content: input.content || template.content || EMPTY_CONTENT,
          ownerId: user.id,
          color: input.color || template.color,
        })
        .returning();
      return json({ document: (await decorate([doc], user))[0] }, 201);
    }
    if (key === "documents/import" && method === "POST") {
      if (Number(request.headers.get("content-length")) > 1_100_000)
        throw new ApiError(
          413,
          "File is too large. Please choose a file under 1 MB.",
        );
      const form = await request.formData();
      const file = form.get("file");
      if (!(file instanceof File))
        throw new ApiError(400, "Choose a .txt or .md file to import.");
      if (!/\.(txt|md)$/i.test(file.name))
        throw new ApiError(415, "Only .txt and .md files are supported.");
      if (file.size > 1_048_576)
        throw new ApiError(413, "File is too large. Maximum size is 1 MB.");
      if (!file.size)
        throw new ApiError(
          400,
          "This file is empty. Choose a file with some content.",
        );
      let text: string;
      try {
        text = new TextDecoder("utf-8", { fatal: true }).decode(
          await file.arrayBuffer(),
        );
      } catch {
        throw new ApiError(400, "Please choose a UTF-8 text file.");
      }
      if (text.includes("\0"))
        throw new ApiError(
          400,
          "This looks like a binary file. Please upload plain text or Markdown.",
        );
      const content = fromText(text, /\.md$/i.test(file.name));
      if (!validateContent(content))
        throw new ApiError(
          413,
          "The imported content is too large or complex.",
        );
      const [doc] = await db
        .insert(documents)
        .values({
          title:
            file.name
              .replace(/\.(txt|md)$/i, "")
              .replace(/[\x00-\x1f]/g, "")
              .slice(0, 160) || "Imported document",
          content,
          ownerId: user.id,
          color: "paper",
        })
        .returning();
      return json({ document: (await decorate([doc], user))[0] }, 201);
    }
    if (path[0] === "documents" && path[1]) {
      const id = path[1];
      const action = path[2];
      const { doc, permission } = await access(
        id,
        user,
        action === "restore" || method === "DELETE",
      );
      if (path.length === 2 && method === "GET")
        return json({ document: (await decorate([doc], user))[0] });
      if (path.length === 2 && method === "PUT") {
        if (permission === "viewer")
          throw new ApiError(
            403,
            "You have view-only access to this document.",
          );
        const input = z
          .object({
            title: titleSchema.optional(),
            content: z
              .custom<import("@/lib/types").RichNode>(
                validateContent,
                "Invalid rich-text content.",
              )
              .optional(),
            revision: z.number().int().positive().optional(),
          })
          .refine(
            (v) => v.title !== undefined || v.content !== undefined,
            "No changes were provided.",
          )
          .refine(
            (v) => v.content === undefined || v.revision !== undefined,
            "A revision is required when saving content.",
          )
          .parse(await body(request));
        if (input.revision !== undefined && input.revision !== doc.revision)
          throw new ApiError(
            409,
            "A collaborator saved a newer version. Download your draft before reloading to avoid losing changes.",
          );
        const [saved] = await db
          .update(documents)
          .set({
            ...(input.title ? { title: input.title } : {}),
            ...(input.content ? { content: input.content } : {}),
            updatedAt: new Date(),
            revision: doc.revision + 1,
          })
          .where(
            and(eq(documents.id, id), eq(documents.revision, doc.revision)),
          )
          .returning();
        if (!saved)
          throw new ApiError(
            409,
            "This document was updated elsewhere. Reload to get the latest version.",
          );
        return json({ document: (await decorate([saved], user))[0] });
      }
      if (path.length === 2 && method === "DELETE") {
        if (permission !== "owner")
          throw new ApiError(403, "Only the owner can delete this document.");
        if (request.nextUrl.searchParams.get("permanent") === "true") {
          if (!doc.deletedAt)
            throw new ApiError(
              400,
              "Move the document to Trash before permanently deleting it.",
            );
          await db.delete(documents).where(eq(documents.id, id));
        } else
          await db
            .update(documents)
            .set({ deletedAt: new Date() })
            .where(eq(documents.id, id));
        return json({ ok: true });
      }
      if (action === "restore" && method === "POST") {
        if (permission !== "owner")
          throw new ApiError(403, "Only the owner can restore this document.");
        await db
          .update(documents)
          .set({ deletedAt: null })
          .where(eq(documents.id, id));
        return json({ document: await one(id, user) });
      }
      if (action === "star" && method === "POST") {
        const { starred } = z
          .object({ starred: z.boolean() })
          .parse(await body(request));
        if (starred)
          await db
            .insert(documentStars)
            .values({ documentId: id, userId: user.id })
            .onConflictDoNothing();
        else
          await db
            .delete(documentStars)
            .where(
              and(
                eq(documentStars.documentId, id),
                eq(documentStars.userId, user.id),
              ),
            );
        return json({ starred });
      }
      if (action === "shares" && path.length === 3 && method === "GET") {
        const record = await one(id, user);
        return json({
          owner: record.owner,
          collaborators: record.collaborators,
        });
      }
      if (action === "share" && method === "POST") {
        if (permission !== "owner")
          throw new ApiError(403, "Only the owner can manage sharing.");
        const input = z
          .object({
            email: z.email().toLowerCase().max(255),
            permission: z.enum(["editor", "viewer"]).default("editor"),
          })
          .parse(await body(request));
        const [other] = await db
          .select()
          .from(users)
          .where(eq(users.email, input.email));
        if (!other)
          throw new ApiError(
            404,
            "No registered user has that email. Try reviewer@example.com or abhay@example.com.",
          );
        if (other.id === user.id)
          throw new ApiError(400, "You already own this document.");
        await db
          .insert(documentShares)
          .values({
            documentId: id,
            userId: other.id,
            permission: input.permission,
          })
          .onConflictDoUpdate({
            target: [documentShares.documentId, documentShares.userId],
            set: { permission: input.permission },
          });
        return json({ document: await one(id, user) }, 201);
      }
      if (action === "shares" && path[3] && method === "DELETE") {
        if (permission !== "owner")
          throw new ApiError(403, "Only the owner can revoke access.");
        z.uuid().parse(path[3]);
        await db
          .delete(documentShares)
          .where(
            and(
              eq(documentShares.documentId, id),
              eq(documentShares.userId, path[3]),
            ),
          );
        return json({ document: await one(id, user) });
      }
    }
    throw new ApiError(404, "This endpoint could not be found.");
  } catch (error) {
    if (error instanceof ApiError)
      return json({ error: error.message }, error.status);
    if (error instanceof z.ZodError)
      return json(
        { error: error.issues[0]?.message || "Please check your input." },
        400,
      );
    console.error("CollabDocs API error:", error);
    return json(
      { error: "Something went wrong. Please try again in a moment." },
      500,
    );
  }
}
