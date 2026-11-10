"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  AlertCircle,
  ArrowRight,
  Check,
  FileText,
  Link2,
  LockKeyhole,
  Mail,
  ShieldCheck,
  Trash2,
  UploadCloud,
  Users,
  X,
} from "lucide-react";
import { api } from "@/lib/client";
import type { DocumentRecord } from "@/lib/types";
import { Avatar, Modal } from "./ui";
import { useWorkspace } from "./workspace-provider";

export function ImportDialog({
  onClose,
  onImported,
}: {
  onClose: () => void;
  onImported: (doc: DocumentRecord) => void;
}) {
  const [file, setFile] = useState<File | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [dragging, setDragging] = useState(false);
  const input = useRef<HTMLInputElement>(null);
  function choose(value?: File) {
    setError("");
    setFile(null);
    if (!value) return;
    if (!/\.(txt|md)$/i.test(value.name)) {
      setError("That file type isn’t supported. Choose a .txt or .md file.");
      return;
    }
    if (value.size > 1048576) {
      setError("That file is a little too big. Maximum file size is 1 MB.");
      return;
    }
    if (!value.size) {
      setError("This file is empty. Choose a file with some content.");
      return;
    }
    setFile(value);
  }
  async function upload() {
    if (!file) return;
    setBusy(true);
    setError("");
    try {
      const form = new FormData();
      form.append("file", file);
      const data = await api<{ document: DocumentRecord }>(
        "/documents/import",
        { method: "POST", body: form },
      );
      onImported(data.document);
    } catch (e) {
      setError(
        e instanceof Error ? e.message : "We couldn’t import that file.",
      );
      setBusy(false);
    }
  }
  return (
    <Modal
      title="Bring your words along"
      description="Turn a text or Markdown file into your next great document."
      onClose={() => !busy && onClose()}
      icon={<UploadCloud size={25} />}
    >
      <div
        className={`dropzone ${dragging ? "dragging" : ""} ${file ? "has-file" : ""}`}
        onDragOver={(e) => {
          e.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragging(false);
          if (!busy) choose(e.dataTransfer.files[0]);
        }}
      >
        <input
          ref={input}
          type="file"
          accept=".txt,.md,text/plain,text/markdown"
          className="visually-hidden"
          aria-label="Choose a text or Markdown file"
          disabled={busy}
          onChange={(e) => choose(e.target.files?.[0])}
        />
        {file ? (
          <>
            <span className="upload-file-icon">
              <FileText size={31} />
            </span>
            <strong className="filename">{file.name}</strong>
            <span>{(file.size / 1024).toFixed(1)} KB · Ready to import</span>
            <button
              className="text-button"
              onClick={() => input.current?.click()}
              disabled={busy}
            >
              Choose a different file
            </button>
          </>
        ) : (
          <>
            <span className="upload-file-icon">
              <UploadCloud size={32} strokeWidth={1.5} />
            </span>
            <strong>Drop your document here</strong>
            <span>or choose one from your computer</span>
            <button
              className="button button-secondary"
              onClick={() => input.current?.click()}
            >
              Browse files
            </button>
          </>
        )}
      </div>
      <div className="upload-formats">
        <span>
          <FileText size={14} /> TXT & Markdown (.md)
        </span>
        <span>Up to 1 MB</span>
      </div>
      {error && (
        <p className="inline-error" role="alert">
          <AlertCircle size={16} />
          {error}
        </p>
      )}
      <div className="info-note">
        <ShieldCheck size={17} />
        <p>
          Your file becomes a private document. Markdown headings, lists, and
          basic formatting come along too.
        </p>
      </div>
      <div className="modal-actions">
        <button
          className="button button-secondary"
          onClick={onClose}
          disabled={busy}
        >
          Cancel
        </button>
        <button
          className="button button-primary"
          onClick={() => void upload()}
          disabled={!file || busy}
        >
          {busy ? "Importing your document…" : "Import document"}
          <ArrowRight size={16} />
        </button>
      </div>
    </Modal>
  );
}
export function ShareDialog({
  document: initial,
  onClose,
  onUpdate,
}: {
  document: DocumentRecord;
  onClose: () => void;
  onUpdate?: (doc: DocumentRecord) => void;
}) {
  const { user, notify, setDocuments } = useWorkspace();
  const [doc, setDoc] = useState(initial);
  const [email, setEmail] = useState("");
  const [permission, setPermission] = useState("editor");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState(false);
  const owner = doc.ownerId === user?.id;
  useEffect(() => {
    let active = true;
    api<{ document: DocumentRecord }>(`/documents/${initial.id}`)
      .then((data) => {
        if (active) setDoc(data.document);
      })
      .catch((e) => {
        if (active) setError(e.message);
      });
    return () => {
      active = false;
    };
  }, [initial.id]);
  function update(next: DocumentRecord) {
    setDoc(next);
    setDocuments((items) => items.map((d) => (d.id === next.id ? next : d)));
    onUpdate?.(next);
  }
  async function share(target: string, role: string) {
    setBusy(true);
    setError("");
    try {
      const data = await api<{ document: DocumentRecord }>(
        `/documents/${doc.id}/share`,
        {
          method: "POST",
          body: JSON.stringify({ email: target.trim(), permission: role }),
        },
      );
      update(data.document);
      setEmail("");
      notify("A little more company. Document access updated.");
    } catch (e) {
      setError(
        e instanceof Error ? e.message : "Unable to share this document.",
      );
    } finally {
      setBusy(false);
    }
  }
  async function revoke(id: string) {
    setBusy(true);
    setError("");
    try {
      const data = await api<{ document: DocumentRecord }>(
        `/documents/${doc.id}/shares/${id}`,
        { method: "DELETE" },
      );
      update(data.document);
      notify("Access removed.");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Unable to remove access.");
    } finally {
      setBusy(false);
    }
  }
  async function copy() {
    try {
      await navigator.clipboard.writeText(
        `${window.location.origin}/documents/${doc.id}`,
      );
      setCopied(true);
      notify("Document link copied. Only invited people can open it.");
    } catch {
      setError(
        "Your browser blocked the clipboard. You can copy the document URL from the address bar.",
      );
    }
  }
  return (
    <Modal
      title="Good ideas love company"
      description={`Share “${doc.title}” with your people.`}
      onClose={onClose}
      icon={<Users size={25} />}
    >
      {owner && (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            void share(email, permission);
          }}
        >
          <label className="field-label" htmlFor="share-email">
            Invite by email
          </label>
          <div className="share-invite">
            <div className="input-with-icon">
              <Mail size={16} />
              <input
                id="share-email"
                type="email"
                placeholder="Enter an email address"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                disabled={busy}
              />
            </div>
            <select
              className="select"
              aria-label="Permission for invited person"
              value={permission}
              onChange={(e) => setPermission(e.target.value)}
              disabled={busy}
            >
              <option value="editor">Can edit</option>
              <option value="viewer">Can view</option>
            </select>
          </div>
          <button
            className="button button-primary full-width invite-submit"
            disabled={busy || !email.trim()}
          >
            {busy ? "Updating access…" : "Send invitation"}
            <ArrowRight size={16} />
          </button>
          <p className="field-hint">
            Try{" "}
            {user?.email === "abhay@example.com"
              ? "reviewer@example.com"
              : "abhay@example.com"}
            . Access is granted immediately; no email is sent.
          </p>
        </form>
      )}
      {error && (
        <p className="inline-error" role="alert">
          <AlertCircle size={16} />
          {error}
        </p>
      )}
      <h3 className="small-heading">
        People with access <span>{doc.collaborators.length + 1}</span>
      </h3>
      <div className="collaborator-list">
        <div className="collaborator-row">
          <Avatar user={doc.owner} />
          <span className="collaborator-name">
            <strong>
              {doc.owner.name}
              {owner && " (you)"}
            </strong>
            <small>{doc.owner.email}</small>
          </span>
          <span className="role-label">Owner</span>
        </div>
        {doc.collaborators.map((person) => (
          <div key={person.id} className="collaborator-row">
            <Avatar user={person} />
            <span className="collaborator-name">
              <strong>
                {person.name}
                {person.id === user?.id && " (you)"}
              </strong>
              <small>{person.email}</small>
            </span>
            {owner ? (
              <>
                <select
                  className="role-select"
                  aria-label={`Permission for ${person.name}`}
                  value={person.permission}
                  onChange={(e) => void share(person.email, e.target.value)}
                  disabled={busy}
                >
                  <option value="editor">Can edit</option>
                  <option value="viewer">Can view</option>
                </select>
                <button
                  className="icon-button danger-hover"
                  onClick={() => void revoke(person.id)}
                  disabled={busy}
                  aria-label={`Remove access for ${person.name}`}
                >
                  <X size={16} />
                </button>
              </>
            ) : (
              <span className="role-label">
                {person.permission === "editor" ? "Can edit" : "Can view"}
              </span>
            )}
          </div>
        ))}
      </div>
      <div className="restricted-access">
        <span className="restricted-icon">
          <LockKeyhole size={19} />
        </span>
        <span>
          <strong>Private, by default</strong>
          <p>Only people with access can open this document.</p>
        </span>
      </div>
      <div className="modal-actions spread">
        <button className="button button-secondary" onClick={() => void copy()}>
          {copied ? <Check size={16} /> : <Link2 size={16} />}{" "}
          {copied ? "Link copied" : "Copy link"}
        </button>
        <button className="button button-primary" onClick={onClose}>
          Done
        </button>
      </div>
    </Modal>
  );
}
export function RenameDialog({
  document,
  onClose,
  onSaved,
}: {
  document: DocumentRecord;
  onClose: () => void;
  onSaved: (doc: DocumentRecord) => void;
}) {
  const [title, setTitle] = useState(document.title);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const close = useCallback(() => {
    if (!busy) onClose();
  }, [busy, onClose]);
  return (
    <Modal
      title="A new name, same great idea"
      description="Give your document a title that feels right."
      onClose={close}
      icon={<FileText size={24} />}
    >
      <form
        onSubmit={async (e) => {
          e.preventDefault();
          setBusy(true);
          try {
            const data = await api<{ document: DocumentRecord }>(
              `/documents/${document.id}`,
              {
                method: "PUT",
                body: JSON.stringify({
                  title: title.trim(),
                  revision: document.revision,
                }),
              },
            );
            onSaved(data.document);
          } catch (e) {
            setError(e instanceof Error ? e.message : "Unable to rename.");
            setBusy(false);
          }
        }}
      >
        <label className="field-label" htmlFor="document-title">
          Document title
        </label>
        <input
          className="input"
          id="document-title"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          maxLength={160}
          required
          autoFocus
          onFocus={(e) => e.target.select()}
        />
        {error && <p className="inline-error">{error}</p>}
        <div className="modal-actions">
          <button
            type="button"
            className="button button-secondary"
            onClick={onClose}
            disabled={busy}
          >
            Cancel
          </button>
          <button
            className="button button-primary"
            disabled={!title.trim() || busy}
          >
            {busy ? "Saving…" : "Save name"}
          </button>
        </div>
      </form>
    </Modal>
  );
}
export function DeleteDialog({
  document,
  onClose,
  onDeleted,
}: {
  document: DocumentRecord;
  onClose: () => void;
  onDeleted: () => void;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  async function remove() {
    setBusy(true);
    try {
      await api(
        `/documents/${document.id}${document.deletedAt ? "?permanent=true" : ""}`,
        { method: "DELETE" },
      );
      onDeleted();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Unable to delete.");
      setBusy(false);
    }
  }
  return (
    <Modal
      title={
        document.deletedAt
          ? "Say goodbye for good?"
          : "Move this document to Trash?"
      }
      description={`“${document.title}” ${document.deletedAt ? "will be permanently deleted. This can’t be undone." : "will be removed from your workspace. You can restore it from Trash whenever you need it."}`}
      onClose={() => !busy && onClose()}
      icon={<Trash2 size={24} />}
    >
      {document.collaborators.length > 0 && (
        <div className="info-note">
          <Users size={17} />
          <p>
            People you shared this document with will no longer have access.
          </p>
        </div>
      )}
      {error && <p className="inline-error">{error}</p>}
      <div className="modal-actions">
        <button
          className="button button-secondary"
          disabled={busy}
          onClick={onClose}
        >
          Keep document
        </button>
        <button
          className="button button-danger"
          disabled={busy}
          onClick={() => void remove()}
        >
          {busy
            ? "Removing…"
            : document.deletedAt
              ? "Delete permanently"
              : "Move to Trash"}
        </button>
      </div>
    </Modal>
  );
}
