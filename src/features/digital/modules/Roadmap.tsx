import { useState } from "react";
import { CheckSquare, Loader2, RefreshCw, Sparkles, Square } from "lucide-react";
import { toast } from "sonner";
import { buildRoadmap } from "../ai";
import { useWorkspace } from "../store";
import type { Assessment } from "../types";
import { DemoNotice, PageHeader, Panel, btnGhost, btnPrimary, fieldClass } from "../components";

const QUESTIONS: { key: keyof Assessment; label: string; placeholder: string; long?: boolean }[] = [
  { key: "industry", label: "What does your firm do?", placeholder: "e.g. Joinery making custom furniture and staircases" },
  { key: "employees", label: "How many people work there?", placeholder: "e.g. 12" },
  { key: "yearsInBusiness", label: "How long have you been in business?", placeholder: "e.g. 60 years, third generation" },
  { key: "recordKeeping", label: "How do you keep records today?", placeholder: "e.g. Paper binders, some Excel sheets" },
  { key: "invoicing", label: "How do you write and send invoices?", placeholder: "e.g. Word template, printed and posted" },
  { key: "customerComms", label: "How do customers reach you?", placeholder: "e.g. Phone, walk-ins, a little email" },
  { key: "inventory", label: "How do you track stock or materials?", placeholder: "e.g. The foreman checks the shelves" },
  { key: "onlinePresence", label: "What is your online presence?", placeholder: "e.g. Old website from 2010, no social media" },
  { key: "painPoints", label: "What takes too much time or goes wrong?", placeholder: "e.g. Chasing payments, finding old quotes", long: true },
  { key: "budget", label: "Monthly budget for software?", placeholder: "e.g. Up to €200 / month" },
];

const EMPTY: Assessment = {
  industry: "",
  employees: "",
  yearsInBusiness: "",
  recordKeeping: "",
  invoicing: "",
  customerComms: "",
  inventory: "",
  onlinePresence: "",
  painPoints: "",
  budget: "",
};

