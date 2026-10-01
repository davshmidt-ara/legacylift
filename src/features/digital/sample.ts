import { addDays, todayIso } from "./finance";
import type { BusinessProfile, Customer, ExtractedRecord, Invoice, StockItem } from "./types";

export const SAMPLE_PROFILE: BusinessProfile = {
  businessName: "Hartmann & Söhne Joinery",
  ownerName: "Klaus Hartmann",
  address: "Werkstattweg 4\n50667 Köln\nGermany",
  email: "info@hartmann-joinery.example",
  phone: "+49 221 555 0100",
  taxId: "DE123456789",
  bankDetails: "Sparkasse KölnBonn · IBAN DE00 3705 0198 0000 0000 00 · BIC COLSDE33",
  currency: "EUR",
  defaultTaxRate: 19,
  paymentTermsDays: 14,
  invoicePrefix: "RE",
  quotePrefix: "AN",
  invoiceFooter: "Thank you for your trust in our craft since 1962.",
};

export const SAMPLE_RECORDS: ExtractedRecord[] = [
  {
    docType: "order",
    title: "Timber order — Nordholz",
    party: "Nordholz Timber Supply",
    date: "2026-09-02",
    amount: 2310,
    currency: "EUR",
    summary: "Monthly order of kiln-dried oak and beech boards.",
    fields: [{ label: "Delivery", value: "Week 38" }],
    lineItems: [
      { description: "Oak boards 27mm, m³", quantity: 1.5, unitPrice: 1100, total: 1650 },
      { description: "Beech boards 20mm, m³", quantity: 1, unitPrice: 660, total: 660 },
    ],
    tags: ["supplier", "materials"],
  },
  {
    docType: "contract",
    title: "Workshop lease — Werkstattweg 4",
    party: "Rheinland Immobilien GmbH",
    date: "2019-01-01",
    amount: 1850,
    currency: "EUR",
    summary: "Monthly lease for workshop and yard. Renewal notice due 6 months before 31 Dec 2029.",
    fields: [{ label: "Notice period", value: "6 months" }],
    lineItems: [],
    tags: ["lease", "renewal 2029"],
  },
];

type SampleInvoice = Omit<Invoice, "id" | "createdAt" | "customerId" | "items"> & {
  customer: number;
  items: { description: string; quantity: number; unitPrice: number }[];
};

