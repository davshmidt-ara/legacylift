import { useEffect } from "react";
import { Link } from "react-router-dom";
import { ArrowRight, Archive, Bot, Boxes, Check, FileScan, Map, PenLine, ReceiptText, ShieldCheck, Users } from "lucide-react";

const FUNCTIONS = [
  { icon: ReceiptText, title: "Invoices & quotes", text: "Numbered invoices and quotes with tax, printable as PDF. Quotes turn into invoices in one click; overdue ones are flagged." },
  { icon: Users, title: "Customer book", text: "Contacts, notes and complete invoice history per customer. It replaces the card index and the address book." },
  { icon: Boxes, title: "Stock control", text: "Materials on hand with reorder levels. Invoiced items are booked out automatically; low stock gets flagged." },
  { icon: FileScan, title: "Paper digitizing", text: "Photograph invoices, orders, contracts and handwritten cards. AI turns them into records, customers and invoices." },
  { icon: Bot, title: "Business assistant", text: "Ask “Who owes us money?” or “What are we low on?” and get answers from your own books, in plain language." },
  { icon: PenLine, title: "Writer", text: "Payment reminders, quotes, supplier orders and replies drafted in your name from a few notes." },
  { icon: Map, title: "Digital roadmap", text: "A ten-question check-up scores digital maturity and lays out a phased plan with real tools and costs." },
  { icon: Archive, title: "Document archive", text: "Every scanned document searchable in one place, exportable to CSV for the accountant." },
];

const PACKAGES = [
  {
    name: "Digital Start",
    for: "For firms still on paper",
    items: ["Digital check-up and roadmap", "Archive digitized with AI (customer cards, open invoices, contracts)", "Customer book set up", "Half-day staff training"],
  },
  {
    name: "Business Suite",
    for: "For day-to-day running",
    highlight: true,
    items: ["Everything in Digital Start", "Invoicing and quotes with your letterhead details", "Stock control with reorder alerts", "Payment tracking and overdue follow-up", "Monthly backup check"],
  },
  {
    name: "AI Partner",
    for: "For firms ready to automate",
    items: ["Everything in Business Suite", "AI assistant over your business data", "AI writer for reminders, quotes and replies", "Quarterly roadmap review with an advisor"],
  },
];

