"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { api, RequestError } from "@/lib/client";
import { validateContent } from "@/lib/content";
import type { DocumentRecord, RichNode } from "@/lib/types";
type SaveStatus = "saved" | "unsaved" | "saving" | "error" | "conflict";
type Draft = {
  title: string;
  content: RichNode;
  revision: number;
  savedAt: number;
};
export function useAutosave(
  initial: DocumentRecord,
  userId: string,
  onSaved: (doc: DocumentRecord) => void,
) {
  const key = `collabdocs_draft_${userId}_${initial.id}`;
  const [recovery] = useState<Draft | null>(() => {
    if (initial.permission === "viewer" || typeof window === "undefined")
      return null;
    try {
      const value = JSON.parse(localStorage.getItem(key) || "null");
      return value &&
        typeof value.title === "string" &&
        value.title.length <= 160 &&
        Number.isInteger(value.revision) &&
        validateContent(value.content)
        ? value
        : null;
    } catch {
      return null;
    }
  });
  const [title, setTitleState] = useState(recovery?.title ?? initial.title);
  const [status, setStatus] = useState<SaveStatus>(
    recovery
      ? recovery.revision !== initial.revision
        ? "conflict"
        : "unsaved"
      : "saved",
  );
  const [error, setError] = useState(
    recovery && recovery.revision !== initial.revision
      ? "Your recovered draft differs from the latest version. Download your draft before reloading."
      : "",
  );
  const [lastSaved, setLastSaved] = useState(initial.updatedAt);
  const latest = useRef({
    title: recovery?.title ?? initial.title,
    content: recovery?.content ?? initial.content,
  });
  const revision = useRef(recovery?.revision ?? initial.revision);
  const generation = useRef(recovery ? 1 : 0);
  const savedGeneration = useRef(0);
  const blocked = useRef(
    Boolean(recovery && recovery.revision !== initial.revision),
  );
  const inFlight = useRef<Promise<boolean> | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const onSavedRef = useRef(onSaved);
  useEffect(() => {
    onSavedRef.current = onSaved;
  }, [onSaved]);
  const persistDraft = useCallback(() => {
    try {
      localStorage.setItem(
        key,
        JSON.stringify({
          ...latest.current,
          revision: revision.current,
          savedAt: Date.now(),
        }),
      );
    } catch {
      /* Persistence still uses PostgreSQL if local storage is unavailable. */
    }
  }, [key]);
  const saveNow = useCallback(async (): Promise<boolean> => {
    if (timer.current) clearTimeout(timer.current);
    if (blocked.current) return false;
    if (inFlight.current) return inFlight.current;
    if (generation.current === savedGeneration.current) return true;
    const run = async () => {
      while (generation.current > savedGeneration.current) {
        const version = generation.current;
        const snapshot = {
          ...latest.current,
          title: latest.current.title.trim() || "Untitled document",
          revision: revision.current,
        };
        setStatus("saving");
        setError("");
        try {
          const { document } = await api<{ document: DocumentRecord }>(
            `/documents/${initial.id}`,
            { method: "PUT", body: JSON.stringify(snapshot) },
          );
          revision.current = document.revision;
          savedGeneration.current = version;
          setLastSaved(document.updatedAt);
          onSavedRef.current(document);
          if (generation.current === version) {
            setStatus("saved");
            try {
              localStorage.removeItem(key);
            } catch {}
          } else persistDraft();
        } catch (e) {
          const conflict = e instanceof RequestError && e.status === 409;
          blocked.current = conflict;
          setStatus(conflict ? "conflict" : "error");
          setError(
            e instanceof Error
              ? e.message
              : "Your changes haven’t saved. Please try again.",
          );
          persistDraft();
          return false;
        }
      }
      return true;
    };
    inFlight.current = run();
    const result = await inFlight.current;
    inFlight.current = null;
    return result;
  }, [initial.id, key, persistDraft]);
  const schedule = useCallback(() => {
    generation.current++;
    if (!blocked.current) setStatus("unsaved");
    persistDraft();
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => void saveNow(), 850);
  }, [saveNow, persistDraft]);
  const setTitle = useCallback(
    (value: string) => {
      setTitleState(value);
      latest.current.title = value;
      schedule();
    },
    [schedule],
  );
  const setContent = useCallback(
    (value: RichNode) => {
      latest.current.content = value;
      schedule();
    },
    [schedule],
  );
  useEffect(() => {
    if (recovery && !blocked.current)
      timer.current = setTimeout(() => void saveNow(), 1200);
    const beforeUnload = (e: BeforeUnloadEvent) => {
      if (generation.current > savedGeneration.current) {
        persistDraft();
        e.preventDefault();
      }
    };
    const keydown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "s") {
        e.preventDefault();
        void saveNow();
      }
    };
    const online = () => {
      if (!blocked.current) void saveNow();
    };
    window.addEventListener("beforeunload", beforeUnload);
    window.addEventListener("keydown", keydown);
    window.addEventListener("online", online);
    return () => {
      if (timer.current) clearTimeout(timer.current);
      window.removeEventListener("beforeunload", beforeUnload);
      window.removeEventListener("keydown", keydown);
      window.removeEventListener("online", online);
    };
  }, [persistDraft, recovery, saveNow]);
  function discardDraft() {
    try {
      localStorage.removeItem(key);
    } catch {}
    savedGeneration.current = generation.current;
    window.location.reload();
  }
  return {
    title,
    setTitle,
    setContent,
    initialContent: recovery?.content ?? initial.content,
    status,
    error,
    lastSaved,
    saveNow,
    latest,
    discardDraft,
    recovered: Boolean(recovery),
  };
}
