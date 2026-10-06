import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import type {
  BusinessProfile,
  BusinessRecord,
  ExtractedRecord,
  WorkspaceState,
} from "./types";
import { buildSampleData, sampleProfile, sampleRecords } from "./sample";
import { mergeWorkspaces } from "./merge";
import { translate as tr, useT } from "@/i18n";

const STORAGE_KEY = "legacylift.workspace.v1";

/** Storage key for a client workspace managed from the internal console. */
export const clientStorageKey = (clientId: string) => `legacylift.client.${clientId}.workspace`;

export const EMPTY_PROFILE: BusinessProfile = {
  businessName: "",
  ownerName: "",
  address: "",
  email: "",
  phone: "",
  taxId: "",
  bankDetails: "",
  currency: "EUR",
  defaultTaxRate: 21, // standard VAT in Latvia and Lithuania
  paymentTermsDays: 14,
  invoicePrefix: "INV",
  quotePrefix: "QUO",
  invoiceFooter: "",
};

export const EMPTY_STATE: WorkspaceState = {
  version: 2,
  profile: EMPTY_PROFILE,
  customers: [],
  invoices: [],
  stock: [],
  records: [],
  assessment: null,
  roadmap: null,
  roadmapDone: [],
  chat: [],
};

const arr = <T,>(v: unknown): T[] => (Array.isArray(v) ? (v as T[]) : []);
const obj = (v: unknown): Record<string, unknown> => (v && typeof v === "object" && !Array.isArray(v) ? (v as Record<string, unknown>) : {});

/** True when a parsed file looks like a LegacyLift workspace backup. */
export function isWorkspaceBackup(raw: unknown): boolean {
  const data = obj(raw);
  const lists = ["customers", "invoices", "stock", "records"];
  const hasList = lists.some((k) => Array.isArray(data[k]));
  const badList = lists.some((k) => k in data && !Array.isArray(data[k]));
  const hasProfile = typeof obj(data.profile).businessName === "string" || typeof data.businessName === "string";
  return (hasList || hasProfile) && !badList;
}

/** Accepts anything previously saved (including v1, which had a top-level businessName); bad fields become empty. */
export function migrate(raw: unknown): WorkspaceState {
  const data = obj(raw);
  const profile = { ...EMPTY_PROFILE, ...(obj(data.profile) as Partial<BusinessProfile>) };
  if (!profile.businessName && typeof data.businessName === "string") profile.businessName = data.businessName;
  return {
    version: 2,
    profile,
    customers: arr(data.customers),
    invoices: arr(data.invoices),
    stock: arr(data.stock),
    records: arr(data.records),
    assessment: (data.assessment as WorkspaceState["assessment"]) ?? null,
    roadmap: (data.roadmap as WorkspaceState["roadmap"]) ?? null,
    roadmapDone: arr<string>(data.roadmapDone),
    chat: arr(data.chat),
  };
}

export function loadWorkspace(storageKey = STORAGE_KEY): WorkspaceState {
  try {
    const raw = localStorage.getItem(storageKey);
    return raw ? migrate(JSON.parse(raw)) : EMPTY_STATE;
  } catch {
    return EMPTY_STATE;
  }
}

