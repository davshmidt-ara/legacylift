import { describe, expect, it } from "vitest";
import { mergeWorkspaces } from "./merge";
import { EMPTY_STATE } from "./store";
import type { Customer, WorkspaceState } from "./types";

const cust = (id: string, name: string): Customer => ({ id, name, company: "", email: "", phone: "", address: "", notes: "", createdAt: "2026-09-27" });
const ws = (customers: Customer[], businessName = "Mill"): WorkspaceState => ({ ...EMPTY_STATE, profile: { ...EMPTY_STATE.profile, businessName }, customers });

describe("mergeWorkspaces", () => {
  const base = ws([cust("a", "Anna"), cust("b", "Bernd")]);

  it("keeps additions from both sides", () => {
    const { merged, clashes } = mergeWorkspaces(base, ws([cust("a", "Anna"), cust("b", "Bernd"), cust("l", "Local")]), ws([cust("a", "Anna"), cust("b", "Bernd"), cust("r", "Remote")]));
    expect(merged.customers.map((c) => c.id)).toEqual(["a", "b", "l", "r"]);
    expect(clashes).toBe(0);
  });

  it("keeps each side's edits to different items", () => {
    const { merged } = mergeWorkspaces(base, ws([cust("a", "Anna L."), cust("b", "Bernd")]), ws([cust("a", "Anna"), cust("b", "Bernd R.")]));
    expect(merged.customers.map((c) => c.name)).toEqual(["Anna L.", "Bernd R."]);
  });

  it("respects deletions made on either side", () => {
    const { merged } = mergeWorkspaces(base, ws([cust("b", "Bernd")]), ws([cust("a", "Anna"), cust("b", "Bernd"), cust("r", "Remote")]));
    expect(merged.customers.map((c) => c.id)).toEqual(["b", "r"]);
  });

  it("prefers this browser's version when both changed the same item, and reports it", () => {
    const { merged, clashes } = mergeWorkspaces(base, ws([cust("a", "Anna L."), cust("b", "Bernd")]), ws([cust("a", "Anna R."), cust("b", "Bernd")]));
    expect(merged.customers[0].name).toBe("Anna L.");
    expect(clashes).toBe(1);
  });

  it("takes the other side's profile when only they changed it", () => {
    const { merged } = mergeWorkspaces(base, ws(base.customers), ws(base.customers, "Mill & Sons"));
    expect(merged.profile.businessName).toBe("Mill & Sons");
  });
});
