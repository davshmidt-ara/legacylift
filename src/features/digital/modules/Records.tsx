import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { CheckCircle2, CircleDot, Download, Search, Trash2 } from "lucide-react";
import { recordsToCsv, useWorkspace } from "../store";
import { useBase } from "../base";
import { DOC_TYPES } from "../types";
import { ConfirmDelete, PageHeader, Panel, btnGhost, download, fieldClass, formatMoney } from "../components";

const Records = () => {
  const { state, patchItem, remove } = useWorkspace();
  const base = useBase();
  const [query, setQuery] = useState("");
  const [type, setType] = useState("all");
  const [expanded, setExpanded] = useState<string | null>(null);

  const filtered = useMemo(() => {
    const q = query.toLowerCase().trim();
    return state.records.filter(
      (r) =>
        (type === "all" || r.docType === type) &&
        (!q ||
          `${r.title} ${r.party} ${r.summary} ${r.tags.join(" ")} ${r.fields.map((f) => f.value).join(" ")}`
            .toLowerCase()
            .includes(q)),
    );
  }, [state.records, query, type]);

  return (
    <div className="max-w-6xl">
      <PageHeader
        eyebrow="Archive"
        title="Documents"
        description="Every paper document you've digitized — contracts, supplier orders, old invoices — searchable in one place. Export to CSV for Excel or your accountant."
        actions={
          <>
            <button
              type="button"
              className={btnGhost}
              disabled={!state.records.length}
              onClick={() => download("legacylift-records.csv", recordsToCsv(filtered), "text/csv")}
            >
              <Download size={16} aria-hidden="true" /> CSV
            </button>
            <button
              type="button"
              className={btnGhost}
              disabled={!state.records.length}
              onClick={() => download("legacylift-backup.json", JSON.stringify(state, null, 2), "application/json")}
            >
              <Download size={16} aria-hidden="true" /> Full backup
            </button>
          </>
        }
      />

      <div className="flex flex-col gap-2 sm:flex-row mb-4">
        <div className="relative flex-1">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
          <input
            aria-label="Search records"
            className={`${fieldClass} pl-9`}
            placeholder="Search names, amounts, notes…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </div>
        <select aria-label="Filter by type" className={`${fieldClass} sm:w-44`} value={type} onChange={(e) => setType(e.target.value)}>
          <option value="all">All types</option>
          {DOC_TYPES.map((t) => (
            <option key={t} value={t}>
              {t}
            </option>
          ))}
        </select>
      </div>

      {state.records.length === 0 ? (
        <Panel>
          <p className="text-sm text-muted-foreground">
            No records yet. <Link to={`${base}/digitize`} className="text-primary underline">Digitize your first document</Link>.
          </p>
        </Panel>
      ) : (
        <ul className="flex flex-col gap-2">
          {filtered.map((r) => (
            <li key={r.id} className="rounded-lg border border-border bg-card">
              <div className="flex items-center gap-3 p-4">
                <button
                  type="button"
                  aria-label={r.status === "done" ? "Mark as open" : "Mark as done"}
                  className="shrink-0 min-h-11 min-w-11 inline-flex items-center justify-center rounded focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                  onClick={() => patchItem("records", r.id, { status: r.status === "done" ? "open" : "done" })}
                >
                  {r.status === "done" ? (
                    <CheckCircle2 className="text-primary" size={20} aria-hidden="true" />
                  ) : (
                    <CircleDot className="text-muted-foreground" size={20} aria-hidden="true" />
                  )}
                </button>
                <button
                  type="button"
                  className="flex-1 min-w-0 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary rounded"
                  aria-expanded={expanded === r.id}
                  onClick={() => setExpanded(expanded === r.id ? null : r.id)}
                >
                  <p className="font-semibold truncate">{r.title}</p>
                  <p className="text-xs text-muted-foreground truncate">
                    <span className="uppercase tracking-wide">{r.docType}</span>
                    {r.party && ` · ${r.party}`}
                    {r.date && ` · ${r.date}`}
                  </p>
                </button>
                <p className="hidden sm:block font-mono tabular-nums whitespace-nowrap">{formatMoney(r.amount, r.currency)}</p>
                <ConfirmDelete label={`Delete ${r.title}`} onConfirm={() => remove("records", r.id)}>
                  <Trash2 size={16} aria-hidden="true" />
                </ConfirmDelete>
              </div>
              {expanded === r.id && (
                <div className="border-t border-border p-4 text-sm flex flex-col gap-3">
                  <p className="sm:hidden font-heading font-semibold">{formatMoney(r.amount, r.currency)}</p>
                  {r.summary && <p>{r.summary}</p>}
                  {r.fields.length > 0 && (
                    <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1">
                      {r.fields.map((f, i) => (
                        <div key={i} className="contents">
                          <dt className="text-muted-foreground">{f.label}</dt>
                          <dd className="break-words">{f.value}</dd>
                        </div>
                      ))}
                    </dl>
                  )}
                  {r.lineItems.length > 0 && (
                    <div className="overflow-x-auto">
                      <table className="w-full text-left text-xs">
                        <thead className="text-muted-foreground">
                          <tr>
                            <th className="py-1 pr-3 font-normal">Item</th>
                            <th className="py-1 pr-3 font-normal">Qty</th>
                            <th className="py-1 pr-3 font-normal">Unit</th>
                            <th className="py-1 font-normal">Total</th>
                          </tr>
                        </thead>
                        <tbody>
                          {r.lineItems.map((li, i) => (
                            <tr key={i} className="border-t border-border/50">
                              <td className="py-1 pr-3">{li.description}</td>
                              <td className="py-1 pr-3">{li.quantity ?? "—"}</td>
                              <td className="py-1 pr-3">{formatMoney(li.unitPrice, r.currency)}</td>
                              <td className="py-1">{formatMoney(li.total, r.currency)}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                  <div className="flex flex-wrap gap-1">
                    {r.tags.map((t) => (
                      <span key={t} className="rounded-full bg-secondary px-2 py-0.5 text-xs">
                        {t}
                      </span>
                    ))}
                    <span className="text-xs text-muted-foreground ml-auto">Source: {r.source}</span>
                  </div>
                </div>
              )}
            </li>
          ))}
          {filtered.length === 0 && <p className="text-sm text-muted-foreground">No records match your search.</p>}
        </ul>
      )}
    </div>
  );
};

export default Records;
