import { useState } from "react";
import { useLocation } from "react-router-dom";
import { Copy, Loader2, PenLine } from "lucide-react";
import { toast } from "sonner";
import { writeDraft } from "../ai";
import { useWorkspace } from "../store";
import { DemoNotice, PageHeader, Panel, btnGhost, btnPrimary, fieldClass } from "../components";
import { msg, useT } from "@/i18n";

const TEMPLATES = [
  { label: msg("Payment reminder"), kind: "email", audience: msg("customer"), notes: msg("Friendly reminder that invoice #1047 (€8,450) was due on 13 September. Offer bank transfer or card payment link.") },
  { label: msg("Quote"), kind: "quote letter", audience: msg("customer"), notes: msg("Quote for a built-in oak wardrobe, 2.4m wide, delivery in 6 weeks, €4,800 incl. installation. Valid 30 days.") },
  { label: msg("Reply to enquiry"), kind: "email", audience: msg("prospective customer"), notes: msg("Thank them for the enquiry about a staircase, ask for measurements and photos, propose a site visit next week.") },
  { label: msg("Supplier request"), kind: "email", audience: msg("supplier"), notes: msg("Ask for updated prices on kiln-dried oak and beech for Q4 and whether delivery can move to Tuesdays.") },
  { label: msg("Announce going digital"), kind: "letter", audience: msg("long-standing customers"), notes: msg("We now send invoices by email and accept online payment. Paper invoices still available on request. Thank them for their loyalty.") },
];

const Writer = () => {
  const t = useT();
  const { state } = useWorkspace();
  const location = useLocation();
  const prefill = location.state as { kind?: string; audience?: string; tone?: string; notes?: string } | null;
  const [form, setForm] = useState({ kind: "email", audience: t("customer"), tone: "friendly", notes: "", ...(prefill ?? {}) });
  const [output, setOutput] = useState("");
  const [busy, setBusy] = useState(false);
  const [demo, setDemo] = useState(false);

  async function generate() {
    setBusy(true);
    try {
      const { value, demo: isDemo } = await writeDraft(form, state.profile.businessName);
      setOutput(value);
      setDemo(isDemo);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t("The draft couldn't be written. Please try again."));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="max-w-5xl">
      <PageHeader
        eyebrow="AI"
        title={t("AI writer")}
        description={t("Describe what you want to say in a few words — AI writes the email, letter or quote in a professional voice. Always read it before sending.")}
      />

      <div className="flex flex-wrap gap-2 mb-4">
        {TEMPLATES.map((tpl) => (
          <button
            key={tpl.label}
            type="button"
            className={btnGhost}
            onClick={() => setForm((f) => ({ ...f, kind: tpl.kind, audience: t(tpl.audience), notes: t(tpl.notes) }))}
          >
            {t(tpl.label)}
          </button>
        ))}
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Panel>
          <form
            className="flex flex-col gap-3"
            onSubmit={(e) => {
              e.preventDefault();
              generate();
            }}
          >
            <div className="grid gap-3 sm:grid-cols-3">
              <label className="text-xs text-muted-foreground">
                {t("Type")}
                <select className={fieldClass} value={form.kind} onChange={(e) => setForm({ ...form, kind: e.target.value })}>
                  {["email", "letter", "quote letter", "social media post", "website text"].map((k) => (
                    <option key={k} value={k}>
                      {t(k)}
                    </option>
                  ))}
                </select>
              </label>
              <label className="text-xs text-muted-foreground">
                {t("For")}
                <input className={fieldClass} value={form.audience} onChange={(e) => setForm({ ...form, audience: e.target.value })} />
              </label>
              <label className="text-xs text-muted-foreground">
                {t("Tone")}
                <select className={fieldClass} value={form.tone} onChange={(e) => setForm({ ...form, tone: e.target.value })}>
                  {["friendly", "formal", "firm but polite", "warm and personal"].map((tone) => (
                    <option key={tone} value={tone}>
                      {t(tone)}
                    </option>
                  ))}
                </select>
              </label>
            </div>
            <label className="text-xs text-muted-foreground">
              {t("What should it say?")}
              <textarea
                rows={8}
                className={fieldClass}
                placeholder={t("Key points, names, amounts, dates…")}
                value={form.notes}
                onChange={(e) => setForm({ ...form, notes: e.target.value })}
              />
            </label>
            <div>
              <button type="submit" className={btnPrimary} disabled={busy || !form.notes.trim()}>
                {busy ? <Loader2 size={16} className="animate-spin" aria-hidden="true" /> : <PenLine size={16} aria-hidden="true" />}
                {busy ? t("Writing…") : t("Write it")}
              </button>
            </div>
          </form>
        </Panel>

        <Panel className="flex flex-col gap-3">
          <div className="flex items-center justify-between">
            <h2 className="font-heading font-semibold">{t("Draft")}</h2>
            <button
              type="button"
              className={btnGhost}
              disabled={!output}
              onClick={() =>
                navigator.clipboard.writeText(output).then(
                  () => toast.success(t("Copied")),
                  () => toast.error(t("Copy was blocked — select the text and copy it manually.")),
                )
              }
            >
              <Copy size={16} aria-hidden="true" /> {t("Copy")}
            </button>
          </div>
          <DemoNotice show={demo} />
          <label htmlFor="draft-output" className="sr-only">
            {t("Generated draft")}
          </label>
          <textarea
            id="draft-output"
            rows={14}
            className={`${fieldClass} flex-1 font-body`}
            value={output}
            placeholder={t("Your draft will appear here. You can edit it before copying.")}
            onChange={(e) => setOutput(e.target.value)}
          />
        </Panel>
      </div>
    </div>
  );
};

export default Writer;
