import { locale } from "@/i18n";

/** Countries offered for a business or customer, with the standard VAT rate a new business there starts with. */
export const COUNTRIES: { code: string; vat: number }[] = [
  { code: "LV", vat: 21 },
  { code: "LT", vat: 21 },
  { code: "EE", vat: 24 },
  { code: "FI", vat: 25.5 },
  { code: "SE", vat: 25 },
  { code: "DK", vat: 25 },
  { code: "PL", vat: 23 },
  { code: "DE", vat: 19 },
  { code: "NO", vat: 25 },
  { code: "GB", vat: 20 },
];

/** Standard VAT rate for a country, or undefined when we don't know it. */
export const standardVat = (code: string) => COUNTRIES.find((c) => c.code === code)?.vat;

/** Country name in the language LegacyLift is shown in, e.g. "Latvija" for LV in Latvian. */
export function countryName(code: string) {
  if (!code) return "";
  try {
    return new Intl.DisplayNames(locale() ?? undefined, { type: "region" }).of(code) ?? code;
  } catch {
    return code;
  }
}

/** The business's home country, guessed from the language LegacyLift is set up in. */
export const countryForLanguage = (lang: string) => ({ lv: "LV", lt: "LT", et: "EE" })[lang] ?? "";
