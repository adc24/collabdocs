# CollabDocs architecture

## 1. System overview

The browser runs React components inside Next.js App Router. Fetch requests target same-origin `/api` route handlers. Route handlers perform authentication, input validation, authorization, and domain operations through Drizzle ORM against PostgreSQL.

Browser → Next.js pages + React / TipTap → same-origin REST API → service/permission logic → Drizzle → PostgreSQL.

Frontend and backend deploy together as **one Node web service**; PostgreSQL is the only other component. Python is used only for HTTP integration tests.

## 2. Frontend structure

- `workspace-provider.tsx`: bootstrap session, explicitly labeled demo login, sign-in/out, account switching, document cache, notifications, and help.
- `dashboard.tsx`: workspace navigation; computed owned/shared/starred/search filters; grid/list layouts; action dispatch and template creation.
- `document-editor.tsx`: document loader, editable title, TipTap toolbar, outline, zoom, save status, sharing, export, and responsive writing page.
- `document-dialogs.tsx`: import, permission management, rename, and confirmed deletion.
- `ui.tsx`: logo, avatars, CSS/SVG paper illustrations, keyboard-trapped dialogs, empty-state illustration, and loading indicator.
- `use-autosave.ts`: document-scoped recovery and save state machine.
- `assessment-guide.tsx` and `assessment.ts`: reviewer requirement mapping, real workflow shortcuts, and fixed-allowlist source/documentation exports. No Google Drive, video recording, or permanent-hosting integration is implied.
- `globals.css`: warm-neutral design tokens, coral interactions, responsive breakpoints, reduced motion, and editor typography. DM Sans is self-hosted; the license is bundled.

Client state is deliberately local and small. A context holds workspace/session state; editor content remains in TipTap rather than being copied through a global store on every keystroke. The server remains the source of truth. Local storage holds view preferences, an explicit signed-out flag, and recoverable unsaved drafts, not the authoritative document database or session tokens.

## 3. Backend structure

`src/app/api/[...path]/route.ts` exposes the handler implemented in `src/lib/server.ts`. `/api/health` is independent. The domain dispatcher uses:

- `security.ts` for passwords, session creation/authentication, same-origin checks, and login limits.
- `seed.ts` for transactional, lock-protected initial demo data.
- `content.ts` for bounded rich-text validation, safe plain-text/Markdown conversion, text extraction, and Markdown export.
- `templates.ts` for reusable editable templates and meaningful initial content.
- `db/index.ts` for the environment-driven PostgreSQL pool.

No database calls are made from client components. All application database interactions use Drizzle. API errors have consistent JSON shapes; internal database errors are logged on the server rather than returned to clients. Request validation limits titles, payload size, file format, encoding, node depth/count, rich-text node types, formatting marks, and common attributes.

## 4. Database schema

### Users

`id UUID PK`, `name VARCHAR(100)`, `email VARCHAR(255) UNIQUE`, `password_hash TEXT`, `color VARCHAR(20)`, `created_at TIMESTAMPTZ`.

### Documents

`id UUID PK`, `title VARCHAR(160)`, `content JSONB`, `owner_id UUID FK(users)`, `color VARCHAR(20)`, `revision INTEGER`, `created_at TIMESTAMPTZ`, `updated_at TIMESTAMPTZ`, nullable `deleted_at TIMESTAMPTZ`.

The owner index supports workspace retrieval. JSONB stores canonical TipTap/ProseMirror document structure, preserving formatting on reopening. Dates are stored as timezone-aware timestamps and serialized to ISO strings.

### Document shares

`id UUID PK`, `document_id UUID FK(documents)`, `user_id UUID FK(users)`, `permission VARCHAR(10)`, `created_at TIMESTAMPTZ`.

A unique `(document_id, user_id)` index makes grants idempotent and role updates unambiguous. A user index supports shared-workspace queries. Valid permissions are constrained by API validation to `editor` or `viewer`.

### Document stars

Composite primary key `(document_id, user_id)`, both foreign keys. A favorite is private to the user, not a property visible as starred to every collaborator.

### Sessions

`token_hash VARCHAR(64) PK`, `user_id UUID FK(users)`, `expires_at TIMESTAMPTZ`.

Only a SHA-256 hash of each 32-byte random bearer token is stored. Foreign keys cascade for clean deletion. Full schema is in `src/db/schema.ts`. `scripts/schema.sql` is the matching idempotent DDL applied on deploy.

## 5. Authentication and authorization

Passwords use Node’s `scrypt` with a random 16-byte salt and a 64-byte derived key. Verification uses constant-time comparison for equal-length keys. Login generates an opaque random token and sets an HTTP-only, SameSite=Lax cookie. Verified HTTPS Origin/forwarded-scheme detection adds Secure, including behind a TLS-terminating proxy; `SESSION_COOKIE_SECURE=true` forces it for HTTPS-only deployments and non-browser clients. Sessions expire after seven days; logout and account switching revoke the current token. Expired sessions are purged during login.

Mutation requests reject cross-site fetch metadata and mismatched browser origins. No wildcard CORS is enabled. Same-origin requests and non-browser authenticated integration clients are supported. The reverse proxy must sanitize forwarded headers.

The backend independently checks every document operation:

| Role      | Read/export/copy | Edit | Share/revoke | Delete/restore |
| --------- | ---------------- | ---- | ------------ | -------------- |
| Owner     | Yes              | Yes  | Yes          | Yes            |
| Editor    | Yes              | Yes  | No           | No             |
| Viewer    | Yes              | No   | No           | No             |
| Uninvited | No               | No   | No           | No             |

Private and trashed documents are not exposed to uninvited users. Trash is owner-only. A copied URL never creates access. Invitation email addresses must match an existing registered user; self-invites are rejected. Existing collaborators can see the access list but cannot change it.

