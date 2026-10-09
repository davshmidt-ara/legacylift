import { beforeEach, describe, expect, it, vi } from "vitest";
import { act, fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { EMPTY_STATE } from "@/features/digital/store";

globalThis.ResizeObserver ??= class {
  observe() {}
  unobserve() {}
  disconnect() {}
} as unknown as typeof ResizeObserver;

// A signed-in (or not) Supabase auth, controlled per test.
const oauth = vi.hoisted(() => vi.fn(async (_args: unknown) => ({ data: {}, error: null })));
const authState = vi.hoisted(() => ({ session: null as null | { user: { id: string; email: string } } }));
vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    auth: {
      getSession: async () => ({ data: { session: authState.session } }),
      onAuthStateChange: () => ({ data: { subscription: { unsubscribe: () => undefined } } }),
      signOut: async () => ({ error: null }),
      signInWithOAuth: oauth,
    },
    from: () => ({ update: () => ({ eq: async () => ({ error: null }) }) }),
    functions: { invoke: async () => ({ data: null, error: new Error("offline") }) },
  },
}));

const api = vi.hoisted(() => ({
  claimInvites: vi.fn(async () => 0),
  amIStaff: vi.fn(async () => null as null | { displayName: string }),
  myWorkspaces: vi.fn(async () => [] as { firmId: string; name: string }[]),
  fetchWorkspace: vi.fn(),
  saveWorkspace: vi.fn(async () => 2),
  watchWorkspace: vi.fn(() => () => undefined),
  staffExists: vi.fn(async () => false),
  listClients: vi.fn(async () => []),
  allWorkspaces: vi.fn(async () => ({})),
  startMyBusiness: vi.fn(async (_name: string) => "f9"),
  accountRegister: vi.fn(async () => [] as unknown[]),
  deleteMyAccount: vi.fn(async () => undefined),
}));
vi.mock("./api", async (orig) => ({ ...(await orig<typeof import("./api")>()), ...api }));

import DigitalApp from "@/pages/digital/DigitalApp";
import OpsApp from "@/pages/digital/ops/OpsApp";

const signIn = () => (authState.session = { user: { id: "u1", email: "maria@bakery.test" } });
const bakery = { ...EMPTY_STATE, profile: { ...EMPTY_STATE.profile, businessName: "Bäckerei Lindner" } };

function renderAt(path: string) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route path="/app/*" element={<DigitalApp />} />
        <Route path="/internal/*" element={<OpsApp />} />
      </Routes>
    </MemoryRouter>,
  );
}

beforeEach(() => {
  authState.session = null;
  localStorage.clear();
  sessionStorage.clear();
  Object.values(api).forEach((fn) => fn.mockClear());
  api.amIStaff.mockResolvedValue(null);
  api.staffExists.mockResolvedValue(false);
  api.myWorkspaces.mockResolvedValue([]);
});

describe("client app sign-in", () => {
  it("asks to sign in, and can be tried without an account", async () => {
    renderAt("/app");
    expect(await screen.findByRole("heading", { name: /sign in to legacylift/i })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /try it without an account/i }));
    expect(await screen.findByText("Getting started")).toBeInTheDocument();
    expect(screen.getAllByText(/saved on this device only/i).length).toBeGreaterThan(0);
  });

  it("opens the business the account is linked to and saves changes online", async () => {
    signIn();
    api.myWorkspaces.mockResolvedValueOnce([{ firmId: "f1", name: "Bäckerei Lindner" }]);
    api.fetchWorkspace.mockResolvedValueOnce({ state: bakery, version: 1 });
    renderAt("/app/settings");
    expect(await screen.findByDisplayValue("Bäckerei Lindner")).toBeInTheDocument();
    expect(api.claimInvites).toHaveBeenCalled();
    expect(api.fetchWorkspace).toHaveBeenCalledWith("f1");
    expect(screen.getAllByText(/all changes saved/i).length).toBeGreaterThan(0);

    fireEvent.change(screen.getByLabelText(/owner \/ contact person/i), { target: { value: "Maria Lindner" } });
    fireEvent.click(screen.getByRole("button", { name: /save details/i }));
    await act(async () => {
      await new Promise((r) => setTimeout(r, 1000));
    });
    expect(api.saveWorkspace).toHaveBeenCalled();
    const [firmId, saved, version] = api.saveWorkspace.mock.calls[0] as unknown as [string, typeof bakery, number];
    expect(firmId).toBe("f1");
    expect(version).toBe(1);
    expect(saved.profile.ownerName).toBe("Maria Lindner");
  });

  it("lets a new account set up its own business and opens it", async () => {
    signIn();
    renderAt("/app");
    expect(await screen.findByRole("heading", { name: /set up your business/i })).toBeInTheDocument();
    expect(screen.getByText("maria@bakery.test")).toBeInTheDocument();
    api.myWorkspaces.mockResolvedValueOnce([{ firmId: "f9", name: "Maiznīca Saulīte" }]);
    api.fetchWorkspace.mockResolvedValueOnce({ state: { ...EMPTY_STATE, profile: { ...EMPTY_STATE.profile, businessName: "Maiznīca Saulīte" } }, version: 1 });
    fireEvent.change(screen.getByLabelText(/business name/i), { target: { value: "  Maiznīca Saulīte " } });
    fireEvent.click(screen.getByRole("button", { name: /open my workspace/i }));
    expect(await screen.findByRole("heading", { name: "Maiznīca Saulīte", level: 1 })).toBeInTheDocument();
    expect(api.startMyBusiness).toHaveBeenCalledWith("  Maiznīca Saulīte ");
    expect(api.fetchWorkspace).toHaveBeenCalledWith("f9");
  });

  it("brings over what was entered while trying LegacyLift without an account", async () => {
    signIn();
    localStorage.setItem("legacylift.workspace.v1", JSON.stringify({ ...EMPTY_STATE, profile: { ...EMPTY_STATE.profile, businessName: "Maiznīca Saulīte" }, customers: [{ id: "c1", name: "Kafejnīca Kanēlis", company: "", email: "", phone: "", address: "", notes: "", createdAt: "2026-10-01" }] }));
    api.fetchWorkspace.mockResolvedValue({ state: EMPTY_STATE, version: 1 });
    renderAt("/app");
    expect(await screen.findByLabelText(/bring over what i entered/i)).toBeChecked();
    expect(screen.getByLabelText(/business name/i)).toHaveValue("Maiznīca Saulīte");
    fireEvent.click(screen.getByRole("button", { name: /open my workspace/i }));
    await act(async () => {});
    const [firmId, saved, version] = api.saveWorkspace.mock.calls.at(-1) as unknown as [string, typeof EMPTY_STATE, number];
    expect([firmId, version]).toEqual(["f9", 1]);
    expect(saved.customers.map((c) => c.name)).toEqual(["Kafejnīca Kanēlis"]);
    localStorage.removeItem("legacylift.workspace.v1");
  });

  it("lets a client delete their own account after typing their email", async () => {
    signIn();
    api.myWorkspaces.mockResolvedValueOnce([{ firmId: "f1", name: "Bäckerei Lindner" }]);
    api.fetchWorkspace.mockResolvedValueOnce({ state: bakery, version: 1 });
    renderAt("/app/settings");
    fireEvent.click(await screen.findByRole("button", { name: /delete my account…/i }));
    const confirm = screen.getByRole("button", { name: /delete my account permanently/i });
    expect(confirm).toBeDisabled();
    fireEvent.change(screen.getByLabelText(/type your email address/i), { target: { value: "MARIA@bakery.test " } });
    fireEvent.click(confirm);
    await act(async () => {});
    expect(api.deleteMyAccount).toHaveBeenCalledTimes(1);
  });

  it("signs in with Google or Microsoft and comes back to the same page", async () => {
    const page = window.location.href; // the page they started on (the test router doesn't change the address bar)
    const first = renderAt("/app");
    fireEvent.click(await screen.findByRole("button", { name: /continue with google/i }));
    await act(async () => {});
    expect(oauth).toHaveBeenLastCalledWith({ provider: "google", options: { redirectTo: page, scopes: undefined } });
    first.unmount();
    renderAt("/app");
    fireEvent.click(await screen.findByRole("button", { name: /continue with microsoft/i }));
    await act(async () => {});
    expect(oauth).toHaveBeenLastCalledWith({ provider: "azure", options: { redirectTo: page, scopes: "email openid profile" } });
  });
});

