import type { RichNode } from "./types";
import { toMarkdown } from "./content";
export class RequestError extends Error {
  constructor(
    message: string,
    public status: number,
  ) {
    super(message);
  }
}
export async function api<T>(
  path: string,
  options: RequestInit = {},
): Promise<T> {
  const response = await fetch(`/api${path}`, {
    ...options,
    credentials: "same-origin",
    headers: {
      ...(options.body && !(options.body instanceof FormData)
        ? { "Content-Type": "application/json" }
        : {}),
      ...options.headers,
    },
    cache: "no-store",
  });
  const data = await response.json().catch(() => ({
    error: "Couldn’t reach the workspace. Please try again.",
  }));
  if (!response.ok)
    throw new RequestError(
      data.error || "Something went wrong.",
      response.status,
    );
  return data as T;
}
export function relativeDate(value: string) {
  const hours = Math.max(
    0,
    Math.floor((Date.now() - new Date(value).getTime()) / 3600000),
  );
  if (!hours) return "Just now";
  if (hours < 24) return `${hours} ${hours === 1 ? "hour" : "hours"} ago`;
  const days = Math.floor(hours / 24);
  if (days === 1) return "Yesterday";
  if (days < 7) return `${days} days ago`;
  return new Date(value).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
  });
}
export type AssessmentDownload =
  "package" | "submission" | "video-script" | "video-url";
export async function downloadAssessment(file: AssessmentDownload) {
  const response = await fetch(`/api/assessment/download?file=${file}`, {
    cache: "no-store",
    credentials: "same-origin",
  });
  if (!response.ok) {
    const data = await response.json().catch(() => ({}));
    throw new RequestError(
      data.error || "The download failed. Please try again.",
      response.status,
    );
  }
  const blob = await response.blob();
  const filenames = {
    package: "CollabDocs-submission.zip",
    submission: "SUBMISSION.md",
    "video-script": "WALKTHROUGH_SCRIPT.md",
    "video-url": "WALKTHROUGH_VIDEO_URL.txt",
  };
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filenames[file];
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
export function exportDocument(title: string, content: RichNode) {
  const blob = new Blob([toMarkdown(content)], {
    type: "text/markdown;charset=utf-8",
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `${title.replace(/[<>:"/\\|?*]/g, "-") || "document"}.md`;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
