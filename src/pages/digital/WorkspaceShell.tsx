import { useEffect, useState, type ReactNode } from "react";
import { Link, NavLink, Route, Routes } from "react-router-dom";
import {
  Archive,
  Bot,
  Boxes,
  Cloud,
  CloudOff,
  HardDrive,
  Loader2,
  FileScan,
  LayoutDashboard,
  Map,
  Menu,
  PenLine,
  Plus,
  ReceiptText,
  Settings as SettingsIcon,
  Users,
  X,
  type LucideIcon,
} from "lucide-react";
import { WorkspaceProvider, useWorkspace, type Persistence } from "@/features/digital/store";
import { WorkspaceBaseContext, useBase } from "@/features/digital/base";
import { lowStock, receivables } from "@/features/digital/finance";
import Dashboard from "@/features/digital/modules/Dashboard";
import Invoices from "@/features/digital/modules/Invoices";
import Customers from "@/features/digital/modules/Customers";
import Inventory from "@/features/digital/modules/Inventory";
import Digitize from "@/features/digital/modules/Digitize";
import Records from "@/features/digital/modules/Records";
import Assistant from "@/features/digital/modules/Assistant";
import RoadmapModule from "@/features/digital/modules/Roadmap";
import Writer from "@/features/digital/modules/Writer";
import Settings from "@/features/digital/modules/Settings";
import { msg, useT } from "@/i18n";
import { LanguageSwitch } from "@/i18n/LanguageSwitch";

interface NavEntry {
  to: string; // relative to the workspace base
  label: string;
  icon: LucideIcon;
  end?: boolean;
  badge?: "overdue" | "lowStock";
}

const GROUPS: { title: string; items: NavEntry[] }[] = [
  {
    title: msg("Run the business"),
    items: [
      { to: "", label: msg("Overview"), icon: LayoutDashboard, end: true },
      { to: "/invoices", label: msg("Invoices & quotes"), icon: ReceiptText, badge: "overdue" },
      { to: "/customers", label: msg("Customers"), icon: Users },
      { to: "/stock", label: msg("Stock"), icon: Boxes, badge: "lowStock" },
    ],
  },
  {
    title: msg("AI tools"),
    items: [
      { to: "/digitize", label: msg("Digitize paper"), icon: FileScan },
      { to: "/documents", label: msg("Documents"), icon: Archive },
      { to: "/assistant", label: msg("Assistant"), icon: Bot },
      { to: "/writer", label: msg("Writer"), icon: PenLine },
      { to: "/roadmap", label: msg("Digital roadmap"), icon: Map },
    ],
  },
];

function NavItems({ onNavigate }: { onNavigate?: () => void }) {
  const t = useT();
  const { state } = useWorkspace();
  const base = useBase();
  const counts = { overdue: receivables(state.invoices).overdueCount, lowStock: lowStock(state.stock).length };
  const item = ({ to, label, icon: Icon, end, badge }: NavEntry) => (
    <li key={to}>
      <NavLink
        to={`${base}${to}`}
        end={end}
        onClick={onNavigate}
        className={({ isActive }) =>
          `flex items-center gap-3 rounded-md px-3 py-2 text-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ll-highlight ${
            isActive ? "bg-white/10 text-ll-sidebar-foreground font-medium" : "text-ll-sidebar-muted hover:text-ll-sidebar-foreground hover:bg-white/5"
          }`
        }
      >
        <Icon size={17} aria-hidden="true" />
        <span className="flex-1">{t(label)}</span>
        {badge && counts[badge] > 0 && (
          <span
            className={`min-w-5 rounded-full px-1.5 text-center text-[11px] font-semibold font-mono ${badge === "overdue" ? "bg-destructive text-white" : "bg-ll-highlight text-black"}`}
            aria-label={t(badge === "overdue" ? "Overdue: {n}" : "Low stock: {n}", { n: counts[badge] })}
          >
            {counts[badge]}
          </span>
        )}
      </NavLink>
    </li>
  );
  return (
    <div className="flex flex-col gap-6">
      {GROUPS.map((g) => (
        <div key={g.title}>
          <p className="px-3 mb-1 text-[11px] uppercase tracking-[0.14em] text-ll-sidebar-muted/80">{t(g.title)}</p>
          <ul className="flex flex-col gap-0.5">{g.items.map(item)}</ul>
        </div>
      ))}
      <ul>{item({ to: "/settings", label: msg("Settings"), icon: SettingsIcon })}</ul>
    </div>
  );
}

