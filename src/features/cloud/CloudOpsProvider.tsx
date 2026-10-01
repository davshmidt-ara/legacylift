import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { EMPTY_STATE, newId, toRecord } from "@/features/digital/store";
import { buildSampleData, SAMPLE_PROFILE, SAMPLE_RECORDS } from "@/features/digital/sample";
import type { WorkspaceState } from "@/features/digital/types";
import { OpsContext, type NewClient, type OpsApi } from "@/features/ops/store";
import type { Client, OpsState } from "@/features/ops/types";
import * as api from "./api";
import { useAuth } from "./auth";

const report = (err: unknown) => toast.error(err instanceof Error ? err.message : "Something went wrong. Please try again.");

/** The operations console backed by Supabase: every team member sees the same clients. */
export function CloudOpsProvider({ children }: { children: ReactNode }) {
  const auth = useAuth();
  const [clients, setClients] = useState<Client[] | null>(null);
  const [workspaces, setWorkspaces] = useState<Record<string, api.LoadedWorkspace>>({});
  const [loadError, setLoadError] = useState<string | null>(null);
  const author = auth.staff?.displayName || auth.email;

  const inFlight = useRef<Promise<void> | null>(null);
  const refresh = useCallback(() => {
    // Opening the console triggers a load from here and from the layout; share one request.
    if (!inFlight.current) inFlight.current = doRefresh().finally(() => (inFlight.current = null));
    return inFlight.current;
  }, []);
  async function doRefresh() {
    try {
      const [list, ws] = await Promise.all([api.listClients(), api.allWorkspaces()]);
      setClients(list);
      setWorkspaces(ws);
      setLoadError(null);
    } catch (err) {
      setLoadError(err instanceof Error ? err.message : "Couldn't load clients.");
    }
  }

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const withLog = useCallback(
    async (id: string, text: string) => {
      const entry = await api.addLog(id, text, author);
      setClients((list) => list?.map((c) => (c.id === id ? { ...c, log: [entry, ...c.log] } : c)) ?? list);
    },
    [author],
  );

  const setTeamMember = useCallback(
    (name: string) => {
      const userId = auth.session?.user.id;
      if (!userId) return;
      void supabase
        .from("staff")
        .update({ display_name: name })
        .eq("user_id", userId)
        .then(({ error }) => error && report(error));
    },
    [auth.session],
  );

  const addClient = useCallback(
    async (c: NewClient) => {
      const created = await api.createClient(c);
      // The client exists now; a failed log entry must not make it look like creating failed.
      const entry = await api.addLog(created.id, `Client added (${c.stage})`, author).catch(() => null);
      const client = { ...created, log: entry ? [entry] : [] };
      setClients((list) => [client, ...(list ?? [])]);
      const ws = await api.fetchWorkspace(created.id).catch(() => null);
      if (ws) setWorkspaces((m) => ({ ...m, [created.id]: ws }));
      return client;
    },
    [author],
  );

  const updateClient = useCallback(
    (id: string, patch: Partial<Client>, logText?: string) => {
      setClients((list) => list?.map((c) => (c.id === id ? { ...c, ...patch } : c)) ?? list);
      api
        .updateClientRow(id, patch)
        .then(() => (logText ? withLog(id, logText) : undefined))
        .catch((err) => {
          report(err);
          void refresh();
        });
    },
    [withLog, refresh],
  );

  const toggleTask = useCallback(
    (id: string, taskId: string, label: string) => {
      const client = clients?.find((c) => c.id === id);
      if (!client) return;
      const done = client.manualDone.includes(taskId);
      const optimistic = done ? client.manualDone.filter((t) => t !== taskId) : [...client.manualDone, taskId];
      setClients((list) => list?.map((c) => (c.id === id ? { ...c, manualDone: optimistic } : c)) ?? list);
      api
        .setTaskDone(id, taskId, !done)
        .then((manualDone) => {
          setClients((list) => list?.map((c) => (c.id === id ? { ...c, manualDone } : c)) ?? list);
          return withLog(id, done ? `Reopened: ${label}` : `Done: ${label}`);
        })
        .catch((err) => {
          report(err);
          void refresh();
        });
    },
    [clients, withLog, refresh],
  );

  const addNote = useCallback((id: string, text: string) => void withLog(id, text).catch(report), [withLog]);

  const removeClient = useCallback(
    (id: string) => {
      setClients((list) => list?.filter((c) => c.id !== id) ?? list);
      api.deleteClient(id).catch((err) => {
        report(err);
        void refresh();
      });
    },
    [refresh],
  );

  const replaceWorkspace = useCallback(
    async (id: string, data: WorkspaceState) => {
      await api.overwriteWorkspace(id, data);
      const ws = await api.fetchWorkspace(id);
      setWorkspaces((m) => ({ ...m, [id]: ws }));
    },
    [],
  );

  const loadExampleClients = useCallback(() => {
    void (async () => {
      const make = (c: Omit<NewClient, "owner">) => addClient({ ...c, owner: author });
      const hartmann = await make({ firmName: "Hartmann & Söhne Joinery (example)", contactName: "Klaus Hartmann", email: "", phone: SAMPLE_PROFILE.phone, industry: "Joinery", city: "Köln", package: "suite", stage: "active", notes: "Example client. Delete when you start for real." });
      await make({ firmName: "Bäckerei Lindner (example)", contactName: "Maria Lindner", email: "", phone: "", industry: "Bakery, 3 shops", city: "Berlin", package: "start", stage: "onboarding", notes: "Example client." });
      await make({ firmName: "Druckerei Voss & Co. (example)", contactName: "Peter Voss", email: "", phone: "", industry: "Print shop", city: "Hamburg", package: "partner", stage: "lead", notes: "Example client." });
      await replaceWorkspace(hartmann.id, {
        ...EMPTY_STATE,
        profile: { ...SAMPLE_PROFILE, businessName: hartmann.firmName },
        ...buildSampleData(newId),
        records: SAMPLE_RECORDS.map((r) => toRecord(r, "sample")),
      });
      await api.setTaskDone(hartmann.id, "kickoff", true);
      await api.setTaskDone(hartmann.id, "training", true);
      await refresh();
    })().catch(report);
  }, [addClient, author, replaceWorkspace, refresh]);

  const workspaceOf = useCallback((id: string) => workspaces[id]?.state ?? EMPTY_STATE, [workspaces]);

  const ops: OpsState = useMemo(() => ({ version: 1, teamMember: author, clients: clients ?? [] }), [author, clients]);

  const value = useMemo<OpsApi>(
    () => ({
      mode: "cloud",
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

  if (loadError && !clients) {
    return (
      <div className="theme-legacylift min-h-screen flex items-center justify-center p-6">
        <div role="alert" className="max-w-md rounded-lg border border-border bg-card p-6 text-center flex flex-col gap-3">
          <p className="font-heading text-lg font-semibold">Couldn't load your clients</p>
          <p className="text-sm text-muted-foreground">{loadError}</p>
          <button type="button" onClick={() => void refresh()} className="self-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground">
            Try again
          </button>
        </div>
      </div>
    );
  }
  if (!clients) {
    return (
      <div className="theme-legacylift min-h-screen flex items-center justify-center">
        <p role="status" className="flex items-center gap-2 text-muted-foreground">
          <Loader2 className="animate-spin" size={18} aria-hidden="true" /> Loading clients…
        </p>
      </div>
    );
  }
  return <OpsContext.Provider value={value}>{children}</OpsContext.Provider>;
}
