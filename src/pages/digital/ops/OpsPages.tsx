import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link, useNavigate, useParams, useSearchParams } from "react-router-dom";
import { ArrowLeft, ArrowRight, CheckCircle2, Circle, Copy, Download, ExternalLink, Mail, Plus, Search, Sparkles, Trash2, Upload, X } from "lucide-react";
import { toast } from "sonner";
import { isWorkspaceBackup, migrate, toCsv } from "@/features/digital/store";
import type { WorkspaceState } from "@/features/digital/types";
import {
  ConfirmDelete,
  EmptyState,
  Money,
  PageHeader,
  Panel,
  btnGhost,
  btnPrimary,
  download,
  fieldClass,
  formatDate,
  labelClass,
  linkClass,
} from "@/features/digital/components";
import { PACKAGES, attentionRank, checklistProgress, isTaskDone, nextTask, packageName, tasksFor, workspaceSnapshot } from "@/features/ops/playbook";
import { useOps, type NewClient } from "@/features/ops/store";
import * as cloud from "@/features/cloud/api";
import { useAuth } from "@/features/cloud/auth";
import { siteUrl } from "@/lib/site";
import { STAGES, type Client, type PackageId, type Stage } from "@/features/ops/types";

export const OPS = "/internal";
export const clientBase = (id: string) => `${OPS}/clients/${id}/workspace`;

const STAGE_STYLE: Record<Stage, string> = {
  lead: "bg-ll-info/15 text-ll-info",
  onboarding: "bg-ll-highlight/20 text-ll-warning",
  active: "bg-ll-success/15 text-ll-success",
  paused: "bg-muted text-muted-foreground",
};

export function StagePill({ stage }: { stage: Stage }) {
  return <span className={`inline-flex rounded-full px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wider ${STAGE_STYLE[stage]}`}>{stage}</span>;
}

function Progress({ pct, label }: { pct: number; label: string }) {
  return (
    <div className="flex items-center gap-2 min-w-[8rem]">
      <div className="h-1.5 flex-1 rounded-full bg-muted overflow-hidden" role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100} aria-label={label}>
        <div className="h-full rounded-full bg-primary" style={{ width: `${pct}%` }} />
      </div>
      <span className="font-mono text-xs tabular-nums text-muted-foreground w-9 text-right">{pct}%</span>
    </div>
  );
}

function useClientRows(clients: Client[]) {
  const { workspaceOf } = useOps();
  return useMemo(
    () =>
      clients.map((c) => {
        const ws = workspaceOf(c.id);
        return { c, ws, snap: workspaceSnapshot(ws), progress: checklistProgress(c, ws), next: nextTask(c, ws), rank: attentionRank(c, ws) };
      })
      .sort((a, b) => a.rank - b.rank || a.c.firmName.localeCompare(b.c.firmName)),
    [clients, workspaceOf],
  );
}

/* --------------------------------------------------------------- overview */

