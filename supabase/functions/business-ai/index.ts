import { corsHeaders } from "https://esm.sh/@supabase/supabase-js@2.95.0/cors";
import Anthropic from "npm:@anthropic-ai/sdk";

// AI backend for the LegacyLift digitalization workspace.
// Requires the ANTHROPIC_API_KEY secret: `supabase secrets set ANTHROPIC_API_KEY=...`

const MODEL = "claude-opus-5";
const MAX_FILE_BYTES = 8 * 1024 * 1024;
const MAX_BODY_BYTES = 12 * 1024 * 1024;
const MAX_MESSAGE_CHARS = 8_000;
const MAX_CONTEXT_CHARS = 200_000;

// Abuse protection until staff/client logins exist (see README):
//   AI_ALLOWED_ORIGINS  comma-separated list of sites allowed to call this function, e.g. https://legacylift.lv
//   AI_RATE_LIMIT       requests per visitor per 10 minutes (default 40)
//   AI_ALLOW_ANONYMOUS  "true" = also answer people who aren't signed in (demo sites only). By default only
//                       signed-in staff and members of a client firm can use the AI.
const ALLOWED_ORIGINS = (Deno.env.get("AI_ALLOWED_ORIGINS") ?? "")
  .split(",")
  .map((o) => o.trim())
  .filter(Boolean);
const RATE_LIMIT = Number(Deno.env.get("AI_RATE_LIMIT") ?? 40);
const ALLOW_ANONYMOUS = Deno.env.get("AI_ALLOW_ANONYMOUS") === "true";

/**
 * Returns the user's id when they are signed in AND are staff or belong to a client firm; otherwise null.
 * Uses the caller's own token, so Supabase Auth and the database access rules make the decision.
 */
async function allowedUser(req: Request): Promise<string | null> {
  const auth = req.headers.get("authorization") ?? "";
  if (!/^Bearer\s+\S+/.test(auth)) return null;
  const url = Deno.env.get("SUPABASE_URL");
  const key = Deno.env.get("SUPABASE_ANON_KEY") ?? "";
  if (!url) return null;
  const headers = { Authorization: auth, apikey: key, "Content-Type": "application/json" };
  try {
    const userRes = await fetch(`${url}/auth/v1/user`, { headers });
    if (!userRes.ok) return null;
    const user = (await userRes.json()) as { id?: string };
    if (!user.id) return null;
    const wsRes = await fetch(`${url}/rest/v1/rpc/my_workspaces`, { method: "POST", headers, body: "{}" });
    if (!wsRes.ok) return null;
    const list = (await wsRes.json()) as unknown[];
    return Array.isArray(list) && list.length > 0 ? user.id : null;
  } catch {
    return null;
  }
}
const RATE_WINDOW_MS = 10 * 60 * 1000;
const hits = new Map<string, number[]>();

function rateLimited(key: string) {
  const now = Date.now();
  const recent = (hits.get(key) ?? []).filter((t) => now - t < RATE_WINDOW_MS);
  recent.push(now);
  hits.set(key, recent);
  if (hits.size > 5_000) hits.clear(); // keep memory bounded on long-lived instances
  return recent.length > RATE_LIMIT;
}

/** Keeps only well-formed turns, trims long ones, and makes sure the conversation starts with the user. */
function cleanMessages(raw: unknown): { role: "user" | "assistant"; content: string }[] {
  if (!Array.isArray(raw)) return [];
  const list = raw
    .filter((m) => m && (m.role === "user" || m.role === "assistant") && typeof m.content === "string" && m.content.trim())
    .map((m) => ({ role: m.role as "user" | "assistant", content: String(m.content).slice(0, MAX_MESSAGE_CHARS) }))
    .slice(-20);
  const first = list.findIndex((m) => m.role === "user");
  return first === -1 ? [] : list.slice(first);
}

type Task = "extract" | "chat" | "roadmap" | "draft";

interface Attachment {
  mediaType: string;
  data: string; // base64, no data: prefix
}

interface Payload {
  task: Task;
  text?: string;
  attachment?: Attachment | null;
  messages?: { role: "user" | "assistant"; content: string }[];
  context?: unknown;
  answers?: Record<string, unknown>;
  draft?: { kind: string; audience: string; tone: string; notes: string };
  businessName?: string;
  /** The language the person uses LegacyLift in: "lv" (Latvian) or "en" (English, the default). */
  language?: string;
}

const SYSTEM_BASE =
  "You work inside LegacyLift, a workspace that helps long-established small and mid-sized firms " +
  "(family businesses, workshops, wholesalers, practices) move from paper, fax and spreadsheets to digital tools. " +
  "The people using it are experienced in their trade but often new to software, so write plainly, avoid jargon, " +
  "and prefer concrete next steps with realistic costs and effort.";

