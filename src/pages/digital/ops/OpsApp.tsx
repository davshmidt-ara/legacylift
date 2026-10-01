import { useEffect, useMemo, useState } from "react";
import { Link, NavLink, Route, Routes, useParams } from "react-router-dom";
import { ArrowLeft, BookOpen, Building2, LayoutDashboard, LogOut, Menu, Users, X, type LucideIcon } from "lucide-react";
import { toast } from "sonner";
import { clientStorageKey } from "@/features/digital/store";
import { OpsProvider, useOps } from "@/features/ops/store";
import { AuthProvider, useAuth } from "@/features/cloud/auth";
import { AuthFrame, AuthLoading, AuthScreen } from "@/features/cloud/AuthScreen";
import { CloudOpsProvider } from "@/features/cloud/CloudOpsProvider";
import { cloudPersistence } from "@/features/cloud/persistence";
import { staffExists } from "@/features/cloud/api";
import { btnGhost, btnPrimary } from "@/features/digital/components";
import { Brand, WorkspaceShell } from "../WorkspaceShell";
import { OPS, OpsClientDetail, OpsClients, OpsOverview, OpsPlaybook, OpsTeam, StagePill, clientBase } from "./OpsPages";

const NAV: { to: string; label: string; icon: LucideIcon; end?: boolean }[] = [
  { to: OPS, label: "Overview", icon: LayoutDashboard, end: true },
  { to: `${OPS}/clients`, label: "Clients", icon: Building2 },
  { to: `${OPS}/playbook`, label: "Service playbook", icon: BookOpen },
];

function TeamMember() {
  const { mode, ops, setTeamMember } = useOps();
  if (mode === "cloud") return <SignedInAs />;
  return (
    <label className="flex flex-col gap-1 px-3 text-[11px] uppercase tracking-[0.14em] text-ll-sidebar-muted">
      Signed in as
      <input
        id="ops-team-member"
        value={ops.teamMember}
        placeholder="Your name"
        onChange={(e) => setTeamMember(e.target.value)}
        className="rounded-md border border-white/15 bg-white/5 px-2 py-1.5 text-sm normal-case tracking-normal text-ll-sidebar-foreground placeholder:text-ll-sidebar-muted focus:outline-none focus-visible:ring-2 focus-visible:ring-ll-highlight"
      />
    </label>
  );
}

function OpsNav({ onNavigate }: { onNavigate?: () => void }) {
  const { mode } = useOps();
  const items = mode === "cloud" ? [...NAV, { to: `${OPS}/team`, label: "Team", icon: Users }] : NAV;
  return (
    <ul className="flex flex-col gap-0.5">
      {items.map(({ to, label, icon: Icon, end }: (typeof NAV)[number]) => (
        <li key={to}>
          <NavLink
            to={to}
            end={end}
            onClick={onNavigate}
            className={({ isActive }) =>
              `flex items-center gap-3 rounded-md px-3 py-2 text-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ll-highlight ${
                isActive ? "bg-white/10 text-ll-sidebar-foreground font-medium" : "text-ll-sidebar-muted hover:text-ll-sidebar-foreground hover:bg-white/5"
              }`
            }
          >
            <Icon size={17} aria-hidden="true" />
            {label}
          </NavLink>
        </li>
      ))}
    </ul>
  );
}

function SignedInAs() {
  const auth = useAuth();
  return (
    <div className="px-3 flex flex-col gap-1.5">
      <p className="text-[12px] text-ll-sidebar-muted truncate" title={auth.email}>
        Signed in as {auth.staff?.displayName || auth.email}
      </p>
      <button
        type="button"
        onClick={() => void auth.signOut()}
        className="self-start inline-flex items-center gap-1.5 rounded-md px-2 py-1.5 text-xs text-ll-sidebar-muted hover:text-ll-sidebar-foreground hover:bg-white/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ll-highlight"
      >
        <LogOut size={13} aria-hidden="true" /> Sign out
      </button>
    </div>
  );
}

