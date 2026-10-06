import { useRef, useState } from "react";
import { Camera, Check, FileUp, Loader2, Trash2, Wand2 } from "lucide-react";
import { toast } from "sonner";
import { extractDocument, fileToAttachment, isVisualFile } from "../ai";
import { newId, toRecord, useWorkspace } from "../store";
import { addDays, markedPaid, nextNumber, round2, todayIso } from "../finance";
import { DOC_TYPES, type ExtractedRecord, type Invoice } from "../types";
import { DOC_TYPE_LABEL, DemoNotice, PageHeader, Panel, btnGhost, btnPrimary, fieldClass } from "../components";
import { useT } from "@/i18n";

const MAX_BYTES = 8 * 1024 * 1024;

interface Pending {
  key: string;
  source: string;
  preview?: string;
  status: "working" | "ready" | "error";
  record?: ExtractedRecord;
  demo?: boolean;
  error?: string;
}

const Digitize = () => {
  const t = useT();
  const { state, upsert } = useWorkspace();
  const [alsoCustomer, setAlsoCustomer] = useState<Record<string, boolean>>({});
  const [alsoInvoice, setAlsoInvoice] = useState<Record<string, boolean>>({});
  const [queue, setQueue] = useState<Pending[]>([]);
  const [pasted, setPasted] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);
  const cameraRef = useRef<HTMLInputElement>(null);

  const patch = (key: string, p: Partial<Pending>) =>
    setQueue((q) => q.map((item) => (item.key === key ? { ...item, ...p } : item)));

  async function process(source: string, getInput: () => Promise<Parameters<typeof extractDocument>[0]>, preview?: string) {
    const key = `${source}-${Date.now()}-${Math.random()}`;
    setQueue((q) => [{ key, source, preview, status: "working" }, ...q]);
    try {
      const input = await getInput();
      const { value, demo } = await extractDocument({ ...input, fileName: source, businessName: state.profile.businessName });
      patch(key, { status: "ready", record: value, demo });
    } catch (err) {
      patch(key, { status: "error", error: err instanceof Error ? err.message : t("Could not read this file") });
    }
  }

  function handleFiles(files: FileList | null) {
    if (!files) return;
    for (const file of Array.from(files)) {
      if (file.size > MAX_BYTES) {
        toast.error(t("{name} is larger than 8 MB", { name: file.name }));
        continue;
      }
      if (isVisualFile(file)) {
        const preview = file.type.startsWith("image/") ? URL.createObjectURL(file) : undefined;
        process(file.name, async () => ({ attachment: await fileToAttachment(file) }), preview);
      } else if (file.type.startsWith("text/") || /\.(txt|csv|md|tsv)$/i.test(file.name)) {
        process(file.name, async () => ({ text: await file.text() }));
      } else {
        toast.error(t("{name}: use a photo, PDF or text file", { name: file.name }));
      }
    }
  }

  function save(item: Pending) {
    if (!item.record) return;
    const rec = item.record;
    upsert("records", toRecord(rec, item.source));
    const done: string[] = [t("archived")];
    let customerId = state.customers.find((c) => rec.party && (c.company || c.name).toLowerCase() === rec.party.toLowerCase())?.id;
    const wantCustomer = alsoCustomer[item.key] ?? rec.docType === "customer";
    if (wantCustomer && rec.party && !customerId) {
      const get = (re: RegExp) => rec.fields.find((f) => re.test(f.label))?.value ?? "";
      customerId = newId();
      upsert("customers", {
        id: customerId,
        name: rec.party,
        company: "",
        email: get(/mail/i),
        phone: get(/phone|tel|mobile|tālr|mob/i),
        address: get(/address|adresse|street|adrese|iela/i),
        notes: rec.summary,
        createdAt: new Date().toISOString(),
      });
      done.push(t("customer added"));
    }
    if (alsoInvoice[item.key] && rec.docType === "invoice" && customerId) {
      const issue = rec.date || todayIso();
      const items = rec.lineItems.length
        ? rec.lineItems.map((l) => {
            const quantity = l.quantity ?? 1;
            // Paper lines sometimes only show the line total; derive the unit price from it.
            const unitPrice = l.unitPrice ?? (l.total !== null ? round2(l.total / (quantity || 1)) : 0);
            return { id: newId(), description: l.description, quantity, unitPrice };
          })
        : [{ id: newId(), description: rec.title, quantity: 1, unitPrice: rec.amount ?? 0 }];
      const numberField = rec.fields.find((f) => /invoice (no|number|#)|rechnungs|rēķin/i.test(f.label))?.value;
      const inv: Invoice = {
        id: newId(),
        kind: "invoice",
        number: numberField || nextNumber(state.invoices, "invoice", state.profile),
        customerId,
        issueDate: issue,
        dueDate: addDays(issue, state.profile.paymentTermsDays || 14),
        items,
        taxRate: 0, // amounts from paper are taken as gross
        notes: t("Digitized from {source}", { source: item.source }),
        status: markedPaid(rec.tags) ? "paid" : "sent",
        paidAt: markedPaid(rec.tags) ? issue : undefined,
        stockDeducted: true,
        createdAt: new Date().toISOString(),
      };
      upsert("invoices", inv);
      done.push(t("added to invoices"));
    }
    setQueue((q) => q.filter((i) => i.key !== item.key));
    toast.success(`“${rec.title}”: ${done.join(", ")}`);
  }

  const editRecord = (key: string, rec: ExtractedRecord, p: Partial<ExtractedRecord>) => patch(key, { record: { ...rec, ...p } });

  return (
    <div className="max-w-5xl">
      <PageHeader
        eyebrow="AI"
        title={t("Digitize documents")}
        description={t("Photograph or upload paper invoices, orders, delivery notes, contracts or customer cards. AI reads them — including handwriting — and turns them into searchable records you can check before saving.")}
      />

      <div className="grid gap-4 md:grid-cols-2 mb-8">
        <Panel>
          <h2 className="font-heading font-semibold mb-3">{t("Upload or photograph")}</h2>
          <div
            onDragOver={(e) => e.preventDefault()}
            onDrop={(e) => {
              e.preventDefault();
              handleFiles(e.dataTransfer.files);
            }}
            className="rounded-md border-2 border-dashed border-border p-6 text-center"
          >
            <FileUp className="mx-auto text-primary mb-2" size={28} aria-hidden="true" />
            <p className="text-sm text-muted-foreground mb-4">{t("Drop photos, scans (PDF) or text files here")}</p>
            <div className="flex flex-wrap justify-center gap-2">
              <button type="button" className={btnPrimary} onClick={() => fileRef.current?.click()}>
                <FileUp size={16} aria-hidden="true" /> {t("Choose files")}
              </button>
              <button type="button" className={btnGhost} onClick={() => cameraRef.current?.click()}>
                <Camera size={16} aria-hidden="true" /> {t("Take photo")}
              </button>
            </div>
            <input
              ref={fileRef}
              type="file"
              multiple
              accept="image/png,image/jpeg,image/webp,image/gif,application/pdf,text/plain,text/csv,.txt,.csv,.md"
              className="sr-only"
              aria-label={t("Choose files to digitize")}
              onChange={(e) => {
                handleFiles(e.target.files);
                e.target.value = "";
              }}
            />
            <input
              ref={cameraRef}
              type="file"
              accept="image/*"
              capture="environment"
              className="sr-only"
              aria-label={t("Take a photo of a document")}
              onChange={(e) => {
                handleFiles(e.target.files);
                e.target.value = "";
              }}
            />
          </div>
        </Panel>

        <Panel>
          <label htmlFor="paste-text" className="block font-heading font-semibold mb-3">
            {t("Or paste text")}
          </label>
          <textarea
            id="paste-text"
            rows={7}
            className={fieldClass}
            placeholder={t("Paste an email, a typed-up ledger page, an old spreadsheet row…")}
            value={pasted}
            onChange={(e) => setPasted(e.target.value)}
          />
          <button
            type="button"
            className={`${btnPrimary} mt-3`}
            disabled={!pasted.trim()}
            onClick={() => {
              const text = pasted;
              setPasted("");
              process(t("pasted text"), async () => ({ text }));
            }}
          >
            <Wand2 size={16} aria-hidden="true" /> {t("Extract with AI")}
          </button>
        </Panel>
      </div>

      {queue.length > 0 && <h2 className="font-heading text-lg font-semibold mb-3">{t("Review before saving")}</h2>}
      <div className="flex flex-col gap-4">
        {queue.map((item) => (
          <Panel key={item.key}>
            <div className="flex items-center justify-between gap-3 mb-3">
              <p className="text-sm font-semibold truncate">{item.source}</p>
              <button
                type="button"
                className={btnGhost}
                aria-label={t("Discard {name}", { name: item.source })}
                onClick={() => setQueue((q) => q.filter((i) => i.key !== item.key))}
              >
                <Trash2 size={16} aria-hidden="true" />
              </button>
            </div>

            {item.status === "working" && (
              <p className="flex items-center gap-2 text-sm text-muted-foreground" role="status">
                <Loader2 className="animate-spin" size={16} aria-hidden="true" /> {t("Reading document…")}
              </p>
            )}
            {item.status === "error" && <p className="text-sm text-destructive">{item.error}</p>}

            {item.status === "ready" && item.record && (
              <div className="grid gap-4 md:grid-cols-[160px_1fr]">
                {item.preview ? (
                  <img src={item.preview} alt={t("Preview of {name}", { name: item.source })} className="rounded-md border border-border max-h-56 object-contain w-full" />
                ) : (
                  <div className="hidden md:block" />
                )}
                <div className="flex flex-col gap-3">
                  <DemoNotice show={!!item.demo} />
                  <div className="grid gap-3 sm:grid-cols-2">
                    <label className="text-xs text-muted-foreground">
                      {t("Title")}
                      <input className={fieldClass} value={item.record.title} onChange={(e) => editRecord(item.key, item.record!, { title: e.target.value })} />
                    </label>
                    <label className="text-xs text-muted-foreground">
                      {t("Type")}
                      <select
                        className={fieldClass}
                        value={item.record.docType}
                        onChange={(e) => editRecord(item.key, item.record!, { docType: e.target.value as ExtractedRecord["docType"] })}
                      >
                        {DOC_TYPES.map((d) => (
                          <option key={d} value={d}>
                            {t(DOC_TYPE_LABEL[d])}
                          </option>
                        ))}
                      </select>
                    </label>
                    <label className="text-xs text-muted-foreground">
                      {t("Customer / supplier")}
                      <input className={fieldClass} value={item.record.party} onChange={(e) => editRecord(item.key, item.record!, { party: e.target.value })} />
                    </label>
                    <label className="text-xs text-muted-foreground">
                      {t("Date")}
                      <input type="date" className={fieldClass} value={item.record.date} onChange={(e) => editRecord(item.key, item.record!, { date: e.target.value })} />
                    </label>
                    <label className="text-xs text-muted-foreground">
                      {t("Amount")}
                      <input
                        type="number"
                        step="0.01"
                        className={fieldClass}
                        value={item.record.amount ?? ""}
                        onChange={(e) => editRecord(item.key, item.record!, { amount: e.target.value === "" ? null : Number(e.target.value) })}
                      />
                    </label>
                    <label className="text-xs text-muted-foreground">
                      {t("Currency")}
                      <input className={fieldClass} value={item.record.currency} onChange={(e) => editRecord(item.key, item.record!, { currency: e.target.value.toUpperCase() })} />
                    </label>
                  </div>
                  <label className="text-xs text-muted-foreground">
                    {t("Summary")}
                    <textarea rows={2} className={fieldClass} value={item.record.summary} onChange={(e) => editRecord(item.key, item.record!, { summary: e.target.value })} />
                  </label>
                  {item.record.fields.length > 0 && (
                    <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 text-sm">
                      {item.record.fields.map((f, i) => (
                        <div key={i} className="contents">
                          <dt className="text-muted-foreground">{f.label}</dt>
                          <dd className="break-words">{f.value}</dd>
                        </div>
                      ))}
                    </dl>
                  )}
                  {item.record.lineItems.length > 0 && (
                    <p className="text-xs text-muted-foreground">{t("Lines found: {n}", { n: item.record.lineItems.length })}</p>
                  )}
                  <fieldset className="flex flex-col gap-2 text-sm">
                    <legend className="sr-only">{t("Also create")}</legend>
                    {item.record.party && !state.customers.some((c) => (c.company || c.name).toLowerCase() === item.record!.party.toLowerCase()) && (
                      <label className="inline-flex items-center gap-2">
                        <input
                          type="checkbox"
                          id={`also-customer-${item.key}`}
                          className="h-4 w-4 accent-[hsl(var(--primary))]"
                          checked={alsoCustomer[item.key] ?? item.record.docType === "customer"}
                          onChange={(e) => setAlsoCustomer({ ...alsoCustomer, [item.key]: e.target.checked })}
                        />
                        {t("Add “{name}” to customers", { name: item.record.party })}
                      </label>
                    )}
                    {item.record.docType === "invoice" && item.record.party && (
                      <label className="inline-flex items-center gap-2">
                        <input
                          type="checkbox"
                          id={`also-invoice-${item.key}`}
                          className="h-4 w-4 accent-[hsl(var(--primary))]"
                          checked={alsoInvoice[item.key] ?? false}
                          onChange={(e) => {
                            setAlsoInvoice({ ...alsoInvoice, [item.key]: e.target.checked });
                            if (e.target.checked) setAlsoCustomer({ ...alsoCustomer, [item.key]: true });
                          }}
                        />
                        {t("Also add to Invoices so it's tracked for payment")}
                      </label>
                    )}
                  </fieldset>
                  <div>
                    <button type="button" className={btnPrimary} onClick={() => save(item)}>
                      <Check size={16} aria-hidden="true" /> {t("Save record")}
                    </button>
                  </div>
                </div>
              </div>
            )}
          </Panel>
        ))}
      </div>
    </div>
  );
};

export default Digitize;
