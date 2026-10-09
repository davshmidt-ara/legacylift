import { AuthProvider } from "@/features/cloud/auth";
import { useNoIndex } from "@/lib/site";
import { WorkspaceShell } from "./WorkspaceShell";
import ClientEntry from "./ClientEntry";

/** The firm-facing app: sign in to your business's workspace, or try it on this device only. */
const DigitalApp = ({ deviceOnly = false }: { deviceOnly?: boolean }) => {
  useNoIndex();
  return deviceOnly ? (
    <WorkspaceShell />
  ) : (
    <AuthProvider>
      <ClientEntry />
    </AuthProvider>
  );
};

export default DigitalApp;
