# CollabDocs — four-minute walkthrough recording outline

**Candidate:** Abhay Chouhan  
**Assessment:** Ajaia LLC — AI-Native Full Stack Product Engineer

This is a recording script, not a claim that a video has been produced. Record the actual running product, upload an unlisted Loom or public YouTube video, and replace the pending value in `WALKTHROUGH_VIDEO_URL.txt` and `SUBMISSION.md`.

## 0:00–0:25 — Frame the product

> “I built CollabDocs as a focused answer to Ajaia’s shared-work problem: create a document, shape an idea, bring in existing text, and share it with the right person. I prioritized a reliable end-to-end slice over recreating every Google Docs feature.”

Show the dashboard and open **Assessment guide** in the sidebar. Point out the five core capabilities and the deliberately bounded scope.

## 0:25–1:15 — Create, edit, save, reopen

1. Create a blank document and name it `Ajaia product review`.
2. Add a heading and a short paragraph. Apply bold, italic, and underline; add a bulleted or numbered list.
3. Point out the save indicator. Use Save or Ctrl/Cmd + S.
4. Return to the workspace, reopen the document, and refresh once to show persisted formatting.

> “The editor uses TipTap. PostgreSQL stores its structured JSON, so formatting survives reopening. Saves are debounced and serialized; a revision check prevents stale edits from silently overwriting a collaborator.”

## 1:15–1:45 — Import existing work

1. Open Import document.
2. Drop the included `examples/reviewer-notes.md` file, or a small UTF-8 Markdown file you create.
3. Show the converted heading, emphasis, and list in a new editable document.
4. Mention the visible limits: TXT and Markdown only, up to 1 MiB; no DOCX or executable HTML import.

## 1:45–2:40 — Demonstrate real sharing

1. Share the new document with `reviewer@example.com` as an editor.
2. Return to the dashboard. Switch to the reviewer account from the profile/avatar menu.
3. Open Shared with me and edit the document.
4. Switch back to the owner. Change the reviewer to Can view and show that editing is disabled.
5. Revoke access and explain that the server rejects the next direct request; hiding a button is not the permission boundary.

> “The two demo accounts use real database-backed sessions. Access is granted immediately; the product does not pretend to send email or show live presence.”

## 2:40–3:15 — Explain engineering judgment and AI use

Show the editor save status, then the architecture/AI notes or test output.

> “AI accelerated the interface, API scaffolding, and test cases. I rejected flat-text storage and uncoordinated autosave, added revision-based conflict recovery, and verified the result with pytest and Playwright. Screenshot review caught a font issue; testing against the HTTPS preview caught a proxy-related secure-cookie issue. Generated code was a starting point, not the acceptance criteria.”

Mention the actual stack: Next.js route handlers, React, TipTap, PostgreSQL, and Drizzle, deployed as one web service plus a database.

## 3:15–4:00 — Scope cuts and reviewer handoff

1. Show the assessment guide’s tradeoffs and download buttons.
2. Download the source ZIP and submission Markdown.
3. Explain that live cursors, comments, production identity, and complex document formats were intentionally deferred.
4. With another two to four hours, prioritize bounded version history with permission-checked restore and tests—not a broad feature expansion.
5. Point reviewers to README setup, seeded credentials, automated tests, and the submission checklist.

> “The goal is a small product that works end to end, with clear boundaries and evidence. The remaining external handoff steps are to record this walkthrough, upload the materials to one Drive folder, and provide a durable deployment URL.”

## Before uploading

- Verify the recording is 3–5 minutes and the sharing flow is visible.
- Use demo data only; do not record secrets or private documents.
- Replace both video-link placeholders with the actual URL.
- Test the video and Drive links in a signed-out browser.
- Do not claim a video, Drive folder, or permanent deployment exists before it does.
