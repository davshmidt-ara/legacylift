import { useEffect } from "react";
import { Link } from "react-router-dom";
import { ArrowLeft } from "lucide-react";
import { COMPANY } from "@/config/company";
import { countryName } from "@/features/digital/countries";
import { formatDate } from "@/features/digital/components";
import { useLang } from "@/i18n";
import { LanguageSwitch } from "@/i18n/LanguageSwitch";
import { LEGAL } from "./texts";

/** Privacy policy or terms of use, in the chosen language, with the operator's details from src/config/company.ts. */
export default function LegalPage({ doc }: { doc: "privacy" | "terms" }) {
  const { lang } = useLang();
  const texts = LEGAL[lang] ?? LEGAL.en;
  const page = texts[doc];
  const operator = [COMPANY.legalName, COMPANY.registrationNumber, COMPANY.address].filter(Boolean).join(", ") || texts.operatorFallback;
  const contact = COMPANY.email || texts.contactFallback;
  const fill = (s: string) =>
    s
      .replace(/\{operator\}/g, operator)
      .replace(/\{contact\}/g, contact)
      .replace(/\{country\}/g, countryName(COMPANY.country))
      .replace(/\{date\}/g, formatDate(COMPANY.updated));

  useEffect(() => {
    const prev = document.title;
    document.title = `${page.title} · LegacyLift`;
    return () => {
      document.title = prev;
    };
  }, [page.title]);

  return (
    <div className="min-h-screen">
      <header className="border-b border-border">
        <div className="container mx-auto px-4 sm:px-6 py-4 flex items-center justify-between gap-4">
          <Link to="/" className="flex items-center gap-2 font-heading text-xl font-extrabold rounded focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
            <span className="inline-block h-5 w-5 rounded-sm bg-primary" aria-hidden="true" />
            LegacyLift
          </Link>
          <LanguageSwitch />
        </div>
      </header>
      <main className="container mx-auto px-4 sm:px-6 py-10 max-w-3xl">
        <Link to="/" className="inline-flex items-center gap-1 text-sm text-primary hover:underline mb-6">
          <ArrowLeft size={16} aria-hidden="true" /> {texts.back}
        </Link>
        <h1 className="font-heading text-3xl md:text-4xl font-bold">{page.title}</h1>
        <p className="mt-2 text-sm text-muted-foreground">{fill(texts.updated)}</p>
        <p className="mt-6 leading-relaxed">{fill(page.intro)}</p>
        {page.sections.map((s) => (
          <section key={s.heading} className="mt-8">
            <h2 className="font-heading text-xl font-semibold">{s.heading}</h2>
            {s.body.map((p, i) => (
              <p key={i} className="mt-2 leading-relaxed text-foreground/90">
                {fill(p)}
              </p>
            ))}
          </section>
        ))}
      </main>
    </div>
  );
}
