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
const authState = vi.hoisted(() => ({ session: null as null | { user: { id: string; email: string } } }));
vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    auth: {
      getSession: async () => ({ data: { session: authState.session } }),
      onAuthStateChange: () => ({ data: { subscription: { unsubscribe: () => undefined } } }),
      signOut: async () => ({ error: null }),
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

  it("explains what to do when the account isn't linked yet", async () => {
    signIn();
    renderAt("/app");
    expect(await screen.findByRole("heading", { name: /isn't linked to a business yet/i })).toBeInTheDocument();
    expect(screen.getByText("maria@bakery.test")).toBeInTheDocument();
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

  it("offers a demo mode that stays on this device", async () => {
    renderAt("/internal");
    fireEvent.click(await screen.findByRole("button", { name: /open demo mode/i }));
    expect(await screen.findByText(/demo mode: data stays in this browser/i)).toBeInTheDocument();
  });
});