function OpsLayout() {
  const [open, setOpen] = useState(false);
  const { mode, refresh } = useOps();
  // Numbers may have changed inside a client's workspace; reload when coming back to the console.
  useEffect(() => {
    void refresh();
  }, [refresh]);
  return (
    <div className="theme-legacylift min-h-screen md:flex">
      <aside className="hidden md:flex md:w-64 md:shrink-0 md:flex-col md:gap-8 md:bg-ll-sidebar md:py-6 md:px-3 md:sticky md:top-0 md:h-screen">
        <Brand to={OPS} suffix="Ops" />
        <nav aria-label="Operations">
          <OpsNav />
        </nav>
        <div className="mt-auto flex flex-col gap-4">
          <TeamMember />
          <p className="px-3 text-[11px] leading-relaxed text-ll-sidebar-muted">
            {mode === "cloud" ? "Internal tool. Shared with your team." : "Demo mode: data stays in this browser."}
          </p>
        </div>
      </aside>
      <header className="md:hidden sticky top-0 z-40 flex items-center justify-between bg-ll-sidebar px-4 py-3">
        <Brand to={OPS} suffix="Ops" />
        <button
          type="button"
          onClick={() => setOpen((o) => !o)}
          aria-expanded={open}
          aria-controls="ops-mobile-nav"
          aria-label={open ? "Close menu" : "Open menu"}
          className="min-h-11 min-w-11 inline-flex items-center justify-center rounded text-ll-sidebar-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ll-highlight"
        >
          {open ? <X size={22} aria-hidden="true" /> : <Menu size={22} aria-hidden="true" />}
        </button>
      </header>
      {open && (
        <nav id="ops-mobile-nav" aria-label="Operations" className="md:hidden bg-ll-sidebar px-3 pb-4 flex flex-col gap-4">
          <OpsNav onNavigate={() => setOpen(false)} />
          <TeamMember />
        </nav>
      )}
      <main className="flex-1 min-w-0 px-4 py-6 sm:px-6 md:px-10 md:py-10">
        <Routes>
          <Route index element={<OpsOverview />} />
          <Route path="clients" element={<OpsClients />} />
          <Route path="clients/:id" element={<OpsClientDetail />} />
          <Route path="playbook" element={<OpsPlaybook />} />
          <Route path="team" element={<OpsTeam />} />
        </Routes>
      </main>
    </div>
  );
}

/** A client's full LegacyLift workspace, run by the team from inside the console. */
function ClientWorkspace() {
  const { id = "" } = useParams();
  const { mode, ops } = useOps();
  const client = ops.clients.find((c) => c.id === id);
  const persistence = useMemo(() => (mode === "cloud" && id ? cloudPersistence(id) : undefined), [mode, id]);
  if (!client) {
    return (
      <div className="theme-legacylift min-h-screen p-10">
        <p className="mb-2">This client no longer exists.</p>
        <Link to={`${OPS}/clients`} className="text-primary underline">
          Back to clients
        </Link>
      </div>
    );
  }
  return (
    <WorkspaceShell
      base={clientBase(client.id)}
      storageKey={clientStorageKey(client.id)}
      persistence={persistence}
      workspaceKey={client.id}
      homeHref={`${OPS}/clients/${client.id}`}
      brandSuffix="Ops"
      title={`${client.firmName} · LegacyLift Ops`}
      sidebarTop={
        <div className="mb-5 mx-1 rounded-md bg-ll-highlight/15 px-3 py-2.5 text-ll-sidebar-foreground">
          <Link
            to={`${OPS}/clients/${client.id}`}
            className="inline-flex items-center gap-1 text-xs text-ll-sidebar-muted hover:text-ll-sidebar-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ll-highlight rounded"
          >
            <ArrowLeft size={13} aria-hidden="true" /> Back to client file
          </Link>
          <p className="mt-1 text-[11px] uppercase tracking-[0.14em] text-ll-highlight">Working on behalf of</p>
          <p className="text-sm font-semibold leading-snug">{client.firmName}</p>
          <div className="mt-1">
            <StagePill stage={client.stage} />
          </div>
        </div>
      }
    />
  );
}

const DEMO_KEY = "legacylift.ops.demoMode";

