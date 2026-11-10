# CollabDocs — Ajaia LLC assessment

**Candidate:** Abhay Chouhan  
**Email:** abhaydinakar246@gmail.com  
**Role:** AI-Native Full Stack Product Engineer  
**Assignment:** Full Stack Product Engineer — lightweight collaborative document editor

## Submission links

| Deliverable              | Location or status                                                                                            |
| ------------------------ | ------------------------------------------------------------------------------------------------------------- |
| Live product URL         | **Pending:** deploy with `DEPLOYMENT.md`, then paste the URL here                                             |
| Google Drive folder      | **Pending:** upload the extracted source ZIP and share one folder                                             |
| Walkthrough video        | **Pending:** record with `WALKTHROUGH_SCRIPT.md`, then paste the link here and in `WALKTHROUGH_VIDEO_URL.txt` |
| Source code              | This folder. Also downloadable from the running app: **Assessment guide → Download source & docs**            |
| Public source repository | **Pending:** the GitHub repository created in `DEPLOYMENT.md` step 1                                          |

## Demo accounts

| Account  | Email                  | Password  |
| -------- | ---------------------- | --------- |
| Owner    | `abhay@example.com`    | `demo123` |
| Reviewer | `reviewer@example.com` | `demo123` |

The first visit opens the owner workspace. Switch accounts from the avatar menu. These are seeded demo personas; no signup or paid service is needed.

## Requirements and where to see them

| Requirement                   | Status  | How to verify                                                                                                                             |
| ----------------------------- | ------- | ----------------------------------------------------------------------------------------------------------------------------------------- |
| Document creation and editing | Working | Create and rename a document; use bold, italic, underline, headings H1–H3, bulleted and numbered lists; save and reopen                   |
| File upload                   | Working | Import a `.txt` or `.md` file (UTF-8, up to 1 MiB) by drag-and-drop or browse; it becomes a new editable document                         |
| Sharing                       | Working | Owner grants editor or viewer access by email; owned and shared documents are listed separately; owner can revoke                         |
| Persistence                   | Working | PostgreSQL stores users, sessions, documents as structured rich-text JSON, shares and favorites; refresh keeps content and access         |
| Engineering quality           | Working | Input validation and error messages, server-side permission checks, automated tests, setup and deployment instructions, architecture note |

Open **Assessment guide** in the sidebar for shortcuts into each of these flows.

## What is included

- `src/` — the application: React frontend, API route handlers, authentication, editor, autosave, import, sharing, database schema.
- `tests/` — pytest API integration tests and Playwright browser tests.
- `scripts/` — idempotent database schema and the migration script run before each start.
- `render.yaml`, `Dockerfile`, `compose.yaml`, `.node-version` — deployment and local database configuration.
- `README.md` — local setup, environment, API reference, tests.
- `DEPLOYMENT.md` — step-by-step deployment, including what was and was not verified.
- `ARCHITECTURE.md` — priorities, design, permissions, save and conflict handling, limitations.
- `AI_WORKFLOW.md` — AI tools used, what was changed or rejected, how it was verified.
- `WALKTHROUGH_SCRIPT.md`, `WALKTHROUGH_VIDEO_URL.txt` — recording outline and the video link (pending).
- `public/screenshots/` — desktop and mobile dashboard, editor, sharing dialog, assessment guide.
- `examples/reviewer-notes.md` — a small file for trying the import.
- `MANIFEST.json` (in the ZIP only) — file list with sizes and SHA-256 hashes.

Not included: real `.env` files, `node_modules`, build output, database contents, sessions.

## Five-minute review path

1. Create a document named `Ajaia product review`. Add a heading, a formatted paragraph and a list. Refresh to confirm it persisted.
2. Import `examples/reviewer-notes.md`.
3. Share a document with `reviewer@example.com` as editor. Switch account and edit it from "Shared with me".
4. Switch back, change the reviewer to viewer, then revoke. The server enforces each change.
5. Open the assessment guide for scope decisions and the source download.

## Prioritization

- **One coherent flow first:** create, edit, save, import, share. Comments, live cursors and administration were left out.
- **Saves that do not lose work:** debounced, serialized writes with a revision check. A stale save is rejected and the draft is kept for download, instead of silently overwriting a collaborator.
- **Permissions on the server:** every document request checks ownership or an explicit share.
- **One deployable service:** a single Next.js application serves the frontend and the backend API, with PostgreSQL through Drizzle ORM. The editor is TipTap.

## Verification

- 9 pytest API integration tests and 6 Playwright browser tests pass against the production build.
- Coverage includes formatted-content round trips, unauthorized access, grants, role changes and revocation, import validation, save races and conflict recovery, blocked local storage, desktop and mobile flows, secure cookie flags, and the integrity of the source ZIP.
- Deployment rehearsal: the source ZIP was extracted to an empty directory, built with the Render build command, and started with the Render start command against an empty database. All 9 API tests passed against that instance.
- Not verified: an actual deployment on Render or any external host, and the Docker image, which could not be built in the authoring environment. Details are at the end of `DEPLOYMENT.md`.

Commands are in `README.md` under "Automated verification".

## Incomplete or deliberately deferred

- No live multi-user editing, cursors, presence, comments or suggestions. Sharing is asynchronous; avatars show who has access.
- No signup, password reset, identity provider or invitation email. Access is granted immediately to an existing account.
- No `.docx` or PDF import. Markdown import covers headings, emphasis, flat lists, quotes and code blocks; not tables, images or nested lists.
- No version history.
- Search and listing are sized for a small workspace, not a large indexed corpus.
- Local draft recovery uses browser storage on a best-effort basis.
- The live URL, video and Drive folder above are pending until they are created.

## With another 2–4 hours

Add document version history: a snapshot table, permission-checked history and restore endpoints, a small restore panel in the editor, and tests for unauthorized and stale restores. Real-time collaboration would stay out of scope until that is solid.
