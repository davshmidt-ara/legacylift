import { useMemo } from "react";
import { Link } from "react-router-dom";
import { AlertTriangle, ArrowRight, Bot } from "lucide-react";
import GettingStarted from "./GettingStarted";
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { useBase } from "../base";
import { useWorkspace } from "../store";
import { customerName, daysBetween, invoiceTotals, lowStock, monthlyRevenue, receivables, todayIso } from "../finance";
import { EmptyState, Money, PageHeader, Panel, btnGhost, btnPrimary, formatMoney, linkClass } from "../components";
import { locale, useT } from "@/i18n";

const Dashboard = () => {
  const t = useT();
  const { state, loadSampleData } = useWorkspace();
  const base = useBase();
  const today = todayIso();
  const cur = state.profile.currency;
  const rec = useMemo(() => receivables(state.invoices, today), [state.invoices, today]);
  const revenue = useMemo(() => monthlyRevenue(state.invoices, 6, today), [state.invoices, today]);
  const low = lowStock(state.stock);
  const thisMonth = revenue[revenue.length - 1]?.total ?? 0;
  const lastMonth = revenue[revenue.length - 2]?.total ?? 0;
  const drafts = state.invoices.filter((i) => i.status === "draft");
  const openQuotes = state.invoices.filter((i) => i.kind === "quote" && i.status === "sent");
  const empty = !state.invoices.length && !state.customers.length && !state.records.length;
  const done = state.roadmapDone.length;
  const totalActions = state.roadmap?.phases.reduce((s, p) => s + p.actions.length, 0) ?? 0;

  const todo = [
    ...rec.overdue.map((i) => ({
      key: i.id,
      tone: "critical" as const,
      text: t("{number} · {customer} is {days} days overdue ({amount})", { number: i.number, customer: customerName(state.customers, i.customerId), days: daysBetween(i.dueDate, today), amount: formatMoney(invoiceTotals(i).total, cur) }),
      to: `${base}/invoices/${i.id}`,
      cta: t("Send reminder"),
    })),
    ...drafts.map((i) => ({ key: i.id, tone: "info" as const, text: t("{number} is still a draft", { number: i.number }), to: `${base}/invoices/${i.id}`, cta: t("Review & send") })),
    ...openQuotes.map((i) => ({
      key: i.id,
      tone: "info" as const,
      text: t("Quote {number} for {customer} is awaiting a reply", { number: i.number, customer: customerName(state.customers, i.customerId) }),
      to: `${base}/invoices/${i.id}`,
      cta: t("Follow up"),
    })),
    ...low.map((s) => ({ key: s.id, tone: "warning" as const, text: t("{name}: {quantity} {unit} left (reorder at {level})", { name: s.name, quantity: s.quantity.toLocaleString(locale()), unit: s.unit, level: s.reorderLevel.toLocaleString(locale()) }), to: `${base}/stock`, cta: t("Reorder") })),
  ];

  const toneClass = { critical: "bg-destructive", warning: "bg-ll-warning", info: "bg-ll-info" };

  return (
    <div className="max-w-6xl">
      <PageHeader
        eyebrow={new Date().toLocaleDateString(locale(), { weekday: "long", day: "numeric", month: "long" })}
        title={state.profile.businessName || t("Your business at a glance")}
        actions={
          <>
            <Link to={`${base}/invoices/new?kind=quote`} className={btnGhost}>
              {t("New quote")}
            </Link>
            <Link to={`${base}/invoices/new?kind=invoice`} className={btnPrimary}>
              {t("New invoice")}
            </Link>
          </>
        }
      />

      {empty ? (
        <div className="flex flex-col gap-6">
          <GettingStarted />
          <Panel className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="font-heading text-lg font-semibold">{t("Want to look around first?")}</p>
              <p className="text-sm text-muted-foreground">{t("Load an example business (a 60-year-old joinery) to try everything. You can clear it in Settings when you start for real.")}</p>
            </div>
            <button type="button" className={btnPrimary} onClick={loadSampleData}>
              {t("Load example business")}
            </button>
          </Panel>
        </div>
      ) : (
        <div className="flex flex-col gap-6">
          <GettingStarted />
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-px bg-border border border-border rounded-lg overflow-hidden">
            {[
              { label: t("Paid this month"), node: <Money value={thisMonth} currency={cur} />, sub: t("{amount} last month", { amount: formatMoney(lastMonth, cur) }) },
              { label: t("Awaiting payment"), node: <Money value={rec.openAmount} currency={cur} />, sub: t("Open invoices: {n}", { n: rec.openCount }) },
              {
                label: t("Overdue"),
                node: <Money value={rec.overdueAmount} currency={cur} className={rec.overdueCount ? "text-destructive" : ""} />,
                sub: rec.overdueCount ? t("Need a reminder: {n}", { n: rec.overdueCount }) : t("Nothing overdue"),
              },
              { label: t("Roadmap"), node: <span className="font-mono">{totalActions ? `${Math.round((done / totalActions) * 100)}%` : "—"}</span>, sub: totalActions ? t("{done} of {total} steps done", { done, total: totalActions }) : t("Not started") },
            ].map((k) => (
              <div key={k.label} className="bg-card p-4">
                <p className="text-xs uppercase tracking-wider text-muted-foreground">{k.label}</p>
                <p className="mt-1 text-xl md:text-2xl font-semibold">{k.node}</p>
                <p className="text-xs text-muted-foreground mt-0.5">{k.sub}</p>
              </div>
            ))}
          </div>

          <div className="grid gap-6 lg:grid-cols-[1.4fr_1fr]">
            <Panel>
              <h2 className="font-heading text-lg font-semibold">{t("Payments received")}</h2>
              <p className="text-xs text-muted-foreground mb-4">{t("Paid invoices per month, gross, last 6 months")}</p>
              <div className="h-56" role="img" aria-label={`${t("Payments received per month")}: ${revenue.map((r) => `${r.label} ${formatMoney(r.total, cur)}`).join(", ")}`}>
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={revenue} margin={{ top: 4, right: 4, left: 4, bottom: 0 }} barCategoryGap="28%">
                    <CartesianGrid vertical={false} stroke="hsl(var(--border))" strokeOpacity={0.7} />
                    <XAxis dataKey="label" tickLine={false} axisLine={{ stroke: "hsl(var(--border))" }} tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 12 }} />
                    <YAxis
                      width={56}
                      tickLine={false}
                      axisLine={false}
                      tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 11 }}
                      tickFormatter={(v: number) => (v >= 1000 ? `${Math.round(v / 1000)}k` : String(v))}
                    />
                    <Tooltip
                      cursor={{ fill: "hsl(var(--secondary))" }}
                      formatter={(v: number) => [formatMoney(v, cur), t("Received")]}
                      contentStyle={{ background: "hsl(var(--popover))", border: "1px solid hsl(var(--border))", borderRadius: 6, color: "hsl(var(--popover-foreground))", fontSize: 12 }}
                      labelStyle={{ color: "hsl(var(--muted-foreground))" }}
                    />
                    <Bar dataKey="total" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} maxBarSize={36} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </Panel>

            <Panel>
              <h2 className="font-heading text-lg font-semibold mb-3">{t("Needs attention")}</h2>
              {todo.length === 0 ? (
                <p className="text-sm text-muted-foreground">{t("All clear. Nothing overdue, no drafts, stock is fine.")}</p>
              ) : (
                <ul className="flex flex-col divide-y divide-border">
                  {todo.slice(0, 7).map((item) => (
                    <li key={item.key} className="flex items-start gap-3 py-2.5">
                      <span className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${toneClass[item.tone]}`} aria-hidden="true" />
                      <span className="flex-1 text-sm">
                        {item.tone === "critical" && <span className="sr-only">{t("Overdue")}: </span>}
                        {item.tone === "warning" && <span className="sr-only">{t("Low stock")}: </span>}
                        {item.text}
                      </span>
                      <Link to={item.to} className={`text-xs whitespace-nowrap ${linkClass}`}>
                        {item.cta}
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
              {low.length > 0 && (
                <p className="mt-3 flex items-center gap-1 text-xs text-ll-warning">
                  <AlertTriangle size={12} aria-hidden="true" /> {t("Stock items below reorder level: {n}", { n: low.length })}
                </p>
              )}
            </Panel>
          </div>

          <Panel className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-start gap-3">
              <Bot className="text-primary shrink-0 mt-0.5" size={22} aria-hidden="true" />
              <div>
                <p className="font-semibold">{t("Ask the AI assistant about your business")}</p>
                <p className="text-sm text-muted-foreground">{t("“Who owes us the most?” “What did we charge for the last staircase?”")}</p>
              </div>
            </div>
            <Link to={`${base}/assistant`} className={btnGhost}>
              {t("Open assistant")} <ArrowRight size={16} aria-hidden="true" />
            </Link>
          </Panel>
        </div>
      )}

      {!empty && state.invoices.length === 0 && (
        <div className="mt-6">
          <EmptyState title={t("No invoices yet")}>
            <Link to={`${base}/invoices/new?kind=invoice`} className={btnPrimary}>
              {t("Write your first invoice")}
            </Link>
          </EmptyState>
        </div>
      )}
    </div>
  );
};

export default Dashboard;
