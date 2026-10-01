import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { EMPTY_PROFILE, EMPTY_STATE, clientStorageKey, loadWorkspace, newId, toRecord } from "@/features/digital/store";
import { buildSampleData, SAMPLE_PROFILE, SAMPLE_RECORDS } from "@/features/digital/sample";
import { addDays, todayIso } from "@/features/digital/finance";
import type { WorkspaceState } from "@/features/digital/types";
import type { Client, OpsState } from "./types";

const OPS_KEY = "legacylift.ops.v1";

const EMPTY_OPS: OpsState = { version: 1, teamMember: "", clients: [] };

function loadOps(): OpsState {
  try {
    const raw = localStorage.getItem(OPS_KEY);
    if (!raw) return EMPTY_OPS;
    const data = JSON.parse(raw) as Partial<OpsState>;
    return { ...EMPTY_OPS, ...data, clients: (data.clients ?? []).map((c) => ({ ...c, manualDone: c.manualDone ?? [], log: c.log ?? [] })) };
  } catch {
    return EMPTY_OPS;
  }
}

export type NewClient = Omit<Client, "id" | "createdAt" | "manualDone" | "log">;

export interface OpsApi {
  /** "device": everything in this browser (demo). "cloud": shared with the team in Supabase. */
  mode: "device" | "cloud";
  ops: OpsState;
  setTeamMember: (name: string) => void;
  addClient: (c: NewClient) => Promise<Client>;
  /** The client's business data (customers, invoices, stock…). */
  workspaceOf: (id: string) => WorkspaceState;
  /** Replace a client's workspace, e.g. with a backup they sent. */
  replaceWorkspace: (id: string, data: WorkspaceState) => Promise<void>;
  /** Reload clients and their workspaces (after working inside a client's workspace). */
  refresh: () => Promise<void>;
  updateClient: (id: string, patch: Partial<Client>, logText?: string) => void;
  toggleTask: (id: string, taskId: string, label: string) => void;
  addNote: (id: string, text: string) => void;
  removeClient: (id: string) => void;
  loadExampleClients: () => void;
}

export const OpsContext = createContext<OpsApi | null>(null);

