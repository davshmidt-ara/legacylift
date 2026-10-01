import { useMemo, useState } from "react";
import { Link, Route, Routes, useNavigate, useParams } from "react-router-dom";
import { ArrowLeft, Mail, Phone, Plus, Search, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { customerStats, displayStatus, invoiceTotals, todayIso } from "../finance";
import { newId, toCsv, useWorkspace } from "../store";
import { useBase } from "../base";
import type { Customer } from "../types";
import {
  ConfirmDelete,
  EmptyState,
  Money,
  PageHeader,
  Panel,
  StatusPill,
  btnGhost,
  btnPrimary,
  download,
  fieldClass,
  formatDate,
  labelClass,
  linkClass,
} from "../components";

const BLANK: Omit<Customer, "id" | "createdAt"> = { name: "", company: "", email: "", phone: "", address: "", notes: "" };

function CustomerForm({ initial, onSave, submitLabel }: { initial: Omit<Customer, "id" | "createdAt">; onSave: (c: Omit<Customer, "id" | "createdAt">) => void; submitLabel: string }) {
  const [c, setC] = useState(initial);
  const field = (key: keyof typeof c, label: string, type = "text") => (
    <label className={labelClass}>
      {label}
      <input id={`cust-${key}`} type={type} className={fieldClass} value={c[key]} onChange={(e) => setC({ ...c, [key]: e.target.value })} />
    </label>
  );
  return (
    <form
      className="grid gap-3 sm:grid-cols-2"
      onSubmit={(e) => {
        e.preventDefault();
        if (!c.name.trim() && !c.company.trim()) {
          toast.error("Enter a contact name or a company.");
          return;
        }
        onSave(c);
      }}
    >
      {field("name", "Contact name")}
      {field("company", "Company (optional)")}
      {field("email", "Email", "email")}
      {field("phone", "Phone", "tel")}
      <label className={`${labelClass} sm:col-span-2`}>
        Address
        <textarea id="cust-address" rows={2} className={fieldClass} value={c.address} onChange={(e) => setC({ ...c, address: e.target.value })} />
      </label>
      <label className={`${labelClass} sm:col-span-2`}>
        Notes
        <textarea id="cust-notes" rows={3} className={fieldClass} value={c.notes} placeholder="Preferences, history, who to ask for…" onChange={(e) => setC({ ...c, notes: e.target.value })} />
      </label>
      <div className="sm:col-span-2">
        <button type="submit" className={btnPrimary}>
          {submitLabel}
        </button>
      </div>
    </form>
  );
}

function CustomerList() {
  const { state, upsert } = useWorkspace();
  const [query, setQuery] = useState("");
  const [adding, setAdding] = useState(false);
  const navigate = useNavigate();
  const cur = state.profile.currency;
  const today = todayIso();

  const rows = useMemo(() => {
    const q = query.toLowerCase().trim();
    return state.customers
      .filter((c) => !q || `${c.name} ${c.company} ${c.email} ${c.phone} ${c.address}`.toLowerCase().includes(q))
      .map((c) => ({ c, s: customerStats(c.id, state.invoices, today) }))
      .sort((a, b) => b.s.lifetime - a.s.lifetime || (a.c.company || a.c.name).localeCompare(b.c.company || b.c.name));
  }, [state.customers, state.invoices, query, today]);

  return (
    <div className="max-w-6xl">
      <PageHeader
        eyebrow="Relationships"
        title="Customers"
        description="Every customer in one place, with contact details, notes and their full invoice history. No more card index."
        actions={
          <>
            <button
              type="button"
              className={btnGhost}
              disabled={!state.customers.length}
              onClick={() =>
                download(
                  "customers.csv",
                  toCsv(["Name", "Company", "Email", "Phone", "Address", "Notes"], state.customers.map((c) => [c.name, c.company, c.email, c.phone, c.address, c.notes])),
                  "text/csv",
                )
              }
            >
              Export CSV
            </button>
            <button type="button" className={btnPrimary} onClick={() => setAdding((v) => !v)} aria-expanded={adding}>
              <Plus size={16} aria-hidden="true" /> Add customer
            </button>
          </>
        }
      />

      {adding && (
        <Panel className="mb-6">
          <h2 className="font-heading text-lg font-semibold mb-3">New customer</h2>
          <CustomerForm
            initial={BLANK}
            submitLabel="Save customer"
            onSave={(c) => {
              const created = { ...c, id: newId(), createdAt: new Date().toISOString() };
              upsert("customers", created);
              setAdding(false);
              navigate(created.id);
            }}
          />
        </Panel>
      )}

      <div className="relative mb-4">
        <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
        <input aria-label="Search customers" className={`${fieldClass} pl-9`} placeholder="Search name, company, phone, street…" value={query} onChange={(e) => setQuery(e.target.value)} />
      </div>

      {state.customers.length === 0 ? (
        <EmptyState title="No customers yet">
          <p>Add them by hand, or photograph old customer cards on the Digitize page.</p>
        </EmptyState>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-border bg-card">
          <table className="w-full text-sm">
            <thead className="text-left text-xs uppercase tracking-wider text-muted-foreground border-b border-border">
              <tr>
                <th className="px-4 py-3 font-medium">Customer</th>
                <th className="px-4 py-3 font-medium hidden md:table-cell">Contact</th>
                <th className="px-4 py-3 font-medium text-right">Paid to date</th>
                <th className="px-4 py-3 font-medium text-right">Outstanding</th>
              </tr>
            </thead>
            <tbody>
              {rows.map(({ c, s }) => (
                <tr key={c.id} className="border-b border-border last:border-0 hover:bg-secondary/60">
                  <td className="px-4 py-3">
                    <Link to={c.id} className={`font-medium ${linkClass} no-underline hover:underline`}>
                      {c.company || c.name}
                    </Link>
                    {c.company && <span className="block text-xs text-muted-foreground">{c.name}</span>}
                  </td>
                  <td className="px-4 py-3 hidden md:table-cell text-muted-foreground">
                    <span className="block">{c.phone}</span>
                    <span className="block truncate max-w-[16rem]">{c.email}</span>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <Money value={s.lifetime} currency={cur} />
                  </td>
                  <td className="px-4 py-3 text-right">
                    <Money value={s.outstanding} currency={cur} className={s.overdue ? "text-destructive font-semibold" : ""} />
                    {s.overdue > 0 && <span className="block text-[11px] text-destructive">{s.overdue} overdue</span>}
                  </td>
                </tr>
              ))}
              {rows.length === 0 && (
                <tr>
                  <td colSpan={4} className="px-4 py-6 text-center text-muted-foreground">
                    No customers match “{query}”.
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

function CustomerDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { state, upsert, remove } = useWorkspace();
  const base = useBase();
  const c = state.customers.find((x) => x.id === id);
  const today = todayIso();
  if (!c) {
    return (
      <EmptyState title="Customer not found">
        <Link to={`${base}/customers`} className={linkClass}>
          Back to customers
        </Link>
      </EmptyState>
    );
  }
  const s = customerStats(c.id, state.invoices, today);
  const docs = state.invoices.filter((i) => i.customerId === c.id).sort((a, b) => (a.issueDate < b.issueDate ? 1 : -1));
  const cur = state.profile.currency;
  const { id: _id, createdAt: _created, ...editable } = c;

  return (
    <div className="max-w-5xl">
      <Link to={`${base}/customers`} className={`inline-flex items-center gap-1 text-sm mb-4 ${linkClass} no-underline`}>
        <ArrowLeft size={16} aria-hidden="true" /> All customers
      </Link>
      <PageHeader
        eyebrow={c.company ? c.name : "Customer"}
        title={c.company || c.name}
        actions={
          <>
            {c.phone && (
              <a href={`tel:${c.phone}`} className={btnGhost}>
                <Phone size={16} aria-hidden="true" /> {c.phone}
              </a>
            )}
            {c.email && (
              <a href={`mailto:${c.email}`} className={btnGhost}>
                <Mail size={16} aria-hidden="true" /> Email
              </a>
            )}
            <Link to={`${base}/invoices/new?kind=quote&customer=${c.id}`} className={btnGhost}>
              New quote
            </Link>
            <Link to={`${base}/invoices/new?kind=invoice&customer=${c.id}`} className={btnPrimary}>
              New invoice
            </Link>
            {docs.length === 0 ? (
              <ConfirmDelete
                label={`Delete ${c.company || c.name}`}
                onConfirm={() => {
                  remove("customers", c.id);
                  navigate(`${base}/customers`);
                }}
              >
                <Trash2 size={16} aria-hidden="true" />
              </ConfirmDelete>
            ) : (
              <span className="self-center text-xs text-muted-foreground max-w-[14rem]">
                Can't be deleted: {docs.length} invoice(s) or quote(s) belong to this customer.
              </span>
            )}
          </>
        }
      />

      <div className="grid grid-cols-3 gap-px bg-border border border-border rounded-lg overflow-hidden mb-6">
        {[
          { label: "Paid to date", v: s.lifetime },
          { label: "Outstanding", v: s.outstanding },
          { label: "Invoices", v: null, n: s.invoiceCount },
        ].map((k) => (
          <div key={k.label} className="bg-card p-4">
            <p className="text-xs uppercase tracking-wider text-muted-foreground">{k.label}</p>
            <p className="mt-1 text-xl font-semibold">{k.v === null ? <span className="font-mono">{k.n}</span> : <Money value={k.v} currency={cur} />}</p>
          </div>
        ))}
      </div>

      <div className="grid gap-6 lg:grid-cols-[1fr_1fr]">
        <Panel>
          <h2 className="font-heading text-lg font-semibold mb-3">Details</h2>
          <CustomerForm
            key={c.id}
            initial={editable}
            submitLabel="Save changes"
            onSave={(v) => {
              upsert("customers", { ...c, ...v });
              toast.success("Customer saved");
            }}
          />
        </Panel>
        <Panel>
          <h2 className="font-heading text-lg font-semibold mb-3">History</h2>
          {docs.length === 0 ? (
            <p className="text-sm text-muted-foreground">No invoices or quotes yet.</p>
          ) : (
            <ul className="divide-y divide-border">
              {docs.map((d) => (
                <li key={d.id} className="flex items-center justify-between gap-3 py-2 text-sm">
                  <div className="min-w-0">
                    <Link to={`${base}/invoices/${d.id}`} className={`font-mono ${linkClass} no-underline hover:underline`}>
                      {d.number}
                    </Link>
                    <span className="block text-xs text-muted-foreground">
                      {d.kind === "quote" ? "Quote" : "Invoice"} · {formatDate(d.issueDate)}
                    </span>
                  </div>
                  <div className="flex items-center gap-3">
                    <Money value={invoiceTotals(d).total} currency={cur} />
                    <StatusPill status={displayStatus(d, today)} />
                  </div>
                </li>
              ))}
            </ul>
          )}
        </Panel>
      </div>
    </div>
  );
}

const Customers = () => (
  <Routes>
    <Route index element={<CustomerList />} />
    <Route path=":id" element={<CustomerDetail />} />
  </Routes>
);

export default Customers;
