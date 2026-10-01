import type { Persistence } from "@/features/digital/store";
import { fetchWorkspace, saveWorkspace, watchWorkspace } from "./api";

/** A firm's workspace stored in the Supabase `workspaces` table. */
export function cloudPersistence(firmId: string): Persistence {
  return {
    load: () => fetchWorkspace(firmId),
    save: (state, version) => saveWorkspace(firmId, state, version),
    watch: (onRemote) => watchWorkspace(firmId, onRemote),
  };
}
