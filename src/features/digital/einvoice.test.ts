import { describe, expect, it } from "vitest";
import { eInvoiceProblems, eInvoiceXml, parseBankDetails, peppolEndpoint } from "./einvoice";
import { buildSampleData, sampleProfile } from "./sample";
import { newId } from "./store";
import type { Invoice } from "./types";

// The output was checked with the official EN 16931 and Peppol BIS 3.0 validation rules (0 errors, 0 warnings).
// These tests keep the parts that matter for those rules from drifting.

const profile = sampleProfile();
const data = buildSampleData(newId, "2026-10-09");
const company = data.customers[0]; // SIA Ozols Būve, has a VAT number
const person = data.customers[1]; // Anna Bērziņa, private customer
const invoiceFor = (customerId: string, patch: Partial<Invoice> = {}): Invoice => ({ ...data.invoices[0], customerId, ...patch });

const parse = (xml: string) => new DOMParser().parseFromString(xml, "application/xml");
const text = (doc: Document, tag: string) => [...doc.getElementsByTagName(tag)].map((e) => e.textContent ?? "");

describe("e-invoices (EN 16931 / Peppol BIS 3.0)", () => {
  it("finds Peppol addresses from VAT and registration numbers", () => {
    expect(peppolEndpoint("LV40003000001", "LV")).toEqual({ scheme: "9939", id: "LV40003000001" });
    expect(peppolEndpoint("lt 100000000001", "LT")).toEqual({ scheme: "9937", id: "LT100000000001" });
    expect(peppolEndpoint("EE100000000", "EE")).toEqual({ scheme: "9931", id: "EE100000000" });
    expect(peppolEndpoint("302000000", "LT")).toEqual({ scheme: "0200", id: "302000000" });
    expect(peppolEndpoint("40003000001", "LV")).toEqual({ scheme: "0218", id: "40003000001" });
    expect(peppolEndpoint("12345", "")).toBeNull();
  });

  it("reads IBAN and BIC from free-text bank details", () => {
    expect(parseBankDetails(profile.bankDetails)).toEqual({ iban: "LV00HABA0000000000000", bic: "HABALV22" });
    expect(parseBankDetails("cash only")).toEqual({ iban: "", bic: "" });
  });

  it("explains what is missing instead of making an invalid file", () => {
    expect(eInvoiceProblems(invoiceFor(company.id), profile, company)).toEqual([]);
    expect(eInvoiceProblems(invoiceFor(person.id), profile, person)).toEqual([
      "Add the customer's VAT or registration number. E-invoices are for invoices between businesses.",
    ]);
    expect(eInvoiceProblems(invoiceFor(company.id, { kind: "quote" }), { ...profile, taxId: "", country: "" }, company)).toEqual([
      "Only invoices can be sent as e-invoices, not quotes.",
      "Choose your business's country in Settings.",
      "Add your VAT or registration number in Settings.",
    ]);
  });

  it("writes consistent totals: rounded lines add up, tax on the sum", () => {
    const inv = invoiceFor(company.id, {
      taxRate: 21,
      items: [
        { id: "a", description: "Ąžuolas & <co>", quantity: 2.5, unitPrice: 10.333 },
        { id: "b", description: "Šķirne", quantity: 3, unitPrice: 0.1 },
      ],
    });
    const doc = parse(eInvoiceXml(inv, profile, company));
    expect(doc.getElementsByTagName("parsererror")).toHaveLength(0);
    const lines = text(doc, "cbc:LineExtensionAmount").map(Number);
    const [net, ...lineAmounts] = [lines[0], ...lines.slice(1)];
    expect(lineAmounts).toEqual([25.83, 0.3]);
    expect(net).toBe(26.13);
    expect(text(doc, "cbc:TaxAmount").map(Number)).toEqual([5.49, 5.49]);
    expect(Number(text(doc, "cbc:PayableAmount")[0])).toBe(31.62);
    expect(text(doc, "cbc:Name")).toContain("Ąžuolas & <co>");
  });

  it("names both companies by their Peppol address and pays to the IBAN", () => {
    const doc = parse(eInvoiceXml(invoiceFor(company.id), profile, company));
    const endpoints = [...doc.getElementsByTagName("cbc:EndpointID")].map((e) => `${e.getAttribute("schemeID")}:${e.textContent}`);
    expect(endpoints).toEqual(["9939:LV40000000001", "9939:LV40003000001"]);
    expect(text(doc, "cbc:CustomizationID")[0]).toBe("urn:cen.eu:en16931:2017#compliant#urn:fdc:peppol.eu:2017:poacc:billing:3.0");
    expect(text(doc, "cbc:PaymentMeansCode")).toEqual(["58"]);
    expect(text(doc, "cbc:IdentificationCode")).toEqual(["LV", "LV"]);
  });
});
