import { describe, expect, it } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { demoChat, demoExtract, demoRoadmap, parseAmount } from "./demo";
import { EMPTY_STATE, migrate, newId, recordsToCsv, toCsv, toRecord } from "./store";
import {
  addDays,
  customerStats,
  deductStock,
  displayStatus,
  invoiceTotals,
  lowStock,
  monthlyRevenue,
  nextNumber,
  quoteToInvoice,
  receivables,
} from "./finance";
import { buildSampleData, SAMPLE_PROFILE, SAMPLE_RECORDS } from "./sample";
import type { Invoice, WorkspaceState } from "./types";
import DigitalApp from "@/pages/digital/DigitalApp";

// jsdom has no ResizeObserver; the revenue chart needs one.
globalThis.ResizeObserver ??= class {
  observe() {}
  unobserve() {}
  disconnect() {}
} as unknown as typeof ResizeObserver;

const TODAY = "2026-09-26";
const sample = buildSampleData(newId, TODAY);
const state: WorkspaceState = {
  ...EMPTY_STATE,
  profile: SAMPLE_PROFILE,
  ...sample,
  records: SAMPLE_RECORDS.map((r) => toRecord(r, "sample")),
};

function makeInvoice(patch: Partial<Invoice> = {}): Invoice {
  return {
    id: newId(),
    kind: "invoice",
    number: "RE-2026-0001",
    customerId: sample.customers[0].id,
    issueDate: TODAY,
    dueDate: addDays(TODAY, 14),
    items: [
      { id: "a", description: "Oak table", quantity: 2, unitPrice: 450.5 },
      { id: "b", description: "Delivery", quantity: 1, unitPrice: 60 },
    ],
    taxRate: 19,
    notes: "",
    status: "draft",
    createdAt: TODAY,
    ...patch,
  };
}

describe("invoice maths", () => {
  it("computes net, tax and gross with cent rounding", () => {
    expect(invoiceTotals(makeInvoice())).toEqual({ subtotal: 961, tax: 182.59, total: 1143.59 });
  });

  it("derives overdue only for sent invoices past their due date", () => {
    expect(displayStatus(makeInvoice({ status: "sent", dueDate: "2026-09-01" }), TODAY)).toBe("overdue");
    expect(displayStatus(makeInvoice({ status: "paid", dueDate: "2026-09-01" }), TODAY)).toBe("paid");
    expect(displayStatus(makeInvoice({ kind: "quote", status: "sent", dueDate: "2026-09-01" }), TODAY)).toBe("sent");
  });

  it("continues numbering from the highest number of the year", () => {
    expect(nextNumber(sample.invoices, "invoice", SAMPLE_PROFILE, TODAY)).toBe("RE-2026-0048");
    expect(nextNumber(sample.invoices, "quote", SAMPLE_PROFILE, TODAY)).toBe("AN-2026-0020");
    expect(nextNumber(sample.invoices, "invoice", SAMPLE_PROFILE, "2027-01-02")).toBe("RE-2027-0001");
  });

  it("summarizes receivables and monthly revenue", () => {
    const r = receivables(sample.invoices, TODAY);
    expect(r.openCount).toBe(2);
    expect(r.overdueCount).toBe(1);
    const months = monthlyRevenue(sample.invoices, 6, TODAY);
    expect(months).toHaveLength(6);
    expect(months.reduce((s, m) => s + m.total, 0)).toBeGreaterThan(0);
  });

  it("tracks a customer's paid and outstanding totals", () => {
    const s = customerStats(sample.customers[0].id, sample.invoices, TODAY);
    expect(s.overdue).toBe(1);
    expect(s.outstanding).toBeGreaterThan(0);
  });
});

describe("quotes and stock", () => {
  it("turns a quote into a draft invoice with a fresh number", () => {
    const quote = sample.invoices.find((i) => i.kind === "quote")!;
    const inv = quoteToInvoice(quote, sample.invoices, SAMPLE_PROFILE, newId, TODAY);
    expect(inv.kind).toBe("invoice");
    expect(inv.status).toBe("draft");
    expect(inv.number).toBe("RE-2026-0048");
    expect(inv.convertedFrom).toBe(quote.id);
    expect(invoiceTotals(inv).total).toBe(invoiceTotals(quote).total);
  });

  it("books out linked stock and never goes negative", () => {
    const hinges = sample.stock.find((s) => s.sku === "HNG-BR")!;
    const after = deductStock(sample.stock, { items: [{ id: "x", description: "Hinges", quantity: 20, unitPrice: 14.5, productId: hinges.id }] });
    expect(after.find((s) => s.id === hinges.id)!.quantity).toBe(0);
    expect(deductStock(sample.stock, makeInvoice())).toBe(sample.stock);
  });

  it("flags items at or below reorder level", () => {
    expect(lowStock(sample.stock).map((s) => s.sku).sort()).toEqual(["HNG-BR", "OAK-27"]);
  });
});

