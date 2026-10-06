import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import { Link } from "react-router-dom";
import { LogOut } from "lucide-react";
import { myWorkspaces } from "@/features/cloud/api";
import { useAuth } from "@/features/cloud/auth";
import { AuthFrame, AuthLoading, AuthScreen } from "@/features/cloud/AuthScreen";
import { cloudPersistence } from "@/features/cloud/persistence";
import { btnGhost, btnPrimary } from "@/features/digital/components";
import { useWorkspace } from "@/features/digital/store";
import { WorkspaceShell } from "./WorkspaceShell";
import { useT } from "@/i18n";

const DEVICE_MODE_KEY = "legacylift.deviceMode";
const LAST_FIRM_KEY = "legacylift.lastFirm";

const readKey = (k: string) => {
  try {
    return localStorage.getItem(k);
  } catch {
    return null;
  }
};
const writeKey = (k: string, v: string | null) => {
  try {
    if (v === null) localStorage.removeItem(k);
    else localStorage.setItem(k, v);
  } catch {
    // storage blocked
  }
};

const sidebarBtn =
  "inline-flex items-center gap-1.5 rounded-md px-2 py-1.5 text-xs text-ll-sidebar-muted hover:text-ll-sidebar-foreground hover:bg-white/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ll-highlight";

export default function ClientEntry() {
  const t = useT();
  const auth = useAuth();
  const [deviceMode, setDeviceMode] = useState(() => readKey(DEVICE_MODE_KEY) === "1");

  if (deviceMode) {
    return (
      <WorkspaceShell
        account={
          <div className="px-3 flex flex-col gap-1.5">
            <p className="text-[12px] leading-snug text-ll-sidebar-muted">{t("Have an account? Sign in to keep your work safe online and share it with your adviser.")}</p>
            <button
              type="button"
              className={`${sidebarBtn} self-start bg-white/10 text-ll-sidebar-foreground`}
              onClick={() => {
                writeKey(DEVICE_MODE_KEY, null);
                setDeviceMode(false);
              }}
            >
              {t("Sign in")}
            </button>
          </div>
        }
      />
    );
  }
  if (!auth.ready) return <AuthLoading />;
  if (!auth.session || auth.recovering) {
    return (
      <AuthScreen
        eyebrow={t("Your business")}
        title={t("Sign in to LegacyLift")}
        intro={t("Use the email address your LegacyLift adviser invited. New here? Create an account with that email.")}
        deviceOption={{
          label: t("Try it without an account"),
          onChoose: () => {
            writeKey(DEVICE_MODE_KEY, "1");
            setDeviceMode(true);
          },
        }}
      />
    );
  }
  return <SignedIn key={auth.session.user.id} />;
}

function SignedIn() {
  const t = useT();
  const auth = useAuth();
  const [list, setList] = useState<{ firmId: string; name: string }[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [firmId, setFirmId] = useState<string | null>(() => readKey(LAST_FIRM_KEY));

  const load = useCallback(async () => {
    setList(null);
    setError(null);
    try {
      await auth.refreshAccess();
      setList(await myWorkspaces());
    } catch (err) {
      setError(err instanceof Error ? err.message : t("Couldn't load your businesses."));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  if (error) {
    return (
      <AuthFrame eyebrow={t("Your business")} title={t("Something went wrong")}>
        <p className="text-sm text-muted-foreground mb-4">{error}</p>
        <div className="flex gap-2">
          <button type="button" className={btnPrimary} onClick={() => void load()}>
            {t("Try again")}
          </button>
          <button type="button" className={btnGhost} onClick={() => void auth.signOut()}>
            {t("Sign out")}
          </button>
        </div>
      </AuthFrame>
    );
  }
  if (!list) return <AuthLoading text={t("Opening your business…")} />;

  if (list.length === 0) {
    return (
      <AuthFrame eyebrow={t("Almost there")} title={t("Your account isn't linked to a business yet")}>
        <div className="flex flex-col gap-4 text-sm">
          <p>
            {t("You're signed in as")} <strong>{auth.email}</strong>. {t("Ask your LegacyLift adviser to invite this email address, then click Check again.")}
          </p>
          <div className="flex flex-wrap gap-2">
            <button type="button" className={btnPrimary} onClick={() => void load()}>
              {t("Check again")}
            </button>
            <button type="button" className={btnGhost} onClick={() => void auth.signOut()}>
              {t("Sign out")}
            </button>
          </div>
          {auth.staff && (
            <p className="text-muted-foreground">
              {t("You're on the LegacyLift team.")}{" "}
              <Link to="/internal" className="text-primary underline">
                {t("Open the team console")}
              </Link>
            </p>
          )}
        </div>
      </AuthFrame>
    );
  }

  const current = list.find((w) => w.firmId === firmId) ?? list[0];
  return (
    <CloudWorkspace
      firmId={current.firmId}
      account={
        <AccountBox
          email={auth.email}
          list={list}
          currentId={current.firmId}
          staff={Boolean(auth.staff)}
          onSwitch={(id) => {
            writeKey(LAST_FIRM_KEY, id);
            setFirmId(id);
          }}
          onSignOut={() => void auth.signOut()}
        />
      }
    />
  );
}

function CloudWorkspace({ firmId, account }: { firmId: string; account: ReactNode }) {
  const persistence = useMemo(() => cloudPersistence(firmId), [firmId]);
  return <WorkspaceShell workspaceKey={firmId} persistence={persistence} account={account} />;
}

function AccountBox({
  email,
  list,
  currentId,
  staff,
  onSwitch,
  onSignOut,
}: {
  email: string;
  list: { firmId: string; name: string }[];
  currentId: string;
  staff: boolean;
  onSwitch: (id: string) => void;
  onSignOut: () => void;
}) {
  const t = useT();
  const { sync } = useWorkspace();
  return (
    <div className="px-3 flex flex-col gap-2 border-t border-white/10 pt-3">
      {list.length > 1 && (
        <label className="flex flex-col gap-1 text-[11px] uppercase tracking-[0.14em] text-ll-sidebar-muted">
          {t("Business")}
          <select
            id="switch-business"
            value={currentId}
            onChange={(e) => {
              const id = e.target.value;
              void sync.flushNow().finally(() => onSwitch(id));
            }}
            className="rounded-md border border-white/15 bg-white/5 px-2 py-1.5 text-sm normal-case tracking-normal text-ll-sidebar-foreground focus:outline-none focus-visible:ring-2 focus-visible:ring-ll-highlight"
          >
            {list.map((w) => (
              <option key={w.firmId} value={w.firmId} className="text-black">
                {w.name}
              </option>
            ))}
          </select>
        </label>
      )}
      <p className="text-[12px] text-ll-sidebar-muted truncate" title={email}>
        {t("Signed in as {email}", { email })}
      </p>
      <div className="flex flex-wrap gap-1">
        {staff && (
          <Link to="/internal" className={sidebarBtn}>
            {t("Team console")}
          </Link>
        )}
        <button type="button" className={sidebarBtn} onClick={() => void sync.flushNow().finally(onSignOut)}>
          <LogOut size={13} aria-hidden="true" /> {t("Sign out")}
        </button>
      </div>
    </div>
  );
}