export function Brand({ to = "/", suffix }: { to?: string; suffix?: string }) {
  return (
    <Link to={to} className="flex items-center gap-2 px-3 font-heading text-xl font-extrabold text-ll-sidebar-foreground rounded focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ll-highlight">
      <span className="inline-block h-5 w-5 rounded-sm bg-ll-highlight" aria-hidden="true" />
      LegacyLift
      {suffix && <span className="rounded bg-white/10 px-1.5 py-0.5 text-[10px] font-body font-semibold uppercase tracking-wider text-ll-sidebar-muted">{suffix}</span>}
    </Link>
  );
}

/** The two things people do most, one click away from every page. */
function QuickNew({ onNavigate }: { onNavigate?: () => void }) {
  const t = useT();
  const base = useBase();
  const cls =
    "flex-1 inline-flex items-center justify-center gap-1.5 rounded-md px-2 py-2 text-sm font-medium focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ll-highlight";
  return (
    <div className="mt-6 mb-4 flex gap-2 px-1">
      <Link to={`${base}/invoices/new?kind=invoice`} onClick={onNavigate} className={`${cls} bg-ll-highlight text-black hover:bg-ll-highlight/90`}>
        <Plus size={15} aria-hidden="true" /> {t("Invoice")}
      </Link>
      <Link to={`${base}/digitize`} onClick={onNavigate} className={`${cls} bg-white/10 text-ll-sidebar-foreground hover:bg-white/15`}>
        <FileScan size={15} aria-hidden="true" /> {t("Scan")}
      </Link>
    </div>
  );
}

/** Tells people, in plain words, whether their work is safe. */
function SyncBadge() {
  const t = useT();
  const { sync } = useWorkspace();
  const base = "flex items-start gap-2 px-3 text-[12px] leading-snug";
  switch (sync.status) {
    case "device":
      return (
        <p className={`${base} text-ll-sidebar-muted`}>
          <HardDrive size={14} className="mt-0.5 shrink-0" aria-hidden="true" /> {t("Saved on this device only. Download a backup from Settings.")}
        </p>
      );
    case "saving":
      return (
        <p className={`${base} text-ll-sidebar-muted`} role="status">
          <Loader2 size={14} className="mt-0.5 shrink-0 animate-spin" aria-hidden="true" /> {t("Saving…")}
        </p>
      );
    case "error":
      return (
        <div className={`${base} text-ll-highlight flex-col`} role="alert">
          <span className="flex items-start gap-2">
            <CloudOff size={14} className="mt-0.5 shrink-0" aria-hidden="true" /> {t("Not saved yet — trying again. Keep this tab open.")}
          </span>
          <button type="button" onClick={sync.retry} className="underline underline-offset-2 text-ll-sidebar-foreground">
            {t("Try now")}
          </button>
        </div>
      );
    default:
      return (
        <p className={`${base} text-ll-sidebar-muted`} role="status">
          <Cloud size={14} className="mt-0.5 shrink-0" aria-hidden="true" /> {t("All changes saved")}
        </p>
      );
  }
}

function BusinessName() {
  const { state } = useWorkspace();
  return state.profile.businessName ? (
    <p className="px-3 mt-1 text-xs text-ll-sidebar-muted truncate" title={state.profile.businessName}>
      {state.profile.businessName}
    </p>
  ) : null;
}

