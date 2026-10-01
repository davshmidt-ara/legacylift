# LegacyLift — functions reference

This document lists every function LegacyLift provides to a client firm, how the firm uses it, and the code that performs it. All code excerpts are taken from this repository.

- App routes: `/` (landing page), `/app/*` (a firm's own workspace) and `/internal/*` (our team's operations console)
- Frontend code: `src/features/digital/` and `src/pages/digital/`
- AI backend: `supabase/functions/business-ai/index.ts`

---

## Contents

**Run the business (no AI needed)**

1. [Overview dashboard](#1-overview-dashboard)
2. [Invoices & quotes](#2-invoices--quotes)
3. [Customers](#3-customers)
4. [Stock control](#4-stock-control)
5. [Settings, backup & restore](#5-settings-backup--restore)

**AI tools**

6. [Digitize paper](#6-digitize-paper)
7. [Document archive](#7-document-archive)
8. [AI assistant](#8-ai-assistant)
9. [AI writer & payment reminders](#9-ai-writer--payment-reminders)
10. [Digital roadmap](#10-digital-roadmap)

**Foundations**

11. [How data is stored](#11-how-data-is-stored)
12. [How the AI is called](#12-how-the-ai-is-called)
13. [Running, testing and deploying](#13-running-testing-and-deploying)

**Internal**

14. [Operations console (for our team)](#14-operations-console-for-our-team)

---

## How the code is organised

```
src/features/digital/
  types.ts        Data model: Customer, Invoice, StockItem, BusinessProfile, …
  finance.ts      Pure business logic: totals, tax, numbering, overdue, stock, revenue
  store.tsx       Workspace state (React context) + localStorage persistence
  ai.ts           Calls the business-ai edge function, falls back to demo mode
  demo.ts         Offline fallbacks used when AI isn't connected
  sample.ts       Example business (Hartmann & Söhne Joinery)
  components.tsx  Shared UI: buttons, status pills, money formatting, download
  modules/        One file per screen (Dashboard, Invoices, Customers, …)
  merge.ts        Combines two people's changes when they save at the same moment
src/features/cloud/
  api.ts          Every call to the Supabase database (workspaces, clients, invites, team)
  auth.tsx        Sign-in state: session, team access, accepting invites
  AuthScreen.tsx  Sign in / create account / reset password screens
  CloudOpsProvider.tsx  The console's data, shared with the team through Supabase
  persistence.ts  Connects a firm's workspace to the store
src/features/ops/ Console logic: playbook, client types, demo-mode store
src/pages/digital/
  DigitalLanding.tsx  Marketing page with functions and packages
  DigitalApp.tsx      Firm entry: sign in, or try without an account
  ClientEntry.tsx     After sign-in: opens the firm's workspace, switch business, sign out
  WorkspaceShell.tsx  Workspace layout: sidebar, save status, navigation, routes
  ops/                The team console (OpsApp: sign-in and access; OpsPages: screens)
supabase/migrations/  Database tables and access rules
supabase/tests/       Database access tests
supabase/functions/business-ai/index.ts   Claude API calls (server side)
```

The rule of thumb: **calculations live in `finance.ts`** (plain functions, unit-tested), **screens live in `modules/`**, and **every change to data goes through the store** (`upsert`, `patchItem`, `remove`).

---

## 1. Overview dashboard

**What it does:** Shows money received this month, what's awaiting payment, what's overdue, a six-month payments chart, and a "needs attention" list (overdue invoices, unsent drafts, quotes waiting for a reply, low stock).

**How the firm uses it:** Open the workspace. A new firm sees a **Getting started** checklist first: business details → first customer → first invoice → first scanned document. Each step ticks itself off and the next one has a button. After that, click any item in "Needs attention" to go straight to it. **+ Invoice** and **Scan** sit at the top of the sidebar on every page.

```ts
// modules/GettingStarted.tsx — each step checks the firm's own data
{ id: "customer", title: "Add your first customer", path: "/customers", done: (s) => s.customers.length > 0 },

export function setupProgress(s: WorkspaceState) {
  const done = SETUP_STEPS.filter((step) => step.done(s)).length;
  return { done, total: SETUP_STEPS.length, next: SETUP_STEPS.find((step) => !step.done(s)) ?? null };
}
```

**Code:** `modules/Dashboard.tsx`, using `finance.ts`.

Receivables (open and overdue invoices):

```ts
// finance.ts
export function receivables(invoices: Invoice[], today = todayIso()) {
  const open = invoices.filter((i) => i.kind === "invoice" && i.status === "sent");
  const overdue = open.filter((i) => displayStatus(i, today) === "overdue");
  const sum = (list: Invoice[]) => round2(list.reduce((s, i) => s + invoiceTotals(i).total, 0));
  return { openCount: open.length, openAmount: sum(open), overdueCount: overdue.length, overdueAmount: sum(overdue), overdue };
}
```

Payments per month for the chart (by the date the invoice was paid):

```ts
// finance.ts
export function monthlyRevenue(invoices: Invoice[], months = 6, today = todayIso()) {
  const [y, m] = today.split("-").map(Number);
  const buckets: { key: string; label: string; total: number }[] = [];
  for (let k = months - 1; k >= 0; k--) {
    const d = new Date(Date.UTC(y, m - 1 - k, 1));
    const key = d.toISOString().slice(0, 7);
    buckets.push({ key, label: d.toLocaleString(undefined, { month: "short", timeZone: "UTC" }), total: 0 });
  }
  for (const inv of invoices) {
    if (inv.kind !== "invoice" || inv.status !== "paid") continue;
    const key = (inv.paidAt || inv.issueDate).slice(0, 7);
    const b = buckets.find((x) => x.key === key);
    if (b) b.total = round2(b.total + invoiceTotals(inv).total);
  }
  return buckets;
}
```

The chart itself is a Recharts `BarChart` fed with `monthlyRevenue(...)`, and the "needs attention" list is built from `receivables(...).overdue`, drafts, open quotes and `lowStock(...)`.

---

## 2. Invoices & quotes

**What it does:**

- Creates numbered invoices and quotes (`RE-2026-0048`, `AN-2026-0020`), with line items, tax, and due date from the payment terms
- Prints a letterhead layout (browser Print → Save as PDF)
- Emails the invoice through the user's mail program
- Tracks status: draft → sent → paid (invoices), or draft → sent → accepted/declined (quotes)
- Flags an invoice as **overdue** automatically once its due date has passed
- Turns an accepted quote into an invoice in one click
- Duplicates a document, exports the list to CSV, and drafts an AI payment reminder for overdue invoices (see [9](#9-ai-writer--payment-reminders))

**How the firm uses it:** *Invoices & quotes → New invoice* (or *New quote*). Choose a customer (or add one on the spot), add lines, then click **Save & mark as sent**. On the invoice page: **Record payment**, **Email**, **Print / PDF**, **Payment reminder**. On a quote: **Accepted — create invoice**.

**Code:** `modules/Invoices.tsx` (list, editor, detail) and `finance.ts`.

### Totals and tax

Rounded to cents at each step, so printed numbers always add up:

```ts
// finance.ts
export const round2 = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100;

export function invoiceTotals(inv: Pick<Invoice, "items" | "taxRate">) {
  const subtotal = round2(inv.items.reduce((s, i) => s + (i.quantity || 0) * (i.unitPrice || 0), 0));
  const tax = round2((subtotal * (inv.taxRate || 0)) / 100);
  return { subtotal, tax, total: round2(subtotal + tax) };
}
```

### Numbering

Continues from the highest number used this year and restarts at 0001 each new year:

```ts
// finance.ts
export function nextNumber(invoices: Invoice[], kind: InvoiceKind, profile: BusinessProfile, today = todayIso()) {
  const prefix = (kind === "invoice" ? profile.invoicePrefix : profile.quotePrefix) || (kind === "invoice" ? "INV" : "QUO");
  const year = today.slice(0, 4);
  const stem = `${prefix}-${year}-`;
  const max = invoices
    .filter((i) => i.kind === kind && i.number.startsWith(stem))
    .reduce((m, i) => Math.max(m, Number.parseInt(i.number.slice(stem.length), 10) || 0), 0);
  return `${stem}${String(max + 1).padStart(4, "0")}`;
}
```

### Overdue status

"Overdue" is never stored; it is worked out from the due date, so it is always current:

```ts
// finance.ts
export function displayStatus(inv: Invoice, today = todayIso()): DisplayStatus {
  if (inv.kind === "invoice" && inv.status === "sent" && inv.dueDate && inv.dueDate < today) return "overdue";
  return inv.status;
}
```

### Saving from the editor

Empty lines are dropped. "Save & mark as sent" also books linked stock out, once:

```ts
// modules/Invoices.tsx — InvoiceEditor
function save(markSent: boolean) {
  if (!valid) {
    toast.error("Choose a customer and add at least one line with a description.");
    return;
  }
  let cleaned: Invoice = { ...draft, items: draft.items.filter((i) => i.description.trim()) };
  if (markSent) {
    cleaned = { ...cleaned, status: "sent" };
    if (cleaned.kind === "invoice" && !cleaned.stockDeducted) {
      const after = deductStock(state.stock, cleaned);
      if (after !== state.stock) {
        update({ stock: after });
        cleaned.stockDeducted = true;
      }
    }
  }
  upsert("invoices", cleaned);
  toast.success(`${kindLabel(draft.kind)} ${draft.number} saved`);
  navigate(`/app/invoices/${draft.id}`);
}
```

### Keeping stock right when an invoice changes

If a sent invoice is edited, the stock it booked out is first given back, then the new lines are booked out. Deleting a sent invoice gives its stock back:

```ts
// finance.ts
export function returnStock(stock: StockItem[], inv: Pick<Invoice, "items">): StockItem[] { /* adds linked quantities back */ }

// modules/Invoices.tsx — InvoiceEditor.save
let stock = existing?.stockDeducted ? returnStock(state.stock, existing) : state.stock;
const outgoing = cleaned.status === "sent" || cleaned.status === "paid";
const booked = outgoing ? deductStock(stock, cleaned) : stock;
cleaned.stockDeducted = outgoing && booked !== stock;
```

### Recording a payment

```ts
// modules/Invoices.tsx — InvoiceDetail
patchItem("invoices", inv.id, { status: "paid", paidAt: today });
```

### Quote → invoice

```ts
// finance.ts
export function quoteToInvoice(quote: Invoice, invoices: Invoice[], profile: BusinessProfile, newId: () => string, today = todayIso()): Invoice {
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

// modules/Invoices.tsx — InvoiceDetail
function convert() {
  const created = quoteToInvoice(inv!, state.invoices, p, newId, today);
  patchItem("invoices", inv!.id, { status: "accepted" });
  upsert("invoices", created);
  toast.success(`Invoice ${created.number} created from quote`);
  navigate(`/app/invoices/${created.id}`);
}
```

### Print / PDF and email

The invoice page renders a letterhead layout (`<article className="print-sheet">`). A print stylesheet in `src/index.css` hides the sidebar and buttons (`.no-print`), so the browser's *Save as PDF* produces a clean invoice:

```ts
<button type="button" onClick={() => window.print()}>Print / PDF</button>

const mailto = `mailto:${customer?.email ?? ""}?subject=${encodeURIComponent(emailSubject)}&body=${encodeURIComponent(emailBody)}`;
```

### CSV export

```ts
// store.tsx
export function toCsv(header: string[], rows: unknown[][]): string {
  return [header.map(csvEscape).join(","), ...rows.map((r) => r.map(csvEscape).join(","))].join("\n");
}
```

The invoice list calls `toCsv([...columns], rows)` and hands the result to `download("invoices.csv", csv, "text/csv")` from `components.tsx`.

---

## 3. Customers

**What it does:** A contact book (name, company, email, phone, address, notes) with each customer's paid-to-date total, outstanding amount, number of overdue invoices, and full invoice and quote history. Also has **New invoice** / **New quote** buttons pre-filled for that customer, and CSV export.

**How the firm uses it:** *Customers → Add customer*, or photograph old customer cards in *Digitize paper*. Click a customer to edit details and see their history. A customer who has invoices or quotes can't be deleted, so no invoice is ever left without a customer.

**Code:** `modules/Customers.tsx`.

```ts
// finance.ts
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
```

Adding a customer:

```ts
// modules/Customers.tsx — CustomerList
const created = { ...c, id: newId(), createdAt: new Date().toISOString() };
upsert("customers", created);
navigate(created.id);
```

Starting an invoice for a customer is a link. The editor reads `?customer=` and pre-selects them:

```tsx
<Link to={`/app/invoices/new?kind=invoice&customer=${c.id}`}>New invoice</Link>
```

---

## 4. Stock control

**What it does:** Tracks materials and goods with quantity, unit, reorder level, cost and sale price, and location.

- **+ / −** buttons adjust quantities.
- Items at or below their reorder level are flagged, and their count shows in the sidebar.
- An invoice line picked from stock is **booked out automatically** when the invoice is sent.
- **Draft order email** writes the reorder email to the supplier.

**How the firm uses it:** *Stock → Add item*. When writing an invoice, start typing an item name in a line and pick it from the suggestions. The line is then linked to stock.

**Code:** `modules/Inventory.tsx`, `finance.ts`.

```ts
// finance.ts
export function lowStock(stock: StockItem[]) {
  return stock.filter((s) => s.quantity <= s.reorderLevel);
}

export function stockValue(stock: StockItem[]) {
  return round2(stock.reduce((s, i) => s + i.quantity * i.costPrice, 0));
}

/** Books linked stock out for an invoice. Quantities never go below zero. */
export function deductStock(stock: StockItem[], inv: Pick<Invoice, "items">): StockItem[] {
  const used = new Map<string, number>();
  for (const it of inv.items) {
    if (it.productId) used.set(it.productId, (used.get(it.productId) ?? 0) + (it.quantity || 0));
  }
  if (!used.size) return stock;
  return stock.map((s) => (used.has(s.id) ? { ...s, quantity: Math.max(0, round2(s.quantity - used.get(s.id)!)) } : s));
}
```

Adjusting a quantity:

```ts
// modules/Inventory.tsx
const adjust = (s: StockItem, delta: number) => patchItem("stock", s.id, { quantity: Math.max(0, round2(s.quantity + delta)) });
```

The reorder email opens the AI writer pre-filled with the low-stock list:

```ts
// modules/Inventory.tsx
function orderLowStock() {
  const list = low.map((s) => `- ${s.name} (${s.sku}): have ${s.quantity} ${s.unit}, minimum ${s.reorderLevel} ${s.unit}`).join("\n");
  navigate("/app/writer", {
    state: {
      kind: "email",
      audience: "supplier",
      tone: "friendly",
      notes: `Please send a quote and delivery date for restocking the following items:\n${list}\n\nWe usually take delivery on weekday mornings.`,
    },
  });
}
```

---

## 5. Settings, backup & restore

**Restoring is safe:** the file is checked first (`isWorkspaceBackup`), and the firm sees what it contains ("47 customers, 120 invoices…") and must confirm before anything is replaced. Files that aren't LegacyLift backups are refused.

**What it does:** Stores the firm's letterhead details: name, owner, address, email, phone, tax ID and bank details. Also sets the currency, default tax rate, payment terms, invoice and quote number prefixes, and the invoice footer. Offers backup download, restore from a backup file, adding example data, and clearing the workspace (with a confirmation step).

**How the firm uses it:** *Settings*, fill in the company details, then **Save details**. Use **Download backup** regularly.

**Code:** `modules/Settings.tsx`.

```ts
// Save profile
setProfile(p);

// Download backup — the whole workspace as JSON
download(`legacylift-backup-${new Date().toISOString().slice(0, 10)}.json`, JSON.stringify(state, null, 2), "application/json");

// Restore backup — migrate() accepts any earlier format
async function importBackup(file: File) {
  try {
    const data = JSON.parse(await file.text());
    const next = migrate(data);
    replaceAll(next);
    setP(next.profile);
    toast.success(`Restored ${next.customers.length} customers, ${next.invoices.length} invoices, ${next.stock.length} stock items`);
  } catch {
    toast.error("That file isn't a LegacyLift backup.");
  }
}
```

---

## 6. Digitize paper

**What it does:** Turns photos, scanned PDFs or pasted text of paper documents into structured records. It reads invoices, orders, contracts, letters, stock lists and handwritten customer cards. The firm reviews and corrects every field before saving. On save it can also:

- add the customer to **Customers**, and
- put an old invoice on the **Invoices** list so its payment is tracked.

**How the firm uses it:** *Digitize paper → Choose files* (or *Take photo* on a phone, or paste text), check the fields, tick the options, then **Save record**.

**Code:** `modules/Digitize.tsx`, `ai.ts` (`extractDocument`), server task `extract`.

Reading files, where images and PDFs go to the AI as base64 and text files as text:

```ts
// modules/Digitize.tsx
function handleFiles(files: FileList | null) {
  if (!files) return;
  for (const file of Array.from(files)) {
    if (file.size > MAX_BYTES) {
      toast.error(`${file.name} is larger than 8 MB`);
      continue;
    }
    if (isVisualFile(file)) {
      const preview = file.type.startsWith("image/") ? URL.createObjectURL(file) : undefined;
      process(file.name, async () => ({ attachment: await fileToAttachment(file) }), preview);
    } else if (file.type.startsWith("text/") || /\.(txt|csv|md|tsv)$/i.test(file.name)) {
      process(file.name, async () => ({ text: await file.text() }));
    } else {
      toast.error(`${file.name}: use a photo, PDF or text file`);
    }
  }
}
```

On the server, Claude reads the document and must answer in a fixed JSON shape (structured output), so the app always gets the same fields back:

```ts
// supabase/functions/business-ai/index.ts — task "extract"
content.push(attachmentBlock(body.attachment)); // image or PDF
content.push({
  type: "text",
  text:
    "Digitize this business document into a structured record. Transcribe handwriting where legible, " +
    "keep original names and numbers exactly, and put any other useful details into `fields`. " +
    "Use empty strings / null for anything not present rather than guessing.",
});
// …sent with output_config.format = { type: "json_schema", schema: RECORD_SCHEMA }
```

Saving: archive the document, optionally create the customer, and optionally create a tracked invoice:

```ts
// modules/Digitize.tsx (abridged)
upsert("records", toRecord(rec, item.source));

if (wantCustomer && rec.party && !customerId) {
  customerId = newId();
  upsert("customers", { id: customerId, name: rec.party, email: get(/mail/i), phone: get(/phone|tel|mobile/i), /* … */ });
}

if (alsoInvoice[item.key] && rec.docType === "invoice" && customerId) {
  upsert("invoices", {
    kind: "invoice",
    number: numberField || nextNumber(state.invoices, "invoice", state.profile),
    customerId,
    items, // from the extracted line items
    taxRate: 0, // amounts from paper are taken as gross
    status: markedPaid(rec.tags) ? "paid" : "sent", // "paid"/"bezahlt" only, never "unpaid"
    /* … */
  });
}
```

---

## 7. Document archive

**What it does:** A searchable list of every digitized document, filterable by type. Each entry expands to show its fields and line items and can be marked done. Exports to CSV for the accountant.

**Code:** `modules/Records.tsx`.

```ts
// search across title, party, summary, tags and extracted fields
const filtered = state.records.filter(
  (r) =>
    (type === "all" || r.docType === type) &&
    (!q || `${r.title} ${r.party} ${r.summary} ${r.tags.join(" ")} ${r.fields.map((f) => f.value).join(" ")}`.toLowerCase().includes(q)),
);

// mark done / open
patchItem("records", r.id, { status: r.status === "done" ? "open" : "done" });
```

---

## 8. AI assistant

**What it does:** Answers questions in plain language from the firm's own data, for example "Which invoices are unpaid?", "Who are our best customers?" or "What are we running low on?".

**Code:** `modules/Assistant.tsx`, `ai.ts` (`businessContext`, `askAssistant`), server task `chat`.

The app sends a compact snapshot of the whole business with each question:

```ts
// ai.ts
export function businessContext(state: WorkspaceState) {
  return {
    today: new Date().toISOString().slice(0, 10),
    currency: state.profile.currency,
    customers: state.customers.map(({ id: _id, createdAt: _c, ...c }) => c),
    invoicesAndQuotes: state.invoices.map((i) => ({
      type: i.kind,
      number: i.number,
      customer: customerName(state.customers, i.customerId),
      issued: i.issueDate,
      due: i.dueDate,
      status: displayStatus(i),
      paidOn: i.paidAt ?? null,
      total: invoiceTotals(i).total,
      lines: i.items.map((l) => `${l.quantity} × ${l.description} @ ${l.unitPrice}`),
    })),
    stock: state.stock.map(({ id: _id, ...s }) => s),
    archivedDocuments: state.records.map(({ id: _id, createdAt: _c, ...r }) => r),
  };
}

export function askAssistant(messages: ChatMessage[], state: WorkspaceState): Promise<AiResult<string>> {
  return withFallback(
    () => invoke<string>({ task: "chat", messages, context: businessContext(state), businessName: state.profile.businessName }),
    () => demoChat(messages[messages.length - 1]?.content ?? "", state),
  );
}
```

The screen keeps the conversation in the workspace:

```ts
// modules/Assistant.tsx
async function send(text: string) {
  const content = text.trim();
  if (!content || busy) return;
  const next: ChatMessage[] = [...state.chat, { role: "user", content }];
  update({ chat: next });
  setInput("");
  setBusy(true);
  const { value, demo: isDemo } = await askAssistant(next, state);
  setDemo(isDemo);
  update({ chat: [...next, { role: "assistant", content: value }] });
  setBusy(false);
}
```

---

## 9. AI writer & payment reminders

**What it does:** Drafts emails, letters, quote letters, social posts and website text from a few notes, in the tone the firm picks. It has quick templates (payment reminder, quote, reply to an enquiry, supplier request, "we've gone digital" letter), and other screens can open it pre-filled. On an overdue invoice, **Payment reminder** writes the reminder with the invoice number, amount, days late and bank details already in it. The tone gets firmer after 30 days.

**Code:** `modules/Writer.tsx`, `modules/Invoices.tsx` (`draftReminder`), `ai.ts` (`writeDraft`), server task `draft`.

```ts
// modules/Invoices.tsx — InvoiceDetail
async function draftReminder() {
  setDrafting(true);
  const late = daysBetween(inv!.dueDate, today);
  const { value, demo } = await writeDraft(
    {
      kind: "email",
      audience: `customer (${customer?.company || customer?.name || "customer"})`,
      tone: late > 30 ? "firm but polite" : "friendly",
      notes: `Payment reminder for invoice ${inv!.number} dated ${formatDate(inv!.issueDate)} over ${formatMoney(totals.total, cur)}. It was due on ${formatDate(inv!.dueDate)} and is now ${late} days overdue. Please pay to: ${p.bankDetails || "our usual bank account"}. If payment has already been made, please ignore this message. Contact person: ${p.ownerName || p.businessName}.`,
    },
    p.businessName,
  );
  setReminder({ text: value, demo });
  setDrafting(false);
}
```

The writer accepts a pre-filled request from any screen through router state:

```ts
// modules/Writer.tsx
const prefill = location.state as { kind?: string; audience?: string; tone?: string; notes?: string } | null;
const [form, setForm] = useState({ kind: "email", audience: "customer", tone: "friendly", notes: "", ...(prefill ?? {}) });
```

---

## 10. Digital roadmap

**What it does:** A ten-question check-up covering record keeping, invoicing, customer contact, stock, online presence, pain points and budget. It returns a 0–100 digital maturity score, strengths to keep, risks, quick wins, and 3–4 phases with actions, tools, estimated cost and where AI helps. Each action can be ticked off, and progress shows on the dashboard.

**Code:** `modules/Roadmap.tsx`, `ai.ts` (`buildRoadmap`), server task `roadmap` (structured output with `ROADMAP_SCHEMA`).

```ts
// modules/Roadmap.tsx
async function generate() {
  setBusy(true);
  const { value, demo: isDemo } = await buildRoadmap(answers, state.profile.businessName);
  update({ assessment: answers, roadmap: value, roadmapDone: [] });
  setDemo(isDemo);
  setBusy(false);
  setEditing(false);
}

// ticking an action ("phaseIndex:actionIndex")
const toggle = (id: string) =>
  update({ roadmapDone: state.roadmapDone.includes(id) ? state.roadmapDone.filter((x) => x !== id) : [...state.roadmapDone, id] });
```

---

## 11. How data is stored

There are two modes. The screens are identical in both.

- **Signed in (cloud):** each firm has one workspace row in Supabase (`workspaces.data`, a JSON document), shared by the firm's users and our team.
- **Without an account (device only):** the same document is kept in the browser's `localStorage`.

All data is one `WorkspaceState` object (`types.ts`). Screens change it only through the store (`upsert`, `patchItem`, `remove`, `update`), so the mode doesn't matter to them.

### Saving online

`WorkspaceProvider` (`store.tsx`) takes an optional `persistence`: `cloudPersistence(firmId)` in `features/cloud/persistence.ts`.

- **Loading:** it loads once and shows "Opening your workspace…". Nothing is saved before loading finishes, so an empty screen can never overwrite real data.
- **Saving:** it saves 0.8 s after the last change, only if something changed. The sidebar shows *Saving… / All changes saved / Not saved yet — trying again*.
- **Version check:** every save carries the version it started from, and the database refuses a save if someone else saved in between. The version number is set by the server, never the browser:

```ts
// features/cloud/api.ts
const { data } = await supabase.from("workspaces").update({ data: state }).eq("firm_id", firmId).eq("version", version).select("version");
return data && data.length ? data[0].version : "conflict";
```

- **When that happens,** both sides' changes are combined customer by customer, invoice by invoice (`merge.ts`). If both people changed the very same item, this browser's version wins and a message asks the person to check it.
- **Live updates:** when someone else saves and there's nothing unsaved locally, the new version appears.
- **Nothing is lost:** pending changes are saved when leaving the workspace, switching business or signing out. The browser warns before closing with unsaved changes. Failed saves retry every 5 s.

### Who can see what (enforced by the database)

The rules live in `supabase/migrations/20260927120000_legacylift_cloud.sql` and are tested in `supabase/tests/`.

| | Our team (staff) | Client user | Not signed in |
|---|---|---|---|
| All clients, notes, checklist, activity log | ✓ | – | – |
| Their own firm's workspace | ✓ (every firm) | ✓ (only theirs) | – |
| Invite client users, add staff | ✓ | – | – |
| Delete a firm | ✓ | – | – |

- A client user joins a firm by **invite**: staff enter the email in *Client access*. When that person creates an account with the same **confirmed** email and signs in, `claim_invites()` links them to the firm.
- The **first admin** is added once with a single SQL line, which the console shows ready to copy. Nobody can make themselves admin from the app.

## 12. How the AI is called

The browser never holds an API key. It calls the `business-ai` Supabase Edge Function, which calls Claude:

```ts
// ai.ts — browser side
async function invoke<T>(body: Record<string, unknown>): Promise<T> {
  const { data, error } = await supabase.functions.invoke("business-ai", { body });
  if (error) throw error;
  if (!data || (data as { error?: string }).error) {
    throw new Error((data as { error?: string })?.error ?? "Empty response");
  }
  return (data as { result: T }).result;
}

// If the AI isn't reachable, a simple built-in fallback answers and the UI labels it "Demo mode".
async function withFallback<T>(call: () => Promise<T>, fallback: () => T): Promise<AiResult<T>> {
  try {
    return { value: await call(), demo: false };
  } catch (err) {
    console.warn("AI service unavailable, using demo mode:", err);
    return { value: fallback(), demo: true };
  }
}
```

```ts
// supabase/functions/business-ai/index.ts — server side
const client = new Anthropic({ apiKey }); // ANTHROPIC_API_KEY secret

const response = await client.beta.messages.create({
  model: "claude-opus-5",
  max_tokens: 16000,
  betas: ["server-side-fallback-2026-07-01"],
  fallbacks: "default", // if Claude declines, retry on a fallback model server-side
  thinking: { type: "adaptive" },
  output_config: {
    effort: request.effort, // low for chat/writing, medium for extraction, high for roadmaps
    ...(request.schema ? { format: { type: "json_schema", schema: request.schema } } : {}),
  },
  system: request.system,
  messages: request.messages,
});
```

**Errors vs. demo mode:** only "the AI isn't reachable or set up" (network error, function not deployed, no API key) switches to demo mode. Real answers from the service, like "file too large" (413), "declined" (422) or "too many requests" (429), are shown to the user as messages:

```ts
// ai.ts
if (!res || res.status === 404 || res.status === 503) throw new AiUnavailable(message || "AI not connected");
throw new AiError(message || `The AI service returned an error (${res.status}). Please try again.`);
```

**Who may use it:** only signed-in staff and members of a client firm. The function checks the caller's token with Supabase Auth and asks the database (`my_workspaces`) whether they belong anywhere. Everyone else gets "please sign in", and the app then uses the built-in demo helpers. `AI_ALLOW_ANONYMOUS=true` opens it up for a public demo site.

**More protection:**

- Per-visitor rate limit: `AI_RATE_LIMIT` requests per 10 minutes, default 40.
- Optional site allow-list: `AI_ALLOWED_ORIGINS`, e.g. `https://legacylift.lv`.
- Caps on request size, file type and size, chat length, the business data sent, and answer length per task.
- Chat history is cleaned so it always starts with the user.

The function has four tasks. `buildRequest()` sets the prompt, effort and output schema for each:

| Task | Used by | Output |
|---|---|---|
| `extract` | Digitize paper | JSON record (`RECORD_SCHEMA`) |
| `chat` | AI assistant | Text answer |
| `draft` | AI writer, payment reminders | Text ready to send |
| `roadmap` | Digital roadmap | JSON roadmap (`ROADMAP_SCHEMA`) |

---

## 13. Running, testing and deploying

```sh
npm install            # install dependencies
npm run dev            # start locally, then open http://localhost:8080
npm test               # unit and UI tests (src/features/digital/digital.test.tsx)
npm run build          # production build
```

Turn on the AI:

```sh
supabase secrets set ANTHROPIC_API_KEY=sk-ant-...
supabase secrets set AI_ALLOWED_ORIGINS=https://your-site.com   # recommended
supabase functions deploy business-ai
```

The tests cover the money logic (totals, tax rounding, numbering, overdue status, receivables, customer totals), quote → invoice, stock booking-out, low-stock detection, data migration, CSV escaping, the demo fallbacks, and two UI flows: loading the example business, and creating an invoice for a new customer.

---

## 14. Operations console (for our team)

**What it does:** The internal tool our team uses to deliver LegacyLift to client firms, at `/internal`. It is not linked from the public pages and is marked `noindex`.

- **Overview:** active, onboarding and lead counts; open service tasks; which clients have overdue money or low stock; clients by package.
- **Clients:** every firm with its package (Digital Start / Business Suite / AI Partner), stage (lead → onboarding → active → paused), service progress and overdue amount.
- **Client file:**
  - Contact details and a one-click stage switch.
  - A snapshot of the client's business.
  - The **service checklist** for their package: each task has a **Do it** link that opens the right page in their workspace.
  - Quick actions (new invoice, digitize, assistant, …), an activity log, workspace export, and delete.
- **Client workspace:** the full LegacyLift workspace for that firm, with a "Working on behalf of …" banner. The team performs every function from sections 1–10 here for the client.
- **Service playbook:** what each package delivers and where in the workspace each task is done.

**How the team uses it:** *Clients → Add client* (this creates the firm's own workspace). Open the client and follow the **Next step** card at the top: **Do it now** opens the right page in their workspace, or **Mark as done** for tasks done offline (calls, training). The client list is sorted so the client who needs you most is at the top: overdue money first, then onboarding, then leads.

**Giving the client access (signed in):** in the client file, *Client access* → enter their email → **Invite**. The console prepares the message to send: open `/app`, create an account with this email, confirm it, and sign in. From then on the client and your team work in the same workspace, live. *Client access* also shows who has access, and can cancel invites or remove access.

**Team:** *Team* lists everyone on the team. Add a colleague by email once they have created an account.

**Backups:** **Download workspace** saves a copy. **Import client's backup** brings in data a client kept on their own device before they had an account (with a confirmation first). In demo mode (no account), this is also how you hand a workspace over. **Do it** opens the task's page in the client's workspace; do the work there and click **Back to client file**. Tasks marked ✦ are ticked off automatically once the client's data shows they are done.

**Code:** `src/features/ops/` (types, playbook, store) and `src/pages/digital/ops/` (screens).

### One workspace per client

The workspace screens don't know which firm they are showing. `WorkspaceShell` gives them a URL base and a storage key, so the same screens run for any client:

```tsx
// src/pages/digital/ops/OpsApp.tsx
<WorkspaceShell
  base={clientBase(client.id)}                 // /internal/clients/<id>/workspace
  storageKey={clientStorageKey(client.id)}     // legacylift.client.<id>.workspace
  homeHref={`${OPS}/clients/${client.id}`}
  brandSuffix="Ops"
  sidebarTop={/* "Working on behalf of <firm>" banner */}
/>
```

```ts
// src/features/digital/base.ts — every link in the workspace is built from this base
export const WorkspaceBaseContext = createContext("/app");
export const useBase = () => useContext(WorkspaceBaseContext);

// e.g. in modules/Invoices.tsx
navigate(`${base}/invoices/${draft.id}`);
```

### The playbook, with tasks that tick themselves off

```ts
// src/features/ops/playbook.ts (excerpt)
{
  id: "first-invoice",
  label: "Send the first invoice from LegacyLift",
  how: "Write it together with the owner, print or email it, and mark it as sent.",
  path: "/invoices/new?kind=invoice",
  auto: (ws) => ws.invoices.some((i) => i.kind === "invoice" && i.status !== "draft" && !i.notes.startsWith("Digitized")),
},

/** Packages build on each other, so a Suite client gets the Start tasks too. */
export function tasksFor(pkg: PackageId) {
  const upto = PACKAGES.findIndex((p) => p.id === pkg);
  return PACKAGES.slice(0, upto + 1).flatMap((p) => p.tasks.map((task) => ({ pkg: p, task })));
}

export function isTaskDone(client: Client, task: PlaybookTask, ws: WorkspaceState) {
  return client.manualDone.includes(task.id) || Boolean(task.auto?.(ws));
}
```

To change what a package delivers, edit the `START`, `SUITE` or `PARTNER` task lists in `playbook.ts`. The checklist, progress bars and overview update automatically.

### Reading a client's business from the console

```ts
// src/features/ops/playbook.ts
export function workspaceSnapshot(ws: WorkspaceState) {
  const rec = receivables(ws.invoices);
  return {
    customers: ws.customers.length,
    openAmount: rec.openAmount,
    overdueCount: rec.overdueCount,
    overdueAmount: rec.overdueAmount,
    lowStock: lowStock(ws.stock).length,
    roadmapScore: ws.roadmap?.score ?? null,
    /* … */
  };
}

// src/pages/digital/ops/OpsPages.tsx
const ws = loadWorkspace(clientStorageKey(c.id));
const snap = workspaceSnapshot(ws);
const progress = checklistProgress(c, ws);
```

### Client records and the activity log

Every change to a client goes through the ops store, which writes an activity entry with the team member's name (the "Signed in as" field in the sidebar):

```ts
// src/features/ops/store.tsx
updateClient(c.id, { stage: "active" }, "Stage: onboarding → active");
toggleTask(c.id, "training", "Half-day staff training"); // logs "Done: Half-day staff training"
addNote(c.id, "Called Maria, invoices book collected");
```

**Signed in vs. demo:** `CloudOpsProvider` (Supabase, shared with the team) and `OpsProvider` (this browser only) offer the same `OpsApi`, so every console screen works in both modes. Checklist ticks go through one database call (`set_task_done`), so two colleagues ticking at once never undo each other.
