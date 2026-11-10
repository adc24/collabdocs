"use client";
import { useState } from "react";
import {
  ArrowRight,
  ArrowUpRight,
  Check,
  ChevronDown,
  ClipboardCheck,
  Download,
  FileText,
  FolderArchive,
  Link2,
  Loader2,
  Save,
  ShieldCheck,
  Upload,
  Users,
  Video,
} from "lucide-react";
import { downloadAssessment, type AssessmentDownload } from "@/lib/client";
import { Avatar, Modal } from "./ui";
import { useWorkspace } from "./workspace-provider";

const beats = [
  [
    "0:00–0:25",
    "The product decision",
    "Show the workspace and explain the focused five-capability scope.",
  ],
  [
    "0:25–1:15",
    "Write, save, reopen",
    "Create a document, format a heading and list, then refresh to show persistence.",
  ],
  [
    "1:15–1:45",
    "Bring existing work",
    "Import the sample Markdown file and point out the supported formats.",
  ],
  [
    "1:45–2:40",
    "Share across accounts",
    "Grant editor access, switch users, change to viewer, and revoke access.",
  ],
  [
    "2:40–4:00",
    "Engineering, AI, and tradeoffs",
    "Explain conflict-safe saves, verification, deliberate cuts, and the next small improvement.",
  ],
];

