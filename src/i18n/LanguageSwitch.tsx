import { LANGS, useLang } from "./index";

/** EN | LV toggle. */
export function LanguageSwitch({ className = "" }: { className?: string }) {
  const { lang, setLang } = useLang();
  return (
    <div role="group" aria-label="Language / Valoda" className={`inline-flex rounded-md border border-border bg-card p-0.5 text-xs font-semibold ${className}`}>
      {LANGS.map((l) => (
        <button
          key={l.id}
          type="button"
          lang={l.id}
          title={l.name}
          aria-pressed={lang === l.id}
          onClick={() => setLang(l.id)}
          className={`min-h-8 min-w-9 rounded px-2 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${
            lang === l.id ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"
          }`}
        >
          {l.label}
        </button>
      ))}
    </div>
  );
}
