import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { LV } from "./lv";

export type Lang = "en" | "lv";
export const LANGS: { id: Lang; label: string; name: string }[] = [
  { id: "en", label: "EN", name: "English" },
  { id: "lv", label: "LV", name: "Latviešu" },
];

const STORAGE_KEY = "legacylift.lang";

function initialLang(): Lang {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved === "en" || saved === "lv") return saved;
  } catch {
    // storage blocked
  }
  return typeof navigator !== "undefined" && /^lv\b/i.test(navigator.language) ? "lv" : "en";
}

// The current language also lives outside React, for the formatting helpers (money, dates, month names).
let current: Lang = initialLang();

/** Locale for Intl formatting: Latvian, or the browser's own for English. */
export const locale = () => (current === "lv" ? "lv-LV" : undefined);
export const currentLang = () => current;

type Vars = Record<string, string | number>;

/** Translates an English text. Unknown texts stay in English. "{name}" placeholders are filled from `vars`. */
export function translate(text: string, vars?: Vars, lang: Lang = current) {
  const out = lang === "lv" ? (LV[text] ?? text) : text;
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
