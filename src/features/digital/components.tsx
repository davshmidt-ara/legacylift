import { useEffect, useState, type ReactNode } from "react";
import { FlaskConical } from "lucide-react";
import type { DisplayStatus } from "./types";

const focus =
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background";

export const fieldClass =
  "w-full px-3 py-2 bg-card border border-input rounded-md text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus-visible:ring-2 focus-visible:ring-ring";

export const labelClass = "flex flex-col gap-1 text-xs font-medium text-muted-foreground";

export const btnPrimary = `inline-flex items-center justify-center gap-2 px-4 py-2 bg-primary text-primary-foreground font-medium text-sm rounded-md hover:bg-primary/90 transition-colors disabled:opacity-50 disabled:pointer-events-none ${focus}`;

export const btnGhost = `inline-flex items-center justify-center gap-2 px-3 py-2 border border-border bg-card text-foreground text-sm rounded-md hover:bg-secondary transition-colors disabled:opacity-50 disabled:pointer-events-none ${focus}`;

export const btnDanger = `inline-flex items-center justify-center gap-2 px-3 py-2 bg-destructive text-destructive-foreground text-sm rounded-md hover:bg-destructive/90 ${focus}`;

export const iconBtn = `shrink-0 min-h-10 min-w-10 inline-flex items-center justify-center rounded-md text-muted-foreground hover:text-foreground hover:bg-secondary ${focus}`;

export const linkClass = `text-primary underline underline-offset-2 hover:no-underline ${focus} rounded-sm`;

export function PageHeader({ eyebrow, title, description, actions }: { eyebrow?: string; title: string; description?: string; actions?: ReactNode }) {
  return (
    <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between mb-8">
      <div className="min-w-0">
        {eyebrow && <p className="text-xs font-medium uppercase tracking-[0.12em] text-primary mb-2">{eyebrow}</p>}
        <h1 className="font-heading text-3xl md:text-4xl font-bold text-foreground">{title}</h1>
        {description && <p className="mt-2 text-sm text-muted-foreground max-w-2xl leading-relaxed">{description}</p>}
      </div>
      {actions && <div className="flex flex-wrap gap-2 no-print">{actions}</div>}
    </div>
  );
}

export function Panel({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <div className={`rounded-lg border border-border bg-card p-5 ${className}`}>{children}</div>;
}

export function EmptyState({ title, children }: { title: string; children?: ReactNode }) {
  return (
    <div className="rounded-lg border border-dashed border-border px-6 py-10 text-center">
      <p className="font-heading font-semibold text-lg">{title}</p>
      {children && <div className="mt-2 text-sm text-muted-foreground flex flex-col items-center gap-3">{children}</div>}
    </div>
  );
}

const STATUS_STYLE: Record<DisplayStatus, string> = {
  draft: "bg-muted text-muted-foreground",
  sent: "bg-ll-info/15 text-ll-info",
  paid: "bg-ll-success/15 text-ll-success",
  accepted: "bg-ll-success/15 text-ll-success",
  declined: "bg-muted text-muted-foreground line-through",
  overdue: "bg-destructive/15 text-destructive",
};

export function StatusPill({ status }: { status: DisplayStatus }) {
  return (
    <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wider ${STATUS_STYLE[status]}`}>
      {status}
    </span>
  );
}

/** Two-step delete: first click arms, second click confirms. Works where window.confirm is blocked. */
export function ConfirmDelete({ label, onConfirm, children }: { label: string; onConfirm: () => void; children: ReactNode }) {
  const [armed, setArmed] = useState(false);
  useEffect(() => {
    if (!armed) return;
    const t = setTimeout(() => setArmed(false), 4000);
    return () => clearTimeout(t);
  }, [armed]);
  return armed ? (
    <button type="button" className={btnDanger} onClick={onConfirm}>
      Confirm delete
    </button>
  ) : (
    <button type="button" className={iconBtn} aria-label={label} onClick={() => setArmed(true)}>
      {children}
    </button>
  );
}

export function DemoNotice({ show }: { show: boolean }) {
  if (!show) return null;
  return (
    <div role="status" className="flex items-start gap-2 rounded-md border border-ll-highlight/50 bg-ll-highlight/10 px-3 py-2 text-xs text-foreground">
      <FlaskConical size={14} className="mt-0.5 shrink-0 text-ll-warning" aria-hidden="true" />
      <span>
        Demo mode: the AI service isn't connected, so this result came from a simple built-in fallback. Deploy the{" "}
        <code className="font-mono">business-ai</code> function with an Anthropic API key for full AI results.
      </span>
    </div>
  );
}

export function formatMoney(amount: number | null | undefined, currency: string) {
  if (amount === null || amount === undefined || Number.isNaN(amount)) return "—";
  try {
    return new Intl.NumberFormat(undefined, {
      style: currency ? "currency" : "decimal",
      currency: currency || undefined,
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(amount);
  } catch {
    return `${amount.toFixed(2)} ${currency}`.trim();
  }
}

export function formatDate(iso: string) {
  if (!iso) return "—";
  const d = new Date(`${iso.slice(0, 10)}T12:00:00Z`);
  return Number.isNaN(d.getTime()) ? iso : d.toLocaleDateString(undefined, { day: "2-digit", month: "short", year: "numeric", timeZone: "UTC" });
}

export function Money({ value, currency, className = "" }: { value: number | null | undefined; currency: string; className?: string }) {
  return <span className={`font-mono tabular-nums ${className}`}>{formatMoney(value, currency)}</span>;
}

export function download(name: string, content: string, type: string) {
  const url = URL.createObjectURL(new Blob([content], { type }));
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
