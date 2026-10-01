import { AuthProvider } from "@/features/cloud/auth";
import { WorkspaceShell } from "./WorkspaceShell";
import ClientEntry from "./ClientEntry";

/** The firm-facing app: sign in to your business's workspace, or try it on this device only. */
const DigitalApp = ({ deviceOnly = false }: { deviceOnly?: boolean }) =>
  deviceOnly ? (
    <WorkspaceShell />
  ) : (
    <AuthProvider>
      <ClientEntry />
    </AuthProvider>
  );

export default DigitalApp;
