import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, fireEvent, render, screen } from "@testing-library/react";
import { EMPTY_STATE, WorkspaceProvider, useWorkspace, type Persistence } from "./store";
import type { WorkspaceState } from "./types";

/** An in-memory stand-in for the workspaces table, with the same version rule as the database. */
function fakeServer(initial: WorkspaceState) {
  const server = { state: initial, version: 1, saves: 0, failNext: 0, listeners: [] as ((v: number) => void)[] };
  const persistence: Persistence = {
    load: async () => ({ state: structuredClone(server.state), version: server.version }),
    save: async (state, version) => {
      if (server.failNext > 0) {
        server.failNext--;
        throw new Error("Network down");
      }
      if (version !== server.version) return "conflict";
      server.state = structuredClone(state);
      server.version++;
      server.saves++;
      return server.version;
    },
    watch: (cb) => {
      server.listeners.push(cb);
      return () => undefined;
    },
  };
  /** Another person saves directly on the server. */
  const saveElsewhere = (state: WorkspaceState) => {
    server.state = state;
    server.version++;
    server.listeners.forEach((l) => l(server.version));
  };
  return { server, persistence, saveElsewhere };
}

function Probe() {
  const { state, sync, setProfile } = useWorkspace();
  return (
    <div>
      <p data-testid="name">{state.profile.businessName}</p>
      <p data-testid="status">{sync.status}</p>
      <button type="button" onClick={() => setProfile({ businessName: `${state.profile.businessName}!` })}>
        edit
      </button>
    </div>
  );
}

const named = (name: string): WorkspaceState => ({ ...EMPTY_STATE, profile: { ...EMPTY_STATE.profile, businessName: name } });

const flush = async (ms = 0) => {
  await act(async () => {
    await vi.advanceTimersByTimeAsync(ms);
  });
};

describe("cloud sync", () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it("loads from the server first and never saves before that", async () => {
    const { server, persistence } = fakeServer(named("Mill"));
    render(
      <WorkspaceProvider persistence={persistence}>
        <Probe />
      </WorkspaceProvider>,
    );
    expect(screen.getByText(/opening your workspace/i)).toBeInTheDocument();
    await flush();
    expect(screen.getByTestId("name").textContent).toBe("Mill");
    expect(screen.getByTestId("status").textContent).toBe("saved");
    await flush(2000);
    expect(server.saves).toBe(0);
  });

  it("saves a change shortly after it is made", async () => {
    const { server, persistence } = fakeServer(named("Mill"));
    render(
      <WorkspaceProvider persistence={persistence}>
        <Probe />
      </WorkspaceProvider>,
    );
    await flush();
    fireEvent.click(screen.getByText("edit"));
    expect(screen.getByTestId("status").textContent).toBe("saving");
    await flush(1000);
    expect(server.saves).toBe(1);
    expect(server.state.profile.businessName).toBe("Mill!");
    expect(screen.getByTestId("status").textContent).toBe("saved");
  });

  it("combines both people's changes when they save at the same time", async () => {
    const { server, persistence } = fakeServer(named("Mill"));
    render(
      <WorkspaceProvider persistence={persistence}>
        <Probe />
      </WorkspaceProvider>,
    );
    await flush();
    // we rename the business; meanwhile a colleague adds a customer and saves first
    fireEvent.click(screen.getByText("edit"));
    server.state = { ...named("Mill"), customers: [{ id: "c1", name: "Café Morgenrot", company: "", email: "", phone: "", address: "", notes: "", createdAt: "2026-09-27" }] };
    server.version++;
    await flush(1000);
    await flush(0);
    expect(server.state.profile.businessName).toBe("Mill!");
    expect(server.state.customers.map((c) => c.name)).toEqual(["Café Morgenrot"]);
    expect(screen.getByTestId("name").textContent).toBe("Mill!");
    expect(screen.getByTestId("status").textContent).toBe("saved");
  });

  it("saves a pending change when the workspace is closed", async () => {
    const { server, persistence } = fakeServer(named("Mill"));
    const view = render(
      <WorkspaceProvider persistence={persistence}>
        <Probe />
      </WorkspaceProvider>,
    );
    await flush();
    fireEvent.click(screen.getByText("edit"));
    view.unmount(); // e.g. switching business within a second of typing
    await flush(0);
    expect(server.state.profile.businessName).toBe("Mill!");
  });

  it("keeps the change and retries when the connection drops", async () => {
    const { server, persistence } = fakeServer(named("Mill"));
    server.failNext = 1;
    render(
      <WorkspaceProvider persistence={persistence}>
        <Probe />
      </WorkspaceProvider>,
    );
    await flush();
    fireEvent.click(screen.getByText("edit"));
    await flush(1000);
    expect(screen.getByTestId("status").textContent).toBe("error");
    expect(server.saves).toBe(0);
    await flush(6000);
    expect(server.saves).toBe(1);
    expect(server.state.profile.businessName).toBe("Mill!");
    expect(screen.getByTestId("status").textContent).toBe("saved");
  });

  it("picks up live changes from someone else when nothing is unsaved", async () => {
    const { persistence, saveElsewhere } = fakeServer(named("Mill"));
    render(
      <WorkspaceProvider persistence={persistence}>
        <Probe />
      </WorkspaceProvider>,
    );
    await flush();
    await act(async () => {
      saveElsewhere(named("Mill & Sons"));
      await vi.advanceTimersByTimeAsync(0);
    });
    expect(screen.getByTestId("name").textContent).toBe("Mill & Sons");
  });

  it("shows a clear message and a retry when loading fails", async () => {
    const persistence: Persistence = {
      load: vi.fn().mockRejectedValueOnce(new Error("You don't have access to it.")).mockResolvedValue({ state: named("Mill"), version: 1 }),
      save: async () => 2,
    };
    render(
      <WorkspaceProvider persistence={persistence}>
        <Probe />
      </WorkspaceProvider>,
    );
    await flush();
    expect(screen.getByText(/couldn't open this workspace/i)).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /try again/i }));
    await flush();
    expect(screen.getByTestId("name").textContent).toBe("Mill");
  });
});
