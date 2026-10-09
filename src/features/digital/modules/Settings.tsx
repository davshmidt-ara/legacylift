import { useEffect, useRef, useState } from "react";
import { Download, Upload } from "lucide-react";
import { toast } from "sonner";
import { isWorkspaceBackup, migrate, useWorkspace } from "../store";
import type { BusinessProfile, WorkspaceState } from "../types";
import { standardVat } from "../countries";
import { CountrySelect, PageHeader, Panel, btnDanger, btnGhost, btnPrimary, download, fieldClass, labelClass, linkClass } from "../components";
import { Link } from "react-router-dom";
import { useOptionalAuth } from "@/features/cloud/auth";
import { deleteMyAccount } from "@/features/cloud/api";
import { LANGS, useLang, useT, type Lang } from "@/i18n";

const CURRENCIES = ["EUR", "GBP", "USD", "CHF", "SEK", "NOK", "DKK", "PLN", "CZK", "AMD", "INR", "AUD", "CAD"];

const Settings = () => {
  const t = useT();
  const { lang, setLang } = useLang();
  const { state, sync, setProfile, replaceAll, reset, loadSampleData } = useWorkspace();
  const online = sync.status !== "device";
  const [p, setP] = useState<BusinessProfile>(state.profile);
  const [pending, setPending] = useState<{ name: string; data: WorkspaceState } | null>(null);

  // Keep the form in step when the profile changes elsewhere (example data, restore).
  // Keep the form in step with changes made elsewhere (example data, restore, a colleague saving),
  // but never overwrite what the person is in the middle of typing.
  const shownProfile = useRef(state.profile);
  useEffect(() => {
    setP((current) => (JSON.stringify(current) === JSON.stringify(shownProfile.current) ? state.profile : current));
    shownProfile.current = state.profile;
  }, [state.profile]);
  const [confirmReset, setConfirmReset] = useState(false);
  const [confirmName, setConfirmName] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);

  const text = (key: keyof BusinessProfile, label: string, opts: { type?: string; mono?: boolean; wide?: boolean; placeholder?: string } = {}) => (
    <label className={`${labelClass} ${opts.wide ? "sm:col-span-2" : ""}`}>
      {label}
      <input
        id={`profile-${key}`}
        type={opts.type ?? "text"}
        className={`${fieldClass} ${opts.mono ? "font-mono" : ""}`}
        placeholder={opts.placeholder}
        value={p[key] as string}
        onChange={(e) => setP({ ...p, [key]: e.target.value })}
      />
    </label>
  );

  async function importBackup(file: File) {
    let raw: unknown;
    try {
      raw = JSON.parse(await file.text());
    } catch {
      raw = null;
    }
    if (!isWorkspaceBackup(raw)) {
      toast.error(t("That file isn't a LegacyLift backup. Choose a file saved with “Download backup”."));
      return;
    }
    setPending({ name: file.name, data: migrate(raw) });
  }

  return (
    <div className="max-w-4xl">
      <PageHeader eyebrow={t("Settings")} title={t("Your business")} description={t("These details appear on every invoice and quote, and help the AI write in your name.")} />

      <form
        className="flex flex-col gap-6"
        onSubmit={(e) => {
          e.preventDefault();
          setProfile(p);
          toast.success(t("Business details saved"));
        }}
      >
        <Panel className="grid gap-4 sm:grid-cols-2">
          <h2 className="sm:col-span-2 font-heading text-lg font-semibold">{t("Company")}</h2>
          {text("businessName", t("Business name"), { placeholder: t("e.g. SIA Kalniņa Galdniecība") })}
          {text("ownerName", t("Owner / contact person"))}
          <label className={`${labelClass} sm:col-span-2`}>
            {t("Address")}
            <textarea id="profile-address" rows={3} className={fieldClass} value={p.address} onChange={(e) => setP({ ...p, address: e.target.value })} />
          </label>
          <label className={labelClass}>
            {t("Country")}
            <CountrySelect
              id="profile-country"
              value={p.country}
              blankLabel={t("Choose a country…")}
              onChange={(country) =>
                // Follow the new country's standard VAT rate, unless a custom rate was set.
                setP({ ...p, country, defaultTaxRate: p.defaultTaxRate === (standardVat(p.country) ?? p.defaultTaxRate) ? (standardVat(country) ?? p.defaultTaxRate) : p.defaultTaxRate })
              }
            />
          </label>
          {text("taxId", t("VAT / tax number"), { mono: true })}
          {text("email", t("Email"), { type: "email" })}
          {text("phone", t("Phone"), { type: "tel" })}
          {text("bankDetails", t("Bank details (printed on invoices)"), { wide: true, placeholder: t("Bank · IBAN · BIC") })}
        </Panel>

        <Panel className="grid gap-4 sm:grid-cols-3">
          <h2 className="sm:col-span-3 font-heading text-lg font-semibold">{t("Invoicing")}</h2>
          <label className={labelClass}>
            {t("Currency")}
            <select id="profile-currency" className={fieldClass} value={p.currency} onChange={(e) => setP({ ...p, currency: e.target.value })}>
              {CURRENCIES.map((c) => (
                <option key={c}>{c}</option>
              ))}
            </select>
          </label>
          <label className={labelClass}>
            {t("Default VAT rate (%)")}
            <input id="profile-tax" type="number" min={0} step="0.1" className={`${fieldClass} font-mono`} value={p.defaultTaxRate} onChange={(e) => setP({ ...p, defaultTaxRate: Number(e.target.value) })} />
          </label>
          <label className={labelClass}>
            {t("Payment terms (days)")}
            <input id="profile-terms" type="number" min={0} className={`${fieldClass} font-mono`} value={p.paymentTermsDays} onChange={(e) => setP({ ...p, paymentTermsDays: Number(e.target.value) })} />
          </label>
          {text("invoicePrefix", t("Invoice number prefix"), { mono: true, placeholder: t("INV") })}
          {text("quotePrefix", t("Quote number prefix"), { mono: true, placeholder: t("QUO") })}
          <p className="text-xs text-muted-foreground self-end pb-2">
            {t("Next invoice:")} <span className="font-mono">{`${p.invoicePrefix || t("INV")}-${new Date().getFullYear()}-0001`}</span>
          </p>
          <label className={`${labelClass} sm:col-span-3`}>
            {t("Footer line on invoices")}
            <input id="profile-footer" className={fieldClass} value={p.invoiceFooter} onChange={(e) => setP({ ...p, invoiceFooter: e.target.value })} placeholder={t("Thank you for your business.")} />
          </label>
        </Panel>

        <div>
          <button type="submit" className={btnPrimary}>
            {t("Save details")}
          </button>
        </div>
      </form>

      <Panel className="mt-10 flex flex-col gap-3">
        <h2 className="font-heading text-lg font-semibold">{t("Language")}</h2>
        <p className="text-sm text-muted-foreground">{t("The language of LegacyLift on this device, of printed invoices and of AI answers.")}</p>
        <select
          id="profile-language"
          aria-label={t("Language")}
          className={`${fieldClass} max-w-xs`}
          value={lang}
          onChange={(e) => setLang(e.target.value as Lang)}
        >
          {LANGS.map((l) => (
            <option key={l.id} value={l.id}>
              {l.name}
            </option>
          ))}
        </select>
      </Panel>

      {online && <YourAccount />}

      <Panel className="mt-10 flex flex-col gap-4">
        <div>
          <h2 className="font-heading text-lg font-semibold">{t("Your data")}</h2>
          <p className="text-sm text-muted-foreground">
            {online
              ? t("Everything is saved online and shared with your LegacyLift adviser. You can also download a backup to keep your own copy.")
              : t("Everything is stored in this browser on this device. Download a backup regularly and keep it somewhere safe; you can restore it here or on another computer.")}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button type="button" className={btnGhost} onClick={() => download(`legacylift-backup-${new Date().toISOString().slice(0, 10)}.json`, JSON.stringify(state, null, 2), "application/json")}>
            <Download size={16} aria-hidden="true" /> {t("Download backup")}
          </button>
          <button type="button" className={btnGhost} onClick={() => fileRef.current?.click()}>
            <Upload size={16} aria-hidden="true" /> {t("Restore backup")}
          </button>
          <input
            ref={fileRef}
            type="file"
            accept="application/json,.json"
            className="sr-only"
            aria-label={t("Choose a backup file")}
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) importBackup(f);
              e.target.value = "";
            }}
          />
          <button type="button" className={btnGhost} onClick={loadSampleData}>
            {t("Add example data")}
          </button>
        </div>
        {pending && (
          <div role="alert" className="rounded-md border border-ll-highlight/60 bg-ll-highlight/10 p-4 flex flex-col gap-3 text-sm">
            <p>
              <strong>{pending.name}</strong>{" "}
              {t("contains {business}customers ({customers}), invoices and quotes ({invoices}), stock items ({stock}) and documents ({records}). Restoring replaces everything currently in this workspace.", {
                business: pending.data.profile.businessName ? `“${pending.data.profile.businessName}”: ` : "",
                customers: pending.data.customers.length,
                invoices: pending.data.invoices.length,
                stock: pending.data.stock.length,
                records: pending.data.records.length,
              })}
            </p>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                className={btnPrimary}
                onClick={() => {
                  replaceAll(pending.data);
                  setPending(null);
                  toast.success(t("Backup restored"));
                }}
              >
                {t("Replace with this backup")}
              </button>
              <button type="button" className={btnGhost} onClick={() => setPending(null)}>
                {t("Cancel")}
              </button>
            </div>
          </div>
        )}
        <div className="border-t border-border pt-4 flex flex-wrap items-center gap-3">
          {confirmReset ? (
            <>
              <span className="text-sm basis-full">
                {online ? (
                  <>
                    {t("This permanently deletes all customers, invoices, stock and documents of")} <strong>{state.profile.businessName || t("this business")}</strong>{" "}
                    <strong>{t("for everyone who uses it")}</strong>
                    {t(", including your LegacyLift adviser. Download a backup first. Type the business name to confirm.")}
                  </>
                ) : (
                  t("This deletes all customers, invoices, stock and documents in this browser.")
                )}
              </span>
              {online && (
                <input
                  id="confirm-business-name"
                  aria-label={t("Type the business name to confirm")}
                  className={`${fieldClass} max-w-xs`}
                  value={confirmName}
                  onChange={(e) => setConfirmName(e.target.value)}
                  placeholder={state.profile.businessName}
                />
              )}
              <button
                type="button"
                className={btnDanger}
                disabled={online && confirmName.trim() !== (state.profile.businessName || "").trim()}
                onClick={() => {
                  // Online, keep the business name so the workspace stays recognisable.
                  reset();
                  if (online) setProfile({ businessName: state.profile.businessName });
                  setP(online ? { ...migrate({}).profile, businessName: state.profile.businessName } : migrate({}).profile);
                  setConfirmReset(false);
                  setConfirmName("");
                  toast.success(t("Workspace cleared"));
                }}
              >
                {t("Yes, delete everything")}
              </button>
              <button
                type="button"
                className={btnGhost}
                onClick={() => {
                  setConfirmReset(false);
                  setConfirmName("");
                }}
              >
                {t("Cancel")}
              </button>
            </>
          ) : (
            <button type="button" className={`${btnGhost} text-destructive`} onClick={() => setConfirmReset(true)}>
              {t("Clear workspace…")}
            </button>
          )}
        </div>
      </Panel>
    </div>
  );
};

