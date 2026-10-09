// Offline fallbacks used when the AI edge function is not reachable or not configured.
// They are deliberately simple heuristics so the workspace stays usable in demo mode.
import { customerName, displayStatus, invoiceTotals } from "./finance";
import type { Assessment, DocType, ExtractedRecord, Roadmap, WorkspaceState } from "./types";
import { locale, translate as tr } from "@/i18n";

const TYPE_HINTS: [DocType, RegExp][] = [
  ["invoice", /\b(invoice|rechnung|facture|bill to|amount due)\b|rēķin|maksātājs|sąskait|arve|pirkėjas|maksja/i],
  ["receipt", /\b(receipt|quittung|paid|thank you for your purchase|kvīts|kvitas|kviitung|tšekk)\b|čeks/i],
  ["order", /\b(purchase order|order no|bestellung|p\.?o\.?\s*#?)\b|pasūtījum|pavadzīm|užsakym|važtaraš|tellimus|saateleht/i],
  ["contract", /\b(agreement|contract|vertrag|hereby|terms and conditions)\b|līgum|sutart|leping/i],
  ["inventory", /\b(stock|inventory|sku|on hand|lager|noliktava|atlikums|sandėlis|likutis|ladu|laoseis)\b/i],
  ["letter", /\b(dear|sehr geehrte|sincerely|regards|labdien|ar cieņu|laba diena|pagarbiai|lugupidamisega)\b|god\. |tere/i],
  ["customer", /\b(customer|client|kunde|phone|tel\.?|e-?mail|klients|tālr\.?|klientas|klient|telefon)\b/i],
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
  const totalLine = [...lines].reverse().find((l) => /\b(total|summe|gesamt|amount due|balance|kopā|summa apmaksai|apmaksai|iš viso|mokėti|kokku|tasuda)\b/i.test(l) && moneyRe.test(l));
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
    const kv = l.match(/^([A-Za-zÄÖÜäöüßĀāČčĒēĢģĪīĶķĻļŅņŠšŪūŽžĄąĘęĖėĮįŲųÕõ .#/-]{2,30}):\s*(.+)$/);
    if (kv && fields.length < 12) fields.push({ label: kv[1].trim(), value: kv[2].trim() });
  }
  const partyField = fields.find((f) => /(customer|client|to|kunde|supplier|from|name|company|klients|maksātājs|piegādātājs|uzņēmums|vārds|klientas|pirkėjas|tiekėjas|įmonė|klient|maksja|tarnija|ettevõte|nimi)/i.test(f.label));
  const { amount, currency } = findTotal(clean);
  const title = lines[0]?.slice(0, 80) || fileName || tr("Untitled document");
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
  const digitalWords = /(software|app|cloud|excel|spreadsheet|online|digital|email|crm|erp|pos|website|shop|programm|lietotn|mākon|tabul|tiešsaist|digitāl|e-past|mājaslap|veikal|program|debes|lentel|internet|skaitmen|el\. pašt|svetain|parduotuv|tarkvar|rakendus|pilv|tabel|veeb|digi|e-post|pood)/i;
  const answers = [a.recordKeeping, a.invoicing, a.customerComms, a.inventory, a.onlinePresence];
  const digitalCount = answers.filter((x) => digitalWords.test(x)).length;
  const paperCount = answers.filter((x) => /(paper|fax|ledger|notebook|binder|phone|none|nothing|handwritten|papīr|fakss|klade|burtnīc|mape|tālrun|nav|nekas|ar roku|popier|faks|sąsiuvin|segtuv|telefon|nėra|nieko|ranka|paber|kaust|vihik|pole|mitte midagi|käsitsi)/i.test(x)).length;
  const score = Math.max(5, Math.min(95, 20 + digitalCount * 14 - paperCount * 4));

  return {
    score,
    headline:
      score < 40
        ? tr("Mostly paper-based — big, quick gains are available from digitizing records and invoicing first.")
        : score < 70
          ? tr("Partly digital — connect the islands of spreadsheets and email into one system.")
          : tr("Well on the way — focus on automation and AI to free up staff time."),
    strengths: [
      a.yearsInBusiness
        ? tr("Long track record ({years}) of customer relationships and trade knowledge", { years: a.yearsInBusiness })
        : tr("Years of customer relationships and trade knowledge"),
      tr("Established processes that can be mirrored in software instead of reinvented"),
    ],
    risks: [
      tr("Key knowledge lives in a few people's heads or paper files"),
      tr("Paper records can be lost to fire, water or staff turnover"),
      ...(a.painPoints ? [tr("Stated pain point: {text}", { text: a.painPoints })] : []),
    ],
    quickWins: [
      tr("Scan the last 12 months of invoices and customer cards into LegacyLift"),
      tr("Switch to cloud invoicing so invoices go out by email with payment links"),
      tr("Create a shared business email and calendar for all staff"),
    ],
    phases: [
      {
        name: tr("Digitize the paper"),
        timeframe: tr("Weeks 1–4"),
        goal: tr("Every active customer, supplier and open invoice exists digitally."),
        actions: [
          tr("Scan or photograph active customer files and open invoices"),
          tr("Use AI extraction to turn scans into searchable records"),
          tr("Agree one naming convention and folder structure"),
        ],
        tools: [tr("LegacyLift Digitize"), tr("Phone scanner app"), tr("Cloud drive (Google Drive / OneDrive)")],
        estimatedCost: tr("€0–50 / month"),
        aiOpportunity: tr("AI reads handwritten and printed documents and fills in the records for you."),
      },
      {
        name: tr("Modern invoicing & payments"),
        timeframe: tr("Months 2–3"),
        goal: tr("Invoices sent digitally, paid faster, and synced with bookkeeping."),
        actions: [
          tr("Adopt a cloud accounting tool and import customers"),
          tr("Enable online payment links on invoices"),
          tr("Set automatic payment reminders"),
        ],
        tools: [tr("Cloud accounting (e.g. Xero, QuickBooks, lexoffice, sevDesk)"), tr("Card / bank payment links")],
        estimatedCost: tr("€20–60 / month"),
        aiOpportunity: tr("AI drafts polite reminders and flags invoices that are likely to be paid late."),
      },
      {
        name: tr("Customer relationships"),
        timeframe: tr("Months 3–6"),
        goal: tr("One place for every customer conversation, quote and follow-up."),
        actions: [
          tr("Set up a simple CRM or use LegacyLift records as one"),
          tr("Add an up-to-date website with a contact / quote form"),
          tr("Claim and maintain the business profile on maps and search"),
        ],
        tools: [tr("Simple CRM (e.g. HubSpot free, Pipedrive)"), tr("Website builder"), tr("Google Business Profile")],
        estimatedCost: tr("€0–80 / month"),
        aiOpportunity: tr("AI writes quotes, follow-ups and replies to enquiries in your house style."),
      },
      {
        name: tr("Automate & grow"),
        timeframe: tr("Months 6–12"),
        goal: tr("Routine admin runs itself; staff spend time on the craft and customers."),
        actions: [
          tr("Connect accounting, CRM and inventory so data is entered once"),
          tr("Train staff on the AI assistant for everyday questions"),
          tr("Review monthly dashboards of revenue, overdue invoices and pipeline"),
        ],
        tools: [tr("Automation (Zapier / Make)"), tr("LegacyLift Assistant"), tr("Inventory app if stock is held")],
        estimatedCost: tr("€30–150 / month"),
        aiOpportunity: tr("An AI assistant answers questions about customers, orders and cash flow in plain language."),
      },
    ],
  };
}

function money(n: number, cur: string) {
  return `${n.toLocaleString(locale(), { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ${cur}`.trim();
}

export function demoChat(question: string, state: WorkspaceState): string {
  const q = question.toLowerCase();
  const cur = state.profile.currency;
  const { customers, invoices, stock, records } = state;
  if (!customers.length && !invoices.length && !records.length) {
    return tr("The workspace is empty. Add customers and invoices, digitize a few documents, or load the example business, and I can answer questions about them.");
  }
  if (/(unpaid|overdue|owe|outstanding|open invoice|late|neapmaksāt|kavēt|parād|nesamaksāt|neapmokėt|skolin|vėluo|nesumokėt|tasumata|maksmata|võlg|hilin)/.test(q)) {
    const open = invoices.filter((i) => i.kind === "invoice" && i.status === "sent");
    if (!open.length) return tr("Good news: there are no unpaid invoices.");
    const total = open.reduce((s, i) => s + invoiceTotals(i).total, 0);
    const list = open
      .map((i) =>
        tr(displayStatus(i) === "overdue" ? "• {number} — {customer}: {amount}, due {due} (OVERDUE)" : "• {number} — {customer}: {amount}, due {due}", {
          number: i.number,
          customer: customerName(customers, i.customerId),
          amount: money(invoiceTotals(i).total, cur),
          due: i.dueDate,
        }),
      )
      .join("\n");
    return tr("Unpaid invoices: {n}, {amount} in total:\n{list}", { n: open.length, amount: money(total, cur), list });
  }
  if (/(stock|reorder|material|low on|running out|noliktav|atlikum|beigsies|beidzas|materiāl|krājum|sandėl|likut|pritrūk|atsarg|medžiag|lao|otsa|materjal|varu)/.test(q)) {
    const low = stock.filter((s) => s.quantity <= s.reorderLevel);
    if (!low.length) return tr("All stock items ({n}) are above their reorder level.", { n: stock.length });
    return tr("These items are at or below their reorder level:\n{list}", {
      list: low.map((s) => tr("• {name}: {quantity} {unit} (reorder at {level})", { name: s.name, quantity: s.quantity.toLocaleString(locale()), unit: s.unit, level: s.reorderLevel.toLocaleString(locale()) })).join("\n"),
    });
  }
  if (/(best|biggest|top|most).*(customer|client)|(customer|client).*(best|biggest|most)|labāk.*klient|lielāk.*klient|klient.*(labāk|lielāk|visvairāk)|geriausi.*klient|didžiausi.*klient|parim.*klient|suurim.*klient/.test(q)) {
    const totals = customers
      .map((c) => ({ c, t: invoices.filter((i) => i.customerId === c.id && i.kind === "invoice" && i.status === "paid").reduce((s, i) => s + invoiceTotals(i).total, 0) }))
      .sort((a, b) => b.t - a.t)
      .slice(0, 5);
    return tr("Customers by payments received:\n{list}", { list: totals.map(({ c, t }) => `• ${c.company || c.name}: ${money(t, cur)}`).join("\n") });
  }
  if (/(revenue|turnover|total|how much|earned|sales|ieņēm|apgroz|cik daudz|nopelnīj|pārdošan|pajam|apyvart|kiek|uždirb|pardavim|tulu|käive|kui palju|teenisime|müük)/.test(q)) {
    const paid = invoices.filter((i) => i.kind === "invoice" && i.status === "paid");
    return tr("Paid invoices: {n}, {amount} in total.", { n: paid.length, amount: money(paid.reduce((s, i) => s + invoiceTotals(i).total, 0), cur) });
  }
  const words = q.split(/[^\p{L}\p{N}]+/u).filter((w) => w.length > 3);
  const hit = (text: string) => words.some((w) => text.toLowerCase().includes(w));
  const cHits = customers.filter((c) => hit(`${c.name} ${c.company} ${c.notes} ${c.address}`));
  const iHits = invoices.filter((i) => hit(`${i.number} ${customerName(customers, i.customerId)} ${i.items.map((l) => l.description).join(" ")}`));
  const rHits = records.filter((r) => hit(`${r.title} ${r.party} ${r.summary} ${r.tags.join(" ")}`));
  const lines = [
    ...cHits.slice(0, 3).map((c) => `• ${tr("Customer")}: ${c.company || c.name}${c.phone ? `, ${c.phone}` : ""}${c.notes ? ` — ${c.notes}` : ""}`),
    ...iHits.slice(0, 5).map((i) => `• ${tr(i.kind === "quote" ? "Quote" : "Invoice")} ${i.number} (${i.issueDate}, ${tr(displayStatus(i))}): ${money(invoiceTotals(i).total, cur)}`),
    ...rHits.slice(0, 3).map((r) => `• ${tr("Document")}: ${r.title} — ${r.summary}`),
  ];
  if (lines.length) return tr("Here is what I found:\n{list}", { list: lines.join("\n") });
  return tr("I couldn't find anything matching that. (Demo mode uses simple keyword search. Connect the AI service for full answers.)");
}

export function demoDraft(kind: string, audience: string, tone: string, notes: string, businessName: string): string {
  const sign = businessName || tr("The team");
  const subject = kind === "email" ? `${tr("Subject:")} ${notes.split(/\n|\.\s+(?=\p{Lu})/u)[0].slice(0, 60) || tr("A note from us")}\n\n` : "";
  const greeting = tone === "formal" ? tr("Dear Sir or Madam,") : tr("Hello,");
  const close = tone === "formal" ? tr("Yours faithfully,") : tr("Kind regards,");
  const body = notes.trim() || tr("(Add what the message should say.)");
  const note = tr("[Demo draft for: {audience}. Connect the AI service for a fully written version.]", { audience });
  return `${subject}${greeting}\n\n${body}\n\n${tr("Please let us know if you have any questions — we are happy to help.")}\n\n${close}\n${sign}\n\n${note}`;
}
