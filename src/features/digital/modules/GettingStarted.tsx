import { Link } from "react-router-dom";
import { ArrowRight, CheckCircle2, Circle } from "lucide-react";
import { useBase } from "../base";
import { useWorkspace } from "../store";
import type { WorkspaceState } from "../types";
import { Panel, btnPrimary } from "../components";

export interface SetupStep {
  id: string;
  title: string;
  text: string;
  path: string;
  cta: string;
  done: (s: WorkspaceState) => boolean;
}

/** The first things a firm does in LegacyLift, in order. Each step ticks itself off from the data. */
export const SETUP_STEPS: SetupStep[] = [
  {
    id: "details",
    title: "Add your business details",
    text: "Name, address and bank details. They are printed on every invoice.",
    path: "/settings",
    cta: "Open settings",
    done: (s) => Boolean(s.profile.businessName && s.profile.address && s.profile.bankDetails),
  },
  {
    id: "customer",
    title: "Add your first customer",
    text: "Type one in, or photograph an old customer card.",
    path: "/customers",
    cta: "Add a customer",
    done: (s) => s.customers.length > 0,
  },
  {
    id: "invoice",
    title: "Write your first invoice or quote",
    text: "Numbering, tax and totals are done for you.",
    path: "/invoices/new?kind=invoice",
    cta: "Write an invoice",
    done: (s) => s.invoices.length > 0,
  },
  {
    id: "digitize",
    title: "Digitize one paper document",
    text: "Photograph an invoice, order or contract. AI types it up for you to check.",
    path: "/digitize",
    cta: "Digitize paper",
    done: (s) => s.records.length > 0,
  },
];

export function setupProgress(s: WorkspaceState) {
  const done = SETUP_STEPS.filter((step) => step.done(s)).length;
  return { done, total: SETUP_STEPS.length, next: SETUP_STEPS.find((step) => !step.done(s)) ?? null };
}

const GettingStarted = () => {
  const { state } = useWorkspace();
  const base = useBase();
  const { done, total, next } = setupProgress(state);
  if (!next) return null;

  return (
    <Panel className="flex flex-col gap-4">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="font-heading text-lg font-semibold">Getting started</h2>
        <span className="text-xs text-muted-foreground">
          {done} of {total} done
        </span>
      </div>
      <ol className="grid gap-3 md:grid-cols-2">
        {SETUP_STEPS.map((step, i) => {
          const isDone = step.done(state);
          const isNext = step.id === next.id;
          return (
            <li
              key={step.id}
              className={`flex items-start gap-3 rounded-md border p-3 ${isNext ? "border-primary bg-accent/40" : "border-border"}`}
            >
              {isDone ? (
                <CheckCircle2 size={20} className="mt-0.5 shrink-0 text-ll-success" aria-label="Done" />
              ) : (
                <Circle size={20} className="mt-0.5 shrink-0 text-muted-foreground" aria-label="Not done yet" />
              )}
              <div className="flex-1 min-w-0">
                <p className={`text-sm font-medium ${isDone ? "text-muted-foreground line-through" : ""}`}>
                  <span className="font-mono text-muted-foreground mr-1.5">{i + 1}.</span>
                  {step.title}
                </p>
                {!isDone && <p className="text-xs text-muted-foreground mt-0.5">{step.text}</p>}
                {isNext && (
                  <Link to={`${base}${step.path}`} className={`${btnPrimary} mt-2 px-3 py-1.5 text-xs`}>
                    {step.cta} <ArrowRight size={14} aria-hidden="true" />
                  </Link>
                )}
              </div>
            </li>
          );
        })}
      </ol>
    </Panel>
  );
};

export default GettingStarted;
