import { beforeEach, describe, expect, it } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { EMPTY_STATE, clientStorageKey, loadWorkspace, newId } from "@/features/digital/store";
import { buildSampleData, SAMPLE_PROFILE } from "@/features/digital/sample";
import type { WorkspaceState } from "@/features/digital/types";
import { checklistProgress, isTaskDone, tasksFor, workspaceSnapshot } from "./playbook";
import type { Client } from "./types";
import OpsApp from "@/pages/digital/ops/OpsApp";

globalThis.ResizeObserver ??= class {
  observe() {}
  unobserve() {}
  disconnect() {}
} as unknown as typeof ResizeObserver;

const client = (patch: Partial<Client> = {}): Client => ({
  id: "c1",
  firmName: "Test Firm",
  contactName: "",
  email: "",
  phone: "",
  industry: "",
  city: "",
  package: "suite",
  stage: "onboarding",
  owner: "",
  notes: "",
  manualDone: [],
  log: [],
  createdAt: "2026-01-01",
  ...patch,
});

describe("service playbook", () => {
  it("builds packages on top of each other", () => {
    const start = tasksFor("start").length;
    const suite = tasksFor("suite").length;
    const partner = tasksFor("partner").length;
    expect(start).toBeGreaterThan(0);
    expect(suite).toBeGreaterThan(start);
    expect(partner).toBeGreaterThan(suite);
    expect(tasksFor("suite").map((t) => t.task.id)).toContain("kickoff");
  });

  it("ticks tasks off automatically from the client's workspace", () => {
    const empty: WorkspaceState = EMPTY_STATE;
    const full: WorkspaceState = { ...EMPTY_STATE, profile: SAMPLE_PROFILE, ...buildSampleData(newId) };
    const c = client();
    const task = (id: string) => tasksFor("suite").find((t) => t.task.id === id)!.task;
    expect(isTaskDone(c, task("customers"), empty)).toBe(false);
    expect(isTaskDone(c, task("customers"), full)).toBe(true);
    expect(isTaskDone(c, task("stock"), full)).toBe(true);
    expect(isTaskDone(c, task("profile"), full)).toBe(true);
    // manual tasks only count when ticked
    expect(isTaskDone(c, task("kickoff"), full)).toBe(false);
    expect(isTaskDone(client({ manualDone: ["kickoff"] }), task("kickoff"), full)).toBe(true);
    expect(checklistProgress(c, full).done).toBeGreaterThan(checklistProgress(c, empty).done);
  });

  it("summarizes a client's business", () => {
    const snap = workspaceSnapshot({ ...EMPTY_STATE, profile: SAMPLE_PROFILE, ...buildSampleData(newId, "2026-09-26") });
    expect(snap.customers).toBe(4);
    expect(snap.overdueCount).toBeGreaterThanOrEqual(1);
    expect(snap.lowStock).toBe(2);
  });
});

describe("operations console", () => {
  beforeEach(() => localStorage.clear());

  const renderAt = (path: string) =>
    render(
      <MemoryRouter initialEntries={[path]}>
        <Routes>
          <Route path="/internal/*" element={<OpsApp demoOnly />} />
        </Routes>
      </MemoryRouter>,
    );

  it("loads example clients and opens a client's workspace on their behalf", () => {
    renderAt("/internal");
    fireEvent.click(screen.getByRole("button", { name: /load example clients/i }));
    expect(screen.getByRole("heading", { name: "Operations" })).toBeInTheDocument();
    expect(screen.getAllByText("SIA Kalniņa Galdniecība").length).toBeGreaterThan(0);

    fireEvent.click(screen.getByRole("link", { name: /^clients$/i }));
    fireEvent.click(screen.getByRole("link", { name: "SIA Kalniņa Galdniecība" }));
    expect(screen.getByRole("heading", { name: "Service checklist" })).toBeInTheDocument();

    fireEvent.click(screen.getByRole("link", { name: /open workspace/i }));
    expect(screen.getByText(/working on behalf of/i)).toBeInTheDocument();
    expect(screen.getByRole("heading", { level: 1, name: "SIA Kalniņa Galdniecība" })).toBeInTheDocument();
  });

  it("keeps each client's data in its own workspace", async () => {
    renderAt("/internal/clients?new=1");
    fireEvent.change(screen.getByLabelText(/firm name/i), { target: { value: "Uhrmacher Klein" } });
    fireEvent.click(screen.getByRole("button", { name: /create client/i }));
    expect(await screen.findByRole("heading", { level: 1, name: "Uhrmacher Klein" })).toBeInTheDocument();

    const ops = JSON.parse(localStorage.getItem("legacylift.ops.v1")!);
    const id = ops.clients[0].id as string;
    expect(loadWorkspace(clientStorageKey(id)).profile.businessName).toBe("Uhrmacher Klein");
    // the firm-facing workspace is untouched
    expect(localStorage.getItem("legacylift.workspace.v1")).toBeNull();
  });
});

describe("next step and ordering", () => {
  it("points at the first undone task and ranks overdue clients first", async () => {
    const { nextTask, attentionRank } = await import("./playbook");
    const full: WorkspaceState = { ...EMPTY_STATE, profile: SAMPLE_PROFILE, ...buildSampleData(newId, "2026-09-26") };
    expect(nextTask(client(), EMPTY_STATE)?.task.id).toBe("kickoff");
    expect(nextTask(client({ manualDone: ["kickoff"] }), full)?.task.id).toBe("checkup");
    expect(attentionRank(client({ stage: "active" }), full)).toBe(0); // has an overdue invoice
    expect(attentionRank(client({ stage: "paused" }), full)).toBe(5);
    expect(attentionRank(client({ stage: "lead" }), EMPTY_STATE)).toBe(2);
  });
});