/** The signed-in client's own account: privacy links and deleting the account. Not shown to the team. */
function YourAccount() {
  const t = useT();
  const auth = useOptionalAuth();
  const [confirming, setConfirming] = useState(false);
  const [typed, setTyped] = useState("");
  const [busy, setBusy] = useState(false);
  if (!auth?.session || auth.staff) return null;
  return (
    <Panel className="mt-10 flex flex-col gap-3">
      <h2 className="font-heading text-lg font-semibold">{t("Your account")}</h2>
      <p className="text-sm text-muted-foreground">
        {t("Signed in as {email}", { email: auth.email })} ·{" "}
        <Link to="/privacy" className={linkClass}>
          {t("Privacy policy")}
        </Link>{" "}
        ·{" "}
        <Link to="/terms" className={linkClass}>
          {t("Terms of use")}
        </Link>
      </p>
      {confirming ? (
        <div role="alert" className="rounded-md border border-destructive/50 bg-destructive/5 p-4 flex flex-col gap-3 text-sm">
          <p>{t("This permanently deletes your account. A business you set up yourself is deleted with everything in it; a business your LegacyLift adviser set up stays with them. Download a backup first if you want to keep a copy.")}</p>
          <label className={labelClass}>
            {t("Type your email address to confirm")}
            <input id="confirm-delete-account" className={`${fieldClass} max-w-sm`} value={typed} onChange={(e) => setTyped(e.target.value)} placeholder={auth.email} />
          </label>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              className={btnDanger}
              disabled={busy || typed.trim().toLowerCase() !== auth.email.toLowerCase()}
              onClick={async () => {
                setBusy(true);
                try {
                  await deleteMyAccount();
                  toast.success(t("Your account has been deleted."));
                  await auth.signOut();
                } catch (err) {
                  toast.error(err instanceof Error ? err.message : t("Something went wrong. Please try again."));
                  setBusy(false);
                }
              }}
            >
              {t("Delete my account permanently")}
            </button>
            <button type="button" className={btnGhost} onClick={() => setConfirming(false)}>
              {t("Cancel")}
            </button>
          </div>
        </div>
      ) : (
        <button type="button" className={`${btnGhost} self-start text-destructive`} onClick={() => setConfirming(true)}>
          {t("Delete my account…")}
        </button>
      )}
    </Panel>
  );
}

export default Settings;