export function OpsOverview() {
  const { ops, loadExampleClients } = useOps();
  const rows = useClientRows(ops.clients);

  if (!ops.clients.length) {
    return (
      <div className="max-w-4xl">
        <PageHeader eyebrow="Internal" title="Operations" description="Manage every client firm, deliver their package, and run their LegacyLift workspace for them." />
        <EmptyState title="No clients yet">
          <p>Add your first client, or load three example firms to see how the console works.</p>
          <div className="flex flex-wrap justify-center gap-2">
            <Link to={`${OPS}/clients?new=1`} className={btnPrimary}>
              <Plus size={16} aria-hidden="true" /> Add client
            </Link>
            <button type="button" className={btnGhost} onClick={loadExampleClients}>
              Load example clients
            </button>
          </div>
        </EmptyState>
      </div>
    );
  }

  const byStage = (s: Stage) => ops.clients.filter((c) => c.stage === s).length;
  const openTasks = rows.filter((r) => r.c.stage !== "paused").reduce((s, r) => s + (r.progress.total - r.progress.done), 0);
  const attention = rows
    .flatMap(({ c, snap, progress }) => [
      ...(snap.overdueCount ? [{ c, tone: "critical" as const, text: `${snap.overdueCount} overdue invoice(s) — offer to send reminders`, to: `${clientBase(c.id)}/invoices`, cta: "Open invoices" }] : []),
      ...(c.stage === "onboarding" && progress.pct < 100 ? [{ c, tone: "info" as const, text: `Onboarding ${progress.done}/${progress.total} tasks done`, to: `${OPS}/clients/${c.id}`, cta: "Continue" }] : []),
      ...(snap.lowStock ? [{ c, tone: "warning" as const, text: `${snap.lowStock} stock item(s) below reorder level`, to: `${clientBase(c.id)}/stock`, cta: "Open stock" }] : []),
      ...(c.stage === "lead" ? [{ c, tone: "info" as const, text: "Lead — book the kick-off call", to: `${OPS}/clients/${c.id}`, cta: "Open" }] : []),
    ])
    .slice(0, 10);
  const dot = { critical: "bg-destructive", warning: "bg-ll-warning", info: "bg-ll-info" };

  return (
    <div className="max-w-6xl">
      <PageHeader
        eyebrow="Internal"
        title="Operations"
        description="All client firms at a glance. Open a client to work through their package, or jump straight into their workspace."
        actions={
          <Link to={`${OPS}/clients?new=1`} className={btnPrimary}>
            <Plus size={16} aria-hidden="true" /> Add client
          </Link>
        }
      />
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-px bg-border border border-border rounded-lg overflow-hidden mb-6">
        {[
          { label: "Active clients", v: byStage("active"), sub: `${ops.clients.length} in total` },
          { label: "Onboarding", v: byStage("onboarding"), sub: `${byStage("lead")} lead(s) waiting` },
          { label: "Open service tasks", v: openTasks, sub: "across non-paused clients" },
          { label: "Clients with overdue money", v: rows.filter((r) => r.snap.overdueCount).length, sub: "reminders to offer" },
        ].map((k) => (
          <div key={k.label} className="bg-card p-4">
            <p className="text-xs uppercase tracking-wider text-muted-foreground">{k.label}</p>
            <p className="mt-1 text-2xl font-semibold font-mono">{k.v}</p>
            <p className="text-xs text-muted-foreground">{k.sub}</p>
          </div>
        ))}
      </div>

      <div className="grid gap-6 lg:grid-cols-[1.3fr_1fr]">
        <Panel>
          <h2 className="font-heading text-lg font-semibold mb-3">Needs attention</h2>
          {attention.length === 0 ? (
            <p className="text-sm text-muted-foreground">Nothing urgent across your clients.</p>
          ) : (
            <ul className="divide-y divide-border">
              {attention.map((a, i) => (
                <li key={i} className="flex items-start gap-3 py-2.5 text-sm">
                  <span className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${dot[a.tone]}`} aria-hidden="true" />
                  <span className="flex-1">
                    <span className="font-medium">{a.c.firmName}</span>
                    <span className="block text-muted-foreground">{a.text}</span>
                  </span>
                  <Link to={a.to} className={`text-xs whitespace-nowrap ${linkClass}`}>
                    {a.cta}
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </Panel>
        <Panel>
          <h2 className="font-heading text-lg font-semibold mb-3">Clients by package</h2>
          <ul className="flex flex-col gap-3">
            {PACKAGES.map((p) => {
              const n = ops.clients.filter((c) => c.package === p.id).length;
              return (
                <li key={p.id} className="flex items-center justify-between gap-3 text-sm">
                  <span>
                    <span className="font-medium">{p.name}</span>
                    <span className="block text-xs text-muted-foreground">{p.summary}</span>
                  </span>
                  <span className="font-mono text-lg font-semibold">{n}</span>
                </li>
              );
            })}
          </ul>
        </Panel>
      </div>
    </div>
  );
}

/* ---------------------------------------------------------------- clients */

const BLANK: NewClient = { firmName: "", contactName: "", email: "", phone: "", industry: "", city: "", package: "start", stage: "lead", owner: "", notes: "" };

function ClientForm({ initial, submitLabel, onSubmit }: { initial: NewClient; submitLabel: string; onSubmit: (c: NewClient) => void }) {
  const [c, setC] = useState(initial);
  const text = (k: keyof NewClient, label: string, type = "text") => (
    <label className={labelClass}>
      {label}
      <input id={`client-${k}`} type={type} className={fieldClass} value={c[k] as string} onChange={(e) => setC({ ...c, [k]: e.target.value })} />
    </label>
  );
  return (
    <form
      className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3"
      onSubmit={(e) => {
        e.preventDefault();
        if (!c.firmName.trim()) {
          toast.error("Enter the firm's name.");
          return;
        }
        onSubmit(c);
      }}
    >
      {text("firmName", "Firm name")}
      {text("contactName", "Contact person")}
      {text("industry", "Trade / industry")}
      {text("email", "Email", "email")}
      {text("phone", "Phone", "tel")}
      {text("city", "City")}
      <label className={labelClass}>
        Package
        <select id="client-package" className={fieldClass} value={c.package} onChange={(e) => setC({ ...c, package: e.target.value as PackageId })}>
          {PACKAGES.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
            </option>
          ))}
        </select>
      </label>
      <label className={labelClass}>
        Stage
        <select id="client-stage" className={fieldClass} value={c.stage} onChange={(e) => setC({ ...c, stage: e.target.value as Stage })}>
          {STAGES.map((s) => (
            <option key={s}>{s}</option>
          ))}
        </select>
      </label>
      {text("owner", "Account owner (team member)")}
      <label className={`${labelClass} sm:col-span-2 lg:col-span-3`}>
        Notes
        <textarea id="client-notes" rows={2} className={fieldClass} value={c.notes} onChange={(e) => setC({ ...c, notes: e.target.value })} />
      </label>
      <div className="sm:col-span-2 lg:col-span-3">
        <button type="submit" className={btnPrimary}>
          {submitLabel}
        </button>
      </div>
    </form>
  );
}

export function OpsClients() {
  const { ops, addClient, loadExampleClients } = useOps();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const [adding, setAdding] = useState(() => params.has("new"));
  const [query, setQuery] = useState("");
  const [stage, setStage] = useState<Stage | "all">("all");
  const rows = useClientRows(ops.clients)
    .filter((r) => stage === "all" || r.c.stage === stage)
    .filter((r) => !query.trim() || `${r.c.firmName} ${r.c.contactName} ${r.c.city} ${r.c.industry}`.toLowerCase().includes(query.toLowerCase()));

  return (
    <div className="max-w-6xl">
      <PageHeader
        eyebrow="Internal"
        title="Clients"
        actions={
          <>
            {!ops.clients.length && (
              <button type="button" className={btnGhost} onClick={loadExampleClients}>
                Load example clients
              </button>
            )}
            <button type="button" className={btnPrimary} onClick={() => setAdding((v) => !v)} aria-expanded={adding}>
              <Plus size={16} aria-hidden="true" /> Add client
            </button>
          </>
        }
      />
      {adding && (
        <Panel className="mb-6">
          <h2 className="font-heading text-lg font-semibold mb-3">New client</h2>
          <ClientForm
            initial={{ ...BLANK, owner: ops.teamMember }}
            submitLabel="Create client"
            onSubmit={async (c) => {
              try {
                const created = await addClient(c);
                toast.success(`${created.firmName} added. Their workspace is ready.`);
                navigate(`${OPS}/clients/${created.id}`);
              } catch (err) {
                toast.error(err instanceof Error ? err.message : "Couldn't add the client.");
              }
            }}
          />
        </Panel>
      )}

      <div className="flex flex-col gap-2 sm:flex-row mb-4">
        <div className="relative flex-1">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
          <input aria-label="Search clients" className={`${fieldClass} pl-9`} placeholder="Search firm, contact, city…" value={query} onChange={(e) => setQuery(e.target.value)} />
        </div>
        <select aria-label="Filter by stage" className={`${fieldClass} sm:w-44`} value={stage} onChange={(e) => setStage(e.target.value as Stage | "all")}>
          <option value="all">All stages</option>
          {STAGES.map((s) => (
            <option key={s}>{s}</option>
          ))}
        </select>
      </div>

      {ops.clients.length === 0 ? (
        <EmptyState title="No clients yet">
          <p>Add a client firm to create its workspace and service checklist.</p>
        </EmptyState>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-border bg-card">
          <table className="w-full text-sm">
            <thead className="text-left text-xs uppercase tracking-wider text-muted-foreground border-b border-border">
              <tr>
                <th className="px-4 py-3 font-medium">Firm</th>
                <th className="px-4 py-3 font-medium">Package</th>
                <th className="px-4 py-3 font-medium">Stage</th>
                <th className="px-4 py-3 font-medium hidden md:table-cell">Next step</th>
                <th className="px-4 py-3 font-medium text-right hidden lg:table-cell">Overdue</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody>
              {rows.map(({ c, snap, progress, next }) => (
                <tr key={c.id} className="border-b border-border last:border-0 hover:bg-secondary/60">
                  <td className="px-4 py-3">
                    <Link to={`${OPS}/clients/${c.id}`} className={`font-medium ${linkClass} no-underline hover:underline`}>
                      {c.firmName}
                    </Link>
                    {c.source === "website" && <WebsiteBadge />}
                    <span className="block text-xs text-muted-foreground">{[c.contactName, c.city].filter(Boolean).join(" · ")}</span>
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap">{packageName(c.package)}</td>
                  <td className="px-4 py-3">
                    <StagePill stage={c.stage} />
                  </td>
                  <td className="px-4 py-3 hidden md:table-cell max-w-[18rem]">
                    <p className="text-sm truncate" title={next?.task.label}>
                      {next ? next.task.label : <span className="text-ll-success">Package delivered</span>}
                    </p>
                    <Progress pct={progress.pct} label={`${c.firmName} service progress`} />
                  </td>
                  <td className="px-4 py-3 text-right hidden lg:table-cell">
                    {snap.overdueCount ? <Money value={snap.overdueAmount} currency={snap.currency} className="text-destructive" /> : <span className="text-muted-foreground">—</span>}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <Link to={clientBase(c.id)} className={`${btnGhost} whitespace-nowrap`}>
                      Workspace <ArrowRight size={14} aria-hidden="true" />
                    </Link>
                  </td>
                </tr>
              ))}
              {rows.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-4 py-6 text-center text-muted-foreground">
                    No clients match.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

/* ----------------------------------------------------------- client detail */

export function OpsClientDetail() {
  const { id = "" } = useParams();
  const navigate = useNavigate();
  const { mode, ops, updateClient, toggleTask, addNote, removeClient, workspaceOf, replaceWorkspace } = useOps();
  const [note, setNote] = useState("");
  const [editing, setEditing] = useState(false);
  const [pendingImport, setPendingImport] = useState<{ name: string; data: WorkspaceState } | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const c = ops.clients.find((x) => x.id === id);
  const ws = workspaceOf(id);

  if (!c) {
    return (
      <EmptyState title="Client not found">
        <Link to={`${OPS}/clients`} className={linkClass}>
          Back to clients
        </Link>
      </EmptyState>
    );
  }

  const snap = workspaceSnapshot(ws);
  const progress = checklistProgress(c, ws);
  const next = nextTask(c, ws);

  async function readClientBackup(file: File) {
    let raw: unknown = null;
    try {
      raw = JSON.parse(await file.text());
    } catch {
      // not JSON
    }
    if (!isWorkspaceBackup(raw)) {
      toast.error("That file isn't a LegacyLift backup.");
      return;
    }
    setPendingImport({ name: file.name, data: migrate(raw) });
  }
  const base = clientBase(c.id);
  const { id: _id, createdAt: _ca, manualDone: _md, log: _log, ...editable } = c;

  return (
    <div className="max-w-6xl">
      <Link to={`${OPS}/clients`} className={`inline-flex items-center gap-1 text-sm mb-4 ${linkClass} no-underline`}>
        <ArrowLeft size={16} aria-hidden="true" /> All clients
      </Link>
      <PageHeader
        eyebrow={`${packageName(c.package)} · ${c.industry || "Client"}${c.city ? ` · ${c.city}` : ""}${c.source === "website" ? " · Signed up on the website" : ""}`}
        title={c.firmName}
        description={[c.contactName, c.phone, c.email].filter(Boolean).join(" · ")}
        actions={
          <>
            <button type="button" className={btnGhost} onClick={() => setEditing((v) => !v)} aria-expanded={editing}>
              Edit details
            </button>
            <Link to={base} className={btnPrimary}>
              Open workspace <ExternalLink size={15} aria-hidden="true" />
            </Link>
          </>
        }
      />

      {editing && (
        <Panel className="mb-6">
          <ClientForm
            initial={editable}
            submitLabel="Save"
            onSubmit={(v) => {
              const changes = [v.stage !== c.stage && `Stage: ${c.stage} → ${v.stage}`, v.package !== c.package && `Package: ${packageName(c.package)} → ${packageName(v.package)}`].filter(Boolean);
              updateClient(c.id, v, changes.length ? changes.join(" · ") : "Details updated");
              setEditing(false);
            }}
          />
        </Panel>
      )}

      <div className="flex flex-wrap items-center gap-3 mb-6">
        <span className="text-sm text-muted-foreground">Stage</span>
        <div role="radiogroup" aria-label="Stage" className="inline-flex rounded-md border border-border bg-card p-1">
          {STAGES.map((s) => (
            <button
              key={s}
              type="button"
              role="radio"
              aria-checked={c.stage === s}
              onClick={() => c.stage !== s && updateClient(c.id, { stage: s }, `Stage: ${c.stage} → ${s}`)}
              className={`px-3 py-1.5 text-sm rounded capitalize focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${c.stage === s ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"}`}
            >
              {s}
            </button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-px bg-border border border-border rounded-lg overflow-hidden mb-6">
        {[
          { label: "Customers", node: <span className="font-mono">{snap.customers}</span>, to: `${base}/customers` },
          { label: "Awaiting payment", node: <Money value={snap.openAmount} currency={snap.currency} />, to: `${base}/invoices` },
          {
            label: "Overdue",
            node: <Money value={snap.overdueAmount} currency={snap.currency} className={snap.overdueCount ? "text-destructive" : ""} />,
            to: `${base}/invoices`,
          },
          { label: "Digital score", node: <span className="font-mono">{snap.roadmapScore ?? "—"}</span>, to: `${base}/roadmap` },
        ].map((k) => (
          <Link key={k.label} to={k.to} className="bg-card p-4 hover:bg-secondary/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
            <p className="text-xs uppercase tracking-wider text-muted-foreground">{k.label}</p>
            <p className="mt-1 text-xl font-semibold">{k.node}</p>
          </Link>
        ))}
      </div>

      {next ? (
        <div className="mb-6 flex flex-col gap-3 rounded-lg border-2 border-primary bg-card p-5 sm:flex-row sm:items-center">
          <div className="flex-1">
            <p className="text-xs uppercase tracking-[0.12em] text-primary font-semibold">Next step · {next.pkg.name}</p>
            <p className="mt-1 font-heading text-xl font-semibold">{next.task.label}</p>
            <p className="text-sm text-muted-foreground">{next.task.how}</p>
          </div>
          <div className="flex flex-wrap gap-2">
            {next.task.path && (
              <Link to={`${base}${next.task.path}`} className={btnPrimary}>
                Do it now <ArrowRight size={16} aria-hidden="true" />
              </Link>
            )}
            {!next.task.auto && (
              <button type="button" className={next.task.path ? btnGhost : btnPrimary} onClick={() => toggleTask(c.id, next.task.id, next.task.label)}>
                <CheckCircle2 size={16} aria-hidden="true" /> Mark as done
              </button>
            )}
          </div>
        </div>
      ) : (
        <div className="mb-6 rounded-lg border border-ll-success/50 bg-ll-success/10 p-4 text-sm">
          <strong>{packageName(c.package)} fully delivered.</strong> Keep an eye on overdue invoices and book the next review.
        </div>
      )}

      <div className="grid gap-6 lg:grid-cols-[1.5fr_1fr]">
        <Panel>
          <div className="flex items-center justify-between gap-3 mb-1">
            <h2 className="font-heading text-lg font-semibold">Service checklist</h2>
            <Progress pct={progress.pct} label="Service progress" />
          </div>
          <p className="text-xs text-muted-foreground mb-4">
            {progress.done} of {progress.total} done. Tasks marked <Sparkles size={11} className="inline text-primary" aria-label="automatic" /> tick themselves off from the client's workspace.
          </p>
          <div className="flex flex-col gap-6">
            {PACKAGES.slice(0, PACKAGES.findIndex((p) => p.id === c.package) + 1).map((pkg) => (
              <section key={pkg.id} aria-labelledby={`pkg-${pkg.id}`}>
                <h3 id={`pkg-${pkg.id}`} className="text-xs uppercase tracking-[0.12em] text-primary font-semibold mb-2">
                  {pkg.name}
                </h3>
                <ul className="divide-y divide-border">
                  {tasksFor(c.package)
                    .filter((t) => t.pkg.id === pkg.id)
                    .map(({ task }) => {
                      const auto = Boolean(task.auto?.(ws));
                      const done = isTaskDone(c, task, ws);
                      return (
                        <li key={task.id} className="flex items-start gap-3 py-2.5">
                          <button
                            type="button"
                            role="checkbox"
                            aria-checked={done}
                            aria-label={task.label}
                            disabled={auto}
                            onClick={() => toggleTask(c.id, task.id, task.label)}
                            className="mt-0.5 shrink-0 rounded focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-default"
                          >
                            {done ? <CheckCircle2 size={20} className="text-ll-success" aria-hidden="true" /> : <Circle size={20} className="text-muted-foreground" aria-hidden="true" />}
                          </button>
                          <div className="flex-1 min-w-0">
                            <p className={`text-sm font-medium ${done ? "text-muted-foreground line-through" : ""}`}>
                              {task.label} {task.auto && <Sparkles size={12} className="inline text-primary" aria-label="ticks off automatically" />}
                            </p>
                            <p className="text-xs text-muted-foreground">{auto ? "Detected in the client's workspace." : task.how}</p>
                          </div>
                          {task.path && !done && (
                            <Link to={`${base}${task.path}`} className={`${btnGhost} whitespace-nowrap text-xs px-2.5 py-1.5`}>
                              Do it <ArrowRight size={13} aria-hidden="true" />
                            </Link>
                          )}
                        </li>
                      );
                    })}
                </ul>
              </section>
            ))}
          </div>
        </Panel>

        <div className="flex flex-col gap-6">
          <Panel>
            <h2 className="font-heading text-lg font-semibold mb-3">Quick actions in their workspace</h2>
            <div className="grid grid-cols-2 gap-2">
              {[
                ["New invoice", "/invoices/new?kind=invoice"],
                ["New quote", "/invoices/new?kind=quote"],
                ["Digitize paper", "/digitize"],
                ["Customers", "/customers"],
                ["Stock", "/stock"],
                ["Ask the assistant", "/assistant"],
                ["Write a letter", "/writer"],
                ["Business details", "/settings"],
              ].map(([label, path]) => (
                <Link key={path} to={`${base}${path}`} className={`${btnGhost} justify-start`}>
                  {label}
                </Link>
              ))}
            </div>
          </Panel>

          <Panel>
            <h2 className="font-heading text-lg font-semibold mb-3">Activity</h2>
            <form
              className="flex gap-2 mb-4"
              onSubmit={(e) => {
                e.preventDefault();
                if (!note.trim()) return;
                addNote(c.id, note.trim());
                setNote("");
              }}
            >
              <label htmlFor="client-note" className="sr-only">
                Add a note
              </label>
              <input id="client-note" className={fieldClass} placeholder="Call notes, decisions, next steps…" value={note} onChange={(e) => setNote(e.target.value)} />
              <button type="submit" className={btnPrimary} disabled={!note.trim()}>
                Add
              </button>
            </form>
            <ol className="flex flex-col gap-3 max-h-80 overflow-y-auto">
              {c.log.map((l) => (
                <li key={l.id} className="text-sm border-l-2 border-border pl-3">
                  <p>{l.text}</p>
                  <p className="text-xs text-muted-foreground">
                    {formatDate(l.at.slice(0, 10))}
                    {l.author && ` · ${l.author}`}
                  </p>
                </li>
              ))}
            </ol>
          </Panel>

          {mode === "cloud" && <ClientAccess firmId={c.id} firmName={c.firmName} defaultEmail={c.email} />}

          <Panel className="flex flex-col gap-3">
            <h2 className="font-heading text-lg font-semibold">{mode === "cloud" ? "Backups" : "Hand over to the client"}</h2>
            {mode === "cloud" ? (
              <p className="text-sm text-muted-foreground">
                Download a copy of this workspace, or bring in a backup the client made while using LegacyLift on their own device.
              </p>
            ) : (
              <ol className="list-decimal pl-5 text-sm text-muted-foreground space-y-1">
                <li>Download their workspace file and send it to them.</li>
                <li>They open LegacyLift, go to Settings → Restore backup, and pick the file.</li>
                <li>When they send a backup back, import it here to see their latest data.</li>
              </ol>
            )}
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                className={btnGhost}
                onClick={() => download(`${c.firmName.replace(/\W+/g, "-").toLowerCase()}-workspace.json`, JSON.stringify(ws, null, 2), "application/json")}
              >
                <Download size={16} aria-hidden="true" /> Download workspace
              </button>
              <button type="button" className={btnGhost} onClick={() => fileRef.current?.click()}>
                <Upload size={16} aria-hidden="true" /> Import client's backup
              </button>
              <input
                ref={fileRef}
                type="file"
                accept="application/json,.json"
                className="sr-only"
                aria-label="Choose the client's backup file"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) readClientBackup(f);
                  e.target.value = "";
                }}
              />
            </div>
            {pendingImport && (
              <div role="alert" className="rounded-md border border-ll-highlight/60 bg-ll-highlight/10 p-3 text-sm flex flex-col gap-2">
                <p>
                  <strong>{pendingImport.name}</strong> has {pendingImport.data.customers.length} customers, {pendingImport.data.invoices.length} invoices and quotes and{" "}
                  {pendingImport.data.stock.length} stock items. It replaces the copy of {c.firmName}'s workspace kept here.
                </p>
                <div className="flex gap-2">
                  <button
                    type="button"
                    className={btnPrimary}
                    onClick={async () => {
                      try {
                        await replaceWorkspace(c.id, pendingImport.data);
                        addNote(c.id, `Imported client's backup (${pendingImport.name})`);
                        toast.success("Client's backup imported");
                      } catch (err) {
                        toast.error(err instanceof Error ? err.message : "Couldn't import the backup.");
                      }
                      setPendingImport(null);
                    }}
                  >
                    Import
                  </button>
                  <button type="button" className={btnGhost} onClick={() => setPendingImport(null)}>
                    Cancel
                  </button>
                </div>
              </div>
            )}
          </Panel>

          <Panel className="flex flex-wrap items-center gap-2">
            <span className="flex-1 text-sm text-muted-foreground">Remove this client and their workspace</span>
            <ConfirmDelete
              label={`Delete ${c.firmName}`}
              onConfirm={() => {
                removeClient(c.id);
                toast.success(`${c.firmName} removed`);
                navigate(`${OPS}/clients`);
              }}
            >
              <Trash2 size={16} aria-hidden="true" />
            </ConfirmDelete>
          </Panel>
        </div>
      </div>
    </div>
  );
}

/* ---------------------------------------------------------------- playbook */

export function OpsPlaybook() {
  return (
    <div className="max-w-5xl">
      <PageHeader
        eyebrow="Internal"
        title="Service playbook"
        description="What we deliver in each package and where in the workspace each task is done. Packages build on each other."
      />
      <div className="flex flex-col gap-6">
        {PACKAGES.map((p) => (
          <Panel key={p.id}>
            <h2 className="font-heading text-xl font-bold">{p.name}</h2>
            <p className="text-sm text-muted-foreground mb-4">{p.summary}</p>
            <ol className="flex flex-col gap-3">
              {p.tasks.map((t, i) => (
                <li key={t.id} className="grid grid-cols-[2rem_1fr] gap-2 text-sm">
                  <span className="font-mono text-muted-foreground">{String(i + 1).padStart(2, "0")}</span>
                  <div>
                    <p className="font-medium">
                      {t.label} {t.auto && <Sparkles size={12} className="inline text-primary" aria-label="ticks off automatically" />}
                    </p>
                    <p className="text-muted-foreground">{t.how}</p>
                    {t.path && <p className="text-xs font-mono text-primary mt-0.5">Workspace → {t.path.split("?")[0]}</p>}
                  </div>
                </li>
              ))}
            </ol>
          </Panel>
        ))}
      </div>
    </div>
  );
}

/* ----------------------------------------------------------- client access (cloud) */

function ClientAccess({ firmId, firmName, defaultEmail }: { firmId: string; firmName: string; defaultEmail: string }) {
  const auth = useAuth();
  const [access, setAccess] = useState<{ members: { userId: string; email: string }[]; invites: string[] } | null>(null);
  const [email, setEmail] = useState(defaultEmail);
  const [busy, setBusy] = useState(false);

  const load = useCallback(() => {
    cloud
      .listAccess(firmId)
      .then(setAccess)
      .catch((err) => toast.error(err instanceof Error ? err.message : "Couldn't load who has access."));
  }, [firmId]);
  useEffect(load, [load]);

  const appLink = siteUrl("/app");
  const message = (to: string) =>
    `Hello,\n\nyour LegacyLift workspace for ${firmName} is ready.\n\n1. Open ${appLink}\n2. Choose "Create account" and use this email address: ${to}\n3. Confirm your email, sign in, and your business opens.\n\nKind regards`;

  return (
    <Panel className="flex flex-col gap-3">
      <h2 className="font-heading text-lg font-semibold">Client access</h2>
      <p className="text-sm text-muted-foreground">
        Invite the people at {firmName} who should use their workspace. They create an account with the invited email and their business opens straight away.
      </p>
      <form
        className="flex gap-2"
        onSubmit={async (e) => {
          e.preventDefault();
          if (!email.includes("@")) {
            toast.error("Enter an email address.");
            return;
          }
          setBusy(true);
          try {
            const invited = await cloud.inviteToFirm(firmId, email, auth.session?.user.id ?? "");
            toast.success(`Invite ready for ${invited}. Send them the message below.`);
            setEmail("");
            load();
          } catch (err) {
            toast.error(err instanceof Error ? err.message : "Couldn't create the invite.");
          } finally {
            setBusy(false);
          }
        }}
      >
        <label htmlFor={`invite-${firmId}`} className="sr-only">
          Client's email
        </label>
        <input id={`invite-${firmId}`} type="email" className={fieldClass} placeholder="name@their-business.com" value={email} onChange={(e) => setEmail(e.target.value)} />
        <button type="submit" className={btnPrimary} disabled={busy}>
          Invite
        </button>
      </form>

      {access === null ? (
        <p className="text-sm text-muted-foreground">Loading…</p>
      ) : (
        <ul className="flex flex-col divide-y divide-border text-sm">
          {access.members.map((m) => (
            <li key={m.userId} className="flex items-center gap-2 py-2">
              <CheckCircle2 size={16} className="text-ll-success shrink-0" aria-hidden="true" />
              <span className="flex-1 truncate">{m.email}</span>
              <span className="text-xs text-muted-foreground">Has access</span>
              <ConfirmDelete
                label={`Remove access for ${m.email}`}
                onConfirm={() =>
                  cloud
                    .removeMember(firmId, m.userId)
                    .then(load)
                    .catch((err) => toast.error(err.message))
                }
              >
                <X size={16} aria-hidden="true" />
              </ConfirmDelete>
            </li>
          ))}
          {access.invites.map((to) => (
            <li key={to} className="flex flex-col gap-2 py-2">
              <div className="flex items-center gap-2">
                <Mail size={16} className="text-ll-info shrink-0" aria-hidden="true" />
                <span className="flex-1 truncate">{to}</span>
                <span className="text-xs text-muted-foreground">Invited</span>
                <ConfirmDelete
                  label={`Cancel invite for ${to}`}
                  onConfirm={() =>
                    cloud
                      .cancelInvite(firmId, to)
                      .then(load)
                      .catch((err) => toast.error(err.message))
                  }
                >
                  <X size={16} aria-hidden="true" />
                </ConfirmDelete>
              </div>
              <div className="flex flex-wrap gap-2 pl-6">
                <button
                  type="button"
                  className={`${btnGhost} text-xs px-2.5 py-1.5`}
                  onClick={() =>
                    navigator.clipboard.writeText(message(to)).then(
                      () => toast.success("Invite message copied"),
                      () => toast.error("Copy was blocked. Use the email button instead."),
                    )
                  }
                >
                  <Copy size={13} aria-hidden="true" /> Copy invite message
                </button>
                <a
                  className={`${btnGhost} text-xs px-2.5 py-1.5`}
                  href={`mailto:${to}?subject=${encodeURIComponent(`Your LegacyLift workspace for ${firmName}`)}&body=${encodeURIComponent(message(to))}`}
                >
                  <Mail size={13} aria-hidden="true" /> Email it
                </a>
              </div>
            </li>
          ))}
          {access.members.length === 0 && access.invites.length === 0 && <li className="py-2 text-muted-foreground">Nobody from the firm has access yet.</li>}
        </ul>
      )}
    </Panel>
  );
}

/* ---------------------------------------------------------------- team (cloud) */

export function OpsTeam() {
  const [team, setTeam] = useState<{ userId: string; email: string; displayName: string }[] | null>(null);
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const load = useCallback(() => {
    cloud
      .listStaff()
      .then(setTeam)
      .catch((err) => toast.error(err.message));
  }, []);
  useEffect(load, [load]);

  return (
    <div className="max-w-3xl">
      <PageHeader eyebrow="Internal" title="Team" description="Everyone here can see and work on all clients. Add colleagues after they have created an account and confirmed their email." />
      <Panel className="mb-6">
        <h2 className="font-heading text-lg font-semibold mb-3">Add a colleague</h2>
        <form
          className="grid gap-3 sm:grid-cols-[1fr_1fr_auto] sm:items-end"
          onSubmit={async (e) => {
            e.preventDefault();
            try {
              const ok = await cloud.addStaff(email, name);
              if (ok) {
                toast.success(`${email} is now on the team.`);
                setEmail("");
                setName("");
                load();
              } else {
                toast.error(`No confirmed account for ${email}. Ask them to create one at ${siteUrl("/internal")} first.`);
              }
            } catch (err) {
              toast.error(err instanceof Error ? err.message : "Couldn't add them.");
            }
          }}
        >
          <label className={labelClass}>
            Email
            <input id="staff-email" type="email" required className={fieldClass} value={email} onChange={(e) => setEmail(e.target.value)} />
          </label>
          <label className={labelClass}>
            Name
            <input id="staff-name" className={fieldClass} value={name} onChange={(e) => setName(e.target.value)} />
          </label>
          <button type="submit" className={btnPrimary}>
            Add to team
          </button>
        </form>
      </Panel>
      <Panel>
        <h2 className="font-heading text-lg font-semibold mb-3">Team members</h2>
        {team === null ? (
          <p className="text-sm text-muted-foreground">Loading…</p>
        ) : (
          <ul className="divide-y divide-border text-sm">
            {team.map((t) => (
              <li key={t.userId} className="py-2 flex justify-between gap-3">
                <span className="font-medium">{t.displayName || "—"}</span>
                <span className="text-muted-foreground truncate">{t.email}</span>
              </li>
            ))}
          </ul>
        )}
      </Panel>
    </div>
  );
}

function WebsiteBadge() {
  return <span className="ml-2 rounded-full bg-ll-info/15 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-ll-info">Website sign-up</span>;
}

const PROVIDER_LABEL: Record<string, string> = { email: "Email", google: "Google", azure: "Microsoft" };
const providerLabels = (providers: string) =>
  providers
    .split(",")
    .map((p) => p.trim())
    .filter(Boolean)
    .map((p) => PROVIDER_LABEL[p] ?? p);

type AccountFilter = "all" | "new" | "nobusiness" | "team";

/** Every account, from the private register. Staff only; the database refuses anyone else. */
export function OpsAccounts() {
  const [accounts, setAccounts] = useState<cloud.Account[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<AccountFilter>("all");
  const load = useCallback(() => {
    setError(null);
    cloud
      .accountRegister()
      .then(setAccounts)
      .catch((err) => setError(err instanceof Error ? err.message : String(err)));
  }, []);
  useEffect(load, [load]);

  const weekAgo = Date.now() - 7 * 86400000;
  const isNew = (a: cloud.Account) => Date.parse(a.createdAt) >= weekAgo;
  const list = accounts ?? [];
  const rows = list
    .filter((a) => (filter === "new" ? isNew(a) : filter === "nobusiness" ? !a.isStaff && a.businesses.length === 0 : filter === "team" ? a.isStaff : true))
    .filter((a) => !query.trim() || `${a.email} ${a.fullName} ${a.businesses.map((b) => b.name).join(" ")}`.toLowerCase().includes(query.trim().toLowerCase()));
  const count = (p: string) => list.filter((a) => a.providers.split(",").some((x) => x.trim() === p)).length;
  const when = (iso: string | null) => (iso ? `${formatDate(iso.slice(0, 10))} ${iso.slice(11, 16)}` : "—");

  return (
    <div className="max-w-6xl">
      <PageHeader
        eyebrow="Internal · confidential"
        title="Accounts"
        description="Everyone who has created a LegacyLift account, newest first. This list comes from a private register that the website itself cannot read; only people on the team can open this page."
        actions={
          <>
            <button type="button" className={btnGhost} onClick={load}>
              Refresh
            </button>
            <button
              type="button"
              className={btnGhost}
              disabled={!rows.length}
              onClick={() =>
                download(
                  `legacylift-accounts-${new Date().toISOString().slice(0, 10)}.csv`,
                  toCsv(
                    ["Email", "Name", "Sign-in", "Signed up", "Last sign-in", "Email confirmed", "Team", "Businesses"],
                    rows.map((a) => [a.email, a.fullName, providerLabels(a.providers).join(" + "), a.createdAt, a.lastSignInAt ?? "", a.emailConfirmed ? "yes" : "no", a.isStaff ? "yes" : "no", a.businesses.map((b) => b.name).join("; ")]),
                  ),
                  "text/csv",
                )
              }
            >
              <Download size={16} aria-hidden="true" /> Export CSV
            </button>
          </>
        }
      />

      {error && (
        <Panel className="mb-6 border-destructive/40">
          <p role="alert" className="text-sm text-destructive">
            {error}
          </p>
          <p className="mt-2 text-xs text-muted-foreground">If this says the function doesn't exist, the database update for accounts hasn't been applied yet (docs/DEPLOYMENT.md, step 1b).</p>
        </Panel>
      )}

      <div className="grid grid-cols-2 lg:grid-cols-5 gap-px bg-border border border-border rounded-lg overflow-hidden mb-6">
        {[
          ["Accounts", list.length],
          ["New this week", list.filter(isNew).length],
          ["Via Google", count("google")],
          ["Via Microsoft", count("azure")],
          ["Without a business", list.filter((a) => !a.isStaff && a.businesses.length === 0).length],
        ].map(([label, n]) => (
          <div key={label} className="bg-card p-4">
            <p className="text-xs uppercase tracking-wider text-muted-foreground">{label}</p>
            <p className="mt-1 text-2xl font-semibold font-mono">{accounts ? n : "…"}</p>
          </div>
        ))}
      </div>

      <div className="flex flex-col gap-2 sm:flex-row mb-4">
        <div className="relative flex-1">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
          <input aria-label="Search accounts" className={`${fieldClass} pl-9`} placeholder="Search email, name or business…" value={query} onChange={(e) => setQuery(e.target.value)} />
        </div>
        <select aria-label="Show" className={`${fieldClass} sm:w-56`} value={filter} onChange={(e) => setFilter(e.target.value as AccountFilter)}>
          <option value="all">All accounts</option>
          <option value="new">New this week</option>
          <option value="nobusiness">Without a business</option>
          <option value="team">Our team</option>
        </select>
      </div>

      {accounts === null && !error ? (
        <p className="text-sm text-muted-foreground">Loading…</p>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-border bg-card">
          <table className="w-full text-sm">
            <thead className="text-left text-xs uppercase tracking-wider text-muted-foreground border-b border-border">
              <tr>
                <th className="px-4 py-3 font-medium">Person</th>
                <th className="px-4 py-3 font-medium">Sign-in</th>
                <th className="px-4 py-3 font-medium hidden md:table-cell">Signed up</th>
                <th className="px-4 py-3 font-medium hidden lg:table-cell">Last sign-in</th>
                <th className="px-4 py-3 font-medium">Business</th>
                <th className="px-4 py-3">
                  <span className="sr-only">Remove</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {rows.map((a) => (
                <tr key={a.userId} className="border-b border-border last:border-0 align-top">
                  <td className="px-4 py-3">
                    <span className="font-medium">{a.fullName || a.email}</span>
                    {a.fullName && <span className="block text-xs text-muted-foreground">{a.email}</span>}
                    <span className="flex flex-wrap gap-1 mt-1">
                      {isNew(a) && <span className="rounded-full bg-ll-success/15 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-ll-success">New</span>}
                      {a.isStaff && <span className="rounded-full bg-secondary px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider">Team</span>}
                      {!a.emailConfirmed && <span className="rounded-full bg-ll-warning/15 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-ll-warning">Email not confirmed</span>}
                    </span>
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap">{providerLabels(a.providers).join(" + ")}</td>
                  <td className="px-4 py-3 whitespace-nowrap hidden md:table-cell">{when(a.createdAt)}</td>
                  <td className="px-4 py-3 whitespace-nowrap hidden lg:table-cell">{when(a.lastSignInAt)}</td>
                  <td className="px-4 py-3">
                    {a.businesses.length ? (
                      <ul className="flex flex-col gap-0.5">
                        {a.businesses.map((b) => (
                          <li key={b.id}>
                            <Link to={`${OPS}/clients/${b.id}`} className={linkClass}>
                              {b.name}
                            </Link>
                          </li>
                        ))}
                      </ul>
                    ) : (
                      <span className="text-muted-foreground">{a.isStaff ? "—" : "Not set up yet"}</span>
                    )}
                  </td>
                  <td className="px-2 py-3 text-right">
                    {!a.isStaff && (
                      <ConfirmDelete
                        label={`Remove the account of ${a.email}`}
                        onConfirm={() =>
                          cloud
                            .removeAccount(a.userId)
                            .then(() => {
                              toast.success(`${a.email} removed. Businesses they set up alone were deleted with it.`);
                              load();
                            })
                            .catch((err) => toast.error(err instanceof Error ? err.message : String(err)))
                        }
                      >
                        <Trash2 size={16} aria-hidden="true" />
                      </ConfirmDelete>
                    )}
                  </td>
                </tr>
              ))}
              {rows.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-4 py-6 text-center text-muted-foreground">
                    No accounts match.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