export function newId() {
  return typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

export function toRecord(extracted: ExtractedRecord, source: string): BusinessRecord {
  return { ...extracted, id: newId(), createdAt: new Date().toISOString(), source, status: "open" };
}

type Collection = "customers" | "invoices" | "stock" | "records";
type ItemOf<K extends Collection> = WorkspaceState[K][number];

/** Where a workspace lives when it isn't only on this device (e.g. the Supabase database). */
export interface Persistence {
  load(): Promise<{ state: WorkspaceState; version: number }>;
  /** Save if nobody else saved since `version`; returns the new version or "conflict". */
  save(state: WorkspaceState, version: number): Promise<number | "conflict">;
  /** Optional live updates: call back with the new version when someone else saves. */
  watch?(onRemote: (version: number) => void): () => void;
}

export type SyncStatus = "device" | "loading" | "load-error" | "saved" | "saving" | "error";

export interface SyncInfo {
  status: SyncStatus;
  error: string | null;
  retry: () => void;
  /** Save any pending change right now (e.g. before signing out or switching business). */
  flushNow: () => Promise<void>;
}

interface WorkspaceApi {
  state: WorkspaceState;
  sync: SyncInfo;
  /** Apply a patch, or a function returning a patch computed from the latest state. */
  update: (patch: Partial<WorkspaceState> | ((s: WorkspaceState) => Partial<WorkspaceState>)) => void;
  setProfile: (patch: Partial<BusinessProfile>) => void;
  upsert: <K extends Collection>(collection: K, item: ItemOf<K>) => void;
  patchItem: <K extends Collection>(collection: K, id: string, patch: Partial<ItemOf<K>>) => void;
  remove: (collection: Collection, id: string) => void;
  loadSampleData: () => void;
  replaceAll: (next: WorkspaceState) => void;
  reset: () => void;
}

const WorkspaceContext = createContext<WorkspaceApi | null>(null);

const SAVE_DELAY_MS = 800;
const RETRY_DELAY_MS = 5000;

export function WorkspaceProvider({
  children,
  storageKey = STORAGE_KEY,
  persistence,
}: {
  children: ReactNode;
  storageKey?: string;
  /** When given, the workspace is loaded from and saved to it instead of this device. */
  persistence?: Persistence;
}) {
  const [state, setState] = useState<WorkspaceState>(() => (persistence ? EMPTY_STATE : loadWorkspace(storageKey)));
  const [status, setStatus] = useState<SyncStatus>(persistence ? "loading" : "device");
  const [error, setError] = useState<string | null>(null);
  const [loadAttempt, setLoadAttempt] = useState(0);

  // Device-only mode: keep a copy in this browser.
  useEffect(() => {
    if (persistence) return;
    try {
      localStorage.setItem(storageKey, JSON.stringify(state));
    } catch {
      // storage full or blocked — keep working in memory
    }
  }, [state, storageKey, persistence]);

  // Cloud mode bookkeeping, kept in refs so timers always see the latest values.
  const stateRef = useRef(state);
  stateRef.current = state;
  const versionRef = useRef(0);
  const savedJsonRef = useRef<string | null>(null); // what the server has, as JSON
  const inFlightRef = useRef(false);
  const timerRef = useRef<ReturnType<typeof setTimeout>>();
  const loadedRef = useRef(false);

  const applyRemote = useCallback((loaded: { state: WorkspaceState; version: number }) => {
    versionRef.current = loaded.version;
    savedJsonRef.current = JSON.stringify(loaded.state);
    stateRef.current = loaded.state; // before the re-render, so a running save doesn't resend the old state
    setState(loaded.state);
  }, []);

  const flush = useCallback(async () => {
    if (!persistence || !loadedRef.current) return;
    if (inFlightRef.current) return; // the running save re-checks when it finishes
    const snapshot = stateRef.current;
    const json = JSON.stringify(snapshot);
    if (json === savedJsonRef.current) {
      setStatus("saved");
      return;
    }
    inFlightRef.current = true;
    setStatus("saving");
    try {
      const result = await persistence.save(snapshot, versionRef.current);
      if (result === "conflict") {
        // Someone else saved first: combine their changes with ours, then save the combination.
        const remote = await persistence.load();
        const base = savedJsonRef.current ? (JSON.parse(savedJsonRef.current) as WorkspaceState) : remote.state;
        const { merged, clashes } = mergeWorkspaces(base, stateRef.current, remote.state);
        applyRemote(remote);
        stateRef.current = merged;
        setState(merged);
        if (clashes > 0) {
          toast.warning(tr("Someone else changed the same item at the same time. Your version was kept — please check it."));
        } else {
          toast.message(tr("Combined your changes with someone else's."));
        }
      } else {
        versionRef.current = result;
        savedJsonRef.current = json;
      }
      setError(null);
      inFlightRef.current = false;
      if (JSON.stringify(stateRef.current) !== savedJsonRef.current) void flush();
      else setStatus("saved");
    } catch (err) {
      inFlightRef.current = false;
      setError(err instanceof Error ? err.message : tr("Couldn't save"));
      setStatus("error");
      clearTimeout(timerRef.current);
      timerRef.current = setTimeout(() => void flush(), RETRY_DELAY_MS);
    }
  }, [persistence, applyRemote]);

  // Load once (and again on "Try again").
  useEffect(() => {
    if (!persistence) return;
    let cancelled = false;
    loadedRef.current = false;
    setStatus("loading");
    persistence
      .load()
      .then((loaded) => {
        if (cancelled) return;
        applyRemote(loaded);
        loadedRef.current = true;
        setError(null);
        setStatus("saved");
      })
      .catch((err) => {
        if (cancelled) return;
        setError(err instanceof Error ? err.message : tr("Couldn't load the workspace"));
        setStatus("load-error");
      });
    return () => {
      cancelled = true;
    };
  }, [persistence, applyRemote, loadAttempt]);

  // Save a moment after each change.
  useEffect(() => {
    if (!persistence || !loadedRef.current) return;
    if (JSON.stringify(state) === savedJsonRef.current) return;
    setStatus((s) => (s === "error" ? s : "saving"));
    clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => void flush(), SAVE_DELAY_MS);
  }, [state, persistence, flush]);

  // Someone else saved: take their version if we have nothing unsaved (otherwise our save resolves it).
  useEffect(() => {
    if (!persistence?.watch) return;
    return persistence.watch((version) => {
      if (!loadedRef.current || version <= versionRef.current || inFlightRef.current) return;
      if (JSON.stringify(stateRef.current) !== savedJsonRef.current) return;
      persistence
        .load()
        .then((loaded) => {
          if (loaded.version > versionRef.current && JSON.stringify(stateRef.current) === savedJsonRef.current) {
            applyRemote(loaded);
            toast.message(tr("Updated with the latest changes."));
          }
        })
        .catch(() => undefined);
    });
  }, [persistence, applyRemote]);

  // Warn before leaving with unsaved changes; save straight away when the tab is hidden.
  useEffect(() => {
    if (!persistence) return;
    const beforeUnload = (e: BeforeUnloadEvent) => {
      if (loadedRef.current && JSON.stringify(stateRef.current) !== savedJsonRef.current) e.preventDefault();
    };
    const hidden = () => {
      if (document.visibilityState === "hidden") void flush();
    };
    window.addEventListener("beforeunload", beforeUnload);
    document.addEventListener("visibilitychange", hidden);
    return () => {
      window.removeEventListener("beforeunload", beforeUnload);
      document.removeEventListener("visibilitychange", hidden);
      clearTimeout(timerRef.current);
      // Leaving this workspace (switching business, going back to the console): save what's pending.
      if (loadedRef.current && JSON.stringify(stateRef.current) !== savedJsonRef.current) void flush();
    };
  }, [persistence, flush]);

  const retry = useCallback(() => {
    if (status === "load-error") setLoadAttempt((n) => n + 1);
    else void flush();
  }, [status, flush]);
  const flushNow = useCallback(async () => {
    clearTimeout(timerRef.current);
    await flush();
    // wait for a save that was already running
    for (let i = 0; i < 50 && inFlightRef.current; i++) await new Promise((r) => setTimeout(r, 100));
  }, [flush]);
  const sync = useMemo(() => ({ status, error, retry, flushNow }), [status, error, retry, flushNow]);

  const update = useCallback(
    (patch: Partial<WorkspaceState> | ((s: WorkspaceState) => Partial<WorkspaceState>)) =>
      setState((s) => ({ ...s, ...(typeof patch === "function" ? patch(s) : patch) })),
    [],
  );
  const setProfile = useCallback(
    (patch: Partial<BusinessProfile>) => setState((s) => ({ ...s, profile: { ...s.profile, ...patch } })),
    [],
  );
  const upsert = useCallback(<K extends Collection>(collection: K, item: ItemOf<K>) => {
    setState((s) => {
      const list = s[collection] as ItemOf<K>[];
      const exists = list.some((x) => x.id === item.id);
      const next = exists ? list.map((x) => (x.id === item.id ? item : x)) : [item, ...list];
      return { ...s, [collection]: next };
    });
  }, []);
  const patchItem = useCallback(<K extends Collection>(collection: K, id: string, patch: Partial<ItemOf<K>>) => {
    setState((s) => ({
      ...s,
      [collection]: (s[collection] as ItemOf<K>[]).map((x) => (x.id === id ? { ...x, ...patch } : x)),
    }));
  }, []);
  const remove = useCallback((collection: Collection, id: string) => {
    setState((s) => ({ ...s, [collection]: (s[collection] as { id: string }[]).filter((x) => x.id !== id) }));
  }, []);
  const loadSampleData = useCallback(() => {
    setState((s) => {
      const sample = buildSampleData(newId);
      return {
        ...s,
        profile: s.profile.businessName ? s.profile : sampleProfile(),
        customers: [...sample.customers, ...s.customers],
        invoices: [...sample.invoices, ...s.invoices],
        stock: [...sample.stock, ...s.stock],
        records: [...sampleRecords().map((r) => toRecord(r, "sample")), ...s.records],
      };
    });
  }, []);
  const replaceAll = useCallback((next: WorkspaceState) => setState(migrate(next)), []);
  const reset = useCallback(() => setState(EMPTY_STATE), []);

  const api = useMemo(
    () => ({ state, sync, update, setProfile, upsert, patchItem, remove, loadSampleData, replaceAll, reset }),
    [state, sync, update, setProfile, upsert, patchItem, remove, loadSampleData, replaceAll, reset],
  );

  if (status === "loading" || status === "load-error") {
    return <WorkspaceStatus status={status} error={error} retry={retry} />;
  }

  return <WorkspaceContext.Provider value={api}>{children}</WorkspaceContext.Provider>;
}

