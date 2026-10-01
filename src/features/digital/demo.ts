// Offline fallbacks used when the AI edge function is not reachable or not configured.
// They are deliberately simple heuristics so the workspace stays usable in demo mode.
import { customerName, displayStatus, invoiceTotals } from "./finance";
import type { Assessment, DocType, ExtractedRecord, Roadmap, WorkspaceState } from "./types";

const TYPE_HINTS: [DocType, RegExp][] = [
  ["invoice", /\b(invoice|rechnung|facture|bill to|amount due)\b/i],
  ["receipt", /\b(receipt|quittung|paid|thank you for your purchase)\b/i],
  ["order", /\b(purchase order|order no|bestellung|p\.?o\.?\s*#?)\b/i],
  ["contract", /\b(agreement|contract|vertrag|hereby|terms and conditions)\b/i],
  ["inventory", /\b(stock|inventory|sku|on hand|lager)\b/i],
  ["letter", /\b(dear|sehr geehrte|sincerely|regards)\b/i],
  ["customer", /\b(customer|client|kunde|phone|tel\.?|e-?mail)\b/i],
];

const CURRENCY_SIGNS: Record<string, string> = { "€": "EUR", $: "USD", "£": "GBP", "₹": "INR", "¥": "JPY" };

export function parseAmount(raw: string): number | null {
  let s = raw.replace(/[^\d.,-]/g, "");
  if (!s) return null;
  const lastComma = s.lastIndexOf(",");
  const lastDot = s.lastIndexOf(".");
  if (lastComma > lastDot) {
    // European style 1.234,56
    s = s.replace(/\./g, "").replace(",", ".");
  } else {
    s = s.replace(/,/g, "");
  }
  const n = Number.parseFloat(s);
  return Number.isFinite(n) ? n : null;
}

function findDate(text: string): string {
  const iso = text.match(/\b(\d{4})-(\d{2})-(\d{2})\b/);
  if (iso) return iso[0];
  const eu = text.match(/\b(\d{1,2})[./](\d{1,2})[./](\d{4})\b/);
  if (eu) return `${eu[3]}-${eu[2].padStart(2, "0")}-${eu[1].padStart(2, "0")}`;
  return "";
}

function findTotal(text: string): { amount: number | null; currency: string } {
  const lines = text.split(/\n/);
  const moneyRe = /([€$£₹¥]|\b(?:EUR|USD|GBP|CHF|INR)\b)?\s*(-?\d[\d.,]*\d|\d)\s*([€$£₹¥]|\b(?:EUR|USD|GBP|CHF|INR)\b)?/;
  const totalLine = [...lines].reverse().find((l) => /\b(total|summe|gesamt|amount due|balance)\b/i.test(l) && moneyRe.test(l));
  const candidate = totalLine ?? lines.find((l) => /[€$£₹¥]|\b(EUR|USD|GBP|CHF|INR)\b/.test(l) && /\d/.test(l));
  if (!candidate) return { amount: null, currency: "" };
  const m = candidate.slice(candidate.search(/[€$£₹¥\d]|\b(EUR|USD|GBP|CHF|INR)\b/)).match(moneyRe);
  if (!m) return { amount: null, currency: "" };
  const cur = m[1] || m[3] || "";
  return { amount: parseAmount(m[2]), currency: CURRENCY_SIGNS[cur] ?? cur.toUpperCase() };
}

export function demoExtract(text: string, fileName = ""): ExtractedRecord {
  const clean = text.trim();
  const docType = TYPE_HINTS.find(([, re]) => re.test(clean))?.[0] ?? "other";
  const lines = clean.split(/\n/).map((l) => l.trim()).filter(Boolean);
  const fields: { label: string; value: string }[] = [];
  for (const l of lines) {
    const kv = l.match(/^([A-Za-zÄÖÜäöüß .#/-]{2,30}):\s*(.+)$/);
    if (kv && fields.length < 12) fields.push({ label: kv[1].trim(), value: kv[2].trim() });
  }
  const partyField = fields.find((f) => /(customer|client|to|kunde|supplier|from|name|company)/i.test(f.label));
  const { amount, currency } = findTotal(clean);
  const title = lines[0]?.slice(0, 80) || fileName || "Untitled document";
  return {
    docType,
    title,
    party: partyField?.value ?? "",
    date: findDate(clean),
    amount,
    currency,
    summary: lines.slice(0, 3).join(" ").slice(0, 240),
    fields,
    lineItems: [],
    tags: ["demo-extracted"],
  };
}

export function demoRoadmap(a: Assessment): Roadmap {
  const digitalWords = /(software|app|cloud|excel|spreadsheet|online|digital|email|crm|erp|pos|website|shop)/i;
  const answers = [a.recordKeeping, a.invoicing, a.customerComms, a.inventory, a.onlinePresence];
  const digitalCount = answers.filter((x) => digitalWords.test(x)).length;
  const paperCount = answers.filter((x) => /(paper|fax|ledger|notebook|binder|phone|none|nothing|handwritten)/i.test(x)).length;
  const score = Math.max(5, Math.min(95, 20 + digitalCount * 14 - paperCount * 4));

  return {
    score,
    headline:
      score < 40
        ? "Mostly paper-based — big, quick gains are available from digitizing records and invoicing first."
        : score < 70
          ? "Partly digital — connect the islands of spreadsheets and email into one system."
          : "Well on the way — focus on automation and AI to free up staff time.",
    strengths: [
      a.yearsInBusiness
        ? `Long track record (${a.yearsInBusiness}) of customer relationships and trade knowledge`
        : "Years of customer relationships and trade knowledge",
      "Established processes that can be mirrored in software instead of reinvented",
    ],
    risks: [
      "Key knowledge lives in a few people's heads or paper files",
      "Paper records can be lost to fire, water or staff turnover",
      ...(a.painPoints ? [`Stated pain point: ${a.painPoints}`] : []),
    ],
    quickWins: [
      "Scan the last 12 months of invoices and customer cards into LegacyLift",
      "Switch to cloud invoicing so invoices go out by email with payment links",
      "Create a shared business email and calendar for all staff",
    ],
    phases: [
      {
        name: "Digitize the paper",
        timeframe: "Weeks 1–4",
        goal: "Every active customer, supplier and open invoice exists digitally.",
        actions: [
          "Scan or photograph active customer files and open invoices",
          "Use AI extraction to turn scans into searchable records",
          "Agree one naming convention and folder structure",
        ],
        tools: ["LegacyLift Digitize", "Phone scanner app", "Cloud drive (Google Drive / OneDrive)"],
        estimatedCost: "€0–50 / month",
        aiOpportunity: "AI reads handwritten and printed documents and fills in the records for you.",
      },
      {
        name: "Modern invoicing & payments",
        timeframe: "Months 2–3",
        goal: "Invoices sent digitally, paid faster, and synced with bookkeeping.",
        actions: [
          "Adopt a cloud accounting tool and import customers",
          "Enable online payment links on invoices",
          "Set automatic payment reminders",
        ],
        tools: ["Cloud accounting (e.g. Xero, QuickBooks, lexoffice, sevDesk)", "Card / bank payment links"],
        estimatedCost: "€20–60 / month",
        aiOpportunity: "AI drafts polite reminders and flags invoices that are likely to be paid late.",
      },
      {
        name: "Customer relationships",
        timeframe: "Months 3–6",
        goal: "One place for every customer conversation, quote and follow-up.",
        actions: [
          "Set up a simple CRM or use LegacyLift records as one",
          "Add an up-to-date website with a contact / quote form",
          "Claim and maintain the business profile on maps and search",
        ],
        tools: ["Simple CRM (e.g. HubSpot free, Pipedrive)", "Website builder", "Google Business Profile"],
        estimatedCost: "€0–80 / month",
        aiOpportunity: "AI writes quotes, follow-ups and replies to enquiries in your house style.",
      },
      {
        name: "Automate & grow",
        timeframe: "Months 6–12",
        goal: "Routine admin runs itself; staff spend time on the craft and customers.",
        actions: [
          "Connect accounting, CRM and inventory so data is entered once",
          "Train staff on the AI assistant for everyday questions",
          "Review monthly dashboards of revenue, overdue invoices and pipeline",
        ],
        tools: ["Automation (Zapier / Make)", "LegacyLift Assistant", "Inventory app if stock is held"],
        estimatedCost: "€30–150 / month",
        aiOpportunity: "An AI assistant answers questions about customers, orders and cash flow in plain language.",
      },
    ],
  };
}

function money(n: number, cur: string) {
  return `${n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ${cur}`.trim();
}

export function demoChat(question: string, state: WorkspaceState): string {
  const q = question.toLowerCase();
  const cur = state.profile.currency;
  const { customers, invoices, stock, records } = state;
  if (!customers.length && !invoices.length && !records.length) {
    return "The workspace is empty. Add customers and invoices, digitize a few documents, or load the example business, and I can answer questions about them.";
  }
  if (/(unpaid|overdue|owe|outstanding|open invoice|late)/.test(q)) {
    const open = invoices.filter((i) => i.kind === "invoice" && i.status === "sent");
    if (!open.length) return "Good news: there are no unpaid invoices.";
    const total = open.reduce((s, i) => s + invoiceTotals(i).total, 0);
    return `${open.length} invoice(s) are unpaid, ${money(total, cur)} in total:\n${open
      .map((i) => `• ${i.number} — ${customerName(customers, i.customerId)}: ${money(invoiceTotals(i).total, cur)}, due ${i.dueDate}${displayStatus(i) === "overdue" ? " (OVERDUE)" : ""}`)
      .join("\n")}`;
  }
  if (/(stock|reorder|material|low on|running out)/.test(q)) {
    const low = stock.filter((s) => s.quantity <= s.reorderLevel);
    if (!low.length) return `All ${stock.length} stock items are above their reorder level.`;
    return `These items are at or below their reorder level:\n${low.map((s) => `• ${s.name}: ${s.quantity} ${s.unit} (reorder at ${s.reorderLevel})`).join("\n")}`;
  }
  if (/(best|biggest|top|most).*(customer|client)|(customer|client).*(best|biggest|most)/.test(q)) {
    const totals = customers
      .map((c) => ({ c, t: invoices.filter((i) => i.customerId === c.id && i.kind === "invoice" && i.status === "paid").reduce((s, i) => s + invoiceTotals(i).total, 0) }))
      .sort((a, b) => b.t - a.t)
      .slice(0, 5);
    return `Customers by payments received:\n${totals.map(({ c, t }) => `• ${c.company || c.name}: ${money(t, cur)}`).join("\n")}`;
  }
  if (/(revenue|turnover|total|how much|earned|sales)/.test(q)) {
    const paid = invoices.filter((i) => i.kind === "invoice" && i.status === "paid");
    return `${paid.length} paid invoice(s) totalling ${money(paid.reduce((s, i) => s + invoiceTotals(i).total, 0), cur)}.`;
  }
  const words = q.split(/\W+/).filter((w) => w.length > 3);
  const hit = (text: string) => words.some((w) => text.toLowerCase().includes(w));
  const cHits = customers.filter((c) => hit(`${c.name} ${c.company} ${c.notes} ${c.address}`));
  const iHits = invoices.filter((i) => hit(`${i.number} ${customerName(customers, i.customerId)} ${i.items.map((l) => l.description).join(" ")}`));
  const rHits = records.filter((r) => hit(`${r.title} ${r.party} ${r.summary} ${r.tags.join(" ")}`));
  const lines = [
    ...cHits.slice(0, 3).map((c) => `• Customer: ${c.company || c.name}${c.phone ? `, ${c.phone}` : ""}${c.notes ? ` — ${c.notes}` : ""}`),
    ...iHits.slice(0, 5).map((i) => `• ${i.kind === "quote" ? "Quote" : "Invoice"} ${i.number} (${i.issueDate}, ${displayStatus(i)}): ${money(invoiceTotals(i).total, cur)}`),
    ...rHits.slice(0, 3).map((r) => `• Document: ${r.title} — ${r.summary}`),
  ];
  if (lines.length) return `Here is what I found:\n${lines.join("\n")}`;
  return "I couldn't find anything matching that. (Demo mode uses simple keyword search. Connect the AI service for full answers.)";
}

export function demoDraft(kind: string, audience: string, tone: string, notes: string, businessName: string): string {
  const sign = businessName || "The team";
  const subject = kind === "email" ? `Subject: ${notes.split(/[.\n]/)[0].slice(0, 60) || "A note from us"}\n\n` : "";
  const greeting = tone === "formal" ? "Dear Sir or Madam," : "Hello,";
  const close = tone === "formal" ? "Yours faithfully," : "Kind regards,";
  return `${subject}${greeting}\n\n${notes.trim() || "(Add what the message should say.)"}\n\nPlease let us know if you have any questions — we are happy to help.\n\n${close}\n${sign}\n\n[Demo draft for a ${audience}. Connect the AI service for a fully written version.]`;
}