/** `seedExamples` fills an empty console with three example clients (used by demos and previews). */
export function OpsProvider({ children, seedExamples = false }: { children: ReactNode; seedExamples?: boolean }) {
  const [ops, setOps] = useState<OpsState>(loadOps);

  useEffect(() => {
    try {
      localStorage.setItem(OPS_KEY, JSON.stringify(ops));
    } catch {
      // storage blocked — keep working in memory
    }
  }, [ops]);

  const entry = useCallback(
    (text: string, at = new Date().toISOString()) => ({ id: newId(), at, text, author: ops.teamMember || undefined }),
    [ops.teamMember],
  );

  const setTeamMember = useCallback((name: string) => setOps((o) => ({ ...o, teamMember: name })), []);

  const addClient = useCallback(
    (c: NewClient) => {
      const client: Client = { ...c, id: newId(), createdAt: new Date().toISOString(), manualDone: [], log: [entry(`Client added (${c.stage})`)] };
      // Give the new workspace the firm's name so it is ready for the team to fill in.
      try {
        const ws: WorkspaceState = { ...EMPTY_STATE, profile: { ...EMPTY_PROFILE, businessName: c.firmName, email: c.email, phone: c.phone } };
        localStorage.setItem(clientStorageKey(client.id), JSON.stringify(ws));
      } catch {
        // ignore — the workspace starts empty instead
      }
      setOps((o) => ({ ...o, clients: [client, ...o.clients] }));
      return Promise.resolve(client);
    },
    [entry],
  );

  const updateClient = useCallback(
    (id: string, patch: Partial<Client>, logText?: string) =>
      setOps((o) => ({
        ...o,
        clients: o.clients.map((c) => (c.id === id ? { ...c, ...patch, log: logText ? [entry(logText), ...c.log] : c.log } : c)),
      })),
    [entry],
  );

  const toggleTask = useCallback(
    (id: string, taskId: string, label: string) =>
      setOps((o) => ({
        ...o,
        clients: o.clients.map((c) => {
          if (c.id !== id) return c;
          const done = c.manualDone.includes(taskId);
          return {
            ...c,
            manualDone: done ? c.manualDone.filter((t) => t !== taskId) : [...c.manualDone, taskId],
            log: [entry(done ? `Reopened: ${label}` : `Done: ${label}`), ...c.log],
          };
        }),
      })),
    [entry],
  );

  const addNote = useCallback(
    (id: string, text: string) => setOps((o) => ({ ...o, clients: o.clients.map((c) => (c.id === id ? { ...c, log: [entry(text), ...c.log] } : c)) })),
    [entry],
  );

  const removeClient = useCallback((id: string) => {
    try {
      localStorage.removeItem(clientStorageKey(id));
    } catch {
      // ignore
    }
    setOps((o) => ({ ...o, clients: o.clients.filter((c) => c.id !== id) }));
  }, []);

  const loadExampleClients = useCallback(() => {
    const today = todayIso();
    const at = (daysAgo: number) => new Date(`${addDays(today, -daysAgo)}T10:00:00Z`).toISOString();
    const make = (c: Omit<Client, "id" | "createdAt" | "log">, created: number, log: string[]): Client => ({
      ...c,
      id: newId(),
      createdAt: at(created),
      log: log.map((text, i) => ({ id: newId(), at: at(Math.max(0, created - i * 7)), text, author: "Team" })).reverse(),
    });

    const hartmann = make(
      { firmName: "Hartmann & Söhne Joinery", contactName: "Klaus Hartmann", email: SAMPLE_PROFILE.email, phone: SAMPLE_PROFILE.phone, industry: "Joinery", city: "Köln", package: "suite", stage: "active", owner: "Team", notes: "Third generation. Klaus prefers calls before 9am.", manualDone: ["kickoff", "training"] },
      60,
      ["Client added (lead)", "Kick-off call held", "Staff training done with 4 people", "Moved to active"],
    );
    const bakery = make(
      { firmName: "Bäckerei Lindner", contactName: "Maria Lindner", email: "maria@baeckerei-lindner.example", phone: "+49 30 555 0199", industry: "Bakery, 3 shops", city: "Berlin", package: "start", stage: "onboarding", owner: "Team", notes: "Invoices for café customers are still handwritten.", manualDone: ["kickoff"] },
      12,
      ["Client added (lead)", "Kick-off call held"],
    );
    const printer = make(
      { firmName: "Druckerei Voss & Co.", contactName: "Peter Voss", email: "p.voss@druckerei-voss.example", phone: "+49 40 555 0123", industry: "Print shop", city: "Hamburg", package: "partner", stage: "lead", owner: "Team", notes: "Interested in AI for quotes. Demo booked.", manualDone: [] },
      3,
      ["Client added (lead)"],
    );

    try {
      const sample = buildSampleData(newId, today);
      localStorage.setItem(
        clientStorageKey(hartmann.id),
        JSON.stringify({ ...EMPTY_STATE, profile: SAMPLE_PROFILE, ...sample, records: SAMPLE_RECORDS.map((r) => toRecord(r, "sample")) }),
      );
      localStorage.setItem(
        clientStorageKey(bakery.id),
        JSON.stringify({ ...EMPTY_STATE, profile: { ...EMPTY_PROFILE, businessName: bakery.firmName, email: bakery.email, phone: bakery.phone, currency: "EUR", defaultTaxRate: 7 } }),
      );
      localStorage.setItem(clientStorageKey(printer.id), JSON.stringify({ ...EMPTY_STATE, profile: { ...EMPTY_PROFILE, businessName: printer.firmName } }));
    } catch {
      // storage blocked — clients still appear with empty workspaces
    }
    setOps((o) => ({ ...o, clients: [...o.clients, hartmann, bakery, printer] }));
  }, []);

  useEffect(() => {
    if (seedExamples && ops.clients.length === 0) loadExampleClients();
    // run once on mount
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const [tick, setTick] = useState(0);
  const workspaceOf = useCallback(
    (id: string) => loadWorkspace(clientStorageKey(id)),
    // re-read after refresh/replace
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [tick],
  );
  const replaceWorkspace = useCallback(async (id: string, data: WorkspaceState) => {
    localStorage.setItem(clientStorageKey(id), JSON.stringify(data));
    setTick((n) => n + 1);
  }, []);
  const refresh = useCallback(async () => setTick((n) => n + 1), []);

  const api = useMemo<OpsApi>(
    () => ({
      mode: "device",
      ops,
      setTeamMember,
      addClient,
      workspaceOf,
      replaceWorkspace,
      refresh,
      updateClient,
      toggleTask,
      addNote,
      removeClient,
      loadExampleClients,
    }),
    [ops, setTeamMember, addClient, workspaceOf, replaceWorkspace, refresh, updateClient, toggleTask, addNote, removeClient, loadExampleClients],
  );

  return <OpsContext.Provider value={api}>{children}</OpsContext.Provider>;
}

export function useOps() {
  const ctx = useContext(OpsContext);
  if (!ctx) throw new Error("useOps must be used inside OpsProvider");
  return ctx;
}