const RoadmapModule = () => {
  const { state, update } = useWorkspace();
  const [answers, setAnswers] = useState<Assessment>(state.assessment ?? EMPTY);
  const [busy, setBusy] = useState(false);
  const [demo, setDemo] = useState(false);
  const [editing, setEditing] = useState(!state.roadmap);

  const answered = Object.values(answers).filter((v) => v.trim()).length;

  async function generate() {
    setBusy(true);
    try {
      const { value, demo: isDemo } = await buildRoadmap(answers, state.profile.businessName);
      update({ assessment: answers, roadmap: value, roadmapDone: [] });
      setDemo(isDemo);
      setEditing(false);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "The roadmap couldn't be built. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  const toggle = (id: string) =>
    update({
      roadmapDone: state.roadmapDone.includes(id) ? state.roadmapDone.filter((x) => x !== id) : [...state.roadmapDone, id],
    });

  const roadmap = state.roadmap;

  return (
    <div className="max-w-5xl">
      <PageHeader
        eyebrow="AI"
        title="Digital roadmap"
        description="Answer ten questions about how your firm works today. AI scores your digital maturity and builds a practical, phased plan — keeping what already works."
        actions={
          roadmap &&
          !editing && (
            <button type="button" className={btnGhost} onClick={() => setEditing(true)}>
              <RefreshCw size={16} aria-hidden="true" /> Redo assessment
            </button>
          )
        }
      />

      {editing && (
        <Panel className="mb-8">
          <form
            className="grid gap-4 md:grid-cols-2"
            onSubmit={(e) => {
              e.preventDefault();
              generate();
            }}
          >
            {QUESTIONS.map((q) => (
              <label key={q.key} className={`text-sm ${q.long ? "md:col-span-2" : ""}`}>
                <span className="block mb-1 font-semibold">{q.label}</span>
                {q.long ? (
                  <textarea
                    rows={3}
                    className={fieldClass}
                    placeholder={q.placeholder}
                    value={answers[q.key]}
                    onChange={(e) => setAnswers({ ...answers, [q.key]: e.target.value })}
                  />
                ) : (
                  <input
                    className={fieldClass}
                    placeholder={q.placeholder}
                    value={answers[q.key]}
                    onChange={(e) => setAnswers({ ...answers, [q.key]: e.target.value })}
                  />
                )}
              </label>
            ))}
            <div className="md:col-span-2 flex items-center gap-3">
              <button type="submit" className={btnPrimary} disabled={busy || answered < 4}>
                {busy ? <Loader2 size={16} className="animate-spin" aria-hidden="true" /> : <Sparkles size={16} aria-hidden="true" />}
                {busy ? "Building your roadmap…" : "Build my roadmap"}
              </button>
              <span className="text-xs text-muted-foreground">{answered}/10 answered (at least 4)</span>
            </div>
          </form>
        </Panel>
      )}

      {roadmap && !editing && (
        <div className="flex flex-col gap-6">
          <DemoNotice show={demo} />
          <Panel className="flex flex-col gap-4 sm:flex-row sm:items-center">
            <div
              className="shrink-0 h-24 w-24 rounded-full border-4 border-primary inline-flex flex-col items-center justify-center"
              aria-label={`Digital maturity score ${roadmap.score} out of 100`}
            >
              <span className="font-heading text-3xl font-bold">{roadmap.score}</span>
              <span className="text-[10px] uppercase tracking-wide text-muted-foreground">/ 100</span>
            </div>
            <p className="font-heading text-lg">{roadmap.headline}</p>
          </Panel>

          <div className="grid gap-4 md:grid-cols-3">
            {[
              { title: "Strengths to keep", items: roadmap.strengths },
              { title: "Risks today", items: roadmap.risks },
              { title: "Quick wins this month", items: roadmap.quickWins },
            ].map((b) => (
              <Panel key={b.title}>
                <h2 className="font-heading font-semibold mb-2">{b.title}</h2>
                <ul className="list-disc pl-5 text-sm space-y-1 text-foreground/90">
                  {b.items.map((x, i) => (
                    <li key={i}>{x}</li>
                  ))}
                </ul>
              </Panel>
            ))}
          </div>

          <ol className="flex flex-col gap-4">
            {roadmap.phases.map((p, pi) => (
              <li key={pi}>
                <Panel>
                  <div className="flex flex-col gap-1 sm:flex-row sm:items-baseline sm:justify-between mb-2">
                    <h2 className="font-heading text-lg font-semibold">
                      <span className="text-primary">Phase {pi + 1}:</span> {p.name}
                    </h2>
                    <span className="text-xs text-muted-foreground">
                      {p.timeframe} · {p.estimatedCost}
                    </span>
                  </div>
                  <p className="text-sm text-muted-foreground mb-3">{p.goal}</p>
                  <ul className="flex flex-col gap-1 mb-3">
                    {p.actions.map((a, ai) => {
                      const id = `${pi}:${ai}`;
                      const done = state.roadmapDone.includes(id);
                      return (
                        <li key={ai}>
                          <button
                            type="button"
                            role="checkbox"
                            aria-checked={done}
                            onClick={() => toggle(id)}
                            className="flex items-start gap-2 text-left text-sm rounded py-1 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                          >
                            {done ? (
                              <CheckSquare size={18} className="text-primary shrink-0" aria-hidden="true" />
                            ) : (
                              <Square size={18} className="text-muted-foreground shrink-0" aria-hidden="true" />
                            )}
                            <span className={done ? "line-through text-muted-foreground" : ""}>{a}</span>
                          </button>
                        </li>
                      );
                    })}
                  </ul>
                  <div className="flex flex-wrap gap-1 mb-3">
                    {p.tools.map((t) => (
                      <span key={t} className="rounded-full bg-secondary px-2 py-0.5 text-xs">
                        {t}
                      </span>
                    ))}
                  </div>
                  <p className="text-sm flex gap-2">
                    <Sparkles size={16} className="text-primary shrink-0 mt-0.5" aria-hidden="true" />
                    <span>{p.aiOpportunity}</span>
                  </p>
                </Panel>
              </li>
            ))}
          </ol>
        </div>
      )}
    </div>
  );
};

export default RoadmapModule;
