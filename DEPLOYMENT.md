# Deploying CollabDocs

## What gets deployed

CollabDocs is **one web service plus one database**:

| Piece       | What it is                                                                          | Where it comes from |
| ----------- | ----------------------------------------------------------------------------------- | ------------------- |
| Web service | The Next.js app. It serves the React frontend **and** the backend API under `/api`. | This repository     |
| Database    | PostgreSQL 13 or newer                                                              | Created by the host |

There is no separate frontend and backend to deploy. One build, one start command, one URL.

## Option A — Render (recommended, free)

`render.yaml` in this repository tells Render to create both pieces and connect them.

### Step 1. Put the code on GitHub

1. Create an empty repository at <https://github.com/new>, for example `collabdocs`. Do not add a README or `.gitignore`.
2. In a terminal, from the extracted `CollabDocs` folder:

```bash
git init
git add .
git commit -m "CollabDocs: collaborative document editor"
git branch -M main
git remote add origin https://github.com/YOUR-USERNAME/collabdocs.git
git push -u origin main
```

Check on GitHub that `render.yaml`, `package.json`, `scripts/` and `src/` are at the top level of the repository.

### Step 2. Create the service and database on Render

1. Sign in at <https://dashboard.render.com> (signing in with GitHub is simplest).
2. Click **New**, then **Blueprint**.
3. Connect your GitHub account if asked, and choose the `collabdocs` repository.
4. Render reads `render.yaml` and lists two resources: the web service `collabdocs` and the database `collabdocs-db`. Confirm to create them.
5. Wait until the database is available and the web service shows as live. The first build takes several minutes.

### Step 3. Check the deployment

Open the service URL shown in Render (it looks like `https://collabdocs.onrender.com`; Render adds a suffix if the name is taken).

1. `https://YOUR-URL/api/health` should return `{"ok":true}`.
2. The home page should open signed in as Abhay Chouhan with six sample documents.
3. Create a document, type something, wait for "All changes saved", and refresh. The text should still be there.
4. Share it with `reviewer@example.com`, switch account from the avatar menu, and open it under "Shared with me".
5. Open **Assessment guide** and download the source ZIP.

### Step 4. Record the URL

Put the live URL in `README.md` and `SUBMISSION.md`, where it is marked pending, then commit and push. Render redeploys automatically on each push.

### Render free plan limits

- The web service sleeps after 15 minutes without traffic. The next visit takes about a minute to wake it. Open the URL shortly before reviewers do.
- The free database expires 30 days after creation.
- A workspace can have only one free database. If you already have one, use the external database variant below.

### Variant: Render web service with an external database

Use this if you already have a free Render database, or want one that does not expire.

1. Create a free PostgreSQL database with a provider such as Neon, and copy its connection string. It should end with `?sslmode=require`.
2. In `render.yaml`, delete the whole `databases:` block, and replace the `DATABASE_URL` entry with:

```yaml
- key: DATABASE_URL
  sync: false
```

3. Commit, push, and create the Blueprint as in Step 2. Render asks for the `DATABASE_URL` value during creation.

## Option B — Any Node 22 host

Use these settings on a host that runs a long-lived Node process (for example Railway or a VM).

| Setting           | Value                                       |
| ----------------- | ------------------------------------------- |
| Node version      | 22 (see `.node-version`)                    |
| Build command     | `npm ci --include=dev && npm run build`     |
| Start command     | `node scripts/migrate.mjs && npm run start` |
| Health check path | `/api/health`                               |
| Port              | The app listens on `$PORT` (default 3000)   |

The start command applies the schema, then starts the server. The schema step is idempotent, so it is safe on every start.

## Option C — Docker

```bash
docker build -t collabdocs .
docker run --rm -p 3000:3000 \
  -e DATABASE_URL='postgresql://USER:PASSWORD@HOST:5432/DATABASE' \
  -e SESSION_COOKIE_SECURE=true \
  collabdocs
```

The image applies the schema on start. Put HTTPS in front of it; with `SESSION_COOKIE_SECURE=true` the login cookie is only sent over HTTPS. For a plain-HTTP local test, leave that variable out.