describe("team console sign-in", () => {
  it("shows the one-time admin setup, then opens the console once added", async () => {
    signIn();
    renderAt("/internal");
    expect(await screen.findByRole("heading", { name: /set up your team/i })).toBeInTheDocument();
    expect(screen.getByText(/where email = 'maria@bakery.test'/)).toBeInTheDocument();
    api.amIStaff.mockResolvedValue({ displayName: "Owner" }); // the SQL line was run
    fireEvent.click(screen.getByRole("button", { name: /check again/i }));
    expect(await screen.findByRole("heading", { name: "Operations" })).toBeInTheDocument();
    expect(api.listClients).toHaveBeenCalledTimes(1); // one shared load, not two
  });

  it("refuses people who aren't on the team", async () => {
    signIn();
    api.staffExists.mockResolvedValue(true);
    renderAt("/internal");
    expect(await screen.findByRole("heading", { name: /you don't have access yet/i })).toBeInTheDocument();
    expect(api.listClients).not.toHaveBeenCalled();
  });

  it("shows the team every account, from the private register", async () => {
    signIn();
    api.amIStaff.mockResolvedValue({ displayName: "Owner" });
    api.accountRegister.mockResolvedValueOnce([
      { userId: "u2", email: "ilze@saulite.example", fullName: "Ilze Saule", providers: "google", language: "lv", createdAt: new Date().toISOString(), emailConfirmed: true, lastSignInAt: null, isStaff: false, businesses: [{ id: "f9", name: "Maiznīca Saulīte" }] },
      { userId: "u3", email: "jonas@medis.example", fullName: "", providers: "azure", language: "lt", createdAt: "2026-01-02T10:00:00Z", emailConfirmed: true, lastSignInAt: null, isStaff: false, businesses: [] },
      { userId: "u1", email: "maria@bakery.test", fullName: "Maria", providers: "email", language: "", createdAt: "2025-12-01T10:00:00Z", emailConfirmed: true, lastSignInAt: null, isStaff: true, businesses: [] },
    ]);
    renderAt("/internal/accounts");
    expect(await screen.findByRole("heading", { name: "Accounts" })).toBeInTheDocument();
    expect(await screen.findByText("Ilze Saule")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Maiznīca Saulīte" })).toHaveAttribute("href", "/internal/clients/f9");
    expect(screen.getByText("Microsoft")).toBeInTheDocument();
    expect(screen.getByText("Not set up yet")).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText("Show"), { target: { value: "nobusiness" } });
    expect(screen.queryByText("Ilze Saule")).not.toBeInTheDocument();
    expect(screen.getByText("jonas@medis.example")).toBeInTheDocument();
  });

  it("offers a demo mode that stays on this device", async () => {
    renderAt("/internal");
    fireEvent.click(await screen.findByRole("button", { name: /open demo mode/i }));
    expect(await screen.findByText(/demo mode: data stays in this browser/i)).toBeInTheDocument();
  });
});
