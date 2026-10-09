// E-invoices in the EU standard (EN 16931), as Peppol BIS Billing 3.0 UBL XML.
// The file can be uploaded to e-invoicing portals and accounting software, or sent over the Peppol network.
import { msg } from "@/i18n";
import { round2 } from "./finance";
import type { BusinessProfile, Customer, Invoice } from "./types";

const CUSTOMIZATION = "urn:cen.eu:en16931:2017#compliant#urn:fdc:peppol.eu:2017:poacc:billing:3.0";
const PROFILE = "urn:fdc:peppol.eu:2017:poacc:billing:01:1.0";

const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&apos;");
const amount = (n: number) => round2(n).toFixed(2);
const quantity = (n: number) => String(Math.round(n * 10000) / 10000);
/** A VAT number starts with the country letters, e.g. LV40003000001 (EL for Greece). */
const looksLikeVat = (id: string) => /^[A-Z]{2}[A-Z0-9]{2,13}$/.test(id.replace(/\s/g, "").toUpperCase());

/** Peppol electronic-address schemes for VAT numbers, by the VAT number's country letters. */
const VAT_SCHEME: Record<string, string> = {
  AT: "9914", BE: "9925", BG: "9926", CY: "9928", CZ: "9929", DE: "9930", EE: "9931", GB: "9932", EL: "9933", HR: "9934", IE: "9935",
  LT: "9937", LU: "9938", LV: "9939", MT: "9943", NL: "9944", PL: "9945", PT: "9946", RO: "9947", SI: "9949", SK: "9950", FR: "9957", ES: "9920", HU: "9910",
};
/** Peppol schemes for national company registration numbers, by country. */
const COMPANY_SCHEME: Record<string, string> = { LV: "0218", LT: "0200", EE: "0191", SE: "0007", NO: "0192", FI: "0216", DK: "0184" };

/** The Peppol address (scheme and id) a company receives e-invoices at, from its VAT or registration number. */
export function peppolEndpoint(taxId: string, country: string): { scheme: string; id: string } | null {
  const id = taxId.replace(/[\s.-]/g, "").toUpperCase();
  if (!id) return null;
  if (looksLikeVat(id) && VAT_SCHEME[id.slice(0, 2)]) return { scheme: VAT_SCHEME[id.slice(0, 2)], id };
  if (/^\d+$/.test(id) && COMPANY_SCHEME[country]) return { scheme: COMPANY_SCHEME[country], id };
  return null;
}

/** IBAN and BIC found in free-text bank details like "Swedbank · IBAN LV00 HABA 0000 0000 0000 0 · BIC HABALV22". */
export function parseBankDetails(text: string) {
  const iban = text.toUpperCase().match(/\b[A-Z]{2}\d{2}(?:\s?[A-Z0-9]){10,30}\b/)?.[0].replace(/\s/g, "") ?? "";
  const bic = text.toUpperCase().match(/\bBIC[:\s]*([A-Z]{6}[A-Z0-9]{2}(?:[A-Z0-9]{3})?)\b/)?.[1] ?? "";
  return { iban, bic };
}

/** Street and city from a free-text address; the country is given separately. */
function splitAddress(address: string) {
  const lines = address
    .split(/\n|,/)
    .map((l) => l.trim())
    .filter(Boolean);
  return { street: lines[0] ?? "", city: lines.slice(1).join(", ") };
}

/** What is still missing before an e-invoice can be made, as English texts to translate. */
export function eInvoiceProblems(inv: Invoice, profile: BusinessProfile, customer: Customer | undefined): string[] {
  const problems: string[] = [];
  if (inv.kind !== "invoice") problems.push(msg("Only invoices can be sent as e-invoices, not quotes."));
  if (!profile.businessName.trim()) problems.push(msg("Add your business name in Settings."));
  if (!profile.country) problems.push(msg("Choose your business's country in Settings."));
  if (!profile.taxId.trim()) problems.push(msg("Add your VAT or registration number in Settings."));
  else if (profile.country && !peppolEndpoint(profile.taxId, profile.country)) problems.push(msg("Your VAT or registration number in Settings isn't in a format e-invoices accept (e.g. LV40003000001)."));
  if (!customer) problems.push(msg("Choose a customer for this invoice."));
  else if (!customer.taxId?.trim()) problems.push(msg("Add the customer's VAT or registration number. E-invoices are for invoices between businesses."));
  else if (!peppolEndpoint(customer.taxId, customer.country || profile.country)) problems.push(msg("The customer's VAT or registration number isn't in a format e-invoices accept (e.g. LT100000000001 or 302000000)."));
  if (!inv.items.length) problems.push(msg("Add at least one line."));
  return problems;
}

