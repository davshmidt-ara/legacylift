// The service playbook: what the team delivers in each package, and how each task is performed
// in the client's workspace. Tasks with `auto` are ticked off by reading the client's workspace data.
import { invoiceTotals, lowStock, receivables } from "@/features/digital/finance";
import type { WorkspaceState } from "@/features/digital/types";
import type { Client, PackageId } from "./types";

export interface PlaybookTask {
  id: string;
  label: string;
  how: string;
  /** Workspace page that performs the task, relative to the client's workspace. */
  path?: string;
  /** Returns true when the client's data shows the task is done. */
  auto?: (ws: WorkspaceState) => boolean;
}

export interface ServicePackage {
  id: PackageId;
  name: string;
  summary: string;
  tasks: PlaybookTask[];
}

const START: PlaybookTask[] = [
  { id: "kickoff", label: "Kick-off call with the owner", how: "Agree goals, who at the firm is involved, and where the paper files are kept." },
  {
    id: "profile",
    label: "Enter the business details",
    how: "Name, address, phone, email and bank details for the letterhead.",
    path: "/settings",
    auto: (ws) => Boolean(ws.profile.businessName && ws.profile.address && ws.profile.bankDetails),
  },
  {
    id: "checkup",
    label: "Run the digital check-up with the owner",
    how: "Answer the ten questions together and walk through the roadmap it produces.",
    path: "/roadmap",
    auto: (ws) => Boolean(ws.roadmap),
  },
  {
    id: "customers",
    label: "Digitize the customer cards",
    how: "Photograph the card index; tick “Add to customers” when saving each one.",
    path: "/digitize",
    auto: (ws) => ws.customers.length > 0,
  },
  {
    id: "archive",
    label: "Digitize open invoices and key contracts",
    how: "Photograph unpaid invoices (tick “Add to Invoices”), leases and supplier contracts.",
    path: "/digitize",
    auto: (ws) => ws.records.length > 0,
  },
  { id: "training", label: "Half-day staff training", how: "Show staff how to find customers, write an invoice and use Digitize." },
];

const SUITE: PlaybookTask[] = [
  {
    id: "invoicing-setup",
    label: "Set tax rate, payment terms and number prefixes",
    how: "Match the firm's existing numbering so the sequence continues.",
    path: "/settings",
    auto: (ws) => Boolean(ws.profile.taxId && ws.profile.invoicePrefix),
  },
  {
    id: "first-invoice",
    label: "Send the first invoice from LegacyLift",
    how: "Write it together with the owner, print or email it, and mark it as sent.",
    path: "/invoices/new?kind=invoice",
    auto: (ws) => ws.invoices.some((i) => i.kind === "invoice" && i.status !== "draft" && !i.notes.startsWith("Digitized")),
  },
  {
    id: "stock",
    label: "Enter the stock list with reorder levels",
    how: "Walk the shelves with the foreman; add each material with a reorder level.",
    path: "/stock",
    auto: (ws) => ws.stock.length > 0,
  },
  { id: "follow-up", label: "Agree the overdue follow-up routine", how: "Who checks overdue invoices, and when reminders go out.", path: "/invoices" },
  { id: "backup", label: "Set up the monthly backup routine", how: "Show the owner Settings → Download backup and where to keep the file.", path: "/settings" },
];

const PARTNER: PlaybookTask[] = [
  { id: "ai-connect", label: "Connect the AI service", how: "Anthropic API key set and the business-ai function deployed for this client." },
  {
    id: "assistant",
    label: "Walk the owner through the AI assistant",
    how: "Ask real questions together: unpaid invoices, best customers, stock.",
    path: "/assistant",
    auto: (ws) => ws.chat.some((m) => m.role === "user"),
  },
  { id: "writer", label: "Agree writer templates", how: "Payment reminder, quote letter and enquiry reply in the firm's own tone.", path: "/writer" },
  { id: "review", label: "Book the quarterly roadmap review", how: "Revisit the roadmap, tick off finished steps, pick the next ones.", path: "/roadmap" },
];

export const PACKAGES: ServicePackage[] = [
  { id: "start", name: "Digital Start", summary: "Check-up, archive digitized, customer book, training", tasks: START },
  { id: "suite", name: "Business Suite", summary: "Everything in Start plus invoicing, stock and payment follow-up", tasks: SUITE },
  { id: "partner", name: "AI Partner", summary: "Everything in Suite plus AI assistant, writer and quarterly reviews", tasks: PARTNER },
];

export const packageName = (id: PackageId) => PACKAGES.find((p) => p.id === id)?.name ?? id;

/** Packages build on each other, so a Suite client gets the Start tasks too. */
export function tasksFor(pkg: PackageId): { pkg: ServicePackage; task: PlaybookTask }[] {
  const upto = PACKAGES.findIndex((p) => p.id === pkg);
  return PACKAGES.slice(0, upto + 1).flatMap((p) => p.tasks.map((task) => ({ pkg: p, task })));
}

export function isTaskDone(client: Client, task: PlaybookTask, ws: WorkspaceState) {
  return client.manualDone.includes(task.id) || Boolean(task.auto?.(ws));
}

export function checklistProgress(client: Client, ws: WorkspaceState) {
  const all = tasksFor(client.package);
  const done = all.filter(({ task }) => isTaskDone(client, task, ws)).length;
  return { done, total: all.length, pct: all.length ? Math.round((done / all.length) * 100) : 0 };
}

/** Business snapshot of a client's workspace, shown in the console. */
export function workspaceSnapshot(ws: WorkspaceState) {
  const rec = receivables(ws.invoices);
  const paid = ws.invoices.filter((i) => i.kind === "invoice" && i.status === "paid");
  return {
    currency: ws.profile.currency,
    customers: ws.customers.length,
    invoices: ws.invoices.filter((i) => i.kind === "invoice").length,
    documents: ws.records.length,
    stockItems: ws.stock.length,
    lowStock: lowStock(ws.stock).length,
    openAmount: rec.openAmount,
    overdueCount: rec.overdueCount,
    overdueAmount: rec.overdueAmount,
    paidTotal: paid.reduce((s, i) => s + invoiceTotals(i).total, 0),
    roadmapScore: ws.roadmap?.score ?? null,
  };
}

/** The first task in the client's package that isn't done yet, or null when everything is delivered. */
export function nextTask(client: Client, ws: WorkspaceState) {
  return tasksFor(client.package).find(({ task }) => !isTaskDone(client, task, ws)) ?? null;
}

/** Sort order for the client list: whoever needs us most comes first. */
export function attentionRank(client: Client, ws: WorkspaceState) {
  if (client.stage === "paused") return 5;
  if (workspaceSnapshot(ws).overdueCount > 0) return 0;
  if (client.stage === "onboarding") return 1;
  if (client.stage === "lead") return 2;
  return nextTask(client, ws) ? 3 : 4;
}