describe("store", () => {
  it("migrates v1 data with a top-level business name", () => {
    const m = migrate({ businessName: "Old Mill Bakery", records: [] });
    expect(m.profile.businessName).toBe("Old Mill Bakery");
    expect(m.customers).toEqual([]);
    expect(m.version).toBe(2);
  });

  it("exports CSV with escaping", () => {
    expect(toCsv(["a", "b"], [["x,y", 'say "hi"']])).toBe('a,b\n"x,y","say ""hi"""');
    expect(recordsToCsv(state.records).split("\n")).toHaveLength(3);
  });
});

describe("demo fallbacks", () => {
  it("parses European and US amounts", () => {
    expect(parseAmount("1.234,56")).toBe(1234.56);
    expect(parseAmount("1,234.56")).toBe(1234.56);
    expect(parseAmount("abc")).toBeNull();
  });

  it("extracts an invoice from pasted text", () => {
    const rec = demoExtract("RECHNUNG / Invoice 2044\nCustomer: Bäckerei Schulz\nDate: 03.09.2026\nTotal: 1.190,00 EUR");
    expect(rec).toMatchObject({ docType: "invoice", party: "Bäckerei Schulz", date: "2026-09-03", amount: 1190, currency: "EUR" });
  });

  it("answers unpaid and low-stock questions from the whole business", () => {
    expect(demoChat("Which invoices are unpaid?", state)).toMatch(/RE-2026-0045/);
    expect(demoChat("What are we running low on?", state)).toMatch(/Brass hinges/);
  });

  it("scores paper-based firms lower than digital ones", () => {
    const base = { industry: "", employees: "", yearsInBusiness: "", painPoints: "", budget: "" };
    const paper = demoRoadmap({ ...base, recordKeeping: "paper binders", invoicing: "handwritten", customerComms: "phone", inventory: "none", onlinePresence: "nothing" });
    const digital = demoRoadmap({ ...base, recordKeeping: "cloud software", invoicing: "online accounting app", customerComms: "email and CRM", inventory: "excel", onlinePresence: "website and shop" });
    expect(paper.score).toBeLessThan(digital.score);
  });
});

describe("workspace UI", () => {
  const renderAt = (path: string) =>
    render(
      <MemoryRouter initialEntries={[path]}>
        <Routes>
          <Route path="/app/*" element={<DigitalApp deviceOnly />} />
        </Routes>
      </MemoryRouter>,
    );

  it("loads the example business and shows overdue work", () => {
    localStorage.clear();
    renderAt("/app");
    fireEvent.click(screen.getByRole("button", { name: /load example business/i }));
    expect(screen.getByRole("heading", { name: /hartmann & söhne joinery/i, level: 1 })).toBeInTheDocument();
    expect(screen.getByText(/days overdue/i)).toBeInTheDocument();
  });

  it("creates an invoice for a new customer", () => {
    localStorage.clear();
    renderAt("/app/invoices/new?kind=invoice");
    fireEvent.click(screen.getByRole("button", { name: /^new$/i }));
    fireEvent.change(screen.getByLabelText(/contact name/i), { target: { value: "Greta Lind" } });
    fireEvent.click(screen.getByRole("button", { name: /add customer/i }));
    fireEvent.change(screen.getByLabelText(/line 1 description/i), { target: { value: "Chair repair" } });
    fireEvent.change(screen.getByLabelText(/line 1 unit price/i), { target: { value: "100" } });
    fireEvent.click(screen.getByRole("button", { name: /save & mark as sent/i }));
    expect(screen.getAllByText("Greta Lind").length).toBeGreaterThan(0);
    expect(screen.getAllByText(/119\.00/).length).toBeGreaterThan(0);
  });
});

