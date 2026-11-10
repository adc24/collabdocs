# CollabDocs

**A little space for your thoughts. A home for your next big idea.**

CollabDocs is a functional collaborative document workspace built for a technical assessment. It includes persistent rich-text editing, document-level sharing, safe text/Markdown imports, two seeded demo accounts, and a responsive, custom-designed interface.

## Review this assessment quickly

This slice answers **Ajaia LLC’s AI-Native Full Stack Product Engineer** brief for **Abhay Chouhan (abhaydinakar246@gmail.com)**. Open **Assessment guide** in the sidebar for a five-part requirement guide, real workflow shortcuts, demo credentials, scope decisions, and downloads.

- Live deployment: **pending**. Follow `DEPLOYMENT.md`, then paste the URL here and in `SUBMISSION.md`.
- Source/handoff ZIP: use **Download source & docs** in the guide, or `GET /api/assessment/download?file=package`.
- Sample import: `examples/reviewer-notes.md`.
- Screenshots: `public/screenshots/`.
- Submission checklist: `SUBMISSION.md`; recording outline: `WALKTHROUGH_SCRIPT.md`.
- Video and Google Drive links are explicitly pending. No recording, Drive upload, or unrelated repository is presented as a completed deliverable.

To assemble the requested Drive folder, download and extract the ZIP, upload its contents to one folder, add the real video URL, and verify sharing while signed out. The archive contains a hash manifest and excludes actual environment files, database contents, sessions, and dependencies. With the app running locally, `curl -f 'http://localhost:3000/api/assessment/download?file=package' -o CollabDocs-submission.zip` downloads the same package.

## Technology choice

The company brief permits any practical stack. CollabDocs is one Next.js application: React pages are the frontend, and route handlers under `/api` are the backend. They build and deploy together as a single web service, with PostgreSQL (through Drizzle ORM) as the only other component. Python is used only for the pytest integration tests. No paid dependency is required.

## What works

- Dashboard with owned/shared documents, recent sorting, full-content search, grid/list views, favorites, loading/error/empty states, and profile switching.
- Create, rename, duplicate, export, and delete documents; Trash supports restoration and explicit permanent deletion.
- Four editable starter templates: blank, project brief, meeting notes, and brainstorm.
- TipTap editor: bold, italic, underline, strikethrough, code, H1–H3, paragraphs, bullets, numbered lists, blockquotes, alignment, undo/redo, and clear formatting.
- Autosave after an 850 ms pause, serialized saves, manual save / Ctrl or Cmd + S, save status, last-saved time, and local recovery drafts.
- Optimistic concurrency checks reject stale edits with HTTP 409 rather than silently replacing another person’s work.
- TXT / Markdown imports with drag-and-drop, UTF-8 validation, extension/size checks, and basic Markdown preservation.
- Email-address-based sharing with registered demo users, editor/viewer permissions, role changes, collaborator lists, and revocation.
- Server-side permission checks for every document operation.
- Restricted copyable links, Markdown export, word/character counts, document outline, and writing zoom.
- Responsive desktop/tablet/mobile layouts, keyboard focus indicators, focus-trapped dialogs, and reduced-motion support.

## Technology

| Layer          | Implementation                                             |
| -------------- | ---------------------------------------------------------- |
| Application    | Next.js 16 App Router, React 19, TypeScript                |
| Styling        | Tailwind CSS 4 plus a custom CSS design system             |
| Editor         | TipTap 3 / ProseMirror                                     |
| Icons / type   | Lucide React / self-hosted DM Sans (SIL Open Font License) |
| Backend        | Node.js Next.js route handlers                             |
| Persistence    | PostgreSQL, Drizzle ORM, node-postgres                     |
| Validation     | Zod and bounded rich-text document validation              |
| Authentication | scrypt password hashes, opaque HTTP-only cookie sessions   |
| API tests      | Python 3 + pytest, standard-library HTTP client            |
| Browser tests  | Playwright / Chromium                                      |

## Prerequisites

- Node.js 22 LTS and npm.
- PostgreSQL 16+ locally, or Docker with Docker Compose.
- Python 3.10+ with pip and venv for API tests.
- Linux browser tests may require OS dependencies; Playwright can install them.

## Installation and environment

1. Clone this repository and enter its root.
2. Install the locked dependency tree: `npm ci`.
3. Copy `.env.example` to `.env` and set `DATABASE_URL`.
4. Start a local database: `docker compose up -d db`.
5. Apply the schema: `node scripts/migrate.mjs` (idempotent; `npx drizzle-kit push` also works in development).
6. Start the app: `npm run dev`.
7. Open `http://localhost:3000`.

The provided Compose database uses the intentionally public local-development account `postgres` / `postgres`, database `app_db`, bound only to localhost, with a named persistence volume. **Do not reuse that password in production.** If a local PostgreSQL service is already listening on port 5432, use it instead of starting Compose.