const DigitalLanding = () => {
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
          <nav aria-label="Page" className="flex items-center gap-5 text-sm">
            <a href="#functions" className="hidden sm:inline hover:text-primary">
              What you get
            </a>
            <a href="#packages" className="hidden sm:inline hover:text-primary">
              Packages
            </a>
            <Link to="/app" className="font-semibold text-primary hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded">
              Open workspace
            </Link>
          </nav>
        </div>
      </header>

      <main>
        <section className="container mx-auto px-4 sm:px-6 py-14 md:py-20 grid gap-12 lg:grid-cols-[1.1fr_1fr] lg:items-center">
          <div>
            <p className="text-xs font-medium uppercase tracking-[0.16em] text-primary mb-4">Digitalization for established firms</p>
            <h1 className="font-heading text-4xl sm:text-5xl lg:text-6xl font-extrabold leading-[1.02]">
              From the filing cabinet to the future, without losing what works.
            </h1>
            <p className="mt-6 text-lg text-muted-foreground max-w-xl leading-relaxed">
              LegacyLift gives family businesses, workshops and traditional firms the everyday tools they're missing: invoicing, a customer book, stock control. AI does the typing, the chasing and the thinking-ahead.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Link
                to="/app"
                className="inline-flex items-center gap-2 px-6 py-3 bg-primary text-primary-foreground font-semibold rounded-md hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
              >
                Try the workspace <ArrowRight size={18} aria-hidden="true" />
              </Link>
              <Link
                to="/app/roadmap"
                className="inline-flex items-center gap-2 px-6 py-3 border border-border bg-card rounded-md font-semibold hover:bg-secondary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                Take the digital check-up
              </Link>
            </div>
          </div>

          {/* Paper slip → digital record */}
          <div className="relative mx-auto w-full max-w-md" aria-label="Example: a handwritten invoice becomes a digital record" role="img">
            <div className="rotate-[-4deg] rounded-sm border border-border bg-[hsl(var(--ll-paper))] p-5 shadow-md font-mono text-[13px] leading-6 text-[hsl(var(--ll-paper-ink))]">
              <p className="font-semibold">RECHNUNG Nr. 1047</p>
              <p>Müller Bau GmbH</p>
              <p>Eichentreppe 14 Stufen ...... 7.200,–</p>
              <p>Montage 18 Std. ............. 1.170,–</p>
              <p className="border-t border-dashed border-current mt-1 pt-1">Summe netto ................ 8.370,–</p>
            </div>
            <div className="relative -mt-3 ml-8 sm:ml-16 rounded-lg border border-border bg-card p-5 shadow-lg">
              <div className="flex items-center justify-between">
                <span className="font-mono text-sm font-medium">RE-2026-1047</span>
                <span className="rounded-full bg-destructive/15 text-destructive px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wider">Overdue</span>
              </div>
              <p className="mt-2 font-semibold">Müller Bau GmbH</p>
              <dl className="mt-3 grid grid-cols-2 gap-y-1 text-sm">
                <dt className="text-muted-foreground">Net</dt>
                <dd className="text-right font-mono tabular-nums">€8,370.00</dd>
                <dt className="text-muted-foreground">VAT 19%</dt>
                <dd className="text-right font-mono tabular-nums">€1,590.30</dd>
                <dt className="font-semibold border-t border-border pt-1">Total</dt>
                <dd className="text-right font-mono tabular-nums font-semibold border-t border-border pt-1">€9,960.30</dd>
              </dl>
              <p className="mt-3 inline-flex items-center gap-1.5 text-xs text-primary font-medium">
                <PenLine size={13} aria-hidden="true" /> Payment reminder drafted
              </p>
            </div>
          </div>
        </section>

        <section id="functions" aria-labelledby="functions-heading" className="border-y border-border bg-card py-16 md:py-20">
          <div className="container mx-auto px-4 sm:px-6">
            <div className="max-w-2xl mb-10">
              <h2 id="functions-heading" className="font-heading text-3xl md:text-4xl font-bold">
                What the firm gets
              </h2>
              <p className="mt-3 text-muted-foreground">
                Eight working tools in one workspace. The first three run the business every day; AI helps with the rest.
              </p>
            </div>
            <div className="grid gap-x-8 gap-y-10 sm:grid-cols-2 lg:grid-cols-4">
              {FUNCTIONS.map(({ icon: Icon, title, text }) => (
                <div key={title}>
                  <Icon className="text-primary mb-3" size={24} aria-hidden="true" />
                  <h3 className="font-heading font-semibold text-lg">{title}</h3>
                  <p className="mt-1.5 text-sm text-muted-foreground leading-relaxed">{text}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section id="packages" aria-labelledby="packages-heading" className="container mx-auto px-4 sm:px-6 py-16 md:py-20">
          <div className="max-w-2xl mb-10">
            <h2 id="packages-heading" className="font-heading text-3xl md:text-4xl font-bold">
              Packages
            </h2>
            <p className="mt-3 text-muted-foreground">Each step builds on the one before, so a firm can start small and grow into it.</p>
          </div>
          <div className="grid gap-6 lg:grid-cols-3">
            {PACKAGES.map((p) => (
              <div key={p.name} className={`flex flex-col rounded-lg border p-6 ${p.highlight ? "border-primary border-2 bg-card" : "border-border bg-card"}`}>
                <p className="text-xs uppercase tracking-[0.12em] text-muted-foreground">{p.for}</p>
                <h3 className="mt-1 font-heading text-2xl font-bold">{p.name}</h3>
                <ul className="mt-5 flex flex-col gap-2.5 text-sm flex-1">
                  {p.items.map((i) => (
                    <li key={i} className="flex gap-2">
                      <Check size={16} className="text-primary shrink-0 mt-0.5" aria-hidden="true" />
                      <span>{i}</span>
                    </li>
                  ))}
                </ul>
                <Link
                  to="/app"
                  className={`mt-6 inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-md text-sm font-semibold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${
                    p.highlight ? "bg-primary text-primary-foreground hover:bg-primary/90" : "border border-border hover:bg-secondary"
                  }`}
                >
                  See it in the workspace
                </Link>
              </div>
            ))}
          </div>
          <p className="mt-8 flex items-start gap-2 text-sm text-muted-foreground max-w-2xl">
            <ShieldCheck size={16} className="text-primary shrink-0 mt-0.5" aria-hidden="true" />
            Every AI result is shown for review before it is saved or sent. The firm stays in charge of its books.
          </p>
        </section>
      </main>

      <footer className="border-t border-border py-6 text-center text-xs text-muted-foreground">LegacyLift · Built for firms with history.</footer>
    </div>
  );
};

export default DigitalLanding;
