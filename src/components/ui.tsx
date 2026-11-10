"use client";
import { useEffect, useId, useRef, type ReactNode } from "react";
import { createPortal } from "react-dom";
import {
  X,
  FileText,
  Sparkles,
  Plus,
  ArrowUpRight,
  Check,
  ListTodo,
  Lightbulb,
} from "lucide-react";
import type { User, TemplateId } from "@/lib/types";

export function Logo({ small = false }: { small?: boolean }) {
  return (
    <span translate="no" className={`brand ${small ? "brand-small" : ""}`}>
      <span className="brand-mark">
        <svg viewBox="0 0 36 36" fill="none" aria-hidden="true">
          <path
            d="M10 7a3 3 0 0 1 3-3h13a3 3 0 0 1 3 3v20a3 3 0 0 1-3 3H13a3 3 0 0 1-3-3V7Z"
            fill="currentColor"
            opacity=".27"
            transform="rotate(12 19 17)"
          />
          <rect x="6" y="7" width="21" height="26" rx="4" fill="currentColor" />
          <path
            d="M12 15h9M12 20h9M12 25h5"
            stroke="white"
            strokeWidth="2"
            strokeLinecap="round"
          />
        </svg>
      </span>
      {!small && (
        <span>
          Collab<span className="brand-light">Docs</span>
          <span className="brand-period">.</span>
        </span>
      )}
    </span>
  );
}
export function Avatar({
  user,
  size = "normal",
  className = "",
}: {
  user: Pick<User, "name" | "color">;
  size?: "tiny" | "small" | "normal" | "large";
  className?: string;
}) {
  return (
    <span
      title={user.name}
      className={`avatar avatar-${size} color-${user.color} ${className}`}
    >
      {user.name
        .split(" ")
        .slice(0, 2)
        .map((n) => n[0])
        .join("")}
    </span>
  );
}
export function Modal({
  title,
  description,
  onClose,
  children,
  wide = false,
  className = "",
  icon,
}: {
  title: string;
  description?: string;
  onClose: () => void;
  children: ReactNode;
  wide?: boolean;
  className?: string;
  icon?: ReactNode;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const id = useId();
  useEffect(() => {
    const previous = document.activeElement as HTMLElement;
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const focus = () =>
      ref.current
        ?.querySelector<HTMLElement>("input, button, select, [tabindex='0']")
        ?.focus();
    const timer = setTimeout(focus, 50);
    const keydown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
      if (e.key !== "Tab") return;
      const items = Array.from(
        ref.current?.querySelectorAll<HTMLElement>(
          "button:not(:disabled), input:not(:disabled), select:not(:disabled), a[href], summary, [tabindex='0']",
        ) || [],
      ).filter((element) => element.getClientRects().length > 0);
      if (!items.length) return;
      const first = items[0];
      const last = items[items.length - 1];
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    };
    document.addEventListener("keydown", keydown);
    return () => {
      clearTimeout(timer);
      document.body.style.overflow = overflow;
      document.removeEventListener("keydown", keydown);
      previous?.focus();
    };
  }, [onClose]);
  return createPortal(
    <div
      className="modal-backdrop"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        className={`modal ${wide ? "modal-wide" : ""} ${className}`}
        role="dialog"
        aria-modal="true"
        aria-labelledby={id}
        aria-describedby={description ? `${id}-description` : undefined}
        ref={ref}
      >
        <button
          className="icon-button modal-close"
          onClick={onClose}
          aria-label="Close dialog"
        >
          <X size={19} />
        </button>
        {icon && <div className="modal-icon">{icon}</div>}
        <div className="modal-heading">
          <h2 id={id}>{title}</h2>
          {description && <p id={`${id}-description`}>{description}</p>}
        </div>
        {children}
      </div>
    </div>,
    document.body,
  );
}
export function TemplateArt({ type }: { type: TemplateId }) {
  const Icon =
    type === "project"
      ? FileText
      : type === "meeting"
        ? ListTodo
        : type === "brainstorm"
          ? Lightbulb
          : Plus;
  return (
    <div className={`template-art art-${type}`} aria-hidden="true">
      {type === "blank" ? (
        <span className="blank-paper">
          <Plus size={25} strokeWidth={1.4} />
        </span>
      ) : (
        <>
          <span className="art-orbit" />
          <span className="art-paper">
            <Icon size={18} strokeWidth={1.5} />
            <span className="paper-heading" />
            <span className="paper-line" />
            <span className="paper-line short" />
            {type === "meeting" ? (
              <span className="paper-check">
                <Check size={9} />
                <span />
              </span>
            ) : (
              <span className="paper-block" />
            )}
          </span>
          <span className="art-sticker">
            {type === "brainstorm" ? (
              <Sparkles size={15} />
            ) : (
              <ArrowUpRight size={17} />
            )}
          </span>
        </>
      )}
    </div>
  );
}
export function EmptyIllustration() {
  return (
    <div className="empty-illustration" aria-hidden="true">
      <span className="empty-sheet back" />
      <span className="empty-sheet front">
        <FileText size={34} strokeWidth={1.2} />
        <i />
        <i />
      </span>
      <span className="empty-spark">
        <Sparkles size={21} />
      </span>
    </div>
  );
}
export function LoadingDots() {
  return (
    <span className="loading-dots" aria-label="Loading">
      <i />
      <i />
      <i />
    </span>
  );
}
