import { promises as fs } from "node:fs";
import path from "node:path";
import { createHash } from "node:crypto";
import { zip } from "fflate";
import type { NextRequest } from "next/server";

// Only fixed, public assessment materials are downloadable. User documents,
// environment secrets, session data, and dependency directories are never read.
// These are intentional runtime reads from the public handoff allowlist. The
// Docker runner copies them explicitly; Turbopack must not trace the whole project.
const ROOT_FILES = [
  "README.md",
  "ARCHITECTURE.md",
  "AI_WORKFLOW.md",
  "SUBMISSION.md",
  "DEPLOYMENT.md",
  "WALKTHROUGH_SCRIPT.md",
  "WALKTHROUGH_VIDEO_URL.txt",
  "package.json",
  "package-lock.json",
  "tsconfig.json",
  "next.config.ts",
  "drizzle.config.ts",
  "playwright.config.ts",
  "postcss.config.mjs",
  "eslint.config.mjs",
  "compose.yaml",
  "render.yaml",
  "Dockerfile",
  ".dockerignore",
  ".gitignore",
  ".env.example",
  ".node-version",
];
const INDIVIDUAL_FILES: Record<
  string,
  { path: string; filename: string; type: string }
> = {
  submission: {
    path: "SUBMISSION.md",
    filename: "SUBMISSION.md",
    type: "text/markdown; charset=utf-8",
  },
  "video-script": {
    path: "WALKTHROUGH_SCRIPT.md",
    filename: "WALKTHROUGH_SCRIPT.md",
    type: "text/markdown; charset=utf-8",
  },
  "video-url": {
    path: "WALKTHROUGH_VIDEO_URL.txt",
    filename: "WALKTHROUGH_VIDEO_URL.txt",
    type: "text/plain; charset=utf-8",
  },
};
const headers = (filename: string, type: string) => ({
  "Content-Type": type,
  "Content-Disposition": `attachment; filename="${filename}"`,
  "Cache-Control": "no-store",
  "X-Content-Type-Options": "nosniff",
});

async function collectTree(
  directory: string,
  entries: Record<string, Uint8Array>,
  budget: { bytes: number; files: number },
) {
  const directoryEntries = await fs.readdir(
    /*turbopackIgnore: true*/ directory,
    { withFileTypes: true },
  );
  for (const entry of directoryEntries.sort((a, b) =>
    a.name.localeCompare(b.name),
  )) {
    if (
      entry.isSymbolicLink() ||
      entry.name.startsWith(".env") ||
      [
        "node_modules",
        ".next",
        "__pycache__",
        ".pytest_cache",
        ".git",
      ].includes(entry.name) ||
      entry.name.endsWith(".pyc")
    )
      continue;
    const absolute = path.join(/*turbopackIgnore: true*/ directory, entry.name);
    const relative = path
      .relative(process.cwd(), absolute)
      .split(path.sep)
      .join("/");
    if (entry.isDirectory()) {
      await collectTree(absolute, entries, budget);
      continue;
    }
    if (!entry.isFile()) continue;
    const bytes = await fs.readFile(/*turbopackIgnore: true*/ absolute);
    budget.bytes += bytes.byteLength;
    budget.files++;
    if (budget.bytes > 12_000_000 || budget.files > 400)
      throw new Error("Assessment source exceeds the safe export budget.");
    entries[`CollabDocs/${relative}`] = new Uint8Array(bytes);
  }
}

async function sourceArchive() {
  const entries: Record<string, Uint8Array> = {};
  const budget = { bytes: 0, files: 0 };
  for (const file of ROOT_FILES) {
    const bytes = await fs.readFile(
      /*turbopackIgnore: true*/ path.join(
        /*turbopackIgnore: true*/ process.cwd(),
        file,
      ),
    );
    entries[`CollabDocs/${file}`] = new Uint8Array(bytes);
    budget.bytes += bytes.byteLength;
    budget.files++;
  }
  for (const directory of ["src", "tests", "public", "examples", "scripts"])
    await collectTree(
      path.join(/*turbopackIgnore: true*/ process.cwd(), directory),
      entries,
      budget,
    );
  const manifest = {
    project: "CollabDocs",
    assessment: "Ajaia LLC — AI-Native Full Stack Product Engineer",
    candidate: "Abhay Chouhan",
    generatedAt: new Date().toISOString(),
    contents: Object.entries(entries).map(([file, bytes]) => ({
      path: file,
      bytes: bytes.byteLength,
      sha256: createHash("sha256").update(bytes).digest("hex"),
    })),
    excluded: [
      "Actual .env files and credentials",
      "node_modules and build output",
      "Database contents and user sessions",
      "Private documents and uploads",
    ],
    walkthrough:
      "Not recorded or uploaded by this application. See WALKTHROUGH_VIDEO_URL.txt and WALKTHROUGH_SCRIPT.md.",
  };
  entries["CollabDocs/MANIFEST.json"] = new TextEncoder().encode(
    JSON.stringify(manifest, null, 2),
  );
  const archive = await new Promise<Uint8Array>((resolve, reject) => {
    zip(entries, { level: 6 }, (error, data) =>
      error ? reject(error) : resolve(data),
    );
  });
  return new Blob([Uint8Array.from(archive)], { type: "application/zip" });
}

export async function assessmentDownload(
  request: NextRequest,
): Promise<Response> {
  if (process.env.DEMO_MODE === "false")
    return Response.json(
      { error: "Assessment downloads are disabled." },
      { status: 404 },
    );
  const file = request.nextUrl.searchParams.get("file") || "package";
  if (file === "package")
    return new Response(await sourceArchive(), {
      headers: headers("CollabDocs-submission.zip", "application/zip"),
    });
  if (!Object.hasOwn(INDIVIDUAL_FILES, file))
    return Response.json(
      { error: "Choose a valid assessment download." },
      { status: 400 },
    );
  const item = INDIVIDUAL_FILES[file];
  const text = await fs.readFile(
    /*turbopackIgnore: true*/ path.join(
      /*turbopackIgnore: true*/ process.cwd(),
      item.path,
    ),
    "utf8",
  );
  if (file === "submission" && text.split("\n").length > 1000)
    throw new Error("Submission exceeds the assessment's 1000-line limit.");
  return new Response(text, { headers: headers(item.filename, item.type) });
}