function party(p: { name: string; email: string; address: string; country: string; taxId: string; contact?: string; phone?: string }) {
  const { street, city } = splitAddress(p.address);
  const id = p.taxId.replace(/[\s.-]/g, "").toUpperCase();
  const vat = id && looksLikeVat(id);
  const endpoint = peppolEndpoint(p.taxId, p.country);
  return [
    "<cac:Party>",
    endpoint ? `<cbc:EndpointID schemeID="${endpoint.scheme}">${esc(endpoint.id)}</cbc:EndpointID>` : "",
    `<cac:PartyName><cbc:Name>${esc(p.name)}</cbc:Name></cac:PartyName>`,
    "<cac:PostalAddress>",
    street ? `<cbc:StreetName>${esc(street)}</cbc:StreetName>` : "",
    city ? `<cbc:CityName>${esc(city)}</cbc:CityName>` : "",
    `<cac:Country><cbc:IdentificationCode>${esc(p.country)}</cbc:IdentificationCode></cac:Country>`,
    "</cac:PostalAddress>",
    vat ? `<cac:PartyTaxScheme><cbc:CompanyID>${esc(id)}</cbc:CompanyID><cac:TaxScheme><cbc:ID>VAT</cbc:ID></cac:TaxScheme></cac:PartyTaxScheme>` : "",
    "<cac:PartyLegalEntity>",
    `<cbc:RegistrationName>${esc(p.name)}</cbc:RegistrationName>`,
    id && !vat ? `<cbc:CompanyID>${esc(id)}</cbc:CompanyID>` : "",
    "</cac:PartyLegalEntity>",
    p.contact || p.phone || p.email
      ? `<cac:Contact>${p.contact ? `<cbc:Name>${esc(p.contact)}</cbc:Name>` : ""}${p.phone ? `<cbc:Telephone>${esc(p.phone)}</cbc:Telephone>` : ""}${p.email ? `<cbc:ElectronicMail>${esc(p.email.trim())}</cbc:ElectronicMail>` : ""}</cac:Contact>`
      : "",
    "</cac:Party>",
  ].join("");
}