function OpsRoutes() {
  return (
    <Routes>
      <Route path="clients/:id/workspace/*" element={<ClientWorkspace />} />
      <Route path="*" element={<OpsLayout />} />
    </Routes>
  );
}

/** Signed in, but not on the team yet. The first admin is added once in the Supabase SQL editor. */
function NoAccess() {
  const auth = useAuth();
  const [firstTime, setFirstTime] = useState<boolean | null>(null);
  useEffect(() => {
    staffExists()
      .then((exists) => setFirstTime(!exists))
      .catch(() => setFirstTime(false));
  }, []);
  if (firstTime === null) return <AuthLoading />;
  const sql = `insert into public.staff (user_id, display_name)\nselect id, 'Your name' from auth.users where email = '${auth.email.replace(/'/g, "''")}';`;
  return (
    <AuthFrame eyebrow="Team console" title={firstTime ? "Set up your team" : "You don't have access yet"}>
      <div className="flex flex-col gap-4 text-sm">
        {firstTime ? (
          <>
            <p>
              Nobody is on the team yet. For safety the first admin is added by hand, once. In your Supabase project open <strong>SQL editor</strong>, run
              this line, then click <em>Check again</em>:
            </p>
            <pre className="overflow-x-auto rounded-md border border-border bg-card p-3 font-mono text-xs whitespace-pre">{sql}</pre>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                className={btnGhost}
                onClick={() =>
                  navigator.clipboard.writeText(sql).then(
                    () => toast.success("Copied"),
                    () => toast.error("Copy was blocked. Select the text and copy it."),
                  )
                }
              >
                Copy SQL
              </button>
            </div>
            <p className="text-muted-foreground">After that you add colleagues yourself under Team.</p>
          </>
        ) : (
          <p>
            You're signed in as <strong>{auth.email}</strong>. Ask a LegacyLift admin to add this email under <em>Team</em>, then click <em>Check again</em>.
          </p>
        )}
        <div className="flex gap-2">
          <button type="button" className={btnPrimary} onClick={() => void auth.refreshAccess()}>
            Check again
          </button>
          <button type="button" className={btnGhost} onClick={() => void auth.signOut()}>
            Sign out
          </button>
        </div>
      </div>
    </AuthFrame>
  );
}

function OpsEntry({ seedExamples }: { seedExamples: boolean }) {
  const auth = useAuth();
  const [demo, setDemo] = useState(() => {
    try {
      return sessionStorage.getItem(DEMO_KEY) === "1";
    } catch {
      return false;
    }
  });
  if (demo) {
    return (
      <OpsProvider seedExamples={seedExamples}>
        <OpsRoutes />
      </OpsProvider>
    );
  }
  if (!auth.ready) return <AuthLoading />;
  if (!auth.session || auth.recovering) {
    return (
      <AuthScreen
        eyebrow="Team console"
        title="LegacyLift Ops"
        intro="Sign in with your team account."
        deviceOption={{
          label: "Open demo mode (this device only)",
          onChoose: () => {
            try {
              sessionStorage.setItem(DEMO_KEY, "1");
            } catch {
              // ignore
            }
            setDemo(true);
          },
        }}
      />
    );
  }
  if (!auth.accessReady || (auth.checking && !auth.staff)) return <AuthLoading />;
  if (!auth.staff) return <NoAccess />;
  return (
    <CloudOpsProvider>
      <OpsRoutes />
    </CloudOpsProvider>
  );
}

const OpsApp = ({ seedExamples = false, demoOnly = false }: { seedExamples?: boolean; demoOnly?: boolean }) => {
  useEffect(() => {
    const prev = document.title;
    document.title = "LegacyLift Ops";
    const meta = document.createElement("meta");
    meta.name = "robots";
    meta.content = "noindex, nofollow";
    document.head.appendChild(meta);
    return () => {
      document.title = prev;
      meta.remove();
    };
  }, []);

  if (demoOnly) {
    return (
      <OpsProvider seedExamples={seedExamples}>
        <OpsRoutes />
      </OpsProvider>
    );
  }
  return (
    <AuthProvider>
      <OpsEntry seedExamples={seedExamples} />
    </AuthProvider>
  );
};

export default OpsApp;
