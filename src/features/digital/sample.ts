import { addDays, todayIso } from "./finance";
import type { BusinessProfile, Customer, ExtractedRecord, Invoice, StockItem } from "./types";
import { translate as tr } from "@/i18n";

// The example business: a Riga joinery. Names and addresses stay Latvian; descriptions follow the chosen language.

export const SAMPLE_BUSINESS_NAME = "SIA Kalniņa Galdniecība";

export function sampleProfile(): BusinessProfile {
  return {
    businessName: SAMPLE_BUSINESS_NAME,
    ownerName: "Andris Kalniņš",
    address: "Darbnīcu iela 4\nRīga, LV-1010\nLatvija",
    email: "info@kalnina-galdnieciba.example",
    phone: "+371 2000 0100",
    taxId: "LV40000000001",
    bankDetails: "Swedbank · IBAN LV00 HABA 0000 0000 0000 0 · BIC HABALV22",
    currency: "EUR",
    defaultTaxRate: 21,
    paymentTermsDays: 14,
    invoicePrefix: "RE",
    quotePrefix: "PD",
    invoiceFooter: tr("Thank you for your trust in our craft since 1964."),
  };
}

export function sampleRecords(): ExtractedRecord[] {
  return [
    {
      docType: "order",
      title: tr("Timber order — Ziemeļu Koks"),
      party: "SIA Ziemeļu Koks",
      date: "2026-09-02",
      amount: 2310,
      currency: "EUR",
      summary: tr("Monthly order of kiln-dried oak and beech boards."),
      fields: [{ label: tr("Delivery"), value: tr("Week 38") }],
      lineItems: [
        { description: tr("Oak boards 27 mm, m³"), quantity: 1.5, unitPrice: 1100, total: 1650 },
        { description: tr("Beech boards 20 mm, m³"), quantity: 1, unitPrice: 660, total: 660 },
      ],
      tags: [tr("supplier"), tr("materials")],
    },
    {
      docType: "contract",
      title: tr("Workshop lease — Darbnīcu iela 4"),
      party: "SIA Rīgas Nekustamie Īpašumi",
      date: "2019-01-01",
      amount: 1850,
      currency: "EUR",
      summary: tr("Monthly lease for workshop and yard. Renewal notice due 6 months before 31 Dec 2029."),
      fields: [{ label: tr("Notice period"), value: tr("6 months") }],
      lineItems: [],
      tags: [tr("lease"), tr("renewal 2029")],
    },
  ];
}

/** For tests and seeding; reads the language at the moment the module loads. */
export const SAMPLE_PROFILE = sampleProfile();
export const SAMPLE_RECORDS = sampleRecords();

type SampleInvoice = Omit<Invoice, "id" | "createdAt" | "customerId" | "items"> & {
  customer: number;
  items: { description: string; quantity: number; unitPrice: number }[];
};

