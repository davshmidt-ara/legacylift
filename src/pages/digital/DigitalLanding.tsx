import { useEffect } from "react";
import { Link } from "react-router-dom";
import { ArrowRight, Archive, Bot, Boxes, Check, FileScan, Map, PenLine, ReceiptText, ShieldCheck, Users } from "lucide-react";
import { msg, useLang, useT } from "@/i18n";
import { LanguageSwitch } from "@/i18n/LanguageSwitch";
import { formatMoney } from "@/features/digital/components";

const FUNCTIONS = [
  { icon: ReceiptText, title: msg("Invoices & quotes"), text: msg("Numbered invoices and quotes with tax, printable as PDF. Quotes turn into invoices in one click; overdue ones are flagged.") },
  { icon: Users, title: msg("Customer book"), text: msg("Contacts, notes and complete invoice history per customer. It replaces the card index and the address book.") },
  { icon: Boxes, title: msg("Stock control"), text: msg("Materials on hand with reorder levels. Invoiced items are booked out automatically; low stock gets flagged.") },
  { icon: FileScan, title: msg("Paper digitizing"), text: msg("Photograph invoices, orders, contracts and handwritten cards. AI turns them into records, customers and invoices.") },
  { icon: Bot, title: msg("Business assistant"), text: msg("Ask “Who owes us money?” or “What are we low on?” and get answers from your own books, in plain language.") },
  { icon: PenLine, title: msg("Writer"), text: msg("Payment reminders, quotes, supplier orders and replies drafted in your name from a few notes.") },
  { icon: Map, title: msg("Digital roadmap"), text: msg("A ten-question check-up scores digital maturity and lays out a phased plan with real tools and costs.") },
  { icon: Archive, title: msg("Document archive"), text: msg("Every scanned document searchable in one place, exportable to CSV for the accountant.") },
];

const PACKAGES = [
  {
    name: "Digital Start",
    for: msg("For firms still on paper"),
    items: [msg("Digital check-up and roadmap"), msg("Archive digitized with AI (customer cards, open invoices, contracts)"), msg("Customer book set up"), msg("Half-day staff training")],
  },
  {
    name: "Business Suite",
    for: msg("For day-to-day running"),
    highlight: true,
    items: [msg("Everything in Digital Start"), msg("Invoicing and quotes with your letterhead details"), msg("Stock control with reorder alerts"), msg("Payment tracking and overdue follow-up"), msg("Monthly backup check")],
  },
  {
    name: "AI Partner",
    for: msg("For firms ready to automate"),
    items: [msg("Everything in Business Suite"), msg("AI assistant over your business data"), msg("AI writer for reminders, quotes and replies"), msg("Quarterly roadmap review with an advisor")],
  },
];

