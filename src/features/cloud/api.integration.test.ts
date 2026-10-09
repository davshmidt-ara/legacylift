// Runs the real cloud API against a local Postgres + PostgREST stack with the LegacyLift migration.
// Skipped unless LL_REST_URL is set. See supabase/tests/README.md for how to start the stack
// (the admin row is inserted by that setup, the same way it is done once in production).
import { createHmac } from "node:crypto";
import { beforeAll, describe, expect, it, vi } from "vitest";
import { createClient as createSupabase, type SupabaseClient } from "@supabase/supabase-js";
import { EMPTY_STATE } from "@/features/digital/store";

const REST_URL = process.env.LL_REST_URL;
const JWT_SECRET = process.env.LL_JWT_SECRET ?? "local-test-secret-that-is-at-least-32-chars-long";

const holder = vi.hoisted(() => ({ client: null as unknown as SupabaseClient }));
vi.mock("@/integrations/supabase/client", () => ({
  supabase: new Proxy(
    {},
    {
      get: (_t, prop) => {
        const value = (holder.client as unknown as Record<string | symbol, unknown>)[prop];
        return typeof value === "function" ? value.bind(holder.client) : value;
      },
    },
  ),
}));

const b64 = (o: object) => Buffer.from(JSON.stringify(o)).toString("base64url");
function tokenFor(sub: string, email: string) {
  const head = b64({ alg: "HS256", typ: "JWT" });
  const body = b64({ sub, email, role: "authenticated", exp: Math.floor(Date.now() / 1000) + 3600 });
  const sig = createHmac("sha256", JWT_SECRET).update(`${head}.${body}`).digest("base64url");
  return `${head}.${body}.${sig}`;
}

const USERS = {
  owner: { id: "00000000-0000-0000-0000-00000000000a", email: "owner@agency.test" },
  maria: { id: "00000000-0000-0000-0000-00000000000c", email: "maria@bakery.test" },
  klaus: { id: "00000000-0000-0000-0000-00000000000d", email: "klaus@joinery.test" },
};

function actAs(user: keyof typeof USERS) {
  const jwt = tokenFor(USERS[user].id, USERS[user].email);
  holder.client = createSupabase(REST_URL!, "anon-test-key", {
    accessToken: async () => jwt,
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

describe.skipIf(!REST_URL)("cloud API against a real database", () => {
  let api: typeof import("./api");
  let firmId = "";

  beforeAll(async () => {
    api = await import("./api");
  });

  it("the admin (added once by SQL) creates a client with a ready workspace", async () => {
    actAs("owner");
    expect(await api.staffExists()).toBe(true);
    expect(await api.amIStaff(USERS.owner.id)).toEqual({ displayName: "Owner" });

    const client = await api.createClient({ firmName: "Bäckerei Lindner", email: "maria@bakery.test", package: "start", stage: "onboarding" });
    firmId = client.id;
    expect(client.package).toBe("start");
    const ws = await api.fetchWorkspace(firmId);
    expect(ws.version).toBe(1);
    expect(ws.state.profile.businessName).toBe("Bäckerei Lindner");

    await api.addLog(firmId, "Kick-off call held", "Owner");
    await api.updateClientRow(firmId, { stage: "active" });
    expect(await api.setTaskDone(firmId, "kickoff", true)).toEqual(["kickoff"]);
    const [listed] = await api.listClients();
    expect(listed.stage).toBe("active");
    expect(listed.manualDone).toEqual(["kickoff"]);
    expect(listed.log[0].text).toBe("Kick-off call held");

    expect(await api.inviteToFirm(firmId, "  Maria@Bakery.test ", USERS.owner.id)).toBe("maria@bakery.test");
    expect((await api.listAccess(firmId)).invites).toEqual(["maria@bakery.test"]);
  });

  it("the invited client joins, sees only her workspace, and saves with version checks", async () => {
    actAs("maria");
    expect(await api.amIStaff(USERS.maria.id)).toBeNull();
    expect(await api.myWorkspaces()).toEqual([]);
    expect(await api.claimInvites()).toBe(1);
    expect(await api.myWorkspaces()).toEqual([{ firmId, name: "Bäckerei Lindner" }]);

    const ws = await api.fetchWorkspace(firmId);
    const next = { ...ws.state, customers: [{ id: "c1", name: "Café Morgenrot", company: "", email: "", phone: "", address: "", notes: "", createdAt: "2026-09-27" }] };
    const v2 = await api.saveWorkspace(firmId, next, ws.version);
    expect(v2).toBe(ws.version + 1);
    expect(await api.saveWorkspace(firmId, EMPTY_STATE, ws.version)).toBe("conflict");
    expect((await api.fetchWorkspace(firmId)).state.customers).toHaveLength(1);

    expect(await api.listClients()).toEqual([]); // the internal client list is invisible to clients
    await expect(api.createClient({ firmName: "Sneaky" })).rejects.toThrow();
    await expect(api.listStaff()).rejects.toThrow();
    expect(await api.amIStaff(USERS.maria.id)).toBeNull();
  });

  it("another client can't open the bakery", async () => {
    actAs("klaus");
    expect(await api.claimInvites()).toBe(0);
    expect(await api.myWorkspaces()).toEqual([]);
    await expect(api.fetchWorkspace(firmId)).rejects.toThrow(/doesn't exist or you don't have access/);
    expect(await api.saveWorkspace(firmId, EMPTY_STATE, 2)).toBe("conflict"); // no row visible, nothing changed
  });

  it("staff see who has access, import a backup, and can remove the client", async () => {
    actAs("owner");
    const access = await api.listAccess(firmId);
    expect(access.members.map((m) => m.email)).toEqual(["maria@bakery.test"]);
    expect(access.invites).toEqual([]);

    const all = await api.allWorkspaces();
    expect(all[firmId].state.customers).toHaveLength(1);
    await api.overwriteWorkspace(firmId, { ...EMPTY_STATE, profile: { ...EMPTY_STATE.profile, businessName: "Bäckerei Lindner" } });
    expect((await api.fetchWorkspace(firmId)).state.customers).toHaveLength(0);

    await api.removeMember(firmId, USERS.maria.id);
    expect((await api.listAccess(firmId)).members).toEqual([]);
    await api.deleteClient(firmId);
    expect(await api.listClients()).toEqual([]);
  });

  it("a new account sets up its own business; only the team sees it in the account register", async () => {
    actAs("klaus");
    await expect(api.accountRegister()).rejects.toThrow(/Only the LegacyLift team/);
    const own = await api.startMyBusiness("Hartmann Joinery");
    expect(await api.myWorkspaces()).toEqual([{ firmId: own, name: "Hartmann Joinery" }]);
    expect(await api.listClients()).toEqual([]); // still no access to the internal client list

    actAs("owner");
    const [lead] = await api.listClients();
    expect(lead).toMatchObject({ firmName: "Hartmann Joinery", email: "klaus@joinery.test", source: "website", stage: "lead" });
    const register = await api.accountRegister();
    expect(register.find((a) => a.email === "klaus@joinery.test")?.businesses).toEqual([{ id: own, name: "Hartmann Joinery" }]);
    expect(register.find((a) => a.email === "owner@agency.test")?.isStaff).toBe(true);
    await api.deleteClient(own);
  });
});