const RECORD_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["docType", "title", "party", "date", "amount", "currency", "summary", "fields", "lineItems", "tags"],
  properties: {
    docType: {
      type: "string",
      enum: ["invoice", "receipt", "order", "contract", "customer", "letter", "inventory", "other"],
    },
    title: { type: "string" },
    party: { type: "string", description: "Customer, supplier or counterparty name; empty string if unknown" },
    date: { type: "string", description: "ISO date YYYY-MM-DD, or empty string if unknown" },
    amount: { type: ["number", "null"] },
    currency: { type: "string", description: "ISO 4217 code, or empty string" },
    summary: { type: "string" },
    fields: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["label", "value"],
        properties: { label: { type: "string" }, value: { type: "string" } },
      },
    },
    lineItems: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["description", "quantity", "unitPrice", "total"],
        properties: {
          description: { type: "string" },
          quantity: { type: ["number", "null"] },
          unitPrice: { type: ["number", "null"] },
          total: { type: ["number", "null"] },
        },
      },
    },
    tags: { type: "array", items: { type: "string" } },
  },
};

const ROADMAP_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["score", "headline", "strengths", "risks", "phases", "quickWins"],
  properties: {
    score: { type: "integer", description: "Digital maturity 0-100" },
    headline: { type: "string" },
    strengths: { type: "array", items: { type: "string" } },
    risks: { type: "array", items: { type: "string" } },
    quickWins: { type: "array", items: { type: "string" } },
    phases: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["name", "timeframe", "goal", "actions", "tools", "estimatedCost", "aiOpportunity"],
        properties: {
          name: { type: "string" },
          timeframe: { type: "string" },
          goal: { type: "string" },
          actions: { type: "array", items: { type: "string" } },
          tools: { type: "array", items: { type: "string" } },
          estimatedCost: { type: "string" },
          aiOpportunity: { type: "string" },
        },
      },
    },
  },
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function attachmentBlock(att: Attachment): Anthropic.Beta.BetaContentBlockParam {
  if (att.mediaType === "application/pdf") {
    return { type: "document", source: { type: "base64", media_type: "application/pdf", data: att.data } };
  }
  return {
    type: "image",
    source: {
      type: "base64",
      media_type: att.mediaType as "image/png" | "image/jpeg" | "image/gif" | "image/webp",
      data: att.data,
    },
  };
}

const LANGUAGE_RULES: Record<string, string> = {
  lv:
    "The person uses LegacyLift in Latvian. Write everything meant for people (titles, summaries, field labels, answers, plans and letters) in Latvian, " +
    "using polite forms (Jūs) and Latvian number and date formats. Keep names, numbers and quoted document text exactly as they appear.",
  en: "Write in English unless the person writes to you in another language.",
};

