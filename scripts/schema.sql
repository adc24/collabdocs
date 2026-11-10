-- CollabDocs database schema (PostgreSQL 13+).
-- Idempotent: safe to run on an empty database or one that already has the tables.
-- Keep in step with src/db/schema.ts, which is the source of truth for types.

CREATE TABLE IF NOT EXISTS "users" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "name" varchar(100) NOT NULL,
  "email" varchar(255) NOT NULL,
  "password_hash" text NOT NULL,
  "color" varchar(20) DEFAULT 'peach' NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "users_email_unique" UNIQUE ("email")
);

CREATE TABLE IF NOT EXISTS "documents" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "title" varchar(160) NOT NULL,
  "content" jsonb NOT NULL,
  "owner_id" uuid NOT NULL,
  "color" varchar(20) DEFAULT 'paper' NOT NULL,
  "revision" integer DEFAULT 1 NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
  "deleted_at" timestamp with time zone,
  CONSTRAINT "documents_owner_id_users_id_fk" FOREIGN KEY ("owner_id") REFERENCES "users" ("id") ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS "document_shares" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "document_id" uuid NOT NULL,
  "user_id" uuid NOT NULL,
  "permission" varchar(10) DEFAULT 'editor' NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "document_shares_document_id_documents_id_fk" FOREIGN KEY ("document_id") REFERENCES "documents" ("id") ON DELETE CASCADE,
  CONSTRAINT "document_shares_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "users" ("id") ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS "sessions" (
  "token_hash" varchar(64) PRIMARY KEY NOT NULL,
  "user_id" uuid NOT NULL,
  "expires_at" timestamp with time zone NOT NULL,
  CONSTRAINT "sessions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "users" ("id") ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS "document_stars" (
  "document_id" uuid NOT NULL,
  "user_id" uuid NOT NULL,
  CONSTRAINT "document_stars_document_id_user_id_pk" PRIMARY KEY ("document_id", "user_id"),
  CONSTRAINT "document_stars_document_id_documents_id_fk" FOREIGN KEY ("document_id") REFERENCES "documents" ("id") ON DELETE CASCADE,
  CONSTRAINT "document_stars_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "users" ("id") ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS "documents_owner_idx" ON "documents" USING btree ("owner_id");
CREATE UNIQUE INDEX IF NOT EXISTS "document_user_share_idx" ON "document_shares" USING btree ("document_id", "user_id");
CREATE INDEX IF NOT EXISTS "shares_user_idx" ON "document_shares" USING btree ("user_id");
