import { LANGS, useLang, type Lang } from "./index";

/** Language menu: English, Latviešu, Lietuvių, Eesti. */
export function LanguageSwitch({ className = "" }: { className?: string }) {
  const { lang, setLang } = useLang();
  return (
    <select
      aria-label="Language · Valoda · Kalba · Keel"
      value={lang}
      onChange={(e) => setLang(e.target.value as Lang)}
      className={`min-h-9 rounded-md border border-border bg-card px-2 text-sm font-medium text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${className}`}
    >
      {LANGS.map((l) => (
        <option key={l.id} value={l.id} lang={l.id}>
          {l.name}
        </option>
      ))}
    </select>
  );
}
