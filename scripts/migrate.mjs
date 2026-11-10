// Applies scripts/schema.sql before the server starts.
// Idempotent and safe to run on every deploy: node scripts/migrate.mjs
import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import pg from "pg";

try {
  // Loads a local .env when present. Hosts inject variables directly, and the
  // Docker image does not ship dotenv, so a missing module is fine.
  await import("dotenv/config");
} catch {
  /* optional */
}

const url = process.env.DATABASE_URL;
if (!url) {
  console.error("[migrate] DATABASE_URL is required.");
  process.exit(1);
}

const schemaPath = path.join(
  path.dirname(fileURLToPath(import.meta.url)),
  "schema.sql",
);
const schema = await readFile(schemaPath, "utf8");
const attempts = Number(process.env.MIGRATE_ATTEMPTS || 10);
const transientCodes = new Set([
  "ECONNREFUSED",
  "ENOTFOUND",
  "ETIMEDOUT",
  "ECONNRESET",
  "EAI_AGAIN",
  "57P03", // the database system is starting up
]);

for (let attempt = 1; ; attempt++) {
  const client = new pg.Client({
    connectionString: url,
    connectionTimeoutMillis: 10000,
  });
  client.on("error", () => {});
  try {
    await client.connect();
    await client.query("BEGIN");
    // A different key from the seed lock; serializes concurrent deploys.
    await client.query("SELECT pg_advisory_xact_lock(7251842)");
    await client.query(schema);
    await client.query("COMMIT");
    const { rows } = await client.query(
      "SELECT count(*)::int AS tables FROM information_schema.tables WHERE table_schema = 'public' AND table_name IN ('users', 'documents', 'document_shares', 'sessions', 'document_stars')",
    );
    console.log(`[migrate] Schema ready (${rows[0].tables}/5 tables).`);
    await client.end();
    break;
  } catch (error) {
    await client.query("ROLLBACK").catch(() => {});
    await client.end().catch(() => {});
    if (!transientCodes.has(error.code) || attempt >= attempts) {
      console.error(`[migrate] Failed: ${error.message}`);
      process.exit(1);
    }
    console.log(
      `[migrate] Database not ready (attempt ${attempt}/${attempts}). Retrying in 3s…`,
    );
    await new Promise((resolve) => setTimeout(resolve, 3000));
  }
}
