import { useMemo, useState } from "react";
import { Link, Route, Routes, useNavigate, useParams, useSearchParams } from "react-router-dom";
import {
  ArrowLeft,
  BadgeCheck,
  Copy,
  FileCode2,
  FileText,
  Loader2,
  Mail,
  Pencil,
  Plus,
  Printer,
  Search,
  Send,
  Sparkles,
  Trash2,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { writeDraft } from "../ai";
import { eInvoiceProblems, eInvoiceXml } from "../einvoice";
import {
  addDays,
  customerName,
  daysBetween,
  deductStock,
  displayStatus,
  invoiceTotals,
  nextNumber,
  quoteToInvoice,
  returnStock,
  receivables,
  todayIso,
} from "../finance";
import { newId, toCsv, useWorkspace } from "../store";
import { useBase } from "../base";
import { countryName } from "../countries";
import type { Customer, DisplayStatus, Invoice, InvoiceKind, LineItem } from "../types";
import {
  ConfirmDelete,
  DemoNotice,
  EmptyState,
  Money,
  PageHeader,
  Panel,
  STATUS_LABEL,
  StatusPill,
  btnGhost,
  btnPrimary,
  download,
  fieldClass,
  formatDate,
  formatMoney,
  iconBtn,
  labelClass,
  linkClass,
} from "../components";
import { translate, useT } from "@/i18n";

const kindLabel = (k: InvoiceKind) => translate(k === "invoice" ? "Invoice" : "Quote");
const kindPlural = (k: InvoiceKind) => translate(k === "invoice" ? "Invoices" : "Quotes");

/* ------------------------------------------------------------------ list */

function InvoiceList() {
  const t = useT();
  const { state } = useWorkspace();
  const [params, setParams] = useSearchParams();
  const kind = (params.get("kind") as InvoiceKind | "all" | null) ?? "all";
  const [status, setStatus] = useState<DisplayStatus | "all">("all");
  const [query, setQuery] = useState("");
  const today = todayIso();
  const cur = state.profile.currency;
  const rec = receivables(state.invoices, today);

  const rows = useMemo(() => {
    const q = query.toLowerCase().trim();
    return state.invoices
      .filter((i) => kind === "all" || i.kind === kind)
      .filter((i) => status === "all" || displayStatus(i, today) === status)
      .filter((i) => !q || `${i.number} ${customerName(state.customers, i.customerId)}`.toLowerCase().includes(q))
      .sort((a, b) => (a.issueDate < b.issueDate ? 1 : a.issueDate > b.issueDate ? -1 : b.number.localeCompare(a.number)));
  }, [state.invoices, state.customers, kind, status, query, today]);

  const exportCsv = () =>
    download(
      "invoices.csv",
      toCsv(
        [t("Type"), t("Number"), t("Customer"), t("VAT or registration number"), t("Issue date"), t("Due date"), t("Net"), t("VAT rate (%)"), t("VAT"), t("Total"), t("Currency"), t("Status"), t("Paid on")],
        rows.map((i) => {
          const sum = invoiceTotals(i);
          const c = state.customers.find((x) => x.id === i.customerId);
          return [kindLabel(i.kind), i.number, customerName(state.customers, i.customerId), c?.taxId ?? "", i.issueDate, i.dueDate, sum.subtotal, i.taxRate, sum.tax, sum.total, cur, t(STATUS_LABEL[displayStatus(i, today)]), i.paidAt ?? ""];
        }),
      ),
      "text/csv",
    );

  return (
    <div className="max-w-6xl">
      <PageHeader
        eyebrow={t("Sales")}
        title={t("Invoices & quotes")}
        description={t("Write quotes, turn accepted quotes into invoices, send them by email or print, and see at a glance who still owes you money.")}
        actions={
          <>
            <button type="button" className={btnGhost} onClick={exportCsv} disabled={!rows.length}>
              {t("Export CSV")}
            </button>
            <Link to="new?kind=quote" className={btnGhost}>
              <Plus size={16} aria-hidden="true" /> {t("New quote")}
            </Link>
            <Link to="new?kind=invoice" className={btnPrimary}>
              <Plus size={16} aria-hidden="true" /> {t("New invoice")}
            </Link>
          </>
        }
      />

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-px bg-border border border-border rounded-lg overflow-hidden mb-6">
        {[
          { label: t("Awaiting payment"), value: rec.openAmount, sub: t("Invoices: {n}", { n: rec.openCount }), tone: "" },
          { label: t("Overdue"), value: rec.overdueAmount, sub: t("Invoices: {n}", { n: rec.overdueCount }), tone: rec.overdueCount ? "text-destructive" : "" },
          {
            label: t("Open quotes"),
            value: state.invoices.filter((i) => i.kind === "quote" && i.status === "sent").reduce((s, i) => s + invoiceTotals(i).total, 0),
            sub: t("Awaiting reply: {n}", { n: state.invoices.filter((i) => i.kind === "quote" && i.status === "sent").length }),
            tone: "",
          },
        ].map((k) => (
          <div key={k.label} className="bg-card p-4">
            <p className="text-xs uppercase tracking-wider text-muted-foreground">{k.label}</p>
            <p className={`mt-1 text-2xl font-semibold ${k.tone}`}>
              <Money value={k.value} currency={cur} />
            </p>
            <p className="text-xs text-muted-foreground">{k.sub}</p>
          </div>
        ))}
      </div>

      <div className="flex flex-col gap-2 lg:flex-row lg:items-center mb-4">
        <div role="tablist" aria-label={t("Document type")} className="inline-flex rounded-md border border-border bg-card p-1 self-start">
          {(["all", "invoice", "quote"] as const).map((k) => (
            <button
              key={k}
              role="tab"
              type="button"
              aria-selected={kind === k}
              onClick={() => setParams(k === "all" ? {} : { kind: k })}
              className={`px-3 py-1.5 text-sm rounded focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${kind === k ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"}`}
            >
              {k === "all" ? t("All") : kindPlural(k)}
            </button>
          ))}
        </div>
        <div className="relative flex-1">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
          <input aria-label={t("Search by number or customer")} className={`${fieldClass} pl-9`} placeholder={t("Search number or customer…")} value={query} onChange={(e) => setQuery(e.target.value)} />
        </div>
        <select aria-label={t("Filter by status")} className={`${fieldClass} lg:w-44`} value={status} onChange={(e) => setStatus(e.target.value as DisplayStatus | "all")}>
          <option value="all">{t("Any status")}</option>
          {(["draft", "sent", "overdue", "paid", "accepted", "declined"] as const).map((s) => (
            <option key={s} value={s}>
              {t(STATUS_LABEL[s])}
            </option>
          ))}
        </select>
      </div>

      {state.invoices.length === 0 ? (
        <EmptyState title={t("No invoices or quotes yet")}>
          <p>{t("Create your first one, or load the example data from the overview page.")}</p>
          <Link to="new?kind=invoice" className={btnPrimary}>
            <Plus size={16} aria-hidden="true" /> {t("New invoice")}
          </Link>
        </EmptyState>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-border bg-card">
          <table className="w-full text-sm">
            <thead className="text-left text-xs uppercase tracking-wider text-muted-foreground border-b border-border">
              <tr>
                <th className="px-4 py-3 font-medium">{t("Number")}</th>
                <th className="px-4 py-3 font-medium">{t("Customer")}</th>
                <th className="px-4 py-3 font-medium hidden md:table-cell">{t("Issued")}</th>
                <th className="px-4 py-3 font-medium hidden md:table-cell">{t("Due / valid until")}</th>
                <th className="px-4 py-3 font-medium text-right">{t("Total")}</th>
                <th className="px-4 py-3 font-medium">{t("Status")}</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((i) => {
                const st = displayStatus(i, today);
                return (
                  <tr key={i.id} className="border-b border-border last:border-0 hover:bg-secondary/60">
                    <td className="px-4 py-3">
                      <Link to={i.id} className={`font-mono font-medium ${linkClass} no-underline hover:underline`}>
                        {i.number}
                      </Link>
                      <span className="block text-[11px] text-muted-foreground">{kindLabel(i.kind)}</span>
                    </td>
                    <td className="px-4 py-3 max-w-[16rem] truncate">{customerName(state.customers, i.customerId)}</td>
                    <td className="px-4 py-3 hidden md:table-cell whitespace-nowrap">{formatDate(i.issueDate)}</td>
                    <td className="px-4 py-3 hidden md:table-cell whitespace-nowrap">
                      {formatDate(i.dueDate)}
                      {st === "overdue" && <span className="block text-[11px] text-destructive">{t("{days} days late", { days: daysBetween(i.dueDate, today) })}</span>}
                    </td>
                    <td className="px-4 py-3 text-right whitespace-nowrap">
                      <Money value={invoiceTotals(i).total} currency={state.profile.currency} />
                    </td>
                    <td className="px-4 py-3">
                      <StatusPill status={st} />
                    </td>
                  </tr>
                );
              })}
              {rows.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-4 py-6 text-center text-muted-foreground">
                    {t("Nothing matches these filters.")}
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

/* ---------------------------------------------------------------- editor */

function QuickCustomer({ onCreate, onCancel }: { onCreate: (c: Customer) => void; onCancel: () => void }) {
  const t = useT();
  const [c, setC] = useState({ name: "", company: "", email: "", phone: "", address: "" });
  return (
    <div className="mt-3 rounded-md border border-border bg-secondary/50 p-3 grid gap-2 sm:grid-cols-2">
      <label className={labelClass}>
        {t("Contact name")}
        <input id="qc-name" className={fieldClass} value={c.name} onChange={(e) => setC({ ...c, name: e.target.value })} />
      </label>
      <label className={labelClass}>
        {t("Company (optional)")}
        <input id="qc-company" className={fieldClass} value={c.company} onChange={(e) => setC({ ...c, company: e.target.value })} />
      </label>
      <label className={labelClass}>
        {t("Email")}
        <input id="qc-email" type="email" className={fieldClass} value={c.email} onChange={(e) => setC({ ...c, email: e.target.value })} />
      </label>
      <label className={labelClass}>
        {t("Address")}
        <input id="qc-address" className={fieldClass} value={c.address} onChange={(e) => setC({ ...c, address: e.target.value })} />
      </label>
      <div className="sm:col-span-2 flex gap-2">
        <button
          type="button"
          className={btnPrimary}
          disabled={!c.name.trim() && !c.company.trim()}
          onClick={() => onCreate({ ...c, id: newId(), notes: "", createdAt: new Date().toISOString() })}
        >
          {t("Add customer")}
        </button>
        <button type="button" className={btnGhost} onClick={onCancel}>
          {t("Cancel")}
        </button>
      </div>
    </div>
  );
}

function InvoiceEditor() {
  const t = useT();
  const { id } = useParams();
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const { state, upsert, update } = useWorkspace();
  const base = useBase();
  const existing = state.invoices.find((i) => i.id === id);
  const today = todayIso();

  const [draft, setDraft] = useState<Invoice>(() => {
    if (existing) return existing;
    const kind = (params.get("kind") as InvoiceKind) || "invoice";
    return {
      id: newId(),
      kind,
      number: nextNumber(state.invoices, kind, state.profile, today),
      customerId: params.get("customer") ?? "",
      issueDate: today,
      dueDate: addDays(today, kind === "invoice" ? state.profile.paymentTermsDays || 14 : 30),
      items: [{ id: newId(), description: "", quantity: 1, unitPrice: 0 }],
      taxRate: state.profile.defaultTaxRate,
      notes: "",
      status: "draft",
      createdAt: new Date().toISOString(),
    };
  });
  const [addingCustomer, setAddingCustomer] = useState(false);

  const totals = invoiceTotals(draft);
  const cur = state.profile.currency;
  const setItem = (itemId: string, patch: Partial<LineItem>) =>
    setDraft((d) => ({ ...d, items: d.items.map((it) => (it.id === itemId ? { ...it, ...patch } : it)) }));

  const valid = draft.customerId && draft.items.some((i) => i.description.trim()) && draft.number.trim();

  function save(markSent: boolean) {
    if (!valid) {
      toast.error(t("Choose a customer and add at least one line with a description."));
      return;
    }
    let cleaned: Invoice = { ...draft, items: draft.items.filter((i) => i.description.trim()) };
    if (markSent) cleaned = { ...cleaned, status: "sent" };
    // Keep stock in line with what was actually invoiced: give back what an earlier version
    // booked out, then book out the current lines if the invoice has gone out.
    if (cleaned.kind === "invoice") {
      let stock = existing?.stockDeducted ? returnStock(state.stock, existing) : state.stock;
      const outgoing = cleaned.status === "sent" || cleaned.status === "paid";
      const booked = outgoing ? deductStock(stock, cleaned) : stock;
      cleaned.stockDeducted = outgoing && booked !== stock;
      stock = booked;
      if (stock !== state.stock) update({ stock });
    }
    upsert("invoices", cleaned);
    toast.success(t("{kind} {number} saved", { kind: kindLabel(draft.kind), number: draft.number }));
    navigate(`${base}/invoices/${draft.id}`);
  }

  return (
    <div className="max-w-5xl">
      <Link to={existing ? `${base}/invoices/${existing.id}` : `${base}/invoices`} className={`inline-flex items-center gap-1 text-sm mb-4 ${linkClass} no-underline`}>
        <ArrowLeft size={16} aria-hidden="true" /> {t("Back")}
      </Link>
      <PageHeader eyebrow={kindLabel(draft.kind)} title={existing ? t("Edit {number}", { number: draft.number }) : draft.kind === "invoice" ? t("New invoice") : t("New quote")} />

      <form
        className="flex flex-col gap-6"
        onSubmit={(e) => {
          e.preventDefault();
          save(false);
        }}
      >
        <Panel className="grid gap-4 md:grid-cols-4">
          <div className="md:col-span-2">
            <label className={labelClass} htmlFor="inv-customer">
              {t("Customer")}
            </label>
            <div className="mt-1 flex gap-2">
              <select id="inv-customer" className={fieldClass} value={draft.customerId} onChange={(e) => setDraft({ ...draft, customerId: e.target.value })}>
                <option value="">{t("Choose a customer…")}</option>
                {state.customers.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.company ? `${c.company} — ${c.name}` : c.name}
                  </option>
                ))}
              </select>
              <button type="button" className={btnGhost} onClick={() => setAddingCustomer((v) => !v)} aria-expanded={addingCustomer}>
                <Plus size={16} aria-hidden="true" /> {t("New")}
              </button>
            </div>
            {addingCustomer && (
              <QuickCustomer
                onCancel={() => setAddingCustomer(false)}
                onCreate={(c) => {
                  upsert("customers", c);
                  setDraft((d) => ({ ...d, customerId: c.id }));
                  setAddingCustomer(false);
                }}
              />
            )}
          </div>
          <label className={labelClass}>
            {t("Number")}
            <input id="inv-number" className={`${fieldClass} font-mono`} value={draft.number} onChange={(e) => setDraft({ ...draft, number: e.target.value })} />
          </label>
          <label className={labelClass}>
            {t("VAT rate (%)")}
            <input
              id="inv-tax"
              type="number"
              min={0}
              step="0.1"
              className={`${fieldClass} font-mono`}
              value={draft.taxRate}
              onChange={(e) => setDraft({ ...draft, taxRate: Number(e.target.value) })}
            />
          </label>
          <label className={labelClass}>
            {t("Issue date")}
            <input
              id="inv-issue"
              type="date"
              className={fieldClass}
              value={draft.issueDate}
              onChange={(e) =>
                setDraft({
                  ...draft,
                  issueDate: e.target.value,
                  dueDate: addDays(e.target.value, draft.kind === "invoice" ? state.profile.paymentTermsDays || 14 : 30),
                })
              }
            />
          </label>
          <label className={labelClass}>
            {draft.kind === "invoice" ? t("Payment due") : t("Valid until")}
            <input id="inv-due" type="date" className={fieldClass} value={draft.dueDate} onChange={(e) => setDraft({ ...draft, dueDate: e.target.value })} />
          </label>
        </Panel>

        <Panel>
          <h2 className="font-heading text-lg font-semibold mb-3">{t("Lines")}</h2>
          <div className="flex flex-col gap-3">
            <div className="hidden md:grid md:grid-cols-[1fr_90px_130px_120px_40px] gap-2 text-xs uppercase tracking-wider text-muted-foreground">
              <span>{t("Description")}</span>
              <span>{t("Qty")}</span>
              <span>{t("Unit price")}</span>
              <span className="text-right">{t("Amount")}</span>
              <span />
            </div>
            {draft.items.map((it, idx) => (
              <div key={it.id} className="grid grid-cols-2 md:grid-cols-[1fr_90px_130px_120px_40px] gap-2 items-center border-b border-border pb-3 md:border-0 md:pb-0">
                <div className="col-span-2 md:col-span-1 flex flex-col gap-1">
                  <input
                    id={`line-desc-${idx}`}
                    aria-label={t("Line {n} description", { n: idx + 1 })}
                    className={fieldClass}
                    placeholder={t("What was delivered or done")}
                    value={it.description}
                    list="stock-names"
                    onChange={(e) => {
                      const product = state.stock.find((s) => s.name === e.target.value);
                      setItem(it.id, {
                        description: e.target.value,
                        productId: product?.id,
                        ...(product && product.salePrice ? { unitPrice: product.salePrice } : {}),
                      });
                    }}
                  />
                  {it.productId && <span className="text-[11px] text-ll-success">{t("Linked to stock — booked out when sent")}</span>}
                </div>
                <input
                  aria-label={t("Line {n} quantity", { n: idx + 1 })}
                  type="number"
                  step="any"
                  min={0}
                  className={`${fieldClass} font-mono`}
                  value={it.quantity}
                  onChange={(e) => setItem(it.id, { quantity: Number(e.target.value) })}
                />
                <input
                  aria-label={t("Line {n} unit price", { n: idx + 1 })}
                  type="number"
                  step="0.01"
                  className={`${fieldClass} font-mono`}
                  value={it.unitPrice}
                  onChange={(e) => setItem(it.id, { unitPrice: Number(e.target.value) })}
                />
                <Money className="text-right text-sm" value={(it.quantity || 0) * (it.unitPrice || 0)} currency={cur} />
                <button
                  type="button"
                  className={iconBtn}
                  aria-label={t("Remove line {n}", { n: idx + 1 })}
                  disabled={draft.items.length === 1}
                  onClick={() => setDraft((d) => ({ ...d, items: d.items.filter((x) => x.id !== it.id) }))}
                >
                  <X size={16} aria-hidden="true" />
                </button>
              </div>
            ))}
            <datalist id="stock-names">
              {state.stock.map((s) => (
                <option key={s.id} value={s.name} />
              ))}
            </datalist>
            <div>
              <button
                type="button"
                className={btnGhost}
                onClick={() => setDraft((d) => ({ ...d, items: [...d.items, { id: newId(), description: "", quantity: 1, unitPrice: 0 }] }))}
              >
                <Plus size={16} aria-hidden="true" /> {t("Add line")}
              </button>
            </div>
          </div>
          <dl className="mt-6 ml-auto w-full max-w-xs text-sm grid grid-cols-2 gap-y-1">
            <dt className="text-muted-foreground">{t("Net")}</dt>
            <dd className="text-right">
              <Money value={totals.subtotal} currency={cur} />
            </dd>
            <dt className="text-muted-foreground">{t("VAT {rate}%", { rate: draft.taxRate })}</dt>
            <dd className="text-right">
              <Money value={totals.tax} currency={cur} />
            </dd>
            <dt className="font-semibold border-t border-border pt-2 mt-1">{t("Total")}</dt>
            <dd className="text-right font-semibold border-t border-border pt-2 mt-1">
              <Money value={totals.total} currency={cur} />
            </dd>
          </dl>
        </Panel>

        <Panel>
          <label className={labelClass}>
            {draft.kind === "invoice" ? t("Notes printed on the invoice") : t("Notes printed on the quote")}
            <textarea id="inv-notes" rows={3} className={fieldClass} value={draft.notes} onChange={(e) => setDraft({ ...draft, notes: e.target.value })} placeholder={t("e.g. Delivery in 6 weeks. Materials remain our property until paid in full.")} />
          </label>
        </Panel>

        <div className="flex flex-wrap gap-2">
          <button type="submit" className={btnGhost}>
            {t("Save draft")}
          </button>
          {draft.status === "draft" && (
            <button type="button" className={btnPrimary} onClick={() => save(true)}>
              <Send size={16} aria-hidden="true" /> {t("Save & mark as sent")}
            </button>
          )}
        </div>
      </form>
    </div>
  );
}

/* ---------------------------------------------------------------- detail */

function InvoiceDetail() {
  const t = useT();
  const { id } = useParams();
  const navigate = useNavigate();
  const { state, upsert, patchItem, remove, update } = useWorkspace();
  const base = useBase();
  const inv = state.invoices.find((i) => i.id === id);
  const [reminder, setReminder] = useState<{ text: string; demo: boolean } | null>(null);
  const [drafting, setDrafting] = useState(false);
  const [eInvoiceProblemList, setEInvoiceProblems] = useState<string[]>([]);
  const today = todayIso();

  if (!inv) {
    return (
      <EmptyState title={t("This document no longer exists")}>
        <Link to={`${base}/invoices`} className={linkClass}>
          {t("Back to invoices")}
        </Link>
      </EmptyState>
    );
  }

  const p = state.profile;
  const customer = state.customers.find((c) => c.id === inv.customerId);
  const totals = invoiceTotals(inv);
  const st = displayStatus(inv, today);
  const cur = p.currency;

  function markSent() {
    const patch: Partial<Invoice> = { status: "sent" };
    if (inv!.kind === "invoice" && !inv!.stockDeducted) {
      const before = state.stock;
      const after = deductStock(before, inv!);
      if (after !== before) {
        update({ stock: after });
        patch.stockDeducted = true;
        toast.message(t("Linked stock has been booked out."));
      }
    }
    patchItem("invoices", inv!.id, patch);
    toast.success(t("{number} marked as sent", { number: inv!.number }));
  }

  function convert() {
    const created = quoteToInvoice(inv!, state.invoices, p, newId, today);
    patchItem("invoices", inv!.id, { status: "accepted" });
    upsert("invoices", created);
    toast.success(t("Invoice {number} created from quote", { number: created.number }));
    navigate(`${base}/invoices/${created.id}`);
  }

  function duplicate() {
    const copy: Invoice = {
      ...inv!,
      id: newId(),
      number: nextNumber(state.invoices, inv!.kind, p, today),
      issueDate: today,
      dueDate: addDays(today, inv!.kind === "invoice" ? p.paymentTermsDays || 14 : 30),
      status: "draft",
      paidAt: undefined,
      stockDeducted: false,
      convertedFrom: undefined,
      items: inv!.items.map((i) => ({ ...i, id: newId() })),
      createdAt: new Date().toISOString(),
    };
    upsert("invoices", copy);
    navigate(`${base}/invoices/${copy.id}/edit`);
  }

  async function draftReminder() {
    setDrafting(true);
    const late = daysBetween(inv!.dueDate, today);
    try {
      const { value, demo } = await writeDraft(
        {
          kind: "email",
          audience: t("customer ({name})", { name: customer?.company || customer?.name || t("customer") }),
          tone: late > 30 ? "firm but polite" : "friendly",
          notes: t("Payment reminder for invoice {number} dated {issued} over {amount}. It was due on {due} and is now {days} days overdue. Please pay to: {bank}. If payment has already been made, please ignore this message. Contact person: {contact}.", {
            number: inv!.number,
            issued: formatDate(inv!.issueDate),
            amount: formatMoney(totals.total, cur),
            due: formatDate(inv!.dueDate),
            days: late,
            bank: p.bankDetails || t("our usual bank account"),
            contact: p.ownerName || p.businessName,
          }),
        },
        p.businessName,
      );
      setReminder({ text: value, demo });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t("The reminder couldn't be written. Please try again."));
    } finally {
      setDrafting(false);
    }
  }

  const emailSubject = t("{kind} {number} from {business}", { kind: kindLabel(inv.kind), number: inv.number, business: p.businessName || t("us") });
  const emailBody =
    reminder?.text ??
    t(inv.kind === "invoice" ? "Dear {name},\n\nplease find our invoice {number} over {amount}, due on {due}.\n\nKind regards,\n{sender}" : "Dear {name},\n\nplease find our quote {number} over {amount}.\n\nKind regards,\n{sender}", {
      name: customer?.name || t("customer"),
      number: inv.number,
      amount: formatMoney(totals.total, cur),
      due: formatDate(inv.dueDate),
      sender: p.ownerName || p.businessName,
    });
  const mailto = `mailto:${customer?.email ?? ""}?subject=${encodeURIComponent(emailSubject)}&body=${encodeURIComponent(emailBody)}`;

  return (
    <div className="max-w-5xl">
      <div className="no-print">
        <Link to={`${base}/invoices`} className={`inline-flex items-center gap-1 text-sm mb-4 ${linkClass} no-underline`}>
          <ArrowLeft size={16} aria-hidden="true" /> {t("All invoices & quotes")}
        </Link>
        <div className="flex flex-col gap-4 mb-6">
          <div className="flex flex-wrap items-center gap-3">
            <h1 className="text-2xl md:text-3xl font-semibold font-mono whitespace-nowrap">{inv.number}</h1>
            <span className="text-sm text-muted-foreground">
              {kindLabel(inv.kind)} · {customer ? customer.company || customer.name : t("No customer")}
            </span>
            <StatusPill status={st} />
          </div>
          <div className="flex flex-wrap gap-2">
            {inv.status === "draft" && (
              <button type="button" className={btnPrimary} onClick={markSent}>
                <Send size={16} aria-hidden="true" /> {t("Mark as sent")}
              </button>
            )}
            {inv.kind === "invoice" && inv.status === "sent" && (
              <button type="button" className={btnPrimary} onClick={() => patchItem("invoices", inv.id, { status: "paid", paidAt: today })}>
                <BadgeCheck size={16} aria-hidden="true" /> {t("Record payment")}
              </button>
            )}
            {inv.kind === "invoice" && inv.status === "paid" && (
              <button type="button" className={btnGhost} onClick={() => patchItem("invoices", inv.id, { status: "sent", paidAt: undefined })}>
                {t("Undo payment")}
              </button>
            )}
            {inv.kind === "quote" && inv.status !== "accepted" && (
              <button type="button" className={btnPrimary} onClick={convert}>
                <FileText size={16} aria-hidden="true" /> {t("Accepted — create invoice")}
              </button>
            )}
            {inv.kind === "quote" && inv.status === "sent" && (
              <button type="button" className={btnGhost} onClick={() => patchItem("invoices", inv.id, { status: "declined" })}>
                {t("Declined")}
              </button>
            )}
            {st === "overdue" && (
              <button type="button" className={btnGhost} onClick={draftReminder} disabled={drafting}>
                {drafting ? <Loader2 size={16} className="animate-spin" aria-hidden="true" /> : <Sparkles size={16} aria-hidden="true" />} {t("Payment reminder")}
              </button>
            )}
            <a href={mailto} className={btnGhost}>
              <Mail size={16} aria-hidden="true" /> {t("Email")}
            </a>
            <button type="button" className={btnGhost} onClick={() => window.print()}>
              <Printer size={16} aria-hidden="true" /> {t("Print / PDF")}
            </button>
            {inv.kind === "invoice" && (
              <button
                type="button"
                className={btnGhost}
                onClick={() => {
                  const problems = eInvoiceProblems(inv, p, customer);
                  setEInvoiceProblems(problems);
                  if (!problems.length && customer) {
                    download(`${inv.number}.xml`, eInvoiceXml(inv, p, customer), "application/xml");
                    toast.success(t("E-invoice {number}.xml downloaded", { number: inv.number }));
                  }
                }}
              >
                <FileCode2 size={16} aria-hidden="true" /> {t("E-invoice (XML)")}
              </button>
            )}
            <Link to="edit" className={btnGhost}>
              <Pencil size={16} aria-hidden="true" /> {t("Edit")}
            </Link>
            <button type="button" className={btnGhost} onClick={duplicate}>
              <Copy size={16} aria-hidden="true" /> {t("Duplicate")}
            </button>
            <ConfirmDelete
              label={t("Delete {name}", { name: inv.number })}
              onConfirm={() => {
                if (inv.stockDeducted) {
                  update({ stock: returnStock(state.stock, inv) });
                  toast.message(t("Linked stock has been put back."));
                }
                remove("invoices", inv.id);
                navigate(`${base}/invoices`);
              }}
            >
              <Trash2 size={16} aria-hidden="true" />
            </ConfirmDelete>
          </div>
        </div>

        {eInvoiceProblemList.length > 0 && (
          <Panel className="mb-6 flex flex-col gap-2 border-ll-warning/60">
            <div className="flex items-center justify-between">
              <h2 className="font-heading font-semibold">{t("Before this e-invoice can be made")}</h2>
              <button type="button" className={iconBtn} aria-label={t("Close")} onClick={() => setEInvoiceProblems([])}>
                <X size={16} aria-hidden="true" />
              </button>
            </div>
            <ul className="list-disc pl-5 text-sm">
              {eInvoiceProblemList.map((x) => (
                <li key={x}>{t(x)}</li>
              ))}
            </ul>
            <p className="text-xs text-muted-foreground">
              {t("E-invoices follow the EU standard (EN 16931, Peppol BIS 3.0) and can be uploaded to e-invoicing portals and accounting software.")}{" "}
              <Link to={`${base}/settings`} className={linkClass}>
                {t("Open settings")}
              </Link>
            </p>
          </Panel>
        )}

        {reminder && (
          <Panel className="mb-6 flex flex-col gap-3">
            <div className="flex items-center justify-between">
              <h2 className="font-heading font-semibold">{t("Payment reminder draft")}</h2>
              <button type="button" className={iconBtn} aria-label={t("Close reminder")} onClick={() => setReminder(null)}>
                <X size={16} aria-hidden="true" />
              </button>
            </div>
            <DemoNotice show={reminder.demo} />
            <textarea
              id="reminder-text"
              aria-label={t("Reminder text")}
              rows={10}
              className={fieldClass}
              value={reminder.text}
              onChange={(e) => setReminder({ ...reminder, text: e.target.value })}
            />
            <div className="flex flex-wrap gap-2">
              <a href={mailto} className={btnPrimary}>
                <Mail size={16} aria-hidden="true" /> {t("Open in email")}
              </a>
              <button
                type="button"
                className={btnGhost}
                onClick={() =>
                  navigator.clipboard.writeText(reminder.text).then(
                    () => toast.success(t("Copied")),
                    () => toast.error(t("Copy was blocked — select the text and copy it manually.")),
                  )
                }
              >
                <Copy size={16} aria-hidden="true" /> {t("Copy")}
              </button>
            </div>
            {customer?.email && <p className="text-xs text-muted-foreground">{t("Customer email: {email}", { email: customer.email })}</p>}
          </Panel>
        )}
      </div>

      {/* Printable document */}
      <article className="print-sheet rounded-lg border border-border bg-card p-6 md:p-10 shadow-sm">
        <header className="flex flex-col gap-6 sm:flex-row sm:justify-between border-b-2 border-primary pb-6">
          <div>
            <p className="font-heading text-2xl font-bold">{p.businessName || t("Your business name")}</p>
            <p className="text-sm text-muted-foreground whitespace-pre-line mt-1">{p.address}</p>
            <p className="text-sm text-muted-foreground mt-1">{[p.phone, p.email].filter(Boolean).join(" · ")}</p>
          </div>
          <div className="sm:text-right">
            <p className="text-xs uppercase tracking-[0.2em] text-primary font-semibold">{kindLabel(inv.kind)}</p>
            <p className="font-mono text-xl font-medium">{inv.number}</p>
            <dl className="mt-2 text-sm grid grid-cols-[auto_auto] gap-x-3 sm:justify-end">
              <dt className="text-muted-foreground">{t("Date")}</dt>
              <dd>{formatDate(inv.issueDate)}</dd>
              <dt className="text-muted-foreground">{inv.kind === "invoice" ? t("Due") : t("Valid until")}</dt>
              <dd>{formatDate(inv.dueDate)}</dd>
            </dl>
          </div>
        </header>

        <section className="py-6">
          <p className="text-xs uppercase tracking-wider text-muted-foreground mb-1">{t("Bill to")}</p>
          {customer ? (
            <>
              <p className="font-semibold">{customer.company || customer.name}</p>
              {customer.company && <p className="text-sm">{customer.name}</p>}
              <p className="text-sm text-muted-foreground whitespace-pre-line">{customer.address}</p>
              {customer.country && customer.country !== p.country && <p className="text-sm text-muted-foreground">{countryName(customer.country)}</p>}
              {customer.taxId && <p className="text-sm text-muted-foreground">{t("VAT / reg. no. {id}", { id: customer.taxId })}</p>}
            </>
          ) : (
            <p className="text-sm text-muted-foreground">{t("No customer selected")}</p>
          )}
        </section>

        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="text-left text-xs uppercase tracking-wider text-muted-foreground border-b border-border">
              <tr>
                <th className="py-2 pr-3 font-medium">#</th>
                <th className="py-2 pr-3 font-medium">{t("Description")}</th>
                <th className="py-2 pr-3 font-medium text-right">{t("Qty")}</th>
                <th className="py-2 pr-3 font-medium text-right">{t("Unit price")}</th>
                <th className="py-2 font-medium text-right">{t("Amount")}</th>
              </tr>
            </thead>
            <tbody>
              {inv.items.map((it, i) => (
                <tr key={it.id} className="border-b border-border/70">
                  <td className="py-2 pr-3 font-mono text-muted-foreground">{i + 1}</td>
                  <td className="py-2 pr-3">{it.description}</td>
                  <td className="py-2 pr-3 text-right font-mono tabular-nums">{it.quantity}</td>
                  <td className="py-2 pr-3 text-right">
                    <Money value={it.unitPrice} currency={cur} />
                  </td>
                  <td className="py-2 text-right">
                    <Money value={it.quantity * it.unitPrice} currency={cur} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <dl className="mt-6 ml-auto w-full max-w-xs text-sm grid grid-cols-2 gap-y-1">
          <dt className="text-muted-foreground">{t("Net")}</dt>
          <dd className="text-right">
            <Money value={totals.subtotal} currency={cur} />
          </dd>
          <dt className="text-muted-foreground">{t("VAT {rate}%", { rate: inv.taxRate })}</dt>
          <dd className="text-right">
            <Money value={totals.tax} currency={cur} />
          </dd>
          <dt className="font-semibold text-base border-t-2 border-foreground pt-2 mt-1">{t("Total")}</dt>
          <dd className="text-right font-semibold text-base border-t-2 border-foreground pt-2 mt-1">
            <Money value={totals.total} currency={cur} />
          </dd>
        </dl>

        {inv.notes && <p className="mt-8 text-sm whitespace-pre-line">{inv.notes}</p>}
        {inv.kind === "invoice" && (
          <p className="mt-4 text-sm">
            {p.bankDetails
              ? t("Please pay within {days} days to: {bank}", { days: daysBetween(inv.issueDate, inv.dueDate), bank: p.bankDetails })
              : t("Please pay within {days} days.", { days: daysBetween(inv.issueDate, inv.dueDate) })}
          </p>
        )}
        {inv.status === "paid" && inv.paidAt && (
          <p className="mt-4 inline-block rotate-[-3deg] border-2 border-ll-success text-ll-success px-3 py-1 font-heading font-bold uppercase tracking-widest">
            {t("Paid {date}", { date: formatDate(inv.paidAt) })}
          </p>
        )}

        <footer className="mt-10 pt-4 border-t border-border text-xs text-muted-foreground flex flex-col gap-1 sm:flex-row sm:justify-between">
          <span>{p.invoiceFooter}</span>
          <span>{p.taxId && t("VAT reg. no. {id}", { id: p.taxId })}</span>
        </footer>
      </article>
    </div>
  );
}

const Invoices = () => (
  <Routes>
    <Route index element={<InvoiceList />} />
    <Route path="new" element={<InvoiceEditor />} />
    <Route path=":id" element={<InvoiceDetail />} />
    <Route path=":id/edit" element={<InvoiceEditor />} />
  </Routes>
);

export default Invoices;
