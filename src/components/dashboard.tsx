"use client";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowDownWideNarrow,
  ArrowRight,
  ArrowUpRight,
  Check,
  ChevronDown,
  ChevronRight,
  CircleHelp,
  ClipboardCheck,
  Clock3,
  Copy,
  Download,
  FilePlus2,
  FileText,
  Folder,
  FolderOpen,
  Grid2X2,
  LayoutTemplate,
  List,
  Loader2,
  LogOut,
  Menu,
  MoreHorizontal,
  Plus,
  Search,
  Share2,
  Sparkles,
  Star,
  Sun,
  Trash2,
  Upload,
  Users,
  X,
  Pencil,
  RotateCcw,
  PanelLeftClose,
  Command,
} from "lucide-react";
import type { DocumentRecord, TemplateId, WorkspaceView } from "@/lib/types";
import { api, exportDocument, relativeDate } from "@/lib/client";
import { plainText } from "@/lib/content";
import { preferences } from "@/lib/preferences";
import { AssessmentGuide } from "./assessment-guide";
import { templateData } from "@/lib/templates";
import { Avatar, EmptyIllustration, Logo, Modal, TemplateArt } from "./ui";
import { useWorkspace } from "./workspace-provider";
import {
  DeleteDialog,
  ImportDialog,
  RenameDialog,
  ShareDialog,
} from "./document-dialogs";

type Action =
  "open" | "rename" | "share" | "duplicate" | "delete" | "export" | "restore";
