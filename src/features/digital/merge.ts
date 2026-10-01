// Combines two people's changes to the same workspace instead of throwing one side away.
//
// `base` is what both started from (the last version this browser saved or loaded), `local` is this
// browser's current state and `remote` is what the other person saved. For each customer, invoice,
// stock item and document (matched by id) we keep whichever side changed it; if both changed the same
// item, this browser's version wins. Other fields (profile, roadmap, chat) are handled the same way as a whole.
import type { WorkspaceState } from "./types";

const same = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b);

type Keyed = { id: string };

function mergeList<T extends Keyed>(base: T[], local: T[], remote: T[]): { list: T[]; clashes: number } {
  const byId = (list: T[]) => new Map(list.map((x) => [x.id, x]));
  const b = byId(base);
  const l = byId(local);
  const r = byId(remote);
  let clashes = 0;
  const out: T[] = [];
  const seen = new Set<string>();

  // Keep local order first (what this person is looking at), then anything new from the other side.
  for (const item of [...local, ...remote]) {
    const id = item.id;
    if (seen.has(id)) continue;
    seen.add(id);
    const inBase = b.get(id);
    const inLocal = l.get(id);
    const inRemote = r.get(id);
    const localChanged = inBase ? !inLocal || !same(inBase, inLocal) : Boolean(inLocal);
    const remoteChanged = inBase ? !inRemote || !same(inBase, inRemote) : Boolean(inRemote);
    if (localChanged && remoteChanged && !same(inLocal, inRemote)) clashes++;
    const winner = localChanged ? inLocal : remoteChanged ? inRemote : inLocal ?? inRemote;
    if (winner) out.push(winner); // undefined = deleted on the side that changed it
  }
  return { list: out, clashes };
}

function pick<T>(base: T, local: T, remote: T): { value: T; clash: boolean } {
  const localChanged = !same(base, local);
  const remoteChanged = !same(base, remote);
  return { value: localChanged ? local : remote, clash: localChanged && remoteChanged && !same(local, remote) };
}

export function mergeWorkspaces(base: WorkspaceState, local: WorkspaceState, remote: WorkspaceState): { merged: WorkspaceState; clashes: number } {
  let clashes = 0;
  const list = <K extends "customers" | "invoices" | "stock" | "records">(k: K) => {
    const r = mergeList(base[k] as Keyed[], local[k] as Keyed[], remote[k] as Keyed[]);
    clashes += r.clashes;
    return r.list as WorkspaceState[K];
  };
  const field = <K extends "profile" | "assessment" | "roadmap" | "roadmapDone" | "chat">(k: K) => {
    const r = pick(base[k], local[k], remote[k]);
    if (r.clash) clashes++;
    return r.value;
  };
  const merged: WorkspaceState = {
    version: 2,
    profile: field("profile"),
    customers: list("customers"),
    invoices: list("invoices"),
    stock: list("stock"),
    records: list("records"),
    assessment: field("assessment"),
    roadmap: field("roadmap"),
    roadmapDone: field("roadmapDone"),
    chat: field("chat"),
  };
  return { merged, clashes };
}