Environment variables:

| Variable                  | Purpose                                                                              |
| ------------------------- | ------------------------------------------------------------------------------------ |
| `DATABASE_URL`            | Required PostgreSQL connection string; server-side only                              |
| `DEMO_MODE`               | Defaults to enabled. `false` disables automatic seeding and first-visit demo sign-in |
| `NEXT_TELEMETRY_DISABLED` | Set to `1` to disable Next.js telemetry                                              |
| `BASE_URL`                | Optional test target; defaults to localhost:3000                                     |

For HTTPS-only deployments, set `SESSION_COOKIE_SECURE=true` to force Secure cookies even for non-browser API clients. Local HTTP development leaves this unset. HTTPS browser Origins are verified and detected automatically, including behind proxies that mask the original request scheme.

Do not expose `DATABASE_URL` with a `NEXT_PUBLIC_` prefix. The database configuration reads the same environment variable in both the app and Drizzle CLI.

### Frontend and backend startup

This is an integrated application: **`npm run dev` starts both the React frontend and the HTTP backend.** No Python application server or second port is necessary. The backend listens under `/api` on the same origin, avoiding cross-origin cookie configuration.

Production build and start: see `DEPLOYMENT.md`. `GET /api/health` performs a real PostgreSQL query.

## Demo accounts

| Name                   | Email                  | Password  |
| ---------------------- | ---------------------- | --------- |
| Abhay Chouhan          | `abhay@example.com`    | `demo123` |
| Alex Morgan (reviewer) | `reviewer@example.com` | `demo123` |

The first authenticated API interaction seeds both users and six example documents in one transaction protected by a PostgreSQL advisory lock. Returning to the app does **not** reset or recreate deleted documents.

On first visit, demo mode signs you into Abhay’s workspace. Switch via the profile menu or workspace selector. Signing out opens the real login form and suppresses automatic sign-in until you log in again.

**Sharing demonstration:** create a document as Abhay, click Share, invite `reviewer@example.com` with “Can edit”, then return to the dashboard and switch to Alex. The new document appears in “Shared with me”. Switch back to Abhay to change the permission to “Can view” or revoke it.

Invitations grant database access immediately; **no email is sent**. Collaborator avatars show people with permission, not live presence.

## API documentation

All paths below are relative to `/api`. Except login, logout, and health, requests require a valid `collabdocs_session` cookie. Login sets an HTTP-only, SameSite=Lax, 7-day cookie; HTTPS requests receive a Secure cookie. Successful JSON responses contain `document`, `documents`, `user`, or `ok`. Errors use `{ "error": "Human-readable message" }`.

| Method | Path                                     | Behavior                                                                           |
| ------ | ---------------------------------------- | ---------------------------------------------------------------------------------- |
| POST   | `/auth/login`                            | `{email,password}`; 200 sets session; 401 invalid credentials; 429 rate limit      |
| GET    | `/auth/session`                          | Current user; 401 without a valid session                                          |
| POST   | `/auth/logout`                           | Revoke current session and clear cookie                                            |
| GET    | `/users`                                 | Registered demo users (authenticated)                                              |
| GET    | `/documents`                             | Owned plus explicitly shared, non-trashed documents                                |
| GET    | `/documents?trash=true`                  | Current user’s trashed documents only                                              |
| POST   | `/documents`                             | Optional `{title,template,content,color}`; returns 201                             |
| GET    | `/documents/{id}`                        | Document, owner, collaborators, permission, favorite status, revision              |
| PUT    | `/documents/{id}`                        | `{title?,content?,revision?}`; owner/editor only                                   |
| DELETE | `/documents/{id}`                        | Owner-only soft deletion                                                           |
| DELETE | `/documents/{id}?permanent=true`         | Permanently remove an already-trashed document                                     |
| POST   | `/documents/{id}/restore`                | Owner-only restoration                                                             |
| POST   | `/documents/{id}/star`                   | `{starred:boolean}`; private per-user preference                                   |
| POST   | `/documents/{id}/share`                  | `{email,permission:"editor"                                                        | "viewer"}`; owner only; 201 |
| GET    | `/documents/{id}/shares`                 | Owner and existing collaborators                                                   |
| DELETE | `/documents/{id}/shares/{userId}`        | Owner-only revocation                                                              |
| POST   | `/documents/import`                      | Multipart form with `file`; `.txt` / `.md`, maximum 1 MiB; 201                     |
| GET    | `/assessment/download?file=package`      | Public assessment ZIP; fixed allowlist, no secrets; disabled when demo mode is off |
| GET    | `/assessment/download?file=submission`   | Submission Markdown, enforced below 1,000 lines                                    |
| GET    | `/assessment/download?file=video-script` | Four-minute recording outline; also `video-url` for the pending link file          |
| GET    | `/health`                                | Database connectivity; 200 / 500                                                   |