/** Peppol BIS 3.0 / EN 16931 UBL invoice. Check eInvoiceProblems() first. */
export function eInvoiceXml(inv: Invoice, profile: BusinessProfile, customer: Customer): string {
  const cur = profile.currency || "EUR";
  const rate = inv.taxRate || 0;
  const category = rate > 0 ? "S" : "Z";
  const lines = inv.items.map((it, i) => ({ ...it, n: i + 1, total: round2((it.quantity || 0) * (it.unitPrice || 0)) }));
  // EN 16931 adds up the rounded line amounts; tax is calculated on that sum.
  const net = round2(lines.reduce((s, l) => s + l.total, 0));
  const tax = round2((net * rate) / 100);
  const gross = round2(net + tax);
  const { iban, bic } = parseBankDetails(profile.bankDetails);
  const buyerName = customer.company || customer.name;

  const xml = [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<Invoice xmlns="urn:oasis:names:specification:ubl:schema:xsd:Invoice-2" xmlns:cac="urn:oasis:names:specification:ubl:schema:xsd:CommonAggregateComponents-2" xmlns:cbc="urn:oasis:names:specification:ubl:schema:xsd:CommonBasicComponents-2">',
    `<cbc:CustomizationID>${CUSTOMIZATION}</cbc:CustomizationID>`,
    `<cbc:ProfileID>${PROFILE}</cbc:ProfileID>`,
    `<cbc:ID>${esc(inv.number)}</cbc:ID>`,
    `<cbc:IssueDate>${inv.issueDate}</cbc:IssueDate>`,
    inv.dueDate ? `<cbc:DueDate>${inv.dueDate}</cbc:DueDate>` : "",
    "<cbc:InvoiceTypeCode>380</cbc:InvoiceTypeCode>",
    inv.notes.trim() ? `<cbc:Note>${esc(inv.notes.trim())}</cbc:Note>` : "",
    `<cbc:DocumentCurrencyCode>${esc(cur)}</cbc:DocumentCurrencyCode>`,
    `<cbc:BuyerReference>${esc((customer.name || buyerName).slice(0, 100))}</cbc:BuyerReference>`,
    "<cac:AccountingSupplierParty>",
    party({ name: profile.businessName, email: profile.email, address: profile.address, country: profile.country, taxId: profile.taxId, contact: profile.ownerName, phone: profile.phone }),
    "</cac:AccountingSupplierParty>",
    "<cac:AccountingCustomerParty>",
    party({ name: buyerName, email: customer.email, address: customer.address, country: customer.country || profile.country, taxId: customer.taxId ?? "", contact: customer.company ? customer.name : "", phone: customer.phone }),
    "</cac:AccountingCustomerParty>",
    iban
      ? `<cac:PaymentMeans><cbc:PaymentMeansCode>58</cbc:PaymentMeansCode><cbc:PaymentID>${esc(inv.number)}</cbc:PaymentID><cac:PayeeFinancialAccount><cbc:ID>${iban}</cbc:ID><cbc:Name>${esc(profile.businessName)}</cbc:Name>${bic ? `<cac:FinancialInstitutionBranch><cbc:ID>${bic}</cbc:ID></cac:FinancialInstitutionBranch>` : ""}</cac:PayeeFinancialAccount></cac:PaymentMeans>`
      : "",
    "<cac:TaxTotal>",
    `<cbc:TaxAmount currencyID="${esc(cur)}">${amount(tax)}</cbc:TaxAmount>`,
    "<cac:TaxSubtotal>",
    `<cbc:TaxableAmount currencyID="${esc(cur)}">${amount(net)}</cbc:TaxableAmount>`,
    `<cbc:TaxAmount currencyID="${esc(cur)}">${amount(tax)}</cbc:TaxAmount>`,
    `<cac:TaxCategory><cbc:ID>${category}</cbc:ID><cbc:Percent>${rate}</cbc:Percent><cac:TaxScheme><cbc:ID>VAT</cbc:ID></cac:TaxScheme></cac:TaxCategory>`,
    "</cac:TaxSubtotal>",
    "</cac:TaxTotal>",
    "<cac:LegalMonetaryTotal>",
    `<cbc:LineExtensionAmount currencyID="${esc(cur)}">${amount(net)}</cbc:LineExtensionAmount>`,
    `<cbc:TaxExclusiveAmount currencyID="${esc(cur)}">${amount(net)}</cbc:TaxExclusiveAmount>`,
    `<cbc:TaxInclusiveAmount currencyID="${esc(cur)}">${amount(gross)}</cbc:TaxInclusiveAmount>`,
    `<cbc:PayableAmount currencyID="${esc(cur)}">${amount(gross)}</cbc:PayableAmount>`,
    "</cac:LegalMonetaryTotal>",
    ...lines.map((l) =>
      [
        "<cac:InvoiceLine>",
        `<cbc:ID>${l.n}</cbc:ID>`,
        `<cbc:InvoicedQuantity unitCode="C62">${quantity(l.quantity || 0)}</cbc:InvoicedQuantity>`,
        `<cbc:LineExtensionAmount currencyID="${esc(cur)}">${amount(l.total)}</cbc:LineExtensionAmount>`,
        `<cac:Item><cbc:Name>${esc(l.description || "-")}</cbc:Name><cac:ClassifiedTaxCategory><cbc:ID>${category}</cbc:ID><cbc:Percent>${rate}</cbc:Percent><cac:TaxScheme><cbc:ID>VAT</cbc:ID></cac:TaxScheme></cac:ClassifiedTaxCategory></cac:Item>`,
        `<cac:Price><cbc:PriceAmount currencyID="${esc(cur)}">${String(Math.round((l.unitPrice || 0) * 10000) / 10000)}</cbc:PriceAmount></cac:Price>`,
        "</cac:InvoiceLine>",
      ].join(""),
    ),
    "</Invoice>",
  ];
  return xml.filter(Boolean).join("\n");
}