function WorkspaceStatus({ status, error, retry }: { status: string; error: string | null; retry: () => void }) {
  const t = useT();
  return (
    <div className="theme-legacylift min-h-screen flex items-center justify-center p-6">
      {status === "loading" ? (
        <p role="status" className="flex items-center gap-2 text-muted-foreground">
          <Loader2 className="animate-spin" size={18} aria-hidden="true" /> {t("Opening your workspace…")}
        </p>
      ) : (
        <div role="alert" className="max-w-md rounded-lg border border-border bg-card p-6 text-center flex flex-col gap-3">
          <p className="font-heading text-lg font-semibold">{t("We couldn't open this workspace")}</p>
          <p className="text-sm text-muted-foreground">{error}</p>
          <button
            type="button"
            onClick={retry}
            className="self-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            {t("Try again")}
          </button>
        </div>
      )}
    </div>
  );
}

export function useWorkspace() {
  const ctx = useContext(WorkspaceContext);
  if (!ctx) throw new Error("useWorkspace must be used inside WorkspaceProvider");
  return ctx;
}

const csvEscape = (v: unknown) => {
  const s = v === null || v === undefined ? "" : String(v);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};

export function toCsv(header: string[], rows: unknown[][]): string {
  return [header.map(csvEscape).join(","), ...rows.map((r) => r.map(csvEscape).join(","))].join("\n");
}

export function recordsToCsv(records: BusinessRecord[]): string {
  return toCsv(
    ["Type", "Title", "Party", "Date", "Amount", "Currency", "Status", "Tags", "Summary", "Source"],
    records.map((r) => [r.docType, r.title, r.party, r.date, r.amount, r.currency, r.status, r.tags.join("; "), r.summary, r.source]),
  );
}

