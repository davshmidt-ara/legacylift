import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { AlertTriangle, Minus, Plus, Search, Trash2 } from "lucide-react";
import { lowStock, round2, stockValue } from "../finance";
import { newId, toCsv, useWorkspace } from "../store";
import { useBase } from "../base";
import type { StockItem } from "../types";
import { ConfirmDelete, EmptyState, Money, PageHeader, Panel, btnGhost, btnPrimary, download, fieldClass, iconBtn, labelClass } from "../components";

const BLANK: Omit<StockItem, "id"> = { sku: "", name: "", unit: "pcs", quantity: 0, reorderLevel: 0, costPrice: 0, salePrice: 0, location: "" };

const Inventory = () => {
  const { state, upsert, patchItem, remove } = useWorkspace();
  const base = useBase();
  const navigate = useNavigate();
  const [query, setQuery] = useState("");
  const [onlyLow, setOnlyLow] = useState(false);
  const [form, setForm] = useState<Omit<StockItem, "id"> | null>(null);
  const cur = state.profile.currency;
  const low = lowStock(state.stock);

  const rows = useMemo(() => {
    const q = query.toLowerCase().trim();
    return state.stock
      .filter((s) => !onlyLow || s.quantity <= s.reorderLevel)
      .filter((s) => !q || `${s.sku} ${s.name} ${s.location}`.toLowerCase().includes(q))
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [state.stock, query, onlyLow]);

  const adjust = (s: StockItem, delta: number) => patchItem("stock", s.id, { quantity: Math.max(0, round2(s.quantity + delta)) });

  function orderLowStock() {
    const list = low.map((s) => `- ${s.name} (${s.sku}): have ${s.quantity} ${s.unit}, minimum ${s.reorderLevel} ${s.unit}`).join("\n");
    navigate(`${base}/writer`, {
      state: {
        kind: "email",
        audience: "supplier",
        tone: "friendly",
        notes: `Please send a quote and delivery date for restocking the following items:\n${list}\n\nWe usually take delivery on weekday mornings.`,
      },
    });
  }

  const num = (key: keyof Omit<StockItem, "id">, label: string, step = "any") => (
    <label className={labelClass}>
      {label}
      <input
        id={`stock-${key}`}
        type="number"
        step={step}
        min={0}
        className={`${fieldClass} font-mono`}
        value={form![key] as number}
        onChange={(e) => setForm({ ...form!, [key]: Number(e.target.value) })}
      />
    </label>
  );

  return (
    <div className="max-w-6xl">
      <PageHeader
        eyebrow="Workshop"
        title="Stock"
        description="Materials and goods on hand, with reorder levels. Stock linked to an invoice line is booked out automatically when the invoice is sent."
        actions={
          <>
            <button
              type="button"
              className={btnGhost}
              disabled={!state.stock.length}
              onClick={() =>
                download(
                  "stock.csv",
                  toCsv(
                    ["SKU", "Name", "Unit", "Quantity", "Reorder level", "Cost price", "Sale price", "Location"],
                    state.stock.map((s) => [s.sku, s.name, s.unit, s.quantity, s.reorderLevel, s.costPrice, s.salePrice, s.location]),
                  ),
                  "text/csv",
                )
              }
            >
              Export CSV
            </button>
            <button type="button" className={btnPrimary} onClick={() => setForm(form ? null : BLANK)} aria-expanded={!!form}>
              <Plus size={16} aria-hidden="true" /> Add item
            </button>
          </>
        }
      />

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-px bg-border border border-border rounded-lg overflow-hidden mb-6">
        <div className="bg-card p-4">
          <p className="text-xs uppercase tracking-wider text-muted-foreground">Items</p>
          <p className="mt-1 text-2xl font-semibold font-mono">{state.stock.length}</p>
        </div>
        <div className="bg-card p-4">
          <p className="text-xs uppercase tracking-wider text-muted-foreground">Stock value (cost)</p>
          <p className="mt-1 text-2xl font-semibold">
            <Money value={stockValue(state.stock)} currency={cur} />
          </p>
        </div>
        <div className="bg-card p-4 flex items-start justify-between gap-3">
          <div>
            <p className="text-xs uppercase tracking-wider text-muted-foreground">Below reorder level</p>
            <p className={`mt-1 text-2xl font-semibold font-mono ${low.length ? "text-ll-warning" : ""}`}>{low.length}</p>
          </div>
          {low.length > 0 && (
            <button type="button" className={btnGhost} onClick={orderLowStock}>
              Draft order email
            </button>
          )}
        </div>
      </div>

      {form && (
        <Panel className="mb-6">
          <h2 className="font-heading text-lg font-semibold mb-3">New stock item</h2>
          <form
            className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4"
            onSubmit={(e) => {
              e.preventDefault();
              if (!form.name.trim()) return;
              upsert("stock", { ...form, id: newId() });
              setForm(null);
            }}
          >
            <label className={`${labelClass} lg:col-span-2`}>
              Name
              <input id="stock-name" required className={fieldClass} value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
            </label>
            <label className={labelClass}>
              SKU / code
              <input id="stock-sku" className={`${fieldClass} font-mono`} value={form.sku} onChange={(e) => setForm({ ...form, sku: e.target.value })} />
            </label>
            <label className={labelClass}>
              Unit
              <input id="stock-unit" className={fieldClass} value={form.unit} onChange={(e) => setForm({ ...form, unit: e.target.value })} placeholder="pcs, m, m³, kg, L" />
            </label>
            {num("quantity", "On hand")}
            {num("reorderLevel", "Reorder at")}
            {num("costPrice", "Cost price", "0.01")}
            {num("salePrice", "Sale price (0 if not sold)", "0.01")}
            <label className={`${labelClass} lg:col-span-2`}>
              Location
              <input id="stock-location" className={fieldClass} value={form.location} onChange={(e) => setForm({ ...form, location: e.target.value })} placeholder="Rack A, drawer 3…" />
            </label>
            <div className="lg:col-span-4">
              <button type="submit" className={btnPrimary}>
                Save item
              </button>
            </div>
          </form>
        </Panel>
      )}

      <div className="flex flex-col gap-2 sm:flex-row sm:items-center mb-4">
        <div className="relative flex-1">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
          <input aria-label="Search stock" className={`${fieldClass} pl-9`} placeholder="Search name, code or location…" value={query} onChange={(e) => setQuery(e.target.value)} />
        </div>
        <label className="inline-flex items-center gap-2 text-sm">
          <input id="only-low" type="checkbox" checked={onlyLow} onChange={(e) => setOnlyLow(e.target.checked)} className="h-4 w-4 accent-[hsl(var(--primary))]" />
          Only low stock
        </label>
      </div>

      {state.stock.length === 0 ? (
        <EmptyState title="No stock items yet">
          <p>Add the materials and goods you keep on the shelf.</p>
        </EmptyState>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-border bg-card">
          <table className="w-full text-sm">
            <thead className="text-left text-xs uppercase tracking-wider text-muted-foreground border-b border-border">
              <tr>
                <th className="px-4 py-3 font-medium">Item</th>
                <th className="px-4 py-3 font-medium hidden md:table-cell">Location</th>
                <th className="px-4 py-3 font-medium">On hand</th>
                <th className="px-4 py-3 font-medium text-right hidden sm:table-cell">Reorder at</th>
                <th className="px-4 py-3 font-medium text-right hidden md:table-cell">Cost</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody>
              {rows.map((s) => {
                const isLow = s.quantity <= s.reorderLevel;
                return (
                  <tr key={s.id} className="border-b border-border last:border-0">
                    <td className="px-4 py-3">
                      <span className="font-medium">{s.name}</span>
                      <span className="block text-xs font-mono text-muted-foreground">{s.sku}</span>
                    </td>
                    <td className="px-4 py-3 hidden md:table-cell text-muted-foreground">{s.location}</td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1">
                        <button type="button" className={iconBtn} aria-label={`One less ${s.name}`} onClick={() => adjust(s, -1)}>
                          <Minus size={14} aria-hidden="true" />
                        </button>
                        <input
                          aria-label={`${s.name} quantity`}
                          type="number"
                          step="any"
                          min={0}
                          className={`${fieldClass} w-20 text-center font-mono px-1 ${isLow ? "border-ll-warning" : ""}`}
                          value={s.quantity}
                          onChange={(e) => patchItem("stock", s.id, { quantity: Math.max(0, Number(e.target.value)) })}
                        />
                        <button type="button" className={iconBtn} aria-label={`One more ${s.name}`} onClick={() => adjust(s, 1)}>
                          <Plus size={14} aria-hidden="true" />
                        </button>
                        <span className="text-xs text-muted-foreground ml-1">{s.unit}</span>
                        {isLow && (
                          <span className="ml-2 inline-flex items-center gap-1 text-[11px] font-semibold uppercase tracking-wider text-ll-warning">
                            <AlertTriangle size={12} aria-hidden="true" /> Low
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-right font-mono tabular-nums hidden sm:table-cell">
                      {s.reorderLevel} {s.unit}
                    </td>
                    <td className="px-4 py-3 text-right hidden md:table-cell">
                      <Money value={s.costPrice} currency={cur} />
                    </td>
                    <td className="px-4 py-3 text-right">
                      <ConfirmDelete label={`Delete ${s.name}`} onConfirm={() => remove("stock", s.id)}>
                        <Trash2 size={16} aria-hidden="true" />
                      </ConfirmDelete>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};

export default Inventory;
