// Every call LegacyLift makes to the Supabase database lives here.
// Access rules are enforced in the database (supabase/migrations/*_legacylift_cloud.sql), not in this file.
import { supabase } from "@/integrations/supabase/client";
import type { Database, Json } from "@/integrations/supabase/types";

type FirmUpdate = Database["public"]["Tables"]["firms"]["Update"];
import { migrate } from "@/features/digital/store";
import type { WorkspaceState } from "@/features/digital/types";
import type { Client, LogEntry, PackageId, Stage } from "@/features/ops/types";

export class CloudError extends Error {}

function fail(error: { message: string } | null, what: string): never {
  throw new CloudError(`${what}: ${error?.message ?? "unknown error"}`);
}

/* ------------------------------------------------------------ workspaces */

export interface LoadedWorkspace {
  state: WorkspaceState;
  version: number;
}

export async function fetchWorkspace(firmId: string): Promise<LoadedWorkspace> {
  const { data, error } = await supabase.from("workspaces").select("data, version").eq("firm_id", firmId).maybeSingle();
  if (error) fail(error, "Couldn't load the workspace");
  if (!data) throw new CloudError("This workspace doesn't exist or you don't have access to it.");
  return { state: migrate(data.data), version: data.version };
}

/** Saves only if nobody else saved since `version`. Returns the new version, or "conflict". */
export async function saveWorkspace(firmId: string, state: WorkspaceState, version: number): Promise<number | "conflict"> {
  const { data, error } = await supabase
    .from("workspaces")
    .update({ data: state as unknown as Json })
    .eq("firm_id", firmId)
    .eq("version", version)
    .select("version");
  if (error) fail(error, "Couldn't save");
  return data && data.length ? data[0].version : "conflict";
}

/** Calls `onChange(version)` when someone else saves this workspace. Returns an unsubscribe function. */
export function watchWorkspace(firmId: string, onChange: (version: number) => void): () => void {
  const channel = supabase
    .channel(`workspace:${firmId}`)
    .on("postgres_changes", { event: "UPDATE", schema: "public", table: "workspaces", filter: `firm_id=eq.${firmId}` }, (payload) => {
      const v = (payload.new as { version?: number }).version;
      if (typeof v === "number") onChange(v);
    })
    .subscribe();
  return () => {
    void supabase.removeChannel(channel);
  };
}

export async function myWorkspaces(): Promise<{ firmId: string; name: string }[]> {
  const { data, error } = await supabase.rpc("my_workspaces");
  if (error) fail(error, "Couldn't list your workspaces");
  return (data ?? []).map((w) => ({ firmId: w.firm_id, name: w.business_name }));
}

/** All workspaces a staff member can see, for snapshots in the console. */
export async function allWorkspaces(): Promise<Record<string, LoadedWorkspace>> {
  const { data, error } = await supabase.from("workspaces").select("firm_id, data, version");
  if (error) fail(error, "Couldn't load client workspaces");
  return Object.fromEntries((data ?? []).map((w) => [w.firm_id, { state: migrate(w.data), version: w.version }]));
}

/* ------------------------------------------------------------ account */

export async function claimInvites() {
  const { data, error } = await supabase.rpc("claim_invites");
  if (error) fail(error, "Couldn't accept invites");
  return data ?? 0;
}

export async function amIStaff(userId: string) {
  const { data, error } = await supabase.from("staff").select("user_id, display_name").eq("user_id", userId).maybeSingle();
  if (error) fail(error, "Couldn't check your access");
  return data ? { displayName: data.display_name } : null;
}

/** A signed-in person who wasn't invited sets up their own business. Returns its id. */
export async function startMyBusiness(name: string): Promise<string> {
  const { data, error } = await supabase.rpc("start_my_business", { p_name: name });
  if (error) throw new CloudError(error.message);
  return data as string;
}

