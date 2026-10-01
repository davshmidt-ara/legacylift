import { createContext, useContext } from "react";

/** URL prefix of the workspace. "/app" for a firm's own workspace; the internal console mounts one per client. */
export const WorkspaceBaseContext = createContext("/app");
export const useBase = () => useContext(WorkspaceBaseContext);
