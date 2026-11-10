# AI-assisted development workflow

## Tools used

Claude, Anthropic’s AI model, implemented and reviewed this application through a browser-based coding workspace, using the provided repository file tools, shell execution, npm package tooling, web documentation search, and platform-managed build/start tool. Playwright/Chromium and Python/pytest supplied executable feedback. No external coding-agent service, generated cloud backend, or image-generation service is implied.

Official TipTap documentation was consulted for Next.js SSR integration and editor initialization. The variable font was downloaded from Google Fonts and is served locally with its SIL Open Font License. Document illustrations are CSS and inline SVG, not stock images or remote assets.

## How AI assisted

- Translated the assessment’s feature set into a concrete interface and permission model.
- Designed a consistent warm-neutral/coral UI with reusable document previews, templates, dialogs, and responsive layouts.
- Wrote the Drizzle schema, transactional demo seed, authenticated REST dispatcher, and client API helpers.
- Implemented TipTap editing and a serialized, generation-aware autosave queue rather than independent fire-and-forget writes.
- Added safe text/Markdown import, account switching, access management, and per-user favorites.
- Produced pytest API tests and browser tests that interact with the real application.
- Wrote configuration and documentation explaining the actual stack and operational limits.
- Aligned the handoff to Ajaia’s exact deliverables: a requirement guide, safe source ZIP with integrity manifest, candidate metadata, sample import, screenshots, recording outline, and explicit pending external links.

## Important human-readable decisions

The hosting environment requires Next.js and PostgreSQL through Drizzle. The company’s revised brief permits any practical stack, so the implementation follows that hosting requirement without adding a disconnected framework merely for appearance.

Similarly, no Yjs/live presence connection was invented. Shared editing is protected by version checks, with explicit conflict recovery and honest documentation. Avatars mean granted access, not online presence. Invitation messages do not claim to send actual email.

## Reference judgment

The supplied reference list was treated as optional inspiration, not a feature checklist. Vercel’s official Web Interface Guidelines were consulted for focus visibility, semantic labels, skip navigation, dialog scrolling, and reduced motion. Playwright supplied executable browser verification. The existing restrained visual system was retained instead of importing unrelated animation libraries or copying unrelated repositories. No fake assessment countdown, company logo, Drive connection, or video link was added.

## Generated approaches modified or rejected

1. **Flat content storage was rejected.** TipTap JSONB preserves headings, marks, and lists on refresh and avoids maintaining divergent HTML and plaintext copies.
2. **Uncoordinated autosave was rejected.** A debounce alone cannot prevent older in-flight responses from marking new edits saved. The implementation uses a serialized queue, generation counters, revisions, and local draft recovery.
3. **Frontend-only hiding was rejected.** The API independently checks ownership/share permissions, including direct URL requests and attempts to share/delete as a collaborator.
4. **Arbitrary Markdown HTML rendering was rejected.** A constrained converter produces validated nodes; raw HTML stays text.
5. **A font download assumption was corrected after visual inspection.** The initial Google Fonts response supplied a static black-weight font despite a variable-weight request. The actual variable WOFF2 file was downloaded, checked, and self-hosted.
6. **Gallery fade-in was removed after screenshot review.** Immediate card visibility gives a stable first paint and avoids partially transparent initial captures. Hover feedback remains.
7. **A browser-test search assumption was corrected.** Searching “Website” matched both a title and meeting-note contents; the test now uses an unambiguous full title instead of incorrectly weakening content search.
8. **Inherited vulnerable dependencies were updated.** The original Next.js package had a critical advisory. It and related runtime dependencies were upgraded, and production dependencies were audited again.
9. **Build-time demo configuration was changed to runtime resolution.** The root layout is dynamic so a container deployment does not freeze demo behavior from build-time environment values.

## Verification and debugging approach

- Built and bootstrapped the production runtime before pushing the fresh database schema.
- Applied the Drizzle schema to local PostgreSQL and exercised database-backed endpoints.
- Ran the pytest integration suite covering CRUD, formatted content preservation, stale-write rejection, private access, permission changes, revocation, safe imports, favorites, and Trash/restoration.
- Installed isolated Python tooling when the base environment lacked pytest/ensurepip.
- Installed Chromium OS libraries after the first browser launch identified a missing shared-library dependency. This was an environment failure, not an application failure, and was resolved before continuing.
- Reviewed real desktop/mobile screenshots for font weights, first paint, card layout, and horizontal overflow.
- Used browser interactions to test formatting preservation after reload, sharing with the second user, account switching, and mobile import.
- Kept compile/build validation separate from functional tests; a successful health check alone does not prove editor or authorization correctness.

- A strict ESLint pass surfaced synchronous state initialization in effects and a render-time ref assignment. These were refactored with lazy preferences, keyed account/document boundaries, and effect-based callback synchronization rather than disabled rules. Optional browser storage access was isolated so blocked storage does not prevent authentication or server persistence.
- The source and assessment documents were formatted for maintainability, and extra browser regression tests were added for save races, conflicts, and restricted browser storage.

- A final test against the actual HTTPS preview exposed a proxy that masked the TLS scheme. Secure cookie detection was corrected to use the already-validated browser Origin, an explicit deployment override was documented, and an automated regression test was added for cookie flags and cross-site request rejection.

- The company-aligned handoff was verified with 9 pytest tests and 6 Playwright tests, including archive hashes/secret exclusion, the 1,000-line submission limit, real downloads, mobile guide navigation, and guide-to-editor/import actions. A persisted reviewer document exposed a brittle six-item test assumption; the test was corrected and the document preserved.

- Deployment readiness was rehearsed rather than assumed: the source ZIP was extracted to an empty directory, built with the Render build command under `NODE_ENV=production`, and started with the Render start command against an empty database; the API tests were then run against that instance. The rehearsal exposed that the ZIP had relocated the screenshots, so it was not a faithful copy of the repository; that was corrected. Standalone output had been enabled globally, which conflicts with `next start`; it is now enabled only inside the Dockerfile. No deployment on an external host was performed, and the Docker image was not built.

Generated code was treated as an implementation draft, not as proof of correctness. Logs, database-backed assertions, browser interaction, screenshot inspection, and production compilation provided the evidence for accepting changes.

## Remaining review boundaries

This is an assessment/demo application with real persistence and permissions. Automated checks do not substitute for a full penetration test, distributed-system load testing, or a complete accessibility audit. Production identity, multi-instance abuse prevention, CRDT collaboration, and migration governance remain explicit future work.