export function buildSampleData(newId: () => string, today = todayIso()) {
  const customers: Customer[] = [
    { name: "Stefan Müller", company: "Müller Bau GmbH", email: "s.mueller@muellerbau.example", phone: "+49 221 555 0142", address: "Industriestr. 8, 50735 Köln", notes: "General contractor. Sends 3–4 staircase jobs a year." },
    { name: "Anna Weber", company: "", email: "anna.weber@example.com", phone: "+49 221 555 0192", address: "Lindenstr. 12, 50674 Köln", notes: "Customer since 1998. Prefers phone calls in the morning." },
    { name: "Jens Schulz", company: "Bäckerei Schulz", email: "kontakt@baeckerei-schulz.example", phone: "+49 221 555 0177", address: "Marktplatz 3, 50667 Köln", notes: "Shop fittings. Pays promptly." },
    { name: "Dr. Lea Brandt", company: "Praxis Dr. Brandt", email: "praxis@brandt.example", phone: "+49 221 555 0133", address: "Ringstr. 40, 50672 Köln", notes: "Reception desk project, wants walnut." },
  ].map((c, i) => ({ ...c, id: newId(), createdAt: addDays(today, -400 + i * 30) }));

  const invoiceSeed: SampleInvoice[] = [
    { kind: "invoice", number: `RE-${today.slice(0, 4)}-0041`, customer: 1, issueDate: addDays(today, -150), dueDate: addDays(today, -136), taxRate: 19, status: "paid", paidAt: addDays(today, -140), notes: "", items: [{ description: "Walnut kitchen cabinet fronts", quantity: 12, unitPrice: 260 }] },
    { kind: "invoice", number: `RE-${today.slice(0, 4)}-0042`, customer: 2, issueDate: addDays(today, -110), dueDate: addDays(today, -96), taxRate: 19, status: "paid", paidAt: addDays(today, -100), notes: "", items: [{ description: "Oak shop counter, 3.2 m", quantity: 1, unitPrice: 4200 }, { description: "Installation", quantity: 6, unitPrice: 65 }] },
    { kind: "invoice", number: `RE-${today.slice(0, 4)}-0043`, customer: 0, issueDate: addDays(today, -80), dueDate: addDays(today, -66), taxRate: 19, status: "paid", paidAt: addDays(today, -60), notes: "", items: [{ description: "Beech staircase, 12 steps", quantity: 1, unitPrice: 6100 }] },
    { kind: "invoice", number: `RE-${today.slice(0, 4)}-0044`, customer: 2, issueDate: addDays(today, -45), dueDate: addDays(today, -31), taxRate: 19, status: "paid", paidAt: addDays(today, -35), notes: "", items: [{ description: "Bread shelving, oiled oak", quantity: 4, unitPrice: 480 }] },
    { kind: "invoice", number: `RE-${today.slice(0, 4)}-0045`, customer: 0, issueDate: addDays(today, -40), dueDate: addDays(today, -26), taxRate: 19, status: "sent", notes: "", items: [{ description: "Oak staircase, 14 steps", quantity: 1, unitPrice: 7200 }, { description: "Installation (hours)", quantity: 18, unitPrice: 65 }] },
    { kind: "invoice", number: `RE-${today.slice(0, 4)}-0046`, customer: 3, issueDate: addDays(today, -6), dueDate: addDays(today, 8), taxRate: 19, status: "sent", notes: "", items: [{ description: "Reception desk, walnut veneer", quantity: 1, unitPrice: 3900 }] },
    { kind: "invoice", number: `RE-${today.slice(0, 4)}-0047`, customer: 1, issueDate: today, dueDate: addDays(today, 14), taxRate: 19, status: "draft", notes: "", items: [{ description: "Wardrobe door repair", quantity: 3, unitPrice: 65 }, { description: "Brass hinges", quantity: 6, unitPrice: 14.5 }] },
    { kind: "quote", number: `AN-${today.slice(0, 4)}-0019`, customer: 1, issueDate: addDays(today, -3), dueDate: addDays(today, 27), taxRate: 19, status: "sent", notes: "Delivery approx. 6 weeks after order.", items: [{ description: "Built-in oak wardrobe, 2.4 m", quantity: 1, unitPrice: 4250 }, { description: "Installation (hours)", quantity: 8, unitPrice: 65 }] },
  ];

  const invoices: Invoice[] = invoiceSeed.map(({ customer, items, ...rest }) => ({
    ...rest,
    id: newId(),
    createdAt: rest.issueDate,
    customerId: customers[customer].id,
    items: items.map((it) => ({ ...it, id: newId() })),
  }));

  const stock: StockItem[] = [
    { sku: "OAK-27", name: "Oak boards 27 mm, kiln-dried", unit: "m³", quantity: 0.8, reorderLevel: 1, costPrice: 1100, salePrice: 0, location: "Rack A" },
    { sku: "BEE-20", name: "Beech boards 20 mm", unit: "m³", quantity: 1.6, reorderLevel: 0.5, costPrice: 660, salePrice: 0, location: "Rack B" },
    { sku: "WAL-V", name: "Walnut veneer sheets", unit: "sheet", quantity: 22, reorderLevel: 10, costPrice: 38, salePrice: 0, location: "Veneer press room" },
    { sku: "HNG-BR", name: "Brass hinges 80 mm", unit: "pcs", quantity: 14, reorderLevel: 20, costPrice: 6.2, salePrice: 14.5, location: "Drawer 3" },
    { sku: "OIL-HW", name: "Hardwax oil, clear", unit: "L", quantity: 9, reorderLevel: 4, costPrice: 24, salePrice: 0, location: "Finishing shelf" },
  ].map((s) => ({ ...s, id: newId() }));

  return { customers, invoices, stock };
}