export function buildSampleData(newId: () => string, today = todayIso()) {
  const customers: Customer[] = [
    { name: "Jānis Ozols", company: "SIA Ozols Būve", email: "janis@ozolsbuve.example", phone: "+371 2000 0142", address: "Rūpniecības iela 8, Rīga, LV-1045", notes: tr("General contractor. Sends 3–4 staircase jobs a year.") },
    { name: "Anna Bērziņa", company: "", email: "anna.berzina@example.com", phone: "+371 2000 0192", address: "Liepu iela 12, Rīga, LV-1011", notes: tr("Customer since 1998. Prefers phone calls in the morning.") },
    { name: "Mārtiņš Liepa", company: "Maiznīca Liepa", email: "info@maiznicaliepa.example", phone: "+371 2000 0177", address: "Tirgus laukums 3, Jūrmala, LV-2015", notes: tr("Shop fittings. Pays promptly.") },
    { name: "Dr. Ilze Krūmiņa", company: "Krūmiņas zobārstniecība", email: "prakse@krumina.example", phone: "+371 2000 0133", address: "Brīvības iela 40, Rīga, LV-1050", notes: tr("Reception desk project, wants walnut.") },
  ].map((c, i) => ({ ...c, id: newId(), createdAt: addDays(today, -400 + i * 30) }));

  const year = today.slice(0, 4);
  const invoiceSeed: SampleInvoice[] = [
    { kind: "invoice", number: `RE-${year}-0041`, customer: 1, issueDate: addDays(today, -150), dueDate: addDays(today, -136), taxRate: 21, status: "paid", paidAt: addDays(today, -140), notes: "", items: [{ description: tr("Walnut kitchen cabinet fronts"), quantity: 12, unitPrice: 260 }] },
    { kind: "invoice", number: `RE-${year}-0042`, customer: 2, issueDate: addDays(today, -110), dueDate: addDays(today, -96), taxRate: 21, status: "paid", paidAt: addDays(today, -100), notes: "", items: [{ description: tr("Oak shop counter, 3.2 m"), quantity: 1, unitPrice: 4200 }, { description: tr("Installation"), quantity: 6, unitPrice: 65 }] },
    { kind: "invoice", number: `RE-${year}-0043`, customer: 0, issueDate: addDays(today, -80), dueDate: addDays(today, -66), taxRate: 21, status: "paid", paidAt: addDays(today, -60), notes: "", items: [{ description: tr("Beech staircase, 12 steps"), quantity: 1, unitPrice: 6100 }] },
    { kind: "invoice", number: `RE-${year}-0044`, customer: 2, issueDate: addDays(today, -45), dueDate: addDays(today, -31), taxRate: 21, status: "paid", paidAt: addDays(today, -35), notes: "", items: [{ description: tr("Bread shelving, oiled oak"), quantity: 4, unitPrice: 480 }] },
    { kind: "invoice", number: `RE-${year}-0045`, customer: 0, issueDate: addDays(today, -40), dueDate: addDays(today, -26), taxRate: 21, status: "sent", notes: "", items: [{ description: tr("Oak staircase, 14 steps"), quantity: 1, unitPrice: 7200 }, { description: tr("Installation (hours)"), quantity: 18, unitPrice: 65 }] },
    { kind: "invoice", number: `RE-${year}-0046`, customer: 3, issueDate: addDays(today, -6), dueDate: addDays(today, 8), taxRate: 21, status: "sent", notes: "", items: [{ description: tr("Reception desk, walnut veneer"), quantity: 1, unitPrice: 3900 }] },
    { kind: "invoice", number: `RE-${year}-0047`, customer: 1, issueDate: today, dueDate: addDays(today, 14), taxRate: 21, status: "draft", notes: "", items: [{ description: tr("Wardrobe door repair"), quantity: 3, unitPrice: 65 }, { description: tr("Brass hinges"), quantity: 6, unitPrice: 14.5 }] },
    { kind: "quote", number: `PD-${year}-0019`, customer: 1, issueDate: addDays(today, -3), dueDate: addDays(today, 27), taxRate: 21, status: "sent", notes: tr("Delivery approx. 6 weeks after order."), items: [{ description: tr("Built-in oak wardrobe, 2.4 m"), quantity: 1, unitPrice: 4250 }, { description: tr("Installation (hours)"), quantity: 8, unitPrice: 65 }] },
  ];

  const invoices: Invoice[] = invoiceSeed.map(({ customer, items, ...rest }) => ({
    ...rest,
    id: newId(),
    createdAt: rest.issueDate,
    customerId: customers[customer].id,
    items: items.map((it) => ({ ...it, id: newId() })),
  }));

  const stock: StockItem[] = [
    { sku: "OAK-27", name: tr("Oak boards 27 mm, kiln-dried"), unit: "m³", quantity: 0.8, reorderLevel: 1, costPrice: 1100, salePrice: 0, location: tr("Rack A") },
    { sku: "BEE-20", name: tr("Beech boards 20 mm"), unit: "m³", quantity: 1.6, reorderLevel: 0.5, costPrice: 660, salePrice: 0, location: tr("Rack B") },
    { sku: "WAL-V", name: tr("Walnut veneer sheets"), unit: tr("sheet"), quantity: 22, reorderLevel: 10, costPrice: 38, salePrice: 0, location: tr("Veneer press room") },
    { sku: "HNG-BR", name: tr("Brass hinges 80 mm"), unit: tr("pcs"), quantity: 14, reorderLevel: 20, costPrice: 6.2, salePrice: 14.5, location: tr("Drawer 3") },
    { sku: "OIL-HW", name: tr("Hardwax oil, clear"), unit: "L", quantity: 9, reorderLevel: 4, costPrice: 24, salePrice: 0, location: tr("Finishing shelf") },
  ].map((s) => ({ ...s, id: newId() }));

  return { customers, invoices, stock };
}
