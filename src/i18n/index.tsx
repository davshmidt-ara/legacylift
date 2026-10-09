import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { ET } from "./et";
import { LT } from "./lt";
import { LV } from "./lv";

export type Lang = "en" | "lv" | "lt" | "et";
export const LANGS: { id: Lang; label: string; name: string; locale?: string }[] = [
  { id: "en", label: "EN", name: "English" },
  { id: "lv", label: "LV", name: "Latviešu", locale: "lv-LV" },
  { id: "lt", label: "LT", name: "Lietuvių", locale: "lt-LT" },
  { id: "et", label: "ET", name: "Eesti", locale: "et-EE" },
];

const DICTIONARIES: Record<Lang, Record<string, string> | null> = { en: null, lv: LV, lt: LT, et: ET };
const isLang = (v: unknown): v is Lang => LANGS.some((l) => l.id === v);

const STORAGE_KEY = "legacylift.lang";

function initialLang(): Lang {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (isLang(saved)) return saved;
  } catch {
    // storage blocked
  }
  const browser = typeof navigator !== "undefined" ? navigator.language.slice(0, 2).toLowerCase() : "";
  return isLang(browser) ? browser : "en";
}

// The current language also lives outside React, for the formatting helpers (money, dates, month names).
let current: Lang = initialLang();

/** Locale for Intl formatting: the chosen Baltic language, or the browser's own for English. */
export const locale = () => LANGS.find((l) => l.id === current)?.locale;
export const currentLang = () => current;

type Vars = Record<string, string | number>;

/** Translates an English text. Unknown texts stay in English. "{name}" placeholders are filled from `vars`. */
export function translate(text: string, vars?: Vars, lang: Lang = current) {
  const out = DICTIONARIES[lang]?.[text] ?? text;
  return vars ? out.replace(/\{(\w+)\}/g, (m, k: string) => (k in vars ? String(vars[k]) : m)) : out;
}

/** Marks a text in a constant (a list of steps, a menu) for translation; it is translated where it is shown with t(). */
export const msg = (text: string) => text;

const LangContext = createContext<{ lang: Lang; setLang: (l: Lang) => void }>({ lang: "en", setLang: () => {} });

export function LanguageProvider({ children }: { children: ReactNode }) {
  const [lang, setLangState] = useState<Lang>(current);
  const setLang = useCallback((l: Lang) => {
    current = l;
    try {
      localStorage.setItem(STORAGE_KEY, l);
    } catch {
      // storage blocked: the choice lasts for this visit
    }
    setLangState(l);
  }, []);
  useEffect(() => {
    document.documentElement.lang = lang;
  }, [lang]);
  const value = useMemo(() => ({ lang, setLang }), [lang, setLang]);
  return <LangContext.Provider value={value}>{children}</LangContext.Provider>;
}

export const useLang = () => useContext(LangContext);

/** Returns t(text, vars) and re-renders the component when the language changes. */
export function useT() {
  const { lang } = useLang();
  return useCallback((text: string, vars?: Vars) => translate(text, vars, lang), [lang]);
}
