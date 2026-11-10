import {
  randomBytes,
  scryptSync,
  timingSafeEqual,
  createHash,
} from "node:crypto";
import { and, eq, gt } from "drizzle-orm";
import { db } from "@/db";
import { sessions, users } from "@/db/schema";
import type { NextRequest, NextResponse } from "next/server";
import type { User } from "./types";

export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}
export function hashPassword(password: string) {
  const salt = randomBytes(16).toString("hex");
  return `${salt}:${scryptSync(password, salt, 64).toString("hex")}`;
}
export function verifyPassword(password: string, stored: string) {
  const [salt, key] = stored.split(":");
  if (!salt || !key) return false;
  const expected = Buffer.from(key, "hex");
  const actual = scryptSync(password, salt, 64);
  return expected.length === actual.length && timingSafeEqual(expected, actual);
}
export const hashToken = (token: string) =>
  createHash("sha256").update(token).digest("hex");
export async function currentUser(request: NextRequest): Promise<User> {
  const token = request.cookies.get("collabdocs_session")?.value;
  if (!token) throw new ApiError(401, "Please sign in to your workspace.");
  const [row] = await db
    .select({
      id: users.id,
      name: users.name,
      email: users.email,
      color: users.color,
    })
    .from(sessions)
    .innerJoin(users, eq(sessions.userId, users.id))
    .where(
      and(
        eq(sessions.tokenHash, hashToken(token)),
        gt(sessions.expiresAt, new Date()),
      ),
    );
  if (!row)
    throw new ApiError(401, "Your session has expired. Please sign in again.");
  return row;
}
export async function createSession(
  response: NextResponse,
  userId: string,
  request: NextRequest,
) {
  const token = randomBytes(32).toString("hex");
  const expires = new Date(Date.now() + 7 * 86400000);
  await db
    .insert(sessions)
    .values({ tokenHash: hashToken(token), userId, expiresAt: expires });
  response.cookies.set("collabdocs_session", token, {
    httpOnly: true,
    sameSite: "lax",
    // The platform proxy can hide the TLS scheme. The Origin host has already
    // passed assertSameOrigin before login; it is safe to use for HTTPS detection.
    secure:
      process.env.SESSION_COOKIE_SECURE === "true" ||
      request.headers.get("x-forwarded-proto")?.split(",")[0]?.trim() ===
        "https" ||
      request.nextUrl.protocol === "https:" ||
      request.headers.get("origin")?.startsWith("https://") === true,
    path: "/",
    expires,
  });
}
export function assertSameOrigin(request: NextRequest) {
  if (request.headers.get("sec-fetch-site") === "cross-site")
    throw new ApiError(403, "Cross-site requests are not allowed.");
  const origin = request.headers.get("origin");
  if (origin) {
    const host = new URL(origin).host;
    const valid = [
      request.headers.get("host"),
      request.headers.get("x-forwarded-host"),
      request.nextUrl.host,
    ];
    if (!valid.includes(host))
      throw new ApiError(403, "Request origin is not allowed.");
  }
}
const attempts = new Map<string, { count: number; until: number }>();
export function limitLogin(request: NextRequest) {
  const ip =
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "local";
  const now = Date.now();
  if (attempts.size > 10000)
    for (const [key, value] of attempts)
      if (value.until < now) attempts.delete(key);
  const entry = attempts.get(ip);
  if (entry && entry.until > now) {
    if (entry.count >= 40)
      throw new ApiError(
        429,
        "Too many sign-in attempts. Please try again in 15 minutes.",
      );
    entry.count++;
  } else attempts.set(ip, { count: 1, until: now + 15 * 60000 });
}