const DigitalLanding = () => {
  const t = useT();
  const { lang } = useLang();
  useEffect(() => {
    const prev = document.title;
    document.title = "LegacyLift";
    return () => {
      document.title = prev;
    };
  }, []);

  return (
    <div className="theme-legacylift min-h-screen">
      <header className="border-b border-border">
        <div className="container mx-auto px-4 sm:px-6 py-4 flex items-center justify-between gap-4">
          <span className="flex items-center gap-2 font-heading text-xl font-extrabold">
            <span className="inline-block h-5 w-5 rounded-sm bg-primary" aria-hidden="true" />
            LegacyLift
          </span>
          <nav aria-label={t("Page")} className="flex items-center gap-5 text-sm">
            <a href="#functions" className="hidden sm:inline hover:text-primary">
              {t("What you get")}
            </a>
            <a href="#packages" className="hidden sm:inline hover:text-primary">
              {t("Packages")}
            </a>
            <Link to="/app" className="font-semibold text-primary hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded">
              {t("Open workspace")}
            </Link>
            <LanguageSwitch />
          </nav>
        </div>
      </header>

      <main>
        <section className="container mx-auto px-4 sm:px-6 py-14 md:py-20 grid gap-12 lg:grid-cols-[1.1fr_1fr] lg:items-center">
          <div>
            <p className="text-xs font-medium uppercase tracking-[0.16em] text-primary mb-4">{t("Digitalization for established firms")}</p>
            <h1 className="font-heading text-4xl sm:text-5xl lg:text-6xl font-extrabold leading-[1.02]">
              {t("From the filing cabinet to the future, without losing what works.")}
            </h1>
            <p className="mt-6 text-lg text-muted-foreground max-w-xl leading-relaxed">
              {t("LegacyLift gives family businesses, workshops and traditional firms the everyday tools they're missing: invoicing, a customer book, stock control. AI does the typing, the chasing and the thinking-ahead.")}
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Link
                to="/app"
                className="inline-flex items-center gap-2 px-6 py-3 bg-primary text-primary-foreground font-semibold rounded-md hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
              >
                {t("Try the workspace")} <ArrowRight size={18} aria-hidden="true" />
              </Link>
              <Link
                to="/app/roadmap"
                className="inline-flex items-center gap-2 px-6 py-3 border border-border bg-card rounded-md font-semibold hover:bg-secondary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                {t("Take the digital check-up")}
              </Link>
            </div>
          </div>

          {/* Paper slip → digital record */}
          <div className="relative mx-auto w-full max-w-md" aria-label={t("Example: a handwritten invoice becomes a digital record")} role="img">
            <div className="rotate-[-4deg] rounded-sm border border-border bg-[hsl(var(--ll-paper))] p-5 shadow-md font-mono text-[13px] leading-6 text-[hsl(var(--ll-paper-ink))]">
              {lang === "lv" ? (
                <>
                  <p className="font-semibold">RĒĶINS Nr. 1047</p>
                  <p>SIA Kalniņa Būve</p>
                  <p>Ozolkoka kāpnes, 14 pak. .... 7200,–</p>
                  <p>Montāža 18 st. .............. 1170,–</p>
                  <p className="border-t border-dashed border-current mt-1 pt-1">Kopā bez PVN ............... 8370,–</p>
                </>
              ) : (
                <>
                  <p className="font-semibold">INVOICE No. 1047</p>
                  <p>SIA Kalniņa Būve</p>
                  <p>Oak staircase, 14 steps .... 7,200.–</p>
                  <p>Fitting 18 hrs ............. 1,170.–</p>
                  <p className="border-t border-dashed border-current mt-1 pt-1">Net total .................. 8,370.–</p>
                </>
              )}
            </div>
            <div className="relative -mt-3 ml-8 sm:ml-16 rounded-lg border border-border bg-card p-5 shadow-lg">
              <div className="flex items-center justify-between">
                <span className="font-mono text-sm font-medium">RE-2026-1047</span>
                <span className="rounded-full bg-destructive/15 text-destructive px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wider">{t("overdue")}</span>
              </div>
              <p className="mt-2 font-semibold">SIA Kalniņa Būve</p>
              <dl className="mt-3 grid grid-cols-2 gap-y-1 text-sm">
                <dt className="text-muted-foreground">{t("Net")}</dt>
                <dd className="text-right font-mono tabular-nums">{formatMoney(8370, "EUR")}</dd>
                <dt className="text-muted-foreground">{t("VAT {rate}%", { rate: 21 })}</dt>
                <dd className="text-right font-mono tabular-nums">{formatMoney(1757.7, "EUR")}</dd>
                <dt className="font-semibold border-t border-border pt-1">{t("Total")}</dt>
                <dd className="text-right font-mono tabular-nums font-semibold border-t border-border pt-1">{formatMoney(10127.7, "EUR")}</dd>
              </dl>
              <p className="mt-3 inline-flex items-center gap-1.5 text-xs text-primary font-medium">
                <PenLine size={13} aria-hidden="true" /> {t("Payment reminder drafted")}
              </p>
            </div>
          </div>
        </section>

        <section id="functions" aria-labelledby="functions-heading" className="border-y border-border bg-card py-16 md:py-20">
          <div className="container mx-auto px-4 sm:px-6">
            <div className="max-w-2xl mb-10">
              <h2 id="functions-heading" className="font-heading text-3xl md:text-4xl font-bold">
                {t("What the firm gets")}
              </h2>
              <p className="mt-3 text-muted-foreground">
                {t("Eight working tools in one workspace. The first three run the business every day; AI helps with the rest.")}
              </p>
            </div>
            <div className="grid gap-x-8 gap-y-10 sm:grid-cols-2 lg:grid-cols-4">
              {FUNCTIONS.map(({ icon: Icon, title, text }) => (
                <div key={title}>
                  <Icon className="text-primary mb-3" size={24} aria-hidden="true" />
                  <h3 className="font-heading font-semibold text-lg">{t(title)}</h3>
                  <p className="mt-1.5 text-sm text-muted-foreground leading-relaxed">{t(text)}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section id="packages" aria-labelledby="packages-heading" className="container mx-auto px-4 sm:px-6 py-16 md:py-20">
          <div className="max-w-2xl mb-10">
            <h2 id="packages-heading" className="font-heading text-3xl md:text-4xl font-bold">
              {t("Packages")}
            </h2>
            <p className="mt-3 text-muted-foreground">{t("Each step builds on the one before, so a firm can start small and grow into it.")}</p>
          </div>
          <div className="grid gap-6 lg:grid-cols-3">
            {PACKAGES.map((p) => (
              <div key={p.name} className={`flex flex-col rounded-lg border p-6 ${p.highlight ? "border-primary border-2 bg-card" : "border-border bg-card"}`}>
                <p className="text-xs uppercase tracking-[0.12em] text-muted-foreground">{t(p.for)}</p>
                <h3 className="mt-1 font-heading text-2xl font-bold">{p.name}</h3>
                <ul className="mt-5 flex flex-col gap-2.5 text-sm flex-1">
                  {p.items.map((i) => (
                    <li key={i} className="flex gap-2">
                      <Check size={16} className="text-primary shrink-0 mt-0.5" aria-hidden="true" />
                      <span>{t(i)}</span>
                    </li>
                  ))}
                </ul>
                <Link
                  to="/app"
                  className={`mt-6 inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-md text-sm font-semibold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${
                    p.highlight ? "bg-primary text-primary-foreground hover:bg-primary/90" : "border border-border hover:bg-secondary"
                  }`}
                >
                  {t("See it in the workspace")}
                </Link>
              </div>
            ))}
          </div>
          <p className="mt-8 flex items-start gap-2 text-sm text-muted-foreground max-w-2xl">
            <ShieldCheck size={16} className="text-primary shrink-0 mt-0.5" aria-hidden="true" />
            {t("Every AI result is shown for review before it is saved or sent. The firm stays in charge of its books.")}
          </p>
        </section>
      </main>

      <footer className="border-t border-border py-6 text-center text-xs text-muted-foreground">{t("LegacyLift · Built for firms with history.")}</footer>
    </div>
  );
};

export default DigitalLanding;
