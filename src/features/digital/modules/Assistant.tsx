import { useEffect, useRef, useState } from "react";
import { Bot, Loader2, Send, Trash2, User } from "lucide-react";
import { toast } from "sonner";
import { askAssistant } from "../ai";
import { useWorkspace } from "../store";
import type { ChatMessage } from "../types";
import { DemoNotice, PageHeader, btnGhost, btnPrimary, fieldClass } from "../components";
import { msg, useT } from "@/i18n";

const SUGGESTIONS = [
  msg("Which invoices are still unpaid?"),
  msg("Who are our best customers?"),
  msg("What are we running low on?"),
  msg("Which customers should I follow up with this week?"),
];

const Assistant = () => {
  const t = useT();
  const { state, update } = useWorkspace();
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [demo, setDemo] = useState(false);
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    endRef.current?.scrollIntoView?.({ behavior: "smooth" });
  }, [state.chat.length, busy]);

  async function send(text: string) {
    const content = text.trim();
    if (!content || busy) return;
    const next: ChatMessage[] = [...state.chat, { role: "user", content }];
    update({ chat: next });
    setInput("");
    setBusy(true);
    try {
      const { value, demo: isDemo } = await askAssistant(next, state);
      setDemo(isDemo);
      const asked = next[next.length - 1];
      // Only append the answer if the conversation wasn't cleared while we waited.
      update((s) => (s.chat[s.chat.length - 1] === asked ? { chat: [...s.chat, { role: "assistant", content: value }] } : {}));
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t("The assistant couldn't answer. Please try again."));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="max-w-3xl flex flex-col min-h-[calc(100vh-8rem)]">
      <PageHeader
        title={t("AI assistant")}
        eyebrow="AI"
        description={t("Ask questions about your business in plain language. The assistant reads your customers ({customers}), invoices and quotes ({invoices}), stock items ({stock}) and archived documents ({records}).", {
          customers: state.customers.length,
          invoices: state.invoices.length,
          stock: state.stock.length,
          records: state.records.length,
        })}
        actions={
          state.chat.length > 0 && (
            <button type="button" className={btnGhost} onClick={() => update({ chat: [] })}>
              <Trash2 size={16} aria-hidden="true" /> {t("Clear")}
            </button>
          )
        }
      />

      <div className="flex-1 flex flex-col gap-4 mb-4" aria-live="polite">
        {state.chat.length === 0 && (
          <div className="grid gap-2 sm:grid-cols-2">
            {SUGGESTIONS.map((s) => (
              <button
                key={s}
                type="button"
                className="rounded-lg border border-border bg-card p-3 text-left text-sm hover:border-primary/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                onClick={() => send(t(s))}
              >
                {t(s)}
              </button>
            ))}
          </div>
        )}
        {state.chat.map((m, i) => (
          <div key={i} className={`flex gap-3 ${m.role === "user" ? "flex-row-reverse" : ""}`}>
            <span className="shrink-0 mt-1 h-8 w-8 rounded-full bg-secondary inline-flex items-center justify-center" aria-hidden="true">
              {m.role === "user" ? <User size={16} /> : <Bot size={16} className="text-primary" />}
            </span>
            <div
              className={`rounded-lg px-4 py-3 text-sm whitespace-pre-wrap max-w-[85%] ${
                m.role === "user" ? "bg-primary text-primary-foreground" : "bg-card border border-border"
              }`}
            >
              <span className="sr-only">{m.role === "user" ? t("You: ") : t("Assistant: ")}</span>
              {m.content}
            </div>
          </div>
        ))}
        {busy && (
          <p className="flex items-center gap-2 text-sm text-muted-foreground" role="status">
            <Loader2 size={16} className="animate-spin" aria-hidden="true" /> {t("Thinking…")}
          </p>
        )}
        <DemoNotice show={demo} />
        <div ref={endRef} />
      </div>

      <form
        className="sticky bottom-4 flex gap-2 rounded-lg border border-border bg-background/95 p-2 backdrop-blur"
        onSubmit={(e) => {
          e.preventDefault();
          send(input);
        }}
      >
        <label htmlFor="chat-input" className="sr-only">
          {t("Ask a question")}
        </label>
        <input
          id="chat-input"
          className={fieldClass}
          placeholder={t("Ask about customers, invoices, suppliers…")}
          value={input}
          onChange={(e) => setInput(e.target.value)}
        />
        <button type="submit" className={btnPrimary} disabled={busy || !input.trim()} aria-label={t("Send")}>
          <Send size={16} aria-hidden="true" />
        </button>
      </form>
    </div>
  );
};

export default Assistant;