/** Deletes the signed-in person's account (and businesses they set up alone). */
export async function deleteMyAccount() {
  const { error } = await supabase.rpc("delete_my_account");
  if (error) throw new CloudError(error.message);
}

/** Staff: remove someone's account on request. */
export async function removeAccount(userId: string) {
  const { error } = await supabase.rpc("remove_account", { p_user: userId });
  if (error) throw new CloudError(error.message);
}

export interface Account {
  userId: string;
  email: string;
  fullName: string;
  /** How they sign in, e.g. "email", "google", "azure" (Microsoft) or "email, google". */
  providers: string;
  language: string;
  createdAt: string;
  emailConfirmed: boolean;
  lastSignInAt: string | null;
  isStaff: boolean;
  businesses: { id: string; name: string }[];
}

/** Staff only: every account, newest first, from the private account register. */
export async function accountRegister(): Promise<Account[]> {
  const { data, error } = await supabase.rpc("account_register");
  if (error) fail(error, "Couldn't load accounts");
  return (data ?? []).map((a) => ({
    userId: a.user_id,
    email: a.email,
    fullName: a.full_name,
    providers: a.providers,
    language: a.language,
    createdAt: a.created_at,
    emailConfirmed: a.email_confirmed,
    lastSignInAt: a.last_sign_in_at,
    isStaff: a.is_staff,
    businesses: (a.businesses as { id: string; name: string }[] | null) ?? [],
  }));
}

export async function staffExists() {
  const { data, error } = await supabase.rpc("staff_exists");
  if (error) fail(error, "Couldn't check the team");
  return Boolean(data);
}

export async function listStaff() {
  const { data, error } = await supabase.rpc("staff_list");
  if (error) fail(error, "Couldn't load the team");
  return (data ?? []).map((s) => ({ userId: s.user_id, email: s.email, displayName: s.display_name }));
}

export async function addStaff(email: string, displayName: string) {
  const { data, error } = await supabase.rpc("add_staff", { p_email: email, p_display_name: displayName });
  if (error) fail(error, "Couldn't add that person");
  return Boolean(data);
}

/* ------------------------------------------------------------ firms (staff) */

type FirmRow = {
  id: string;
  firm_name: string;
  contact_name: string;
  email: string;
  phone: string;
  industry: string;
  city: string;
  package: string;
  stage: string;
  owner: string;
  notes: string;
  manual_done: string[];
  source?: string;
  created_at: string;
};

const toClient = (r: FirmRow, log: LogEntry[]): Client => ({
  id: r.id,
  firmName: r.firm_name,
  contactName: r.contact_name,
  email: r.email,
  phone: r.phone,
  industry: r.industry,
  city: r.city,
  package: r.package as PackageId,
  stage: r.stage as Stage,
  owner: r.owner,
  notes: r.notes,
  manualDone: r.manual_done ?? [],
  source: r.source === "website" ? "website" : "team",
  log,
  createdAt: r.created_at,
});

type ClientFields = Partial<Omit<Client, "id" | "createdAt" | "log">>;

const toRow = (c: ClientFields): FirmUpdate => {
  const row: FirmUpdate = {};
  if (c.firmName !== undefined) row.firm_name = c.firmName;
  if (c.contactName !== undefined) row.contact_name = c.contactName;
  if (c.email !== undefined) row.email = c.email;
  if (c.phone !== undefined) row.phone = c.phone;
  if (c.industry !== undefined) row.industry = c.industry;
  if (c.city !== undefined) row.city = c.city;
  if (c.package !== undefined) row.package = c.package;
  if (c.stage !== undefined) row.stage = c.stage;
  if (c.owner !== undefined) row.owner = c.owner;
  if (c.notes !== undefined) row.notes = c.notes;
  if (c.manualDone !== undefined) row.manual_done = c.manualDone;
  return row;
};