const viewLabels: Record<WorkspaceView, string> = {
  all: "All documents",
  mine: "My documents",
  shared: "Shared with me",
  starred: "Starred",
  trash: "Trash",
  templates: "Templates",
};
export default function Dashboard() {
  const router = useRouter();
  const {
    user,
    documents,
    setDocuments,
    loadingDocuments,
    error,
    refresh,
    notify,
    openSwitcher,
    openHelp,
    logout,
  } = useWorkspace();
  const [view, setView] = useState<WorkspaceView>("all");
  const [query, setQuery] = useState("");
  const [layout, setLayout] = useState(() =>
    preferences.get("collabdocs_view") === "list" ? "list" : "grid",
  );
  const [sort, setSort] = useState("updated");
  const [sidebar, setSidebar] = useState(false);
  const [profile, setProfile] = useState(false);
  const [importOpen, setImportOpen] = useState(false);
  const [inviteOpen, setInviteOpen] = useState(false);
  const [creating, setCreating] = useState(false);
  const [assessmentOpen, setAssessmentOpen] = useState(false);
  const closeAssessment = useCallback(() => setAssessmentOpen(false), []);
  const [sharing, setSharing] = useState<DocumentRecord | null>(null);
  const [renaming, setRenaming] = useState<DocumentRecord | null>(null);
  const [deleting, setDeleting] = useState<DocumentRecord | null>(null);
  const [trash, setTrash] = useState<DocumentRecord[]>([]);
  const [loadingTrash, setLoadingTrash] = useState(false);
  const [trashError, setTrashError] = useState("");
  const searchRef = useRef<HTMLInputElement>(null);
  const profileRef = useRef<HTMLDivElement>(null);
  const counts = {
    all: documents.length,
    mine: documents.filter((d) => d.ownerId === user?.id).length,
    shared: documents.filter((d) => d.ownerId !== user?.id).length,
    starred: documents.filter((d) => d.starred).length,
  };
  useEffect(() => {
    const keydown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        if (view === "templates") setView("all");
        setTimeout(() => searchRef.current?.focus(), 30);
      }
    };
    window.addEventListener("keydown", keydown);
    return () => window.removeEventListener("keydown", keydown);
  }, [view]);
  useEffect(() => {
    if (!profile) return;
    const close = (e: MouseEvent) => {
      if (!profileRef.current?.contains(e.target as Node)) setProfile(false);
    };
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, [profile]);
  useEffect(() => {
    let active = true;
    if (view === "trash") {
      api<{ documents: DocumentRecord[] }>("/documents?trash=true")
        .then((data) => {
          if (active) setTrash(data.documents);
        })
        .catch((e) => {
          if (active) setTrashError(e.message);
        })
        .finally(() => {
          if (active) setLoadingTrash(false);
        });
    }
    return () => {
      active = false;
    };
  }, [view, user?.id]);
  const filtered = useMemo(() => {
    let result = [...(view === "trash" ? trash : documents)];
    if (view === "mine") result = result.filter((d) => d.ownerId === user?.id);
    if (view === "shared")
      result = result.filter((d) => d.ownerId !== user?.id);
    if (view === "starred") result = result.filter((d) => d.starred);
    if (query.trim()) {
      const q = query.toLowerCase().trim();
      result = result.filter(
        (d) =>
          d.title.toLowerCase().includes(q) ||
          plainText(d.content).toLowerCase().includes(q),
      );
    }
    result.sort((a, b) =>
      sort === "title"
        ? a.title.localeCompare(b.title)
        : sort === "created"
          ? Date.parse(b.createdAt) - Date.parse(a.createdAt)
          : Date.parse(b.updatedAt) - Date.parse(a.updatedAt),
    );
    return result;
  }, [documents, trash, query, sort, view, user?.id]);
  function navigate(next: WorkspaceView) {
    if (next === "trash" && view !== "trash") {
      setLoadingTrash(true);
      setTrashError("");
    }
    setView(next);
    setQuery("");
    setSidebar(false);
  }
  async function create(template: TemplateId = "blank") {
    if (creating) return;
    setCreating(true);
    try {
      const data = await api<{ document: DocumentRecord }>("/documents", {
        method: "POST",
        body: JSON.stringify({ template }),
      });
      setDocuments((items) => [data.document, ...items]);
      router.push(`/documents/${data.document.id}`);
    } catch (e) {
      notify(
        e instanceof Error ? e.message : "Unable to create document.",
        "error",
      );
      setCreating(false);
    }
  }
  async function star(doc: DocumentRecord) {
    setDocuments((items) =>
      items.map((d) => (d.id === doc.id ? { ...d, starred: !d.starred } : d)),
    );
    try {
      await api(`/documents/${doc.id}/star`, {
        method: "POST",
        body: JSON.stringify({ starred: !doc.starred }),
      });
    } catch (e) {
      setDocuments((items) =>
        items.map((d) =>
          d.id === doc.id ? { ...d, starred: doc.starred } : d,
        ),
      );
      notify(
        e instanceof Error ? e.message : "Unable to update favorite.",
        "error",
      );
    }
  }
  async function action(type: Action, doc: DocumentRecord) {
    if (type === "open") {
      router.push(`/documents/${doc.id}`);
      return;
    }
    if (type === "share") {
      setSharing(doc);
      return;
    }
    if (type === "rename") {
      setRenaming(doc);
      return;
    }
    if (type === "delete") {
      setDeleting(doc);
      return;
    }
    if (type === "export") {
      exportDocument(doc.title, doc.content);
      notify("Your words, to go. Markdown downloaded.");
      return;
    }
    try {
      if (type === "restore") {
        await api(`/documents/${doc.id}/restore`, { method: "POST" });
        setTrash((items) => items.filter((d) => d.id !== doc.id));
        await refresh();
        notify("Right where it belongs. Document restored.");
      }
      if (type === "duplicate") {
        const result = await api<{ document: DocumentRecord }>("/documents", {
          method: "POST",
          body: JSON.stringify({
            title: `${doc.title.slice(0, 150)} (copy)`,
            content: doc.content,
            color: doc.color,
          }),
        });
        setDocuments((items) => [result.document, ...items]);
        notify("A fresh copy, just for you.");
      }
    } catch (e) {
      notify(e instanceof Error ? e.message : "Something went wrong.", "error");
    }
  }
  if (!user) return null;
  const isLoading = view === "trash" ? loadingTrash : loadingDocuments;
  const activeError = view === "trash" ? trashError : error;
  return (
    <div className="workspace-shell">
      {sidebar && (
        <button
          className="sidebar-backdrop"
          aria-label="Close navigation"
          onClick={() => setSidebar(false)}
        />
      )}
      <aside className={`sidebar ${sidebar ? "sidebar-open" : ""}`}>
        <div className="sidebar-brand">
          <button onClick={() => navigate("all")} aria-label="CollabDocs home">
            <Logo />
          </button>
          <button
            className="icon-button mobile-only"
            onClick={() => setSidebar(false)}
            aria-label="Close navigation"
          >
            <PanelLeftClose size={18} />
          </button>
        </div>
        <button className="workspace-selector" onClick={openSwitcher}>
          <span className="workspace-monogram">{user.name[0]}</span>
          <span>
            <strong>{user.name.split(" ")[0]}’s workspace</strong>
            <small>Personal workspace</small>
          </span>
          <ChevronDown size={15} />
        </button>
        <button
          className="button button-primary sidebar-create"
          onClick={() => void create()}
          disabled={creating}
        >
          {creating ? (
            <Loader2 className="spin" size={17} />
          ) : (
            <Plus size={18} />
          )}{" "}
          New document{" "}
          <span className="new-shortcut">
            <FilePlus2 size={14} />
          </span>
        </button>
        <div className="nav-label">WORKSPACE</div>
        <nav className="sidebar-nav" aria-label="Workspace navigation">
          {(
            [
              { id: "all", icon: FolderOpen },
              { id: "mine", icon: FileText },
              { id: "shared", icon: Users },
              { id: "starred", icon: Star },
            ] as const
          ).map((item) => (
            <button
              key={item.id}
              className={`nav-item ${view === item.id ? "active" : ""}`}
              onClick={() => navigate(item.id)}
            >
              <item.icon size={18} strokeWidth={1.65} />
              <span>{viewLabels[item.id]}</span>
              <span className="nav-count">{counts[item.id]}</span>
            </button>
          ))}
          <div className="nav-divider" />
          <button
            className={`nav-item ${view === "templates" ? "active" : ""}`}
            onClick={() => navigate("templates")}
          >
            <LayoutTemplate size={18} strokeWidth={1.65} />
            <span>Templates</span>
            <span className="new-badge">NEW</span>
          </button>
          <button
            className={`nav-item ${view === "trash" ? "active" : ""}`}
            onClick={() => navigate("trash")}
          >
            <Trash2 size={18} strokeWidth={1.65} />
            <span>Trash</span>
          </button>
        </nav>
        <div className="sidebar-bottom">
          <div className="invite-card">
            <span className="invite-card-art" aria-hidden="true">
              <Users size={24} strokeWidth={1.3} />
              <Sparkles size={13} />
            </span>
            <h3>Good ideas love company.</h3>
            <p>
              A little collaboration.
              <br />A lot of possibility.
            </p>
            <button onClick={() => setInviteOpen(true)}>
              Invite a teammate <ArrowUpRight size={14} />
            </button>
          </div>
          <button
            className="sidebar-help"
            onClick={() => {
              setSidebar(false);
              setAssessmentOpen(true);
            }}
          >
            <ClipboardCheck size={17} /> Assessment guide{" "}
            <ArrowUpRight size={14} />
          </button>
          <div className="profile-wrapper" ref={profileRef}>
            <button
              className="profile-button"
              onClick={() => setProfile(!profile)}
              aria-expanded={profile}
            >
              <span className="profile-avatar">
                <Avatar user={user} />
                <i />
              </span>
              <span>
                <strong>{user.name}</strong>
                <small>Personal account</small>
              </span>
              <MoreHorizontal size={18} />
            </button>
            {profile && (
              <div className="profile-menu">
                <small>{user.email}</small>
                <button
                  onClick={() => {
                    setProfile(false);
                    openSwitcher();
                  }}
                >
                  <Users size={16} />
                  Switch demo account
                </button>
                <button
                  onClick={() => {
                    setProfile(false);
                    void logout();
                  }}
                >
                  <LogOut size={16} />
                  Sign out
                </button>
              </div>
            )}
          </div>
        </div>
      </aside>
      <div className="workspace-main">
        <header className="topbar">
          <div className="breadcrumbs">
            <button
              className="icon-button mobile-only"
              onClick={() => setSidebar(true)}
              aria-label="Open navigation"
            >
              <Menu size={20} />
            </button>
            <span className="desktop-breadcrumb-icon">
              <Folder size={16} />
            </span>
            <button onClick={() => navigate("all")}>Workspace</button>
            <ChevronRight size={13} />
            <span>{viewLabels[view]}</span>
          </div>
          <div className="topbar-actions">
            <button
              className="demo-indicator"
              onClick={() => setAssessmentOpen(true)}
              aria-label="Open assessment and submission guide"
            >
              <i />
              Assessment demo
              <ArrowUpRight size={11} />
            </button>
            <span className="topbar-divider" />
            <button
              className="icon-button"
              aria-label="Help and getting started"
              onClick={openHelp}
            >
              <CircleHelp size={19} />
            </button>
            <button
              className="topbar-avatar"
              aria-label="Switch account"
              onClick={openSwitcher}
            >
              <Avatar user={user} size="small" />
            </button>
          </div>
        </header>
        <main className="dashboard-main" id="main-content" tabIndex={-1}>
          <section className="welcome-row">
            <div>
              <div className="welcome-heading">
                <h1>
                  {view === "trash"
                    ? "A second chance for your ideas."
                    : view === "templates"
                      ? "A good place to start."
                      : `Welcome back, ${user.name.split(" ")[0]}`}
                </h1>
                {!["trash", "templates"].includes(view) && (
                  <Sun className="welcome-sun" size={27} strokeWidth={1.35} />
                )}
              </div>
              <p>
                {view === "trash"
                  ? "Not gone for good. Restore a document whenever you need it."
                  : view === "templates"
                    ? "Skip the blank page. Find a little inspiration for what comes next."
                    : "A little space for your thoughts. A home for your next big idea."}
              </p>
            </div>
            <div className="welcome-actions">
              <button
                className="button button-secondary"
                onClick={() => setImportOpen(true)}
              >
                <Upload size={16} />
                <span>Import document</span>
              </button>
              <button
                className="button button-primary"
                onClick={() => void create()}
                disabled={creating}
              >
                {creating ? (
                  <Loader2 size={17} className="spin" />
                ) : (
                  <Plus size={18} />
                )}
                <span>New document</span>
              </button>
            </div>
          </section>
          {view !== "trash" && (
            <section
              className={`templates-section ${view === "templates" ? "templates-expanded" : ""}`}
            >
              <div className="section-overline">
                <h2>
                  {view === "templates"
                    ? "A TEMPLATE FOR EVERY KIND OF IDEA"
                    : "START SOMETHING NEW"}
                </h2>
                <button
                  onClick={() =>
                    navigate(view === "templates" ? "all" : "templates")
                  }
                >
                  {view === "templates"
                    ? "Back to documents"
                    : "Explore templates"}
                  <ArrowUpRight size={14} />
                </button>
              </div>
              <div className="template-grid">
                {(
                  ["blank", "project", "meeting", "brainstorm"] as TemplateId[]
                ).map((id) => (
                  <button
                    className={`template-card color-${templateData[id].color}`}
                    key={id}
                    onClick={() => void create(id)}
                    disabled={creating}
                  >
                    <div className="template-copy">
                      <span className="template-icon">
                        {id === "blank" ? (
                          <Plus size={17} />
                        ) : id === "project" ? (
                          <FileText size={17} />
                        ) : id === "meeting" ? (
                          <Users size={17} />
                        ) : (
                          <Sparkles size={17} />
                        )}
                      </span>
                      <strong>
                        {id === "blank"
                          ? "Blank document"
                          : templateData[id].title}
                      </strong>
                      <small>{templateData[id].description}</small>
                    </div>
                    <TemplateArt type={id} />
                  </button>
                ))}
              </div>
              {view === "templates" && (
                <div className="template-explainer">
                  <span>
                    <Sparkles size={25} />
                  </span>
                  <div>
                    <h3>A head start, not a rulebook.</h3>
                    <p>
                      Every template is a fully editable document. Make a copy,
                      find your own rhythm, and make it yours.
                    </p>
                  </div>
                </div>
              )}
            </section>
          )}
          {view !== "templates" && (
            <section className="documents-section">
              <div className="documents-heading">
                <div className="section-title">
                  <h2>
                    {view === "all" ? "Recent documents" : viewLabels[view]}
                  </h2>
                  <span>{filtered.length}</span>
                </div>
                <div className="document-tools">
                  <div className="search-field">
                    <Search size={16} />
                    <input
                      ref={searchRef}
                      placeholder="Search documents…"
                      aria-label="Search documents"
                      value={query}
                      onChange={(e) => setQuery(e.target.value)}
                    />
                    {query ? (
                      <button
                        onClick={() => setQuery("")}
                        aria-label="Clear search"
                      >
                        <X size={14} />
                      </button>
                    ) : (
                      <kbd>⌘ K</kbd>
                    )}
                  </div>
                  <div className="sort-control">
                    <ArrowDownWideNarrow size={16} />
                    <select
                      aria-label="Sort documents"
                      value={sort}
                      onChange={(e) => setSort(e.target.value)}
                    >
                      <option value="updated">Last edited</option>
                      <option value="created">Date created</option>
                      <option value="title">Name A–Z</option>
                    </select>
                    <ChevronDown size={13} />
                  </div>
                  <div
                    className="view-toggle"
                    role="group"
                    aria-label="Document view"
                  >
                    <button
                      aria-label="Grid view"
                      aria-pressed={layout === "grid"}
                      className={layout === "grid" ? "selected" : ""}
                      onClick={() => {
                        setLayout("grid");
                        preferences.set("collabdocs_view", "grid");
                      }}
                    >
                      <Grid2X2 size={16} />
                    </button>
                    <button
                      aria-label="List view"
                      aria-pressed={layout === "list"}
                      className={layout === "list" ? "selected" : ""}
                      onClick={() => {
                        setLayout("list");
                        preferences.set("collabdocs_view", "list");
                      }}
                    >
                      <List size={18} />
                    </button>
                  </div>
                </div>
              </div>
              {!["starred", "trash"].includes(view) && (
                <div
                  className="document-tabs"
                  role="tablist"
                  aria-label="Filter documents"
                >
                  {(["all", "mine", "shared"] as const).map((id) => (
                    <button
                      key={id}
                      role="tab"
                      aria-selected={view === id}
                      className={view === id ? "active" : ""}
                      onClick={() => navigate(id)}
                    >
                      {id === "all"
                        ? "All documents"
                        : id === "mine"
                          ? "Owned by me"
                          : "Shared with me"}
                      <span>{counts[id]}</span>
                    </button>
                  ))}
                  <span className="document-tabs-note">
                    <span /> A place for every idea
                  </span>
                </div>
              )}
              {activeError ? (
                <div className="empty-state">
                  <EmptyIllustration />
                  <h3>Let’s try that again.</h3>
                  <p>{activeError}</p>
                  <button
                    className="button button-primary"
                    onClick={() => {
                      if (view === "trash") {
                        setView("all");
                      } else void refresh();
                    }}
                  >
                    Reload workspace
                    <RotateCcw size={16} />
                  </button>
                </div>
              ) : isLoading && !filtered.length ? (
                <div className="document-grid">
                  {[0, 1, 2, 3, 4, 5].map((n) => (
                    <div className="document-skeleton" key={n}>
                      <div />
                      <span />
                      <i />
                    </div>
                  ))}
                </div>
              ) : !filtered.length ? (
                <div className="empty-state">
                  <EmptyIllustration />
                  <h3>
                    {query
                      ? "That idea is still out there."
                      : view === "trash"
                        ? "A clean slate. Literally."
                        : view === "starred"
                          ? "Keep your favorites close."
                          : view === "shared"
                            ? "Good company is on its way."
                            : "Great things start with a blank page."}
                  </h3>
                  <p>
                    {query
                      ? `No documents match “${query}”. Try a different word or title.`
                      : view === "trash"
                        ? "Your trash is empty. Anything you remove will appear here."
                        : view === "starred"
                          ? "Star a document to give it a little place of honor here."
                          : view === "shared"
                            ? "Documents shared with you will find a home here."
                            : "A thought, a plan, a possibility. Give it a place to grow."}
                  </p>
                  {query ? (
                    <button
                      className="button button-secondary"
                      onClick={() => setQuery("")}
                    >
                      Clear search
                      <X size={15} />
                    </button>
                  ) : view === "shared" ? (
                    <button
                      className="button button-secondary"
                      onClick={openSwitcher}
                    >
                      Try another demo account
                      <Users size={16} />
                    </button>
                  ) : (
                    view !== "trash" && (
                      <button
                        className="button button-primary"
                        onClick={() => void create()}
                      >
                        <Plus size={16} />
                        Create a document
                      </button>
                    )
                  )}
                </div>
              ) : layout === "grid" ? (
                <div className="document-grid">
                  {filtered.map((doc) => (
                    <DocumentCard
                      key={doc.id}
                      doc={doc}
                      onAction={action}
                      onStar={star}
                      currentUserId={user.id}
                    />
                  ))}
                </div>
              ) : (
                <div className="document-table-wrap">
                  <table className="document-table">
                    <thead>
                      <tr>
                        <th>Document name</th>
                        <th>Owner</th>
                        <th>Last edited</th>
                        <th>People</th>
                        <th>
                          <span className="visually-hidden">Actions</span>
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {filtered.map((doc) => (
                        <tr key={doc.id}>
                          <td>
                            <button
                              className="table-document-title"
                              onClick={() =>
                                void action(
                                  doc.deletedAt ? "restore" : "open",
                                  doc,
                                )
                              }
                            >
                              <span
                                className={`table-file-icon color-${doc.color}`}
                              >
                                <FileText size={19} />
                              </span>
                              <strong>{doc.title}</strong>
                              {doc.starred && (
                                <Star size={13} className="filled-star" />
                              )}
                            </button>
                          </td>
                          <td>
                            <span className="table-owner">
                              <Avatar user={doc.owner} size="tiny" />
                              {doc.ownerId === user.id
                                ? "You"
                                : doc.owner.name.split(" ")[0]}
                            </span>
                          </td>
                          <td>{relativeDate(doc.updatedAt)}</td>
                          <td>
                            <div className="avatar-stack">
                              <Avatar user={doc.owner} size="tiny" />
                              {doc.collaborators.map((c) => (
                                <Avatar user={c} size="tiny" key={c.id} />
                              ))}
                            </div>
                          </td>
                          <td>
                            <DocumentMenu doc={doc} onAction={action} />
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
              {!isLoading && filtered.length > 0 && (
                <div className="documents-footer">
                  <span>
                    {filtered.length}{" "}
                    {filtered.length === 1 ? "document" : "documents"} · A
                    little more organized, a little more inspired.
                  </span>
                  <span>
                    <ShieldIcon />
                    Only shared with the people you choose
                  </span>
                </div>
              )}
            </section>
          )}
          <footer className="workspace-footer">
            <span>Thoughts into words. Words into possibilities.</span>
            <button onClick={openHelp}>
              <Command size={12} /> A little help?
            </button>
          </footer>
        </main>
      </div>
      {assessmentOpen && (
        <AssessmentGuide
          onClose={closeAssessment}
          onCreate={() => {
            setAssessmentOpen(false);
            void create();
          }}
          onImport={() => {
            setAssessmentOpen(false);
            setImportOpen(true);
          }}
          onShare={() => {
            const owned = documents.find((d) => d.ownerId === user.id);
            setAssessmentOpen(false);
            if (owned) setSharing(owned);
          }}
          onShowDocuments={() => {
            setAssessmentOpen(false);
            navigate("all");
          }}
          canShare={counts.mine > 0}
        />
      )}
      {importOpen && (
        <ImportDialog
          onClose={() => setImportOpen(false)}
          onImported={(doc) => {
            setDocuments((items) => [doc, ...items]);
            setImportOpen(false);
            notify("Your words made it. Document imported.");
            router.push(`/documents/${doc.id}`);
          }}
        />
      )}
      {sharing && (
        <ShareDialog document={sharing} onClose={() => setSharing(null)} />
      )}
      {renaming && (
        <RenameDialog
          document={renaming}
          onClose={() => setRenaming(null)}
          onSaved={(doc) => {
            setDocuments((items) =>
              items.map((d) => (d.id === doc.id ? doc : d)),
            );
            setRenaming(null);
            notify("New name. Same great ideas.");
          }}
        />
      )}
      {deleting && (
        <DeleteDialog
          document={deleting}
          onClose={() => setDeleting(null)}
          onDeleted={() => {
            setDocuments((items) => items.filter((d) => d.id !== deleting.id));
            setTrash((items) => items.filter((d) => d.id !== deleting.id));
            notify(
              deleting.deletedAt
                ? "Document permanently deleted."
                : "Document moved to Trash. You can always bring it back.",
            );
            setDeleting(null);
          }}
        />
      )}
      {inviteOpen && (
        <Modal
          title="Better ideas, together"
          description="Choose a document to share with your teammate."
          icon={<Users size={25} />}
          onClose={() => setInviteOpen(false)}
        >
          <div className="invite-document-list">
            {documents
              .filter((d) => d.ownerId === user.id)
              .map((doc) => (
                <button
                  key={doc.id}
                  onClick={() => {
                    setInviteOpen(false);
                    setSharing(doc);
                  }}
                >
                  <span className={`table-file-icon color-${doc.color}`}>
                    <FileText size={19} />
                  </span>
                  <span>
                    <strong>{doc.title}</strong>
                    <small>
                      {doc.collaborators.length
                        ? `${doc.collaborators.length} collaborator`
                        : "Just you, for now"}
                    </small>
                  </span>
                  <ArrowRight size={17} />
                </button>
              ))}
            {!counts.mine && (
              <p>
                Create your first document, then invite someone to make it
                better together.
              </p>
            )}
          </div>
          <div className="info-note">
            <Users size={17} />
            <p>
              Invite a registered demo account. Permissions apply to each
              document, so your other ideas stay private.
            </p>
          </div>
        </Modal>
      )}
    </div>
  );
}
function ShieldIcon() {
  return (
    <svg
      width="12"
      height="13"
      viewBox="0 0 16 18"
      fill="none"
      aria-hidden="true"
    >
      <path
        d="M8 1 2 3.5v5c0 4 6 7.5 6 7.5s6-3.5 6-7.5v-5L8 1Z"
        stroke="currentColor"
        strokeWidth="1.3"
      />
      <path d="m5 8 2 2 4-4" stroke="currentColor" strokeWidth="1.3" />
    </svg>
  );
}
function DocumentCard({
  doc,
  onAction,
  onStar,
  currentUserId,
}: {
  doc: DocumentRecord;
  onAction: (action: Action, doc: DocumentRecord) => void;
  onStar: (doc: DocumentRecord) => void;
  currentUserId: string;
}) {
  const headings =
    doc.content.content
      ?.filter((n) => n.type === "heading")
      .slice(0, 2)
      .map(plainText) || [];
  const paragraph = doc.content.content?.find(
    (n) => n.type === "paragraph" && plainText(n).length > 35,
  );
  const category: Record<string, string> = {
    lavender: "A LITTLE CLARITY, A BIGGER PICTURE",
    peach: "THINK AHEAD. MOVE TOGETHER.",
    sage: "ON THE SAME PAGE",
    blue: "MAKE ROOM FOR POSSIBILITY",
    sand: "THOUGHTFULLY, IN OUR OWN WORDS",
    paper: "YOUR IDEAS ARE IN GOOD COMPANY",
  };
  return (
    <article className={`document-card ${doc.deletedAt ? "trashed-card" : ""}`}>
      <div className={`document-preview color-${doc.color}`}>
        <button
          className="document-open"
          onClick={() => onAction(doc.deletedAt ? "restore" : "open", doc)}
          aria-label={`${doc.deletedAt ? "Restore" : "Open"} ${doc.title}`}
        >
          <div className="preview-paper">
            <div className="preview-eyebrow">
              <span className="preview-mark" />
              {category[doc.color] || "A NEW PERSPECTIVE"}
            </div>
            <h3>
              {headings.length
                ? headings.map((h, i) => <span key={i}>{h}</span>)
                : doc.title === "Untitled document"
                  ? "Your next great idea\nstarts here."
                  : doc.title}
            </h3>
            <div className="preview-rule" />
            <p>
              {paragraph
                ? plainText(paragraph)
                : "A fresh page. A little possibility. Something wonderful in the making."}
            </p>
            <div className="preview-lines">
              <i />
              <i />
              <i />
            </div>
          </div>
        </button>
        {!doc.deletedAt && (
          <button
            className={`card-star ${doc.starred ? "is-starred" : ""}`}
            aria-label={`${doc.starred ? "Unstar" : "Star"} ${doc.title}`}
            onClick={() => onStar(doc)}
          >
            <Star size={15} strokeWidth={1.65} />
          </button>
        )}
      </div>
      <div className="document-card-details">
        <div className="document-title-row">
          <FileText size={17} strokeWidth={1.7} />
          <button
            title={doc.title}
            onClick={() => onAction(doc.deletedAt ? "restore" : "open", doc)}
          >
            {doc.title}
          </button>
          <DocumentMenu doc={doc} onAction={onAction} />
        </div>
        <div className="document-meta-row">
          <span>
            {doc.ownerId === currentUserId
              ? "You"
              : doc.owner.name.split(" ")[0]}
            <i /> {relativeDate(doc.updatedAt)}
          </span>
          <div className="avatar-stack">
            <Avatar user={doc.owner} size="tiny" />
            {doc.collaborators.slice(0, 2).map((c) => (
              <Avatar user={c} size="tiny" key={c.id} />
            ))}
          </div>
        </div>
      </div>
    </article>
  );
}
function DocumentMenu({
  doc,
  onAction,
}: {
  doc: DocumentRecord;
  onAction: (action: Action, doc: DocumentRecord) => void;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent) => {
      if (!ref.current?.contains(e.target as Node)) setOpen(false);
    };
    const key = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", close);
    document.addEventListener("keydown", key);
    return () => {
      document.removeEventListener("mousedown", close);
      document.removeEventListener("keydown", key);
    };
  }, [open]);
  const items = doc.deletedAt
    ? [
        { action: "restore", label: "Restore document", icon: RotateCcw },
        { action: "delete", label: "Delete permanently", icon: Trash2 },
      ]
    : [
        { action: "open", label: "Open document", icon: FileText },
        ...(doc.permission !== "viewer"
          ? [{ action: "rename", label: "Rename", icon: Pencil }]
          : []),
        { action: "share", label: "Share & access", icon: Share2 },
        { action: "duplicate", label: "Make a copy", icon: Copy },
        { action: "export", label: "Export as Markdown", icon: Download },
        ...(doc.permission === "owner"
          ? [{ action: "delete", label: "Move to Trash", icon: Trash2 }]
          : []),
      ];
  return (
    <div className="document-menu-wrapper" ref={ref}>
      <button
        className={`icon-button document-menu-trigger ${open ? "active" : ""}`}
        aria-label={`More options for ${doc.title}`}
        aria-expanded={open}
        onClick={() => setOpen(!open)}
      >
        <MoreHorizontal size={18} />
      </button>
      {open && (
        <div className="document-menu" role="menu">
          {items.map((item) => (
            <button
              role="menuitem"
              key={item.action}
              className={item.action === "delete" ? "danger-text" : ""}
              onClick={() => {
                setOpen(false);
                onAction(item.action as Action, doc);
              }}
            >
              <item.icon size={15} />
              {item.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
