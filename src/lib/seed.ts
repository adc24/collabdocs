import { db } from "@/db";
import { users, documents, documentShares, documentStars } from "@/db/schema";
import { eq, sql } from "drizzle-orm";
import { hashPassword } from "./security";
import { fromText } from "./content";
import { seedDocuments } from "./templates";
let seedPromise: Promise<void> | undefined;
export function ensureSeed() {
  if (process.env.DEMO_MODE === "false") return Promise.resolve();
  if (!seedPromise)
    seedPromise = seed().catch((error) => {
      seedPromise = undefined;
      throw error;
    });
  return seedPromise;
}
async function seed() {
  await db.transaction(async (tx) => {
    await tx.execute(sql`select pg_advisory_xact_lock(7251841)`);
    const existing = await tx
      .select({ id: users.id })
      .from(users)
      .where(eq(users.email, "abhay@example.com"));
    if (existing.length) return;
    const [abhay] = await tx
      .insert(users)
      .values({
        name: "Abhay Chouhan",
        email: "abhay@example.com",
        passwordHash: hashPassword("demo123"),
        color: "peach",
      })
      .returning();
    const [reviewer] = await tx
      .insert(users)
      .values({
        name: "Alex Morgan",
        email: "reviewer@example.com",
        passwordHash: hashPassword("demo123"),
        color: "lavender",
      })
      .returning();
    for (const item of seedDocuments) {
      const owner = item.owner === "abhay" ? abhay : reviewer;
      const other = item.owner === "abhay" ? reviewer : abhay;
      const [doc] = await tx
        .insert(documents)
        .values({
          title: item.title,
          content: fromText(item.content),
          ownerId: owner.id,
          color: item.color,
          updatedAt: new Date(Date.now() - item.hours * 3600000),
          createdAt: new Date(Date.now() - (item.hours + 24) * 3600000),
        })
        .returning();
      if (item.shared)
        await tx.insert(documentShares).values({
          documentId: doc.id,
          userId: other.id,
          permission: "editor",
        });
      if (item.starred)
        await tx
          .insert(documentStars)
          .values({ documentId: doc.id, userId: abhay.id });
    }
  });
}
