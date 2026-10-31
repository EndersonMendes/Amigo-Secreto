"use client";

import {
  useEffect,
  useRef,
  type ButtonHTMLAttributes,
  type ReactNode,
} from "react";
import {
  AlertCircle,
  CheckCircle2,
  LoaderCircle,
  RefreshCw,
  X,
} from "lucide-react";

export function Button({
  children,
  busy,
  variant = "primary",
  className = "",
  disabled,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & {
  busy?: boolean;
  variant?: "primary" | "secondary" | "ghost" | "danger";
}) {
  return (
    <button
      className={`button button-${variant} ${className}`}
      disabled={disabled || busy}
      aria-busy={busy || undefined}
      {...props}
    >
      {busy && <LoaderCircle className="spin" size={17} aria-hidden="true" />}
      {children}
    </button>
  );
}

export function Alert({
  children,
  success = false,
}: {
  children: ReactNode;
  success?: boolean;
}) {
  return (
    <div
      className={`alert ${success ? "alert-success" : "alert-error"}`}
      role={success ? "status" : "alert"}
    >
      {success ? (
        <CheckCircle2 size={19} aria-hidden="true" />
      ) : (
        <AlertCircle size={19} aria-hidden="true" />
      )}
      <div>{children}</div>
    </div>
  );
}

export function LoadingBlock({
  label = "Carregando informações…",
}: {
  label?: string;
}) {
  return (
    <div className="loading-block" role="status" aria-live="polite">
      <div className="skeleton skeleton-short" />
      <div className="skeleton" />
      <div className="skeleton" />
      <span className="muted small">{label}</span>
    </div>
  );
}

export function ErrorBlock({
  message,
  retry,
}: {
  message: string;
  retry?: () => void;
}) {
  return (
    <div className="error-block">
      <Alert>{message}</Alert>
      <p className="muted small">
        As informações do evento não estão disponíveis no momento.
      </p>
      {retry && (
        <Button variant="secondary" onClick={retry}>
          <RefreshCw size={16} aria-hidden="true" />
          Tentar novamente
        </Button>
      )}
    </div>
  );
}

export function Dialog({
  title,
  children,
  onClose,
  busy = false,
}: {
  title: string;
  children: ReactNode;
  onClose: () => void;
  busy?: boolean;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const dialog = ref.current;
    dialog?.showModal();
    const oldOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      dialog?.close();
      document.body.style.overflow = oldOverflow;
    };
  }, []);
  return (
    <dialog
      ref={ref}
      className="dialog"
      aria-labelledby="dialog-title"
      onCancel={(event) => {
        event.preventDefault();
        if (!busy) onClose();
      }}
    >
      <div className="dialog-heading">
        <h2 id="dialog-title">{title}</h2>
        <button
          className="icon-button"
          aria-label="Fechar janela"
          onClick={onClose}
          disabled={busy}
        >
          <X size={21} />
        </button>
      </div>
      {children}
    </dialog>
  );
}

export function EmptyState({
  title,
  children,
}: {
  title: string;
  children: ReactNode;
}) {
  return (
    <div className="empty-state">
      <span className="eyebrow">Tudo no seu tempo</span>
      <h2>{title}</h2>
      <p className="muted">{children}</p>
    </div>
  );
}