interface ShellProps {
  /** URL prefix the workspace is mounted at. */
  base?: string;
  /** localStorage key holding this workspace's data (device-only mode). */
  storageKey?: string;
  /** Load and save this workspace here instead of on the device (cloud mode). */
  persistence?: Persistence;
  /** Identifies the workspace for remounting when it changes (e.g. the firm id). */
  workspaceKey?: string;
  /** Account box at the bottom of the sidebar (who is signed in, switch business, sign out). */
  account?: ReactNode;
  /** Where the logo links to. */
  homeHref?: string;
  /** Small label next to the logo, e.g. "Ops". */
  brandSuffix?: string;
  /** Extra content above the logo, e.g. "All clients" in the internal console. */
  sidebarTop?: ReactNode;
  title?: string;
}

export function WorkspaceShell({
  base = "/app",
  storageKey,
  persistence,
  workspaceKey,
  account,
  homeHref = "/",
  brandSuffix,
  sidebarTop,
  title = "LegacyLift",
}: ShellProps) {
  const t = useT();
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const prev = document.title;
    document.title = title;
    return () => {
      document.title = prev;
    };
  }, [title]);

  return (
    <WorkspaceBaseContext.Provider value={base}>
      <WorkspaceProvider key={workspaceKey ?? storageKey} storageKey={storageKey} persistence={persistence}>
        <div className="theme-legacylift min-h-screen md:flex">
          <aside className="no-print hidden md:flex md:w-64 md:shrink-0 md:flex-col md:bg-ll-sidebar md:py-6 md:px-3 md:sticky md:top-0 md:h-screen md:overflow-y-auto">
            {sidebarTop}
            <Brand to={homeHref} suffix={brandSuffix} />
            <BusinessName />
            <QuickNew />
            <nav aria-label={t("Workspace")} className="mt-3">
              <NavItems />
            </nav>
            <div className="mt-auto pt-6 flex flex-col gap-3">
              <SyncBadge />
              {account}
              <LanguageSwitch className="mx-3 self-start" />
            </div>
          </aside>

          <header className="no-print md:hidden sticky top-0 z-40 flex items-center justify-between bg-ll-sidebar px-4 py-3">
            <Brand to={homeHref} suffix={brandSuffix} />
            <button
              type="button"
              onClick={() => setOpen((o) => !o)}
              aria-expanded={open}
              aria-controls="workspace-mobile-nav"
              aria-label={open ? t("Close menu") : t("Open menu")}
              className="min-h-11 min-w-11 inline-flex items-center justify-center rounded text-ll-sidebar-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ll-highlight"
            >
              {open ? <X size={22} aria-hidden="true" /> : <Menu size={22} aria-hidden="true" />}
            </button>
          </header>
          {open && (
            <nav id="workspace-mobile-nav" aria-label={t("Workspace")} className="no-print md:hidden flex flex-col bg-ll-sidebar px-3 pt-1 pb-4">
              {sidebarTop}
              <QuickNew onNavigate={() => setOpen(false)} />
              <NavItems onNavigate={() => setOpen(false)} />
              <div className="mt-6 flex flex-col gap-3">
                <SyncBadge />
                {account}
                <LanguageSwitch className="mx-3 self-start" />
              </div>
            </nav>
          )}

          <main className="flex-1 min-w-0 px-4 py-6 sm:px-6 md:px-10 md:py-10">
            <Routes>
              <Route index element={<Dashboard />} />
              <Route path="invoices/*" element={<Invoices />} />
              <Route path="customers/*" element={<Customers />} />
              <Route path="stock" element={<Inventory />} />
              <Route path="digitize" element={<Digitize />} />
              <Route path="documents" element={<Records />} />
              <Route path="records" element={<Records />} />
              <Route path="assistant" element={<Assistant />} />
              <Route path="writer" element={<Writer />} />
              <Route path="roadmap" element={<RoadmapModule />} />
              <Route path="settings" element={<Settings />} />
            </Routes>
          </main>
        </div>
      </WorkspaceProvider>
    </WorkspaceBaseContext.Provider>
  );
}