## Environment variables

| Variable                | Required                           | Purpose                                                                                                                                                |
| ----------------------- | ---------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `DATABASE_URL`          | Yes, at build time and at run time | PostgreSQL connection string. Never give it a `NEXT_PUBLIC_` prefix.                                                                                   |
| `SESSION_COOKIE_SECURE` | Set to `true` on HTTPS hosts       | Marks the session cookie Secure. Leave unset for local HTTP.                                                                                           |
| `DEMO_MODE`             | Optional, defaults to on           | Seeds the two demo accounts and sample documents, signs first-time visitors in, and enables the source download. Set to `false` to turn all three off. |
| `NODE_VERSION`          | Render only                        | Pins Node 22.                                                                                                                                          |
| `NEXT_OUTPUT`           | Docker only                        | `standalone`, set inside the Dockerfile. Do not set it elsewhere.                                                                                      |
| `MIGRATE_ATTEMPTS`      | Optional                           | How many times the schema step retries while the database starts (default 10, three seconds apart).                                                    |

## What a deployed demo exposes

This is an assessment demo, so with `DEMO_MODE` on:

- The two demo logins are public. Anyone with the URL can sign in and edit the demo documents.
- `/api/assessment/download` serves this repository's source and documents to anyone, without signing in. It never includes `.env`, database contents or sessions.

Do not store anything private in a demo deployment.

## Not supported as-is

Serverless hosts such as Vercel. The source-download endpoint reads repository files from disk at run time, and login rate limiting is held in process memory. Both assume one long-lived Node process.

## Troubleshooting

| Symptom                                                                    | Likely cause and fix                                                                         |
| -------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------- |
| Build fails with a missing `typescript`, `tailwindcss` or `postcss` module | Dev dependencies were skipped. Use `npm ci --include=dev` as the install step.               |
| Build fails with `DATABASE_URL is required`                                | The variable is not available during the build. Set it for the build as well as the runtime. |
| Start log shows `[migrate] Database not ready` and then fails              | The database is still starting or the URL is wrong. Check `DATABASE_URL`, then redeploy.     |
| Start log shows `[migrate] Failed: ... SSL` or a connection reset          | An external database needs TLS. Add `?sslmode=require` to the URL.                           |
| Login appears to work but the next page is signed out                      | `SESSION_COOKIE_SECURE=true` on a plain-HTTP URL. Use HTTPS, or unset it for local testing.  |
| Saving returns "Request origin is not allowed"                             | A proxy is rewriting the `Host` header. Forward the original `Host`, or `X-Forwarded-Host`.  |
| First visit takes about a minute                                           | A free Render service waking from sleep.                                                     |

## What was verified, and what was not

Verified in the authoring sandbox (Node 22.23, PostgreSQL 15):

- `scripts/schema.sql` creates the same columns, constraints and indexes as the database the app was developed against, and running it twice changes nothing.
- The downloadable source ZIP, extracted into an empty directory, installs and builds with `npm ci --include=dev && npm run build` under `NODE_ENV=production`.
- `node scripts/migrate.mjs && npm run start` on an empty database creates the schema, starts cleanly, and seeds the demo data on the first request. All 9 pytest API tests pass against that instance.
- The Docker runtime layout, reproduced without Docker: a standalone build with a placeholder `DATABASE_URL`, the same files the Dockerfile copies, started with `node scripts/migrate.mjs && node server.js`. All 9 API tests pass against it.

Not verified:

- **No deployment was made on Render or any other external host.** `render.yaml` follows Render's Blueprint documentation but has not been run by Render. Whether the build fits the free plan's memory is untested.
- **The Docker image was never built.** Docker was not available, so the Alpine base image and the non-root user are untested.
- An external database over TLS (`?sslmode=require`).
- Secure cookies behind Render's proxy. They were verified behind the sandbox's HTTPS proxy only.
- The Playwright browser tests were run against the sandbox preview, not against the rehearsal instances.
