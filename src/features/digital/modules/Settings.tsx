import { useEffect, useRef, useState } from "react";
import { Download, Upload } from "lucide-react";
import { toast } from "sonner";
import { isWorkspaceBackup, migrate, useWorkspace } from "../store";
import type { BusinessProfile, WorkspaceState } from "../types";
import { PageHeader, Panel, btnDanger, btnGhost, btnPrimary, download, fieldClass, labelClass } from "../components";

const CURRENCIES = ["EUR", "GBP", "USD", "CHF", "SEK", "NOK", "DKK", "PLN", "CZK", "AMD", "INR", "AUD", "CAD"];

const Settings = () => {
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
      toast.error("That file isn't a LegacyLift backup. Choose a file saved with “Download backup”.");
      return;
    }
    setPending({ name: file.name, data: migrate(raw) });
  }

  return (
    <div className="max-w-4xl">
      <PageHeader eyebrow="Settings" title="Your business" description="These details appear on every invoice and quote, and help the AI write in your name." />

      <form
        className="flex flex-col gap-6"
        onSubmit={(e) => {
          e.preventDefault();
          setProfile(p);
          toast.success("Business details saved");
        }}
      >
        <Panel className="grid gap-4 sm:grid-cols-2">
          <h2 className="sm:col-span-2 font-heading text-lg font-semibold">Company</h2>
          {text("businessName", "Business name", { placeholder: "Hartmann & Söhne Joinery" })}
          {text("ownerName", "Owner / contact person")}
          <label className={`${labelClass} sm:col-span-2`}>
            Address
            <textarea id="profile-address" rows={3} className={fieldClass} value={p.address} onChange={(e) => setP({ ...p, address: e.target.value })} />
          </label>
          {text("email", "Email", { type: "email" })}
          {text("phone", "Phone", { type: "tel" })}
          {text("taxId", "VAT / tax number", { mono: true })}
          {text("bankDetails", "Bank details (printed on invoices)", { wide: true, placeholder: "Bank · IBAN · BIC" })}
        </Panel>

        <Panel className="grid gap-4 sm:grid-cols-3">
          <h2 className="sm:col-span-3 font-heading text-lg font-semibold">Invoicing</h2>
          <label className={labelClass}>
            Currency
            <select id="profile-currency" className={fieldClass} value={p.currency} onChange={(e) => setP({ ...p, currency: e.target.value })}>
              {CURRENCIES.map((c) => (
                <option key={c}>{c}</option>
              ))}
            </select>
          </label>
          <label className={labelClass}>
            Default tax rate (%)
            <input id="profile-tax" type="number" min={0} step="0.1" className={`${fieldClass} font-mono`} value={p.defaultTaxRate} onChange={(e) => setP({ ...p, defaultTaxRate: Number(e.target.value) })} />
          </label>
          <label className={labelClass}>
            Payment terms (days)
            <input id="profile-terms" type="number" min={0} className={`${fieldClass} font-mono`} value={p.paymentTermsDays} onChange={(e) => setP({ ...p, paymentTermsDays: Number(e.target.value) })} />
          </label>
          {text("invoicePrefix", "Invoice number prefix", { mono: true, placeholder: "INV" })}
          {text("quotePrefix", "Quote number prefix", { mono: true, placeholder: "QUO" })}
          <p className="text-xs text-muted-foreground self-end pb-2">
            Next invoice: <span className="font-mono">{`${p.invoicePrefix || "INV"}-${new Date().getFullYear()}-0001`}</span> style
          </p>
          <label className={`${labelClass} sm:col-span-3`}>
            Footer line on invoices
            <input id="profile-footer" className={fieldClass} value={p.invoiceFooter} onChange={(e) => setP({ ...p, invoiceFooter: e.target.value })} placeholder="Thank you for your business." />
          </label>
        </Panel>

        <div>
          <button type="submit" className={btnPrimary}>
            Save details
          </button>
        </div>
      </form>

      <Panel className="mt-10 flex flex-col gap-4">
        <div>
          <h2 className="font-heading text-lg font-semibold">Your data</h2>
          <p className="text-sm text-muted-foreground">
            Everything is stored in this browser on this device. Download a backup regularly and keep it somewhere safe; you can restore it here or on another computer.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button type="button" className={btnGhost} onClick={() => download(`legacylift-backup-${new Date().toISOString().slice(0, 10)}.json`, JSON.stringify(state, null, 2), "application/json")}>
            <Download size={16} aria-hidden="true" /> Download backup
          </button>
          <button type="button" className={btnGhost} onClick={() => fileRef.current?.click()}>
            <Upload size={16} aria-hidden="true" /> Restore backup
          </button>
          <input
            ref={fileRef}
            type="file"
            accept="application/json,.json"
            className="sr-only"
            aria-label="Choose a backup file"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) importBackup(f);
              e.target.value = "";
            }}
          />
          <button type="button" className={btnGhost} onClick={loadSampleData}>
            Add example data
          </button>
        </div>
        {pending && (
          <div role="alert" className="rounded-md border border-ll-highlight/60 bg-ll-highlight/10 p-4 flex flex-col gap-3 text-sm">
            <p>
              <strong>{pending.name}</strong> contains {pending.data.profile.businessName ? `“${pending.data.profile.businessName}” with ` : ""}
              {pending.data.customers.length} customers, {pending.data.invoices.length} invoices and quotes, {pending.data.stock.length} stock items and{" "}
              {pending.data.records.length} documents. Restoring replaces everything currently in this workspace.
            </p>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                className={btnPrimary}
                onClick={() => {
                  replaceAll(pending.data);
                  setPending(null);
                  toast.success("Backup restored");
                }}
              >
                Replace with this backup
              </button>
              <button type="button" className={btnGhost} onClick={() => setPending(null)}>
                Cancel
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
                    This permanently deletes all customers, invoices, stock and documents of <strong>{state.profile.businessName || "this business"}</strong>{" "}
                    <strong>for everyone who uses it</strong>, including your LegacyLift adviser. Download a backup first. Type the business name to confirm.
                  </>
                ) : (
                  "This deletes all customers, invoices, stock and documents in this browser."
                )}
              </span>
              {online && (
                <input
                  id="confirm-business-name"
                  aria-label="Type the business name to confirm"
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
                  toast.success("Workspace cleared");
                }}
              >
                Yes, delete everything
              </button>
              <button
                type="button"
                className={btnGhost}
                onClick={() => {
                  setConfirmReset(false);
                  setConfirmName("");
                }}
              >
                Cancel
              </button>
            </>
          ) : (
            <button type="button" className={`${btnGhost} text-destructive`} onClick={() => setConfirmReset(true)}>
              Clear workspace…
            </button>
          )}
        </div>
      </Panel>
    </div>
  );
};

export default Settings;