Rich text is TipTap JSON with root type `doc`. Include the last retrieved integer `revision` whenever saving `content`; it is required. Title-only clients should also include `revision` to detect concurrent changes. A stale revision returns 409. Private or inaccessible documents return 404 to avoid disclosing their existence; known viewers attempting edits receive 403.

Validation responses: 400 invalid input or malformed content; 413 oversized files/content; 415 unsupported import extension. Supported import formatting: headings, paragraphs, basic bold/italic/strike/code marks, flat lists, blockquotes, fenced code, and horizontal rules. HTML in imports remains literal text, not executable markup. Nested Markdown, links, images, and tables are deliberately out of scope.

## Automated verification

With the app running and demo mode enabled:

- Create a virtual environment: `python3 -m venv .venv`.
- Install API-test requirements: `.venv/bin/pip install -r tests/requirements.txt`.
- Run API tests: `.venv/bin/python -m pytest -q tests/test_api.py`.
- Install the browser: `npx playwright install --with-deps chromium`.
- Run browser tests: `npx playwright test`.

On Windows, use `.venv\\Scripts\\python` / `.venv\\Scripts\\pip`. Debian/Ubuntu may need `python3-venv` installed before creating the environment.

The pytest suite covers creation, retrieval, rich-text preservation, updates, stale saves, anonymous/private access, sharing, viewer restrictions, revocation, imports and invalid files, per-user stars, Trash/restoration, and malformed input. Tests also verify secure cookie flags behind a TLS-terminating proxy and reject cross-site mutations. Tests create and remove their own documents. Browser tests exercise real desktop and mobile flows, changes during an in-flight save, stale-version conflict recovery, and editing with local storage blocked. They save screenshots under ignored `artifacts/`; verified submission copies live in `public/screenshots/`. Reviewer tests also verify real ZIP/Markdown downloads, archive contents and hashes, secret exclusion, the submission line limit, and guide-to-editor/import actions.

Run browser tests against a seeded assessment database. Tests tolerate additional reviewer-created documents and clean up only their own fixtures. Avoid concurrently editing the named seed documents during tests; screenshots reflect the current workspace.

Compile checks: `npx next typegen`, `npm exec tsc -- --noEmit --pretty false`, and `npm run build`. Dependency check: `npm audit --omit=dev`. Development-tool advisories are separate from runtime dependencies and should be reviewed periodically.

## Deployment

Step-by-step instructions are in `DEPLOYMENT.md`. In short:

- **What is deployed:** one web service (frontend and backend API together) and one PostgreSQL database.
- **Render (recommended):** push this folder to a GitHub repository, then Render Dashboard → New → Blueprint → choose the repository. `render.yaml` creates both pieces and connects them.
- **Any Node 22 host:** build with `npm ci --include=dev && npm run build`; start with `node scripts/migrate.mjs && npm run start`. Set `DATABASE_URL` (needed at build time too) and `SESSION_COOKIE_SECURE=true`.
- **Docker:** `docker build -t collabdocs .`, then run with `DATABASE_URL` set. The image applies the schema on start.
- **Schema:** `scripts/migrate.mjs` applies `scripts/schema.sql`. It is idempotent, so it runs on every start.
- **Health check:** `GET /api/health` runs a real database query.

Serverless hosts such as Vercel are not supported as-is: the source-download endpoint reads repository files from disk, and login rate limiting is held in process memory.

`DEPLOYMENT.md` ends with what was verified and what was not. No external deployment is claimed until you create one.

**Private production use needs more work:** disable demo seeding, remove the public demo accounts, add real account provisioning, and move rate limiting to a shared store. See `ARCHITECTURE.md`.

## Project structure

- `src/app/` — pages, root layout, global design system, API route entrypoints.
- `src/components/` — dashboard, editor, dialogs, shared UI, workspace/session provider.
- `src/hooks/use-autosave.ts` — debounced save queue and recovery drafts.
- `src/lib/` — API service, authentication, seed data, validation/conversion, client helpers, types.
- `src/db/` — PostgreSQL client and complete Drizzle schema.
- `tests/` — pytest API/archive integration tests and Playwright workflow/reliability/reviewer tests.
- `examples/` — safe reviewer Markdown import sample.
- `public/screenshots/` — verified UI evidence included in the handoff.
- `public/` — locally served logo and licensed variable font.
- `render.yaml`, `Dockerfile`, `compose.yaml` — Render Blueprint, container build, and local development database.
- `scripts/` — idempotent schema (`schema.sql`) and the migration script run before each start.
- `DEPLOYMENT.md` — step-by-step deployment guide.
- `ARCHITECTURE.md`, `AI_WORKFLOW.md`, `SUBMISSION.md` — assessment documentation.