describe("fixes from review", () => {
  it("only treats explicit 'paid' tags as paid", async () => {
    const { markedPaid } = await import("./finance");
    expect(markedPaid(["paid"])).toBe(true);
    expect(markedPaid(["Bezahlt"])).toBe(true);
    expect(markedPaid(["unpaid"])).toBe(false);
    expect(markedPaid(["nicht bezahlt"])).toBe(false);
    expect(markedPaid([])).toBe(false);
  });

  it("puts stock back exactly as it was booked out", async () => {
    const { returnStock } = await import("./finance");
    const hinges = sample.stock.find((s) => s.sku === "HNG-BR")!;
    const inv = { items: [{ id: "x", description: "Hinges", quantity: 4, unitPrice: 14.5, productId: hinges.id }] };
    const out = deductStock(sample.stock, inv);
    expect(out.find((s) => s.id === hinges.id)!.quantity).toBe(10);
    expect(returnStock(out, inv).find((s) => s.id === hinges.id)!.quantity).toBe(14);
  });

  it("rejects files that are not workspace backups and never keeps bad lists", async () => {
    const { isWorkspaceBackup } = await import("./store");
    expect(isWorkspaceBackup({})).toBe(false);
    expect(isWorkspaceBackup(null)).toBe(false);
    expect(isWorkspaceBackup({ name: "vite_react_shadcn_ts", dependencies: {} })).toBe(false);
    expect(isWorkspaceBackup({ customers: "x" })).toBe(false);
    expect(isWorkspaceBackup({ ...EMPTY_STATE, customers: sample.customers })).toBe(true);
    expect(isWorkspaceBackup({ businessName: "Old Mill Bakery", records: [] })).toBe(true);
    const m = migrate({ customers: "x", invoices: 5, profile: "nope" });
    expect(m.customers).toEqual([]);
    expect(m.invoices).toEqual([]);
    expect(m.profile.currency).toBe("EUR");
  });

  it("sends the assistant a conversation that starts with the user", async () => {
    const { trimConversation } = await import("./ai");
    const chat = Array.from({ length: 21 }, (_, i) => ({ role: (i % 2 === 0 ? "user" : "assistant") as "user" | "assistant", content: String(i) }));
    const trimmed = trimConversation(chat, 20);
    expect(trimmed[0].role).toBe("user");
    expect(trimmed[trimmed.length - 1].content).toBe("20");
    expect(trimConversation([{ role: "assistant", content: "hi" }])).toEqual([]);
  });

  it("tracks getting-started progress", async () => {
    const { setupProgress } = await import("./modules/GettingStarted");
    expect(setupProgress(EMPTY_STATE).done).toBe(0);
    expect(setupProgress(EMPTY_STATE).next?.id).toBe("details");
    const p = setupProgress(state);
    expect(p.done).toBe(4);
    expect(p.next).toBeNull();
  });
});

describe("stock follows invoice edits", () => {
  it("re-books stock when a sent invoice's quantity is changed", () => {
    localStorage.clear();
    const seeded: WorkspaceState = { ...state, invoices: [], chat: [] };
    const hinges = seeded.stock.find((s) => s.sku === "HNG-BR")!;
    const inv = makeInvoice({
      status: "sent",
      stockDeducted: true,
      items: [{ id: "l1", description: hinges.name, quantity: 4, unitPrice: 14.5, productId: hinges.id }],
    });
    // stock as it is after the invoice was sent (14 - 4)
    const booked = seeded.stock.map((s) => (s.id === hinges.id ? { ...s, quantity: 10 } : s));
    localStorage.setItem("legacylift.workspace.v1", JSON.stringify({ ...seeded, stock: booked, invoices: [inv] }));
    render(
      <MemoryRouter initialEntries={[`/app/invoices/${inv.id}/edit`]}>
        <Routes>
          <Route path="/app/*" element={<DigitalApp deviceOnly />} />
        </Routes>
      </MemoryRouter>,
    );
    fireEvent.change(screen.getByLabelText(/line 1 quantity/i), { target: { value: "1" } });
    fireEvent.click(screen.getByRole("button", { name: /save draft/i }));
    const saved = JSON.parse(localStorage.getItem("legacylift.workspace.v1")!) as WorkspaceState;
    expect(saved.stock.find((s) => s.id === hinges.id)!.quantity).toBe(13);
  });
});
