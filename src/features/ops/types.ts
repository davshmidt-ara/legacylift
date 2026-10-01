export type PackageId = "start" | "suite" | "partner";
export type Stage = "lead" | "onboarding" | "active" | "paused";

export const STAGES: Stage[] = ["lead", "onboarding", "active", "paused"];

export interface LogEntry {
  id: string;
  at: string; // ISO timestamp
  text: string;
  author?: string;
}

/** A client firm the team delivers LegacyLift services to. Its business data lives in its own workspace. */
export interface Client {
  id: string;
  firmName: string;
  contactName: string;
  email: string;
  phone: string;
  industry: string;
  city: string;
  package: PackageId;
  stage: Stage;
  owner: string; // team member responsible
  notes: string;
  manualDone: string[]; // ids of checklist tasks ticked by hand
  log: LogEntry[];
  createdAt: string;
}

export interface OpsState {
  version: 1;
  teamMember: string; // who is using this browser, used on log entries
  clients: Client[];
}