export function AssessmentGuide({
  onClose,
  onCreate,
  onImport,
  onShare,
  onShowDocuments,
  canShare,
}: {
  onClose: () => void;
  onCreate: () => void;
  onImport: () => void;
  onShare: () => void;
  onShowDocuments: () => void;
  canShare: boolean;
}) {
  const { notify, openSwitcher } = useWorkspace();
  const [downloading, setDownloading] = useState<AssessmentDownload | null>(
    null,
  );
  async function download(file: AssessmentDownload) {
    if (downloading) return;
    setDownloading(file);
    try {
      await downloadAssessment(file);
      notify(
        file === "package"
          ? "Source and handoff downloaded. Extract the ZIP before uploading to Drive."
          : "Assessment document downloaded.",
      );
    } catch (error) {
      notify(
        error instanceof Error
          ? error.message
          : "The download failed. Please try again.",
        "error",
      );
    } finally {
      setDownloading(null);
    }
  }
  const capabilities = [
    {
      icon: FileText,
      title: "Create & edit",
      description:
        "Rename a document. Write with headings, bold, italic, underline, and lists.",
      action: "Try the editor",
      onClick: onCreate,
    },
    {
      icon: Upload,
      title: "Import a file",
      description:
        "Turn a TXT or Markdown file into an editable document. Up to 1 MiB.",
      action: "Import a file",
      onClick: onImport,
    },
    {
      icon: Users,
      title: "Share with intent",
      description:
        "Separate owned and shared work. Grant editor or viewer access, then revoke it.",
      action: canShare ? "Try sharing" : "Create & share",
      onClick: canShare ? onShare : onCreate,
    },
    {
      icon: Save,
      title: "Save & reopen",
      description:
        "PostgreSQL persistence, automatic saves, recoverable drafts, and stale-edit protection.",
      action: "See documents",
      onClick: onShowDocuments,
    },
    {
      icon: ShieldCheck,
      title: "Engineering quality",
      description:
        "Validated inputs, real authentication, automated tests, and a documented deployment path.",
      action: "View package",
      onClick: () =>
        document
          .getElementById("submission-package")
          ?.scrollIntoView({ behavior: "smooth", block: "start" }),
    },
  ];
  const downloadButton = (file: AssessmentDownload) =>
    downloading === file ? (
      <Loader2 size={16} className="spin" />
    ) : (
      <Download size={16} />
    );
  return (
    <Modal
      wide
      className="assessment-modal"
      title="A focused product. A clear handoff."
      description="CollabDocs · AI-Native Full Stack Product Engineer"
      onClose={onClose}
      icon={<ClipboardCheck size={25} />}
    >
      <div className="assessment-candidate">
        <span>
          <small>PREPARED FOR AJAIA LLC</small>
          <strong>Abhay Chouhan</strong>
        </span>
        <span className="assessment-timebox">4–6 hour target scope</span>
      </div>
      <p className="assessment-intro">
        Five core capabilities, one working product. Try the actual workflows
        below—not a canned demo.
      </p>
      <ol className="capability-list">
        {capabilities.map((capability, index) => (
          <li key={capability.title}>
            <span className="capability-icon">
              <capability.icon size={19} strokeWidth={1.6} />
            </span>
            <div className="capability-copy">
              <h3>
                <span className="capability-index">0{index + 1}</span>
                {capability.title}
                <Check size={13} aria-label="Implemented" />
              </h3>
              <p>{capability.description}</p>
            </div>
            <button className="capability-action" onClick={capability.onClick}>
              {capability.action}
              <ArrowUpRight size={14} />
            </button>
          </li>
        ))}
      </ol>
      <section
        className="review-accounts"
        aria-label="Demo account credentials"
      >
        <div className="review-section-heading">
          <h3>Two accounts. One sharing flow.</h3>
          <button
            onClick={() => {
              onClose();
              openSwitcher();
            }}
          >
            Switch account
            <ArrowRight size={14} />
          </button>
        </div>
        <div className="review-account-grid">
          <div>
            <Avatar
              user={{ name: "Abhay Chouhan", color: "peach" }}
              size="small"
            />
            <span>
              <strong>abhay@example.com</strong>
              <small>Document owner · demo123</small>
            </span>
          </div>
          <div>
            <Avatar
              user={{ name: "Alex Morgan", color: "lavender" }}
              size="small"
            />
            <span>
              <strong>reviewer@example.com</strong>
              <small>Collaborator · demo123</small>
            </span>
          </div>
        </div>
      </section>
      <div className="tradeoff-grid">
        <section>
          <span className="tradeoff-label">DELIBERATE SCOPE CUT</span>
          <h3>Depth over feature count.</h3>
          <p>
            No live cursors, comments, DOCX conversion, or production identity
            system. Sharing is asynchronous, with explicit conflict recovery.
          </p>
        </section>
        <section>
          <span className="tradeoff-label">NEXT 2–4 HOURS</span>
          <h3>A small, useful next slice.</h3>
          <p>
            Add bounded version history with permission-checked restore and
            regression tests. Keep real-time CRDT editing out of scope.
          </p>
        </section>
      </div>
      <details className="walkthrough-details">
        <summary>
          <Video size={17} />
          <strong>Walkthrough recording outline</strong>
          <span>4 minutes</span>
          <ChevronDown size={15} />
        </summary>
        <div className="walkthrough-content">
          <ol>
            {beats.map(([time, title, description]) => (
              <li key={time}>
                <span>{time}</span>
                <div>
                  <strong>{title}</strong>
                  <p>{description}</p>
                </div>
              </li>
            ))}
          </ol>
          <button
            className="button button-secondary"
            disabled={Boolean(downloading)}
            onClick={() => void download("video-script")}
          >
            {downloadButton("video-script")}Download recording script
          </button>
          <p className="field-hint">
            No video has been recorded or uploaded by this app. Record the real
            product, then add its public link to the submission.
          </p>
        </div>
      </details>
      <section className="submission-package" id="submission-package">
        <div className="review-section-heading">
          <h3>
            <FolderArchive size={18} />
            Download the handoff
          </h3>
          <button
            onClick={async () => {
              try {
                await navigator.clipboard.writeText(window.location.origin);
                notify(
                  "Current preview URL copied. Check its availability before sharing.",
                );
              } catch {
                notify(
                  "Copy the current URL from your browser’s address bar.",
                  "error",
                );
              }
            }}
          >
            <Link2 size={14} />
            Copy preview URL
          </button>
        </div>
        <p>
          Source code, setup files, tests, screenshots, architecture, AI
          workflow notes, and the submission checklist. Actual environment
          secrets and database contents are excluded.
        </p>
        <div className="package-actions">
          <button
            className="button button-primary"
            disabled={Boolean(downloading)}
            onClick={() => void download("package")}
          >
            {downloadButton("package")}
            {downloading === "package"
              ? "Preparing source ZIP…"
              : "Download source & docs"}
          </button>
          <button
            className="button button-secondary"
            disabled={Boolean(downloading)}
            onClick={() => void download("submission")}
          >
            {downloadButton("submission")}SUBMISSION.md
          </button>
        </div>
        <div className="package-status">
          <span>
            <Check size={12} />
            Source & tests included
          </span>
          <span>
            <ShieldCheck size={12} />
            Secrets excluded
          </span>
          <span className="pending-status">Video & Drive links pending</span>
        </div>
        <p className="field-hint">
          Extract the ZIP, upload its contents to one Google Drive folder, add
          your recorded video link, and share the folder. This preview URL is
          not a promise of permanent hosting.
        </p>
      </section>
    </Modal>
  );
}