The assessment intentionally makes two demo accounts public. This is lightweight demo authentication, **not a complete production identity platform**. A process-local login limiter is a useful single-instance guard, not a distributed abuse-prevention system.

## 6. Saving and conflict handling

1. TipTap emits structured JSON on edit. Title changes use the same save queue.
2. Each edit increments a client generation counter and writes a user/document-specific recovery draft where local storage is available.
3. After 850 ms of inactivity, a serialized save sends the latest content and last known server revision.
4. The backend validates access and content, compares the supplied revision, and performs `UPDATE ... WHERE revision = expected` while incrementing the revision.
5. A zero-row update or stale revision returns 409. The UI blocks overwriting, preserves the draft, and offers download plus explicit discard/reload.
6. Changes made during an in-flight request are queued for another save with the new revision, rather than lost or incorrectly marked saved.
7. Successful final saves remove the local recovery draft. Network failures show an error and retain the draft; retry occurs on explicit save, a later edit, or returning online.

Internal “Back to workspace” navigation flushes saves. Browser unload warns while a draft is dirty. Local recovery helps with interruptions but is best-effort and constrained by browser storage limits; private browsing or blocked storage may disable it. Local draft text is not encrypted at rest in the browser. Avoid sensitive work on shared machines.

This is **asynchronous shared-document editing with optimistic concurrency**, not live CRDT collaboration. There are no multiplayer cursors, WebSockets, live presence, or background real-time content streaming. Open/reload a document to retrieve changes made elsewhere. This explicit boundary is safer than pretending autosave is a conflict-free multiplayer protocol.

## 7. File safety and format choices

Imports are bounded to 1 MiB and `.txt` / `.md`. UTF-8 is decoded in strict mode; empty/binary/invalid files fail with meaningful HTTP status codes. The original file is not written to the server filesystem and is never executable. The filename is reduced to a bounded document title.

A small Markdown-to-JSON converter supports the assessed heading/list/basic-inline requirements without enabling arbitrary HTML. Text is rendered by TipTap, not injected via `dangerouslySetInnerHTML`. Unsupported complex Markdown remains plain text or is simplified. Export is practical Markdown, not a lossless representation of underline, text alignment, or every rich-text attribute; authoritative storage remains JSONB.

## 8. Operational decisions

- Same-origin frontend/API: fewer moving parts, secure cookies, no unnecessary CORS layer.
- PostgreSQL: real persistence and transactional sharing, with no cloud dependency.
- Advisory-locked seed transaction: avoids duplicate demos across worker startup; does not reset user data on refresh.
- Soft deletion: prevents accidental loss and makes confirmation reversible; permanent deletion cascades shares/stars.
- UUID identifiers: no sequential document enumeration, but permissions—not UUID secrecy—protect access.
- Local fonts and CSS/SVG artwork: no runtime third-party font/image service dependency.
- HTTPS reverse-proxy-aware cookies and security headers: sensible deployed defaults.
- Deployment: `render.yaml` provisions the web service and database together. `scripts/migrate.mjs` applies `scripts/schema.sql` under an advisory lock before each start, so a fresh database needs no manual step. `schema.sql` and `src/db/schema.ts` must be changed together.
- Docker: standalone output (enabled only inside the Dockerfile), non-root runtime, external database.

## 9. Tests and verification

Python/pytest tests use independent real cookie sessions and exercise actual HTTP/database behavior. Playwright tests use Chromium at desktop and mobile sizes, including create/edit/reload, formatting, sharing, switching, import, navigation, and overflow checks. Additional reliability tests delay an in-flight save, verify the latest edit survives, assert that conflicts never overwrite newer server content, exercise draft download/discard, and verify database editing with browser local storage disabled. No fake repository is substituted for PostgreSQL during integration tests. Reviewer-handoff tests open the guide on desktop/mobile, launch real editor/import flows, download the ZIP/Markdown/script, verify archive CRCs and SHA-256 manifest entries, exclude secret/dependency paths, and enforce the submission’s 1,000-line limit.

Type generation, TypeScript compilation, production build, and the platform-managed `/api/health` check are separate gates. Runtime dependency audits are distinct from development-tool advisories. A deployment rehearsal builds the extracted source ZIP in an empty directory and runs the API tests against an instance started on an empty database; see `DEPLOYMENT.md` for what that does and does not cover.

## 10. Reviewer export boundary

The assessment guide reads no user documents. Its download endpoint accepts only fixed file identifiers, recursively exports an explicit source/tests/public/examples/scripts allowlist, skips symlinks and secret files, bounds file count/size, and generates a SHA-256 manifest. ZIP compression runs asynchronously with fflate. Demo mode can disable the endpoint. The runtime image includes the same public handoff materials, never the actual `.env` or database data. Video/Drive links remain pending until the candidate performs those external actions.

## 11. Scope limitations and next improvements

- No production signup, OAuth, password reset, MFA, organization management, or verified email delivery.
- No CRDT/Yjs, live cursors, comments, document version timeline, offline synchronization service, or file attachments.
- No pagination/full-text search index yet; document filtering searches the current authorized workspace in the browser. This is appropriate for the assessment dataset, not thousands of large documents.
- No ownership transfer or public anonymous links.
- No generalized nested Markdown parser or tables/images.
- Browser drafts are best-effort and account-scoped; manually export a conflicted draft before discarding it.
- Process-local rate limiting should move to Redis or an equivalent shared store for multi-instance deployment.
- Schema changes beyond this first version should use versioned, reviewed migrations with backups; the current bootstrap only creates missing tables and indexes.
- A real production rollout should add permission-race/load testing, security review, identity management, observability, automated backups, and accessibility auditing.
