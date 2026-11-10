"use client";
import {
  Fragment,
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  type ReactNode,
  type Dispatch,
  type SetStateAction,
} from "react";
import { useRouter } from "next/navigation";
import {
  ArrowRight,
  Check,
  CheckCircle2,
  FileText,
  Info,
  LogIn,
  ShieldCheck,
  Sparkles,
  Users,
  X,
  AlertCircle,
} from "lucide-react";
import { api, RequestError } from "@/lib/client";
import { preferences } from "@/lib/preferences";
import type { DocumentRecord, User } from "@/lib/types";
import { Avatar, Logo, Modal, LoadingDots } from "./ui";

type WorkspaceContext = {
  user: User | null;
  documents: DocumentRecord[];
  setDocuments: Dispatch<SetStateAction<DocumentRecord[]>>;
  loadingDocuments: boolean;
  error: string;
  refresh: () => Promise<void>;
  notify: (message: string, kind?: "success" | "error") => void;
  openSwitcher: () => void;
  openHelp: () => void;
  logout: () => Promise<void>;
};
const Context = createContext<WorkspaceContext | null>(null);
export function useWorkspace() {
  const value = useContext(Context);
  if (!value) throw new Error("Workspace provider is missing");
  return value;
}
export function WorkspaceProvider({
  children,
  demoMode,
}: {
  children: ReactNode;
  demoMode: boolean;
}) {
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [documents, setDocuments] = useState<DocumentRecord[]>([]);
  const [loadingDocuments, setLoadingDocuments] = useState(true);
  const [error, setError] = useState("");
  const [authError, setAuthError] = useState("");
  const [switcher, setSwitcher] = useState(false);
  const [help, setHelp] = useState(false);
  const [busy, setBusy] = useState(false);
  const [toast, setToast] = useState<{
    message: string;
    kind: "success" | "error";
  } | null>(null);
  const notify = useCallback(
    (message: string, kind: "success" | "error" = "success") =>
      setToast({ message, kind }),
    [],
  );
  const refresh = useCallback(async () => {
    setLoadingDocuments(true);
    setError("");
    try {
      const data = await api<{ documents: DocumentRecord[] }>("/documents");
      setDocuments(data.documents);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Unable to load documents.");
    } finally {
      setLoadingDocuments(false);
    }
  }, []);
  useEffect(() => {
    let active = true;
    async function init() {
      try {
        let result: { user: User };
        try {
          result = await api("/auth/session");
        } catch (e) {
          if (
            !(e instanceof RequestError) ||
            e.status !== 401 ||
            !demoMode ||
            preferences.get("collabdocs_signed_out")
          )
            throw e;
          result = await api("/auth/login", {
            method: "POST",
            body: JSON.stringify({
              email: "abhay@example.com",
              password: "demo123",
            }),
          });
        }
        if (active) {
          setUser(result.user);
          await refresh();
        }
      } catch (e) {
        if (active && (!(e instanceof RequestError) || e.status !== 401))
          setAuthError(
            e instanceof Error
              ? e.message
              : "Couldn’t connect to your workspace.",
          );
      } finally {
        if (active) setLoading(false);
      }
    }
    void init();
    return () => {
      active = false;
    };
  }, [refresh, demoMode]);
  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(() => setToast(null), 5000);
    return () => clearTimeout(timer);
  }, [toast]);
  async function login(email: string, password = "demo123") {
    setBusy(true);
    setAuthError("");
    try {
      const result = await api<{ user: User }>("/auth/login", {
        method: "POST",
        body: JSON.stringify({ email, password }),
      });
      preferences.remove("collabdocs_signed_out");
      setDocuments([]);
      setUser(result.user);
      setSwitcher(false);
      await refresh();
      router.push("/");
      notify(`Welcome back, ${result.user.name.split(" ")[0]}.`);
    } catch (e) {
      setAuthError(e instanceof Error ? e.message : "Unable to sign in.");
    } finally {
      setBusy(false);
    }
  }
  async function logout() {
    try {
      await api("/auth/logout", { method: "POST" });
      preferences.set("collabdocs_signed_out", "true");
      setUser(null);
      setDocuments([]);
      router.push("/");
    } catch (e) {
      notify(e instanceof Error ? e.message : "Couldn’t sign out.", "error");
    }
  }
  if (loading)
    return (
      <div className="boot-screen">
        <Logo />
        <LoadingDots />
        <p>A little space for your next big idea.</p>
      </div>
    );
  return (
    <Context.Provider
      value={{
        user,
        documents,
        setDocuments,
        loadingDocuments,
        error,
        refresh,
        notify,
        openSwitcher: () => {
          setAuthError("");
          setSwitcher(true);
        },
        openHelp: () => setHelp(true),
        logout,
      }}
    >
      {user ? (
        <Fragment key={user.id}>{children}</Fragment>
      ) : (
        <LoginScreen
          onLogin={login}
          busy={busy}
          error={authError}
          demoMode={demoMode}
        />
      )}
      {switcher && (
        <Modal
          title="A different perspective"
          description="Switch demo accounts to try sharing and collaboration."
          onClose={() => !busy && setSwitcher(false)}
          icon={<Users size={25} />}
        >
          <div className="account-list">
            {[
              {
                name: "Abhay Chouhan",
                email: "abhay@example.com",
                color: "peach",
              },
              {
                name: "Alex Morgan",
                email: "reviewer@example.com",
                color: "lavender",
              },
            ].map((account) => (
              <button
                key={account.email}
                className={`account-option ${user?.email === account.email ? "selected" : ""}`}
                disabled={busy || user?.email === account.email}
                onClick={() => void login(account.email)}
              >
                <Avatar user={account} />
                <span>
                  <strong>{account.name}</strong>
                  <small>{account.email}</small>
                </span>
                {user?.email === account.email ? (
                  <Check size={19} />
                ) : (
                  <ArrowRight size={19} />
                )}
              </button>
            ))}
          </div>
          {authError && (
            <p className="inline-error">
              <AlertCircle size={16} />
              {authError}
            </p>
          )}
          <div className="info-note">
            <Info size={17} />
            <p>
              Both demo accounts use <strong>demo123</strong>. Each account has
              its own private workspace and shared documents.
            </p>
          </div>
        </Modal>
      )}
      {help && (
        <Modal
          title="Make yourself at home"
          description="A little guide to your new favorite writing space."
          onClose={() => setHelp(false)}
          icon={<Sparkles size={25} />}
        >
          <div className="help-list">
            <div>
              <FileText />
              <span>
                <strong>A page for every idea</strong>
                <p>
                  Create a blank document, use a template, or import a .txt or
                  .md file up to 1 MB.
                </p>
              </span>
            </div>
            <div>
              <CheckCircle2 />
              <span>
                <strong>Write. We’ll take care of saving.</strong>
                <p>
                  Changes save automatically after a short pause. You can also
                  press Ctrl/⌘ + S.
                </p>
              </span>
            </div>
            <div>
              <Users />
              <span>
                <strong>Better ideas, together</strong>
                <p>
                  Share with reviewer@example.com or abhay@example.com. Switch
                  accounts from your profile to try editor and viewer
                  permissions.
                </p>
              </span>
            </div>
            <div>
              <ShieldCheck />
              <span>
                <strong>Your documents stay yours</strong>
                <p>
                  Only you and people you invite can open your documents.
                  Simultaneous edits are protected with version checks, not live
                  multiplayer cursors.
                </p>
              </span>
            </div>
          </div>
          <button
            className="button button-primary full-width"
            onClick={() => setHelp(false)}
          >
            Sounds good <ArrowRight size={16} />
          </button>
        </Modal>
      )}
      {toast && (
        <div className={`toast toast-${toast.kind}`} role="status">
          {toast.kind === "success" ? (
            <CheckCircle2 size={19} />
          ) : (
            <AlertCircle size={19} />
          )}
          <span>{toast.message}</span>
          <button
            aria-label="Dismiss notification"
            onClick={() => setToast(null)}
          >
            <X size={16} />
          </button>
        </div>
      )}
    </Context.Provider>
  );
}
function LoginScreen({
  onLogin,
  busy,
  error,
  demoMode,
}: {
  onLogin: (email: string, password?: string) => Promise<void>;
  busy: boolean;
  error: string;
  demoMode: boolean;
}) {
  const [email, setEmail] = useState("abhay@example.com");
  const [password, setPassword] = useState("demo123");
  return (
    <main className="login-page" id="main-content" tabIndex={-1}>
      <div className="login-story">
        <Logo />
        <div>
          <span className="eyebrow">
            A LITTLE SPACE. ENDLESS POSSIBILITIES.
          </span>
          <h1>
            Good ideas
            <br />
            deserve
            <br />
            <em>good company.</em>
          </h1>
          <p>
            Your thoughts, plans, and next big thing.
            <br />
            Bring them all together with CollabDocs.
          </p>
        </div>
        <span className="login-footer">
          Thoughtfully made for the way you work.
        </span>
        <div className="login-decoration" aria-hidden="true">
          <FileText size={140} strokeWidth={0.6} />
          <Sparkles size={40} />
        </div>
      </div>
      <section className="login-form-panel">
        <div className="login-form">
          <span className="mobile-login-logo">
            <Logo />
          </span>
          <div className="modal-icon">
            <LogIn size={25} />
          </div>
          <h2>Welcome to your workspace.</h2>
          <p>A fresh page is waiting for you.</p>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              void onLogin(email, password);
            }}
          >
            <label className="field-label" htmlFor="email">
              Email address
            </label>
            <input
              id="email"
              type="email"
              className="input"
              autoComplete="username"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
            <label className="field-label" htmlFor="password">
              Password
            </label>
            <input
              id="password"
              type="password"
              className="input"
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
            {error && <p className="inline-error">{error}</p>}
            <button
              className="button button-primary full-width"
              disabled={busy}
            >
              {busy ? "Opening your workspace…" : "Let’s get started"}
              <ArrowRight size={17} />
            </button>
          </form>
          {demoMode && (
            <>
              <div className="login-divider">
                <span>OR EXPLORE THE DEMO</span>
              </div>
              <div className="demo-logins">
                <button
                  className="button button-secondary"
                  disabled={busy}
                  onClick={() => void onLogin("abhay@example.com")}
                >
                  Continue as Abhay
                </button>
                <button
                  className="button button-secondary"
                  disabled={busy}
                  onClick={() => void onLogin("reviewer@example.com")}
                >
                  Continue as Reviewer
                </button>
              </div>
              <p className="login-hint">
                No signup needed. Demo password: <strong>demo123</strong>
              </p>
            </>
          )}
        </div>
      </section>
    </main>
  );
}
