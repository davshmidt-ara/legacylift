import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { act, fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
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

describe("Latvian translation", () => {
  it("covers every text shown in the app", () => {
    const texts = textsInCode();
    expect(texts.size).toBeGreaterThan(400);
    const missing = [...texts].filter(([text]) => !(text in LV)).map(([text, file]) => `${file.replace(SRC, "src")}: ${text}`);
    expect(missing).toEqual([]);
  });

  it("keeps the same {placeholders} in every translation", () => {
    const wrong = Object.entries(LV).filter(([en, lv]) => placeholders(en).join() !== placeholders(lv).join());
    expect(wrong).toEqual([]);
  });

  it("fills placeholders and falls back to English for unknown texts", () => {
    expect(translate("Signed in as {email}", { email: "a@b.lv" }, "lv")).toBe("Pierakstījies kā a@b.lv");
    expect(translate("Not a known text", undefined, "lv")).toBe("Not a known text");
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
    fireEvent.click(screen.getByRole("button", { name: "LV" }));
    expect(screen.getByRole("link", { name: /izmēģināt darba vietu/i })).toBeInTheDocument();
    expect(document.documentElement.lang).toBe("lv");
    expect(localStorage.getItem("legacylift.lang")).toBe("lv");
    act(() => fireEvent.click(screen.getByRole("button", { name: "EN" })));
  });

  it("runs the workspace in Latvian, down to the printed invoice", () => {
    renderAt("/app");
    fireEvent.click(screen.getAllByRole("button", { name: "LV" })[0]);
    fireEvent.click(screen.getByRole("button", { name: /ielādēt parauga uzņēmumu/i }));
    expect(screen.getByRole("heading", { name: /sia kalniņa galdniecība/i, level: 1 })).toBeInTheDocument();
    expect(screen.getByText(/nepieciešama uzmanība/i)).toBeInTheDocument();
    expect(screen.getAllByText(/kavējums/i).length).toBeGreaterThan(0);

    fireEvent.click(screen.getAllByRole("link", { name: /rēķini un piedāvājumi/i })[0]);
    fireEvent.click(screen.getByRole("link", { name: /RE-\d{4}-0045/ }));
    expect(screen.getByText("Maksātājs")).toBeInTheDocument();
    expect(screen.getAllByText("PVN 21%").length).toBeGreaterThan(0);
    expect(screen.getByText(/ozolkoka kāpnes, 14 pakāpieni/i)).toBeInTheDocument();
    act(() => fireEvent.click(screen.getAllByRole("button", { name: "EN" })[0]));
  });
});
