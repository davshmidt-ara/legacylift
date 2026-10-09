import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { act, fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { ET } from "./et";
import { LT } from "./lt";
import { LV } from "./lv";
import { LanguageProvider, translate } from "./index";
import DigitalLanding from "@/pages/digital/DigitalLanding";
import DigitalApp from "@/pages/digital/DigitalApp";

globalThis.ResizeObserver ??= class {
  observe() {}
  unobserve() {}
  disconnect() {}
} as unknown as typeof ResizeObserver;

const SRC = join(__dirname, "..");

function sourceFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) return name === "ui" || name === "integrations" ? [] : sourceFiles(path);
    return /\.tsx?$/.test(name) && !/\.test\.tsx?$/.test(name) ? [path] : [];
  });
}

const STRING = String.raw`"(?:[^"\\]|\\.)*"`;
/** Every literal text passed to t(), msg(), tr() or translate(), including both sides of `t(cond ? "a" : "b")`. */
function textsInCode() {
  const found = new Map<string, string>();
  const direct = new RegExp(String.raw`(?<![\w.])(?:t|msg|tr|translate)\(\s*(${STRING})`, "g");
  const ternary = new RegExp(String.raw`(?<![\w.])(?:t|tr|translate)\([^()"]*\?\s*(${STRING})\s*:\s*(${STRING})`, "g");
  for (const file of sourceFiles(SRC)) {
    const code = readFileSync(file, "utf8");
    for (const m of code.matchAll(direct)) found.set(JSON.parse(m[1]), file);
    for (const m of code.matchAll(ternary)) {
      found.set(JSON.parse(m[1]), file);
      found.set(JSON.parse(m[2]), file);
    }
  }
  return found;
}

const placeholders = (s: string) => [...s.matchAll(/\{(\w+)\}/g)].map((m) => m[1]).sort();

describe.each([
  ["Latvian", LV],
  ["Lithuanian", LT],
  ["Estonian", ET],
])("%s translation", (_name, dict) => {
  it("covers every text shown in the app", () => {
    const texts = textsInCode();
    expect(texts.size).toBeGreaterThan(400);
    const missing = [...texts].filter(([text]) => !(text in dict)).map(([text, file]) => `${file.replace(SRC, "src")}: ${text}`);
    expect(missing).toEqual([]);
  });

  it("keeps the same {placeholders} in every translation", () => {
    const wrong = Object.entries(dict).filter(([en, tr]) => placeholders(en).join() !== placeholders(tr).join());
    expect(wrong).toEqual([]);
  });

  it("has no leftover entries and no untranslated copies of Latvian", () => {
    expect(Object.keys(dict).sort()).toEqual(Object.keys(LV).sort());
    if (dict !== LV) expect(Object.keys(dict).filter((k) => dict[k] === LV[k] && LV[k].length > 8 && /[āēīūčšžņļķģ]/i.test(LV[k]))).toEqual([]);
  });
});

describe("translate", () => {

  it("fills placeholders and falls back to English for unknown texts", () => {
    expect(translate("Signed in as {email}", { email: "a@b.lv" }, "lv")).toBe("Pierakstījies kā a@b.lv");
    expect(translate("Not a known text", undefined, "lv")).toBe("Not a known text");
    expect(translate("Overdue: {n}", { n: 2 }, "lt")).toBe("Vėluoja: 2");
    expect(translate("Overdue: {n}", { n: 2 }, "et")).toBe("Tähtaeg ületatud: 2");
  });
});

describe("language switch", () => {
  afterEach(() => localStorage.clear());

  const renderAt = (path: string) =>
    render(
      <LanguageProvider>
        <MemoryRouter initialEntries={[path]}>
          <Routes>
            <Route path="/" element={<DigitalLanding />} />
            <Route path="/app/*" element={<DigitalApp deviceOnly />} />
          </Routes>
        </MemoryRouter>
      </LanguageProvider>,
    );

  it("switches the landing page to Latvian and remembers the choice", () => {
    renderAt("/");
    expect(screen.getByRole("link", { name: /try the workspace/i })).toBeInTheDocument();
    const menu = screen.getByRole("combobox", { name: /language/i });
    fireEvent.change(menu, { target: { value: "lv" } });
    expect(screen.getByRole("link", { name: /izmēģināt darba vietu/i })).toBeInTheDocument();
    expect(document.documentElement.lang).toBe("lv");
    expect(localStorage.getItem("legacylift.lang")).toBe("lv");
    fireEvent.change(menu, { target: { value: "lt" } });
    expect(screen.getByRole("link", { name: /išbandyti darbo vietą/i })).toBeInTheDocument();
    fireEvent.change(menu, { target: { value: "et" } });
    expect(screen.getByRole("link", { name: /proovi töölauda/i })).toBeInTheDocument();
    expect(screen.getByText("ARVE nr 1047")).toBeInTheDocument();
    act(() => fireEvent.change(menu, { target: { value: "en" } }));
  });

  it("runs the workspace in Latvian, down to the printed invoice", () => {
    renderAt("/app");
    fireEvent.change(screen.getAllByRole("combobox", { name: /language/i })[0], { target: { value: "lv" } });
    fireEvent.click(screen.getByRole("button", { name: /ielādēt parauga uzņēmumu/i }));
    expect(screen.getByRole("heading", { name: /sia kalniņa galdniecība/i, level: 1 })).toBeInTheDocument();
    expect(screen.getByText(/nepieciešama uzmanība/i)).toBeInTheDocument();
    expect(screen.getAllByText(/kavējums/i).length).toBeGreaterThan(0);

    fireEvent.click(screen.getAllByRole("link", { name: /rēķini un piedāvājumi/i })[0]);
    fireEvent.click(screen.getByRole("link", { name: /RE-\d{4}-0045/ }));
    expect(screen.getByText("Maksātājs")).toBeInTheDocument();
    expect(screen.getAllByText("PVN 21%").length).toBeGreaterThan(0);
    expect(screen.getByText(/ozolkoka kāpnes, 14 pakāpieni/i)).toBeInTheDocument();
    act(() => fireEvent.change(screen.getAllByRole("combobox", { name: /language/i })[0], { target: { value: "en" } }));
  });
});