export async function listClients(): Promise<Client[]> {
  const [firms, logs] = await Promise.all([
    supabase.from("firms").select("*").order("created_at", { ascending: false }),
    supabase.from("firm_log").select("*").order("created_at", { ascending: false }).limit(2000),
  ]);
  if (firms.error) fail(firms.error, "Couldn't load clients");
  if (logs.error) fail(logs.error, "Couldn't load activity");
  const byFirm = new Map<string, LogEntry[]>();
  for (const l of logs.data ?? []) {
    const list = byFirm.get(l.firm_id) ?? [];
    list.push({ id: l.id, at: l.created_at, text: l.text, author: l.author ?? undefined });
    byFirm.set(l.firm_id, list);
  }
  return (firms.data ?? []).map((f) => toClient(f as FirmRow, byFirm.get(f.id) ?? []));
}

export async function createClient(fields: ClientFields & { firmName: string }): Promise<Client> {
  const { data, error } = await supabase.from("firms").insert(toRow(fields) as { firm_name: string }).select("*").single();
  if (error) fail(error, "Couldn't add the client");
  return toClient(data as FirmRow, []);
}

export async function updateClientRow(id: string, fields: ClientFields) {
  const { error } = await supabase.from("firms").update(toRow(fields)).eq("id", id);
  if (error) fail(error, "Couldn't save the client");
}

/** Tick or un-tick a checklist task in one database step. Returns the new list. */
export async function setTaskDone(firmId: string, task: string, done: boolean): Promise<string[]> {
  const { data, error } = await supabase.rpc("set_task_done", { p_firm_id: firmId, p_task: task, p_done: done });
  if (error) fail(error, "Couldn't update the checklist");
  return (data as string[] | null) ?? [];
}

export async function deleteClient(id: string) {
  const { error } = await supabase.from("firms").delete().eq("id", id);
  if (error) fail(error, "Couldn't remove the client");
}

export async function addLog(firmId: string, text: string, author?: string): Promise<LogEntry> {
  const { data, error } = await supabase.from("firm_log").insert({ firm_id: firmId, text, author: author ?? null }).select("*").single();
  if (error) fail(error, "Couldn't add the note");
  return { id: data.id, at: data.created_at, text: data.text, author: data.author ?? undefined };
}

/** Replaces a client's workspace with a backup file, whatever version is stored. */
export async function overwriteWorkspace(firmId: string, state: WorkspaceState) {
  const { error } = await supabase.from("workspaces").update({ data: state as unknown as Json }).eq("firm_id", firmId);
  if (error) fail(error, "Couldn't import the backup");
}

/* ------------------------------------------------------------ client access (staff) */

export async function listAccess(firmId: string) {
  const [members, invites] = await Promise.all([
    supabase.rpc("firm_member_emails", { p_firm_id: firmId }),
    supabase.from("firm_invites").select("email, created_at").eq("firm_id", firmId).order("created_at"),
  ]);
  if (members.error) fail(members.error, "Couldn't load who has access");
  if (invites.error) fail(invites.error, "Couldn't load invites");
  return {
    members: (members.data ?? []).map((m) => ({ userId: m.user_id, email: m.email })),
    invites: (invites.data ?? []).map((i) => i.email),
  };
}

export async function inviteToFirm(firmId: string, email: string, invitedBy: string) {
  const clean = email.trim().toLowerCase();
  const { error } = await supabase.from("firm_invites").upsert({ firm_id: firmId, email: clean, invited_by: invitedBy }, { onConflict: "firm_id,email" });
  if (error) fail(error, "Couldn't create the invite");
  return clean;
}

export async function cancelInvite(firmId: string, email: string) {
  const { error } = await supabase.from("firm_invites").delete().eq("firm_id", firmId).eq("email", email);
  if (error) fail(error, "Couldn't cancel the invite");
}

export async function removeMember(firmId: string, userId: string) {
  const { error } = await supabase.from("firm_members").delete().eq("firm_id", firmId).eq("user_id", userId);
  if (error) fail(error, "Couldn't remove access");
}
