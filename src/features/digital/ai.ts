import { FunctionsHttpError } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";
import { currentLang } from "@/i18n";
import { demoChat, demoDraft, demoExtract, demoRoadmap } from "./demo";
import { customerName, displayStatus, invoiceTotals } from "./finance";
import type { Assessment, ChatMessage, ExtractedRecord, Roadmap, WorkspaceState } from "./types";

export interface AiResult<T> {
  value: T;
  demo: boolean; // true when produced by the offline fallback
}

/** The AI answered with a real error (file too large, busy, declined…). Shown to the user as is. */
export class AiError extends Error {}
/** The AI service isn't reachable or isn't set up yet. The app falls back to demo mode. */
class AiUnavailable extends Error {}

async function invoke<T>(body: Record<string, unknown>): Promise<T> {
  const { data, error } = await supabase.functions.invoke("business-ai", { body: { ...body, language: currentLang() } });
  if (error) {
    if (error instanceof FunctionsHttpError) {
      const res = error.context as Response | undefined;
      let message = "";
      try {
        message = ((await res?.json()) as { error?: string } | undefined)?.error ?? "";
      } catch {
        // body wasn't JSON
      }
      // 404: function not deployed. 503: deployed but no API key yet.
      // 401: not signed in to a business (e.g. trying LegacyLift on this device only) → use the built-in helpers.
      if (!res || res.status === 404 || res.status === 503 || res.status === 401) throw new AiUnavailable(message || "AI not connected");
      throw new AiError(message || `The AI service returned an error (${res.status}). Please try again.`);
    }
    throw new AiUnavailable(error.message); // network, relay, or blocked request
  }
  const payload = data as { result?: T; error?: string } | null;
  if (!payload || payload.error || payload.result === undefined) throw new AiError(payload?.error ?? "The AI returned an empty answer. Please try again.");
  return payload.result;
}

/** Runs the AI call; only when the service is unreachable does it use the built-in fallback. Real errors are thrown. */
async function withFallback<T>(call: () => Promise<T>, fallback: () => T): Promise<AiResult<T>> {
  try {
    return { value: await call(), demo: false };
  } catch (err) {
    if (err instanceof AiError) throw err;
    console.warn("AI service unavailable, using demo mode:", err);
    return { value: fallback(), demo: true };
  }
}

/** Last `max` messages of a conversation, always starting with a user message. */
export function trimConversation(messages: ChatMessage[], max = 20): ChatMessage[] {
  const recent = messages.slice(-max);
  const firstUser = recent.findIndex((m) => m.role === "user");
  return firstUser === -1 ? [] : recent.slice(firstUser);
}

export async function fileToAttachment(file: File): Promise<{ mediaType: string; data: string }> {
  const buf = await file.arrayBuffer();
  let binary = "";
  const bytes = new Uint8Array(buf);
  for (let i = 0; i < bytes.length; i += 0x8000) {
    binary += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  }
  return { mediaType: file.type, data: btoa(binary) };
}

export const isVisualFile = (file: File) =>
  file.type === "application/pdf" || /^image\/(png|jpeg|gif|webp)$/.test(file.type);

export function extractDocument(input: {
  text?: string;
  attachment?: { mediaType: string; data: string } | null;
  fileName?: string;
  businessName?: string;
}): Promise<AiResult<ExtractedRecord>> {
  return withFallback(
    () =>
      invoke<ExtractedRecord>({
        task: "extract",
        text: input.text,
        attachment: input.attachment,
        businessName: input.businessName,
      }),
    () => demoExtract(input.text ?? "", input.fileName),
  );
}

/** Compact, readable snapshot of the business for the assistant. */
export function businessContext(state: WorkspaceState) {
  return {
    today: new Date().toISOString().slice(0, 10),
    currency: state.profile.currency,
    customers: state.customers.map(({ id: _id, createdAt: _c, ...c }) => c),
    invoicesAndQuotes: state.invoices.map((i) => ({
      type: i.kind,
      number: i.number,
      customer: customerName(state.customers, i.customerId),
      issued: i.issueDate,
      due: i.dueDate,
      status: displayStatus(i),
      paidOn: i.paidAt ?? null,
      total: invoiceTotals(i).total,
      lines: i.items.map((l) => `${l.quantity} × ${l.description} @ ${l.unitPrice}`),
    })),
    stock: state.stock.map(({ id: _id, ...s }) => s),
    archivedDocuments: state.records.map(({ id: _id, createdAt: _c, ...r }) => r),
  };
}

export function askAssistant(messages: ChatMessage[], state: WorkspaceState): Promise<AiResult<string>> {
  return withFallback(
    () => invoke<string>({ task: "chat", messages: trimConversation(messages), context: businessContext(state), businessName: state.profile.businessName }),
    () => demoChat(messages[messages.length - 1]?.content ?? "", state),
  );
}

export function buildRoadmap(answers: Assessment, businessName: string): Promise<AiResult<Roadmap>> {
  return withFallback(
    () => invoke<Roadmap>({ task: "roadmap", answers, businessName }),
    () => demoRoadmap(answers),
  );
}

export function writeDraft(
  draft: { kind: string; audience: string; tone: string; notes: string },
  businessName: string,
): Promise<AiResult<string>> {
  return withFallback(
    () => invoke<string>({ task: "draft", draft, businessName }),
    () => demoDraft(draft.kind, draft.audience, draft.tone, draft.notes, businessName),
  );
}