function buildRequest(body: Payload) {
  const business = `${body.businessName ? `The firm is called "${body.businessName}". ` : ""}${body.language === "lv" ? LANGUAGE_RULES.lv : LANGUAGE_RULES.en}`;

  switch (body.task) {
    case "extract": {
      const content: Anthropic.Beta.BetaContentBlockParam[] = [];
      if (body.attachment) content.push(attachmentBlock(body.attachment));
      content.push({
        type: "text",
        text:
          "Digitize this business document into a structured record. Transcribe handwriting where legible, " +
          "keep original names and numbers exactly, and put any other useful details into `fields`. " +
          "Use empty strings / null for anything not present rather than guessing." +
          (body.text ? `\n\nDocument text:\n${body.text}` : ""),
      });
      return {
        system: `${SYSTEM_BASE} ${business}`,
        messages: [{ role: "user" as const, content }],
        effort: "medium" as const,
        schema: RECORD_SCHEMA,
        maxTokens: 8000,
      };
    }
    case "roadmap":
      return {
        system: `${SYSTEM_BASE} ${business}`,
        messages: [
          {
            role: "user" as const,
            content:
              "Assess this firm's digital maturity and write a phased digitalization roadmap (3-4 phases, " +
              "smallest-risk steps first, keep what already works). Name specific, widely available tools " +
              "and say where AI genuinely helps. Assessment answers:\n" +
              JSON.stringify(body.answers ?? {}, null, 2),
          },
        ],
        effort: "high" as const,
        schema: ROADMAP_SCHEMA,
        maxTokens: 12000,
      };
    case "draft": {
      const d = body.draft ?? { kind: "email", audience: "customer", tone: "friendly", notes: "" };
      return {
        system: `${SYSTEM_BASE} ${business} You write business correspondence on the firm's behalf. Return only the finished text, ready to send, with a subject line first if it is an email.`,
        messages: [
          {
            role: "user" as const,
            content: `Write a ${d.tone} ${d.kind} for a ${d.audience}.\n\nWhat it needs to say:\n${d.notes}`,
          },
        ],
        effort: "low" as const,
        schema: null,
        maxTokens: 4000,
      };
    }
    case "chat":
    default:
      return {
        system:
          `${SYSTEM_BASE} ${business} You are the firm's AI business assistant. ` +
          "The data below is the firm's live workspace: customers, invoices and quotes (with status and totals), stock levels and archived paper documents. " +
          "Answer from this data, name the invoice numbers, customers or documents you used, show money with the firm's currency, " +
          "and say plainly when the data does not contain the answer.\n\n" +
          `<business_data>\n${JSON.stringify(body.context ?? {}, null, 1).slice(0, MAX_CONTEXT_CHARS)}\n</business_data>`,
        messages: cleanMessages(body.messages),
        effort: "low" as const,
        schema: null,
        maxTokens: 4000,
      };
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  const origin = req.headers.get("origin") ?? "";
  if (ALLOWED_ORIGINS.length && !ALLOWED_ORIGINS.includes(origin)) {
    return json({ error: "This site is not allowed to use the AI service." }, 403);
  }
  const userId = await allowedUser(req);
  if (!userId && !ALLOW_ANONYMOUS) {
    return json({ error: "Please sign in to your LegacyLift business to use the AI features." }, 401);
  }
  const visitor = userId ?? (req.headers.get("x-forwarded-for")?.split(",")[0].trim() || req.headers.get("cf-connecting-ip") || "unknown");
  if (rateLimited(visitor)) {
    return json({ error: "Too many AI requests in a short time. Please wait a few minutes and try again." }, 429);
  }
  if (Number(req.headers.get("content-length") ?? 0) > MAX_BODY_BYTES) {
    return json({ error: "This request is too large. Try a smaller file." }, 413);
  }

  const apiKey = Deno.env.get("ANTHROPIC_API_KEY");
  if (!apiKey) return json({ error: "AI is not configured (missing ANTHROPIC_API_KEY)" }, 503);

  let body: Payload;
  try {
    body = (await req.json()) as Payload;
  } catch {
    return json({ error: "Invalid JSON body" }, 400);
  }

  if (!["extract", "chat", "roadmap", "draft"].includes(body?.task)) {
    return json({ error: "Unknown task" }, 400);
  }
  if (body.attachment) {
    const okType = ["application/pdf", "image/png", "image/jpeg", "image/gif", "image/webp"].includes(body.attachment.mediaType);
    if (!okType || typeof body.attachment.data !== "string") return json({ error: "Use a photo (JPG, PNG, WebP) or a PDF." }, 400);
    if (body.attachment.data.length * 0.75 > MAX_FILE_BYTES) return json({ error: "File is too large (max 8 MB)." }, 413);
  }
  if (body.task === "chat" && !cleanMessages(body.messages).length) {
    return json({ error: "Ask a question first." }, 400);
  }

  const client = new Anthropic({ apiKey });
  const request = buildRequest(body);

  try {
    const response = await client.beta.messages.create({
      model: MODEL,
      max_tokens: request.maxTokens,
      betas: ["server-side-fallback-2026-07-01"],
      fallbacks: "default",
      thinking: { type: "adaptive" },
      output_config: {
        effort: request.effort,
        ...(request.schema ? { format: { type: "json_schema", schema: request.schema } } : {}),
      },
      system: request.system,
      messages: request.messages,
    } as Anthropic.Beta.MessageCreateParamsNonStreaming);

    if (response.stop_reason === "refusal") {
      return json({ error: "The assistant declined this request." }, 422);
    }

    const text = response.content
      .filter((b): b is Anthropic.Beta.BetaTextBlock => b.type === "text")
      .map((b) => b.text)
      .join("");

    if (request.schema) {
      try {
        return json({ result: JSON.parse(text) });
      } catch {
        return json({ error: "AI returned an unreadable result, please retry." }, 502);
      }
    }
    return json({ result: text });
  } catch (error) {
    console.error("business-ai error:", error);
    if (error instanceof Anthropic.RateLimitError) return json({ error: "AI is busy, try again shortly." }, 429);
    if (error instanceof Anthropic.BadRequestError) return json({ error: error.message }, 400);
    if (error instanceof Anthropic.APIError) return json({ error: "AI service error" }, 502);
    return json({ error: "Unexpected error" }, 500);
  }
});
