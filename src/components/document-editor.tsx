"use client";
import { useEffect, useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { EditorContent, useEditor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import TextAlign from "@tiptap/extension-text-align";
import {
  AlignCenter,
  AlignJustify,
  AlignLeft,
  AlignRight,
  ArrowLeft,
  ArrowUpRight,
  Bold,
  Check,
  ChevronDown,
  CloudCheck,
  Code2,
  Download,
  FileText,
  Italic,
  List,
  ListOrdered,
  Loader2,
  LockKeyhole,
  MoreHorizontal,
  PanelLeft,
  Redo2,
  Save,
  Share2,
  Star,
  Strikethrough,
  TextQuote,
  Underline,
  Undo2,
  Users,
  WifiOff,
  WrapText,
  X,
} from "lucide-react";
import { api, exportDocument } from "@/lib/client";
import { plainText } from "@/lib/content";
import { useAutosave } from "@/hooks/use-autosave";
import type { DocumentRecord, RichNode } from "@/lib/types";
import { Avatar, EmptyIllustration, LoadingDots, Logo } from "./ui";
import { useWorkspace } from "./workspace-provider";
import { ShareDialog } from "./document-dialogs";

export default function DocumentLoader({ id }: { id: string }) {
  const { user } = useWorkspace();
  return <DocumentRequest key={`${id}-${user?.id}`} id={id} />;
}
function DocumentRequest({ id }: { id: string }) {
  const { user } = useWorkspace();
  const [doc, setDoc] = useState<DocumentRecord | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const router = useRouter();
  useEffect(() => {
    let active = true;
    api<{ document: DocumentRecord }>(`/documents/${id}`)
      .then((data) => {
        if (active) setDoc(data.document);
      })
      .catch((e) => {
        if (active) setError(e.message);
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [id, user?.id]);
  if (loading)
    return (
      <div className="editor-loading">
        <Logo />
        <LoadingDots />
        <p>Making a little room for your ideas…</p>
      </div>
    );
  if (error || !doc || !user)
    return (
      <div className="document-error">
        <Logo />
        <EmptyIllustration />
        <h1>This page is out of reach.</h1>
        <p>{error || "This document is no longer available."}</p>
        <button
          className="button button-primary"
          onClick={() => router.push("/")}
        >
          <ArrowLeft size={17} />
          Back to your workspace
        </button>
      </div>
    );
  return (
    <DocumentEditor
      key={`${doc.id}-${user.id}`}
      initial={doc}
      userId={user.id}
    />
  );
}
function DocumentEditor({
  initial,
  userId,
}: {
  initial: DocumentRecord;
  userId: string;
}) {
  const router = useRouter();
  const { setDocuments, notify } = useWorkspace();
  const [record, setRecord] = useState(initial);
  const [sharing, setSharing] = useState(false);
  const [outlineOpen, setOutlineOpen] = useState(true);
  const [menu, setMenu] = useState(false);
  const [zoom, setZoom] = useState(100);
  const [leaving, setLeaving] = useState(false);
  const readOnly = initial.permission === "viewer";
  const save = useAutosave(initial, userId, (doc) => {
    setDocuments((items) => items.map((d) => (d.id === doc.id ? doc : d)));
  });
  const editor = useEditor({
    extensions: [
      StarterKit.configure({ heading: { levels: [1, 2, 3] }, link: false }),
      TextAlign.configure({ types: ["heading", "paragraph"] }),
    ],
    content: save.initialContent,
    immediatelyRender: false,
    shouldRerenderOnTransaction: true,
    editable: !readOnly,
    editorProps: {
      attributes: {
        class: "collab-editor",
        spellcheck: "true",
        "aria-label": "Document content",
        "data-placeholder": "Let your thoughts find their way onto the page…",
      },
    },
    onUpdate: ({ editor }) => save.setContent(editor.getJSON() as RichNode),
  });
  async function goBack() {
    setLeaving(true);
    if (await save.saveNow()) router.push("/");
    else {
      notify(
        "Your draft is safe in this browser. Resolve the save issue before leaving.",
        "error",
      );
      setLeaving(false);
    }
  }
  async function star() {
    try {
      await api(`/documents/${record.id}/star`, {
        method: "POST",
        body: JSON.stringify({ starred: !record.starred }),
      });
      setRecord((d) => ({ ...d, starred: !d.starred }));
      setDocuments((items) =>
        items.map((d) =>
          d.id === record.id ? { ...d, starred: !record.starred } : d,
        ),
      );
    } catch (e) {
      notify(
        e instanceof Error ? e.message : "Couldn’t update favorite.",
        "error",
      );
    }
  }
  const text = editor?.getText() || "";
  const wordCount = text.trim() ? text.trim().split(/\s+/).length : 0;
  const headings = (
    editor?.getJSON().content ||
    initial.content.content ||
    []
  ).filter((n) => n.type === "heading");
  const savedLabel = readOnly
    ? "View only"
    : save.status === "saved"
      ? "All changes saved"
      : save.status === "saving"
        ? "Saving changes…"
        : save.status === "unsaved"
          ? "Unsaved changes"
          : save.status === "conflict"
            ? "Version conflict"
            : "Save needs attention";
  return (
    <div className="editor-shell">
      <header className="editor-header">
        <div className="editor-header-left">
          <button
            className="icon-button editor-back"
            onClick={() => void goBack()}
            disabled={leaving}
            aria-label="Back to workspace"
          >
            {leaving ? (
              <Loader2 size={19} className="spin" />
            ) : (
              <ArrowLeft size={20} />
            )}
          </button>
          <button
            className="editor-logo"
            onClick={() => void goBack()}
            aria-label="CollabDocs workspace"
          >
            <Logo small />
          </button>
          <span className="editor-header-divider" />
          <div className="editor-title-group">
            <div className="editor-title-row">
              <input
                aria-label="Document title"
                value={save.title}
                maxLength={160}
                disabled={readOnly}
                onChange={(e) => save.setTitle(e.target.value)}
                onBlur={() => {
                  if (!save.title.trim()) save.setTitle("Untitled document");
                }}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.currentTarget.blur();
                    editor?.commands.focus("start");
                  }
                }}
              />
              <button
                className={`icon-button ${record.starred ? "star-active" : ""}`}
                onClick={() => void star()}
                aria-label={
                  record.starred ? "Remove from starred" : "Star document"
                }
              >
                <Star size={17} />
              </button>
            </div>
            <div className="editor-document-meta">
              <span>My workspace</span>
              <span>/</span>
              <span>
                {record.ownerId === userId
                  ? "Owned by you"
                  : `Shared by ${record.owner.name.split(" ")[0]}`}
              </span>
              <span className="editor-meta-dot" />
              <span
                className={`save-status status-${save.status}`}
                title={`Last saved ${new Date(save.lastSaved).toLocaleString()}`}
              >
                {save.status === "saving" ? (
                  <Loader2 size={12} className="spin" />
                ) : ["error", "conflict"].includes(save.status) ? (
                  <WifiOff size={12} />
                ) : readOnly ? (
                  <LockKeyhole size={12} />
                ) : (
                  <CloudCheck size={13} />
                )}{" "}
                {savedLabel}
              </span>
            </div>
          </div>
        </div>
        <div className="editor-header-actions">
          <button
            className="editor-collaborators avatar-stack"
            onClick={() => setSharing(true)}
            aria-label="View collaborators"
          >
            <Avatar user={record.owner} size="small" />
            {record.collaborators.map((person) => (
              <Avatar user={person} size="small" key={person.id} />
            ))}
          </button>
          <button
            className="button button-secondary manual-save"
            title="Save document (Ctrl/⌘ + S)"
            disabled={readOnly || save.status === "saving"}
            onClick={async () => {
              if (await save.saveNow())
                notify("All your ideas are safely saved.");
            }}
          >
            <Save size={15} />
            <span>Save</span>
          </button>
          <button
            className="button button-primary"
            onClick={() => setSharing(true)}
          >
            <Users size={16} />
            <span>Share</span>
          </button>
          <div className="editor-more">
            <button
              className="icon-button"
              aria-label="Document actions"
              onClick={() => setMenu(!menu)}
            >
              <MoreHorizontal size={21} />
            </button>
            {menu && (
              <>
                <button
                  className="menu-dismiss"
                  aria-label="Close document actions"
                  onClick={() => setMenu(false)}
                />
                <div className="document-menu">
                  <button
                    onClick={() => {
                      exportDocument(save.title, save.latest.current.content);
                      setMenu(false);
                    }}
                  >
                    <Download size={16} />
                    Export as Markdown
                  </button>
                  <button
                    onClick={async () => {
                      try {
                        await navigator.clipboard.writeText(
                          window.location.href,
                        );
                        notify(
                          "Document link copied. Access is still restricted.",
                        );
                      } catch {
                        notify(
                          "Copy the URL from your browser’s address bar.",
                          "error",
                        );
                      }
                      setMenu(false);
                    }}
                  >
                    <Share2 size={16} />
                    Copy document link
                  </button>
                  <button
                    onClick={() => {
                      setOutlineOpen(!outlineOpen);
                      setMenu(false);
                    }}
                  >
                    <PanelLeft size={16} />
                    {outlineOpen ? "Hide" : "Show"} document outline
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      </header>
      <div className="editor-toolbar">
        <div className="toolbar-inner">
          <ToolbarButton
            label="Toggle document outline"
            active={outlineOpen}
            onClick={() => setOutlineOpen(!outlineOpen)}
          >
            <PanelLeft size={17} />
          </ToolbarButton>
          <span className="toolbar-separator" />
          <ToolbarButton
            label="Undo (Ctrl/⌘ + Z)"
            disabled={readOnly || !editor?.can().undo()}
            onClick={() => editor?.chain().focus().undo().run()}
          >
            <Undo2 size={17} />
          </ToolbarButton>
          <ToolbarButton
            label="Redo (Ctrl/⌘ + Shift + Z)"
            disabled={readOnly || !editor?.can().redo()}
            onClick={() => editor?.chain().focus().redo().run()}
          >
            <Redo2 size={17} />
          </ToolbarButton>
          <span className="toolbar-separator" />
          <div className="text-style-select">
            <select
              aria-label="Text style"
              disabled={readOnly || !editor}
              value={
                editor?.isActive("heading", { level: 1 })
                  ? "1"
                  : editor?.isActive("heading", { level: 2 })
                    ? "2"
                    : editor?.isActive("heading", { level: 3 })
                      ? "3"
                      : "paragraph"
              }
              onChange={(e) => {
                const v = e.target.value;
                if (v === "paragraph")
                  editor?.chain().focus().setParagraph().run();
                else
                  editor
                    ?.chain()
                    .focus()
                    .setHeading({ level: Number(v) as 1 | 2 | 3 })
                    .run();
              }}
            >
              <option value="paragraph">Normal text</option>
              <option value="1">Heading 1</option>
              <option value="2">Heading 2</option>
              <option value="3">Heading 3</option>
            </select>
            <ChevronDown size={13} />
          </div>
          <span className="toolbar-separator" />
          <ToolbarButton
            label="Bold (Ctrl/⌘ + B)"
            active={editor?.isActive("bold")}
            disabled={readOnly}
            onClick={() => editor?.chain().focus().toggleBold().run()}
          >
            <Bold size={17} />
          </ToolbarButton>
          <ToolbarButton
            label="Italic (Ctrl/⌘ + I)"
            active={editor?.isActive("italic")}
            disabled={readOnly}
            onClick={() => editor?.chain().focus().toggleItalic().run()}
          >
            <Italic size={17} />
          </ToolbarButton>
          <ToolbarButton
            label="Underline (Ctrl/⌘ + U)"
            active={editor?.isActive("underline")}
            disabled={readOnly}
            onClick={() => editor?.chain().focus().toggleUnderline().run()}
          >
            <Underline size={17} />
          </ToolbarButton>
          <ToolbarButton
            label="Strikethrough"
            active={editor?.isActive("strike")}
            disabled={readOnly}
            onClick={() => editor?.chain().focus().toggleStrike().run()}
          >
            <Strikethrough size={17} />
          </ToolbarButton>
          <ToolbarButton
            label="Inline code"
            active={editor?.isActive("code")}
            disabled={readOnly}
            onClick={() => editor?.chain().focus().toggleCode().run()}
          >
            <Code2 size={17} />
          </ToolbarButton>
          <span className="toolbar-separator" />
          <ToolbarButton
            label="Align left"
            active={editor?.isActive({ textAlign: "left" })}
            disabled={readOnly}
            onClick={() => editor?.chain().focus().setTextAlign("left").run()}
          >
            <AlignLeft size={17} />
          </ToolbarButton>
          <ToolbarButton
            label="Align center"
            active={editor?.isActive({ textAlign: "center" })}
            disabled={readOnly}
            onClick={() => editor?.chain().focus().setTextAlign("center").run()}
          >
            <AlignCenter size={17} />
          </ToolbarButton>
          <ToolbarButton
            label="Align right"
            active={editor?.isActive({ textAlign: "right" })}
            disabled={readOnly}
            onClick={() => editor?.chain().focus().setTextAlign("right").run()}
          >
            <AlignRight size={17} />
          </ToolbarButton>
          <ToolbarButton
            label="Justify text"
            active={editor?.isActive({ textAlign: "justify" })}
            disabled={readOnly}
            onClick={() =>
              editor?.chain().focus().setTextAlign("justify").run()
            }
          >
            <AlignJustify size={17} />
          </ToolbarButton>
          <span className="toolbar-separator" />
          <ToolbarButton
            label="Bulleted list"
            active={editor?.isActive("bulletList")}
            disabled={readOnly}
            onClick={() => editor?.chain().focus().toggleBulletList().run()}
          >
            <List size={18} />
          </ToolbarButton>
          <ToolbarButton
            label="Numbered list"
            active={editor?.isActive("orderedList")}
            disabled={readOnly}
            onClick={() => editor?.chain().focus().toggleOrderedList().run()}
          >
            <ListOrdered size={18} />
          </ToolbarButton>
          <ToolbarButton
            label="Blockquote"
            active={editor?.isActive("blockquote")}
            disabled={readOnly}
            onClick={() => editor?.chain().focus().toggleBlockquote().run()}
          >
            <TextQuote size={18} />
          </ToolbarButton>
          <span className="toolbar-separator" />
          <ToolbarButton
            label="Clear formatting"
            disabled={readOnly}
            onClick={() =>
              editor?.chain().focus().unsetAllMarks().clearNodes().run()
            }
          >
            <WrapText size={18} />
          </ToolbarButton>
          <span className="toolbar-right-label">
            {readOnly ? (
              <>
                <LockKeyhole size={13} />
                Viewing
              </>
            ) : (
              <>
                <span className="editing-dot" />
                Editing
              </>
            )}
          </span>
        </div>
      </div>
      {save.error && (
        <div className="save-error-banner" role="alert">
          <WifiOff size={17} />
          <span>{save.error}</span>
          <button
            onClick={() =>
              exportDocument(save.title, save.latest.current.content)
            }
          >
            <Download size={14} />
            Download draft
          </button>
          {save.status === "conflict" ? (
            <button onClick={save.discardDraft}>Discard draft & reload</button>
          ) : (
            <button onClick={() => void save.saveNow()}>Retry saving</button>
          )}
        </div>
      )}
      {readOnly && (
        <div className="read-only-banner">
          <LockKeyhole size={14} />
          You have view-only access. Ask the document owner for permission to
          edit.
        </div>
      )}
      <div className={`editor-workspace ${outlineOpen ? "with-outline" : ""}`}>
        {outlineOpen && (
          <aside className="document-outline">
            <div className="outline-title">
              <span>IN THIS DOCUMENT</span>
              <button
                className="icon-button"
                onClick={() => setOutlineOpen(false)}
                aria-label="Hide outline"
              >
                <X size={14} />
              </button>
            </div>
            {headings.length ? (
              headings.map((heading, i) => (
                <button
                  key={i}
                  className={`outline-link level-${heading.attrs?.level || 1}`}
                  onClick={() =>
                    document
                      .querySelectorAll(
                        ".collab-editor h1, .collab-editor h2, .collab-editor h3",
                      )
                      [i]?.scrollIntoView({
                        behavior: "smooth",
                        block: "center",
                      })
                  }
                >
                  {plainText(heading as RichNode)}
                </button>
              ))
            ) : (
              <p className="outline-empty">
                Your headings will find a home here as your ideas take shape.
              </p>
            )}
            <div className="outline-tip">
              <SparkleIcon />
              <p>
                A little focus.
                <br />A lot of possibility.
              </p>
            </div>
          </aside>
        )}
        <main className="writing-surface" id="main-content" tabIndex={-1}>
          <div className="page-top-label">
            <span>
              <FileText size={13} />{" "}
              {readOnly ? "READING SPACE" : "YOUR WRITING SPACE"}
            </span>
            <span>
              Private document <LockKeyhole size={11} />
            </span>
          </div>
          <div className="writing-page" style={{ zoom: zoom / 100 }}>
            {editor ? (
              <EditorContent editor={editor} />
            ) : (
              <div className="editor-initializing">
                <LoadingDots />
              </div>
            )}
          </div>
          <div className="page-bottom-note">
            A thought, a sentence, a possibility. Keep going.
          </div>
        </main>
      </div>
      <footer className="editor-footer">
        <div>
          <span>{wordCount.toLocaleString()} words</span>
          <i />
          <span>{text.length.toLocaleString()} characters</span>
          <span className="editor-footer-owner">
            <i />
            Made for thinking clearly.
          </span>
        </div>
        <div>
          <span className="last-saved">
            Last saved{" "}
            {new Date(save.lastSaved).toLocaleTimeString([], {
              hour: "numeric",
              minute: "2-digit",
            })}
          </span>
          <span className="footer-divider" />
          <select
            aria-label="Document zoom"
            value={zoom}
            onChange={(e) => setZoom(Number(e.target.value))}
          >
            {[80, 90, 100, 110, 125].map((n) => (
              <option key={n} value={n}>
                {n}%
              </option>
            ))}
          </select>
        </div>
      </footer>
      {sharing && (
        <ShareDialog
          document={record}
          onClose={() => setSharing(false)}
          onUpdate={(doc) =>
            setRecord((previous) => ({
              ...previous,
              collaborators: doc.collaborators,
            }))
          }
        />
      )}
    </div>
  );
}
function ToolbarButton({
  children,
  label,
  active,
  disabled,
  onClick,
}: {
  children: ReactNode;
  label: string;
  active?: boolean;
  disabled?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      className={`toolbar-button ${active ? "active" : ""}`}
      title={label}
      aria-label={label}
      aria-pressed={active}
      disabled={disabled}
      onMouseDown={(e) => e.preventDefault()}
      onClick={onClick}
    >
      {children}
    </button>
  );
}
function SparkleIcon() {
  return (
    <svg
      width="30"
      height="30"
      viewBox="0 0 32 32"
      fill="none"
      aria-hidden="true"
    >
      <path
        d="m16 4 3 9 9 3-9 3-3 9-3-9-9-3 9-3 3-9Z"
        stroke="currentColor"
        strokeWidth="1.3"
      />
      <path d="m26 2 1 3 3 1-3 1-1 3-1-3-3-1 3-1 1-3Z" fill="currentColor" />
    </svg>
  );
}
