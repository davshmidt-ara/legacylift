// Pure business logic for invoices, quotes and stock. Kept free of React so it is easy to test.
import type { BusinessProfile, Customer, DisplayStatus, Invoice, InvoiceKind, StockItem } from "./types";
import { locale, translate } from "@/i18n";

export const round2 = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100;

/** True when a document's tags say it has been paid ("paid", "bezahlt", "apmaksāts"…), but not "unpaid" / "nicht bezahlt" / "neapmaksāts". */
export function markedPaid(tags: string[]) {
  return tags.some((t) => /^\s*(paid|bezahlt|payé|pagato|pagado|betaald|apmaksāts|apmaksāta|samaksāts|samaksāta|apmokėta|makstud|tasutud)\s*$/i.test(t));
}

export function todayIso(now = new Date()) {
  const d = new Date(now.getTime() - now.getTimezoneOffset() * 60000);
  return d.toISOString().slice(0, 10);
}

export function addDays(iso: string, days: number) {
  const d = new Date(`${iso}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

export function daysBetween(fromIso: string, toIso: string) {
  return Math.round((Date.parse(`${toIso}T12:00:00Z`) - Date.parse(`${fromIso}T12:00:00Z`)) / 86400000);
}

export function invoiceTotals(inv: Pick<Invoice, "items" | "taxRate">) {
  const subtotal = round2(inv.items.reduce((s, i) => s + (i.quantity || 0) * (i.unitPrice || 0), 0));
  const tax = round2((subtotal * (inv.taxRate || 0)) / 100);
  return { subtotal, tax, total: round2(subtotal + tax) };
}

export function displayStatus(inv: Invoice, today = todayIso()): DisplayStatus {
  if (inv.kind === "invoice" && inv.status === "sent" && inv.dueDate && inv.dueDate < today) return "overdue";
  return inv.status;
}

/** Next document number, e.g. RE-2026-0048. Continues from the highest existing number for the year. */
export function nextNumber(invoices: Invoice[], kind: InvoiceKind, profile: BusinessProfile, today = todayIso()) {
  const prefix = (kind === "invoice" ? profile.invoicePrefix : profile.quotePrefix) || translate(kind === "invoice" ? "INV" : "QUO");
  const year = today.slice(0, 4);
  const stem = `${prefix}-${year}-`;
  const max = invoices
    .filter((i) => i.kind === kind && i.number.startsWith(stem))
    .reduce((m, i) => Math.max(m, Number.parseInt(i.number.slice(stem.length), 10) || 0), 0);
  return `${stem}${String(max + 1).padStart(4, "0")}`;
}

export function customerName(customers: Customer[], id: string) {
  const c = customers.find((x) => x.id === id);
  if (!c) return translate("Unknown customer");
  return c.company ? `${c.company}${c.name ? ` (${c.name})` : ""}` : c.name;
}

export function receivables(invoices: Invoice[], today = todayIso()) {
  const open = invoices.filter((i) => i.kind === "invoice" && i.status === "sent");
  const overdue = open.filter((i) => displayStatus(i, today) === "overdue");
  const sum = (list: Invoice[]) => round2(list.reduce((s, i) => s + invoiceTotals(i).total, 0));
  return { openCount: open.length, openAmount: sum(open), overdueCount: overdue.length, overdueAmount: sum(overdue), overdue };
}

/** Paid invoice totals per month for the last `months` months, oldest first. */
export function monthlyRevenue(invoices: Invoice[], months = 6, today = todayIso()) {
  const [y, m] = today.split("-").map(Number);
  const buckets: { key: string; label: string; total: number }[] = [];
  for (let k = months - 1; k >= 0; k--) {
    const d = new Date(Date.UTC(y, m - 1 - k, 1));
    const key = d.toISOString().slice(0, 7);
    buckets.push({ key, label: d.toLocaleString(locale(), { month: "short", timeZone: "UTC" }), total: 0 });
  }
  for (const inv of invoices) {
    if (inv.kind !== "invoice" || inv.status !== "paid") continue;
    const key = (inv.paidAt || inv.issueDate).slice(0, 7);
    const b = buckets.find((x) => x.key === key);
    if (b) b.total = round2(b.total + invoiceTotals(inv).total);
  }
  return buckets;
}

export function lowStock(stock: StockItem[]) {
  return stock.filter((s) => s.quantity <= s.reorderLevel);
}

export function stockValue(stock: StockItem[]) {
  return round2(stock.reduce((s, i) => s + i.quantity * i.costPrice, 0));
}

/** Customer lifetime numbers used on the customer page. */
export function customerStats(customerId: string, invoices: Invoice[], today = todayIso()) {
  const mine = invoices.filter((i) => i.customerId === customerId && i.kind === "invoice");
  const paid = mine.filter((i) => i.status === "paid");
  const open = mine.filter((i) => i.status === "sent");
  return {
    invoiceCount: mine.length,
    lifetime: round2(paid.reduce((s, i) => s + invoiceTotals(i).total, 0)),
    outstanding: round2(open.reduce((s, i) => s + invoiceTotals(i).total, 0)),
    overdue: open.filter((i) => displayStatus(i, today) === "overdue").length,
  };
}

/** Books linked stock out for an invoice. Returns the new stock list (quantities never go below zero). */
export function deductStock(stock: StockItem[], inv: Pick<Invoice, "items">): StockItem[] {
  const used = new Map<string, number>();
  for (const it of inv.items) {
    if (it.productId) used.set(it.productId, (used.get(it.productId) ?? 0) + (it.quantity || 0));
  }
  if (!used.size) return stock;
  return stock.map((s) => (used.has(s.id) ? { ...s, quantity: Math.max(0, round2(s.quantity - used.get(s.id)!)) } : s));
}

/** Undoes deductStock: puts linked stock back (used when a sent invoice is edited or deleted). */
export function returnStock(stock: StockItem[], inv: Pick<Invoice, "items">): StockItem[] {
  const used = new Map<string, number>();
  for (const it of inv.items) {
    if (it.productId) used.set(it.productId, (used.get(it.productId) ?? 0) + (it.quantity || 0));
  }
  if (!used.size) return stock;
  return stock.map((s) => (used.has(s.id) ? { ...s, quantity: round2(s.quantity + used.get(s.id)!) } : s));
}

/** Creates a draft invoice from an accepted quote. */
export function quoteToInvoice(
  quote: Invoice,
  invoices: Invoice[],
  profile: BusinessProfile,
  newId: () => string,
  today = todayIso(),
): Invoice {
  return {
    ...quote,
    id: newId(),
    kind: "invoice",
    number: nextNumber(invoices, "invoice", profile, today),
    issueDate: today,
    dueDate: addDays(today, profile.paymentTermsDays || 14),
    status: "draft",
    paidAt: undefined,
    stockDeducted: false,
    convertedFrom: quote.id,
    items: quote.items.map((i) => ({ ...i, id: newId() })),
    createdAt: new Date().toISOString(),
  };
}
