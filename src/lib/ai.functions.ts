import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const GATEWAY = "https://ai.gateway.lovable.dev/v1";

const FREE_LIMITS = {
  rooms: 3,
  containers: 30,
  transcriptions: 100,
  searches: 200,
};

// Monthly AI usage caps per plan. Premium = no monthly cap (still rate-limited).
const PLAN_LIMITS: Record<string, { transcriptions: number; searches: number }> = {
  free: { transcriptions: 100, searches: 200 },
  pro: { transcriptions: 5000, searches: 20000 },
  premium: { transcriptions: Number.POSITIVE_INFINITY, searches: Number.POSITIVE_INFINITY },
};

// Per-minute soft rate limit (anti-abuse). Same for all plans.
const RATE_LIMIT_PER_MIN = 60;

// AI prices (USD per 1M tokens) — keep in sync with Lovable AI Gateway pricing.
const PRICES = {
  "google/gemini-2.5-flash": { input: 0.30, output: 2.50 },
  "google/gemini-embedding-001": { input: 0.15, output: 0 },
} as const;

class LimitError extends Error {
  status = 402;
  constructor(msg: string) {
    super(msg);
  }
}

async function checkRateLimit(supabase: any, userId: string) {
  const { data, error } = await supabase.rpc("increment_ai_rate_limit", { _user_id: userId });
  if (error) throw new Error(error.message);
  if ((data as number) > RATE_LIMIT_PER_MIN) {
    throw new LimitError(`Забагато запитів (${RATE_LIMIT_PER_MIN}/хв). Зачекай хвилинку.`);
  }
}

function costFor(model: keyof typeof PRICES, inputTokens: number, outputTokens: number) {
  const p = PRICES[model];
  if (!p) return 0;
  return (inputTokens * p.input + outputTokens * p.output) / 1_000_000;
}

async function logUsage(
  supabase: any,
  userId: string,
  operation: string,
  model: keyof typeof PRICES,
  inputTokens: number,
  outputTokens: number,
) {
  try {
    await supabase.rpc("log_ai_usage", {
      _user_id: userId,
      _operation: operation,
      _model: model,
      _input_tokens: inputTokens,
      _output_tokens: outputTokens,
      _cost_usd: costFor(model, inputTokens, outputTokens),
    });
  } catch (e) {
    // Logging must never break the user flow.
    console.error("logUsage failed", e);
  }
}

async function getOrCreateMonthly(supabase: any, userId: string) {
  const month = new Date();
  month.setUTCDate(1);
  month.setUTCHours(0, 0, 0, 0);
  const monthStr = month.toISOString().slice(0, 10);

  const { data } = await supabase
    .from("usage_counters")
    .select("*")
    .eq("user_id", userId)
    .eq("month", monthStr)
    .maybeSingle();
  if (data) return data;

  const { data: created, error } = await supabase
    .from("usage_counters")
    .insert({ user_id: userId, month: monthStr })
    .select()
    .single();
  if (error) throw error;
  return created;
}

async function callAI(body: unknown) {
  const key = process.env.LOVABLE_API_KEY;
  if (!key) throw new Error("LOVABLE_API_KEY is not configured");
  const res = await fetch(`${GATEWAY}/chat/completions`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${key}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const text = await res.text();
    if (res.status === 429) throw new Error("Перевищено ліміт запитів. Спробуй через хвилину.");
    if (res.status === 402) throw new Error("Закінчилися кредити Lovable AI. Поповніть у налаштуваннях.");
    throw new Error(`AI gateway error ${res.status}: ${text}`);
  }
  return res.json();
}

async function embed(text: string): Promise<{ embedding: number[]; tokens: number }> {
  const key = process.env.LOVABLE_API_KEY;
  if (!key) throw new Error("LOVABLE_API_KEY is not configured");
  const res = await fetch(`${GATEWAY}/embeddings`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${key}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "google/gemini-embedding-001",
      input: text,
      dimensions: 768,
    }),
  });
  if (!res.ok) {
    if (res.status === 429) {
      throw new Error("Забагато запитів до AI. Зачекай хвилинку і спробуй ще раз.");
    }
    if (res.status === 402) {
      throw new Error("Закінчились AI-кредити робочого простору. Поповни їх у Settings → Workspace → Usage.");
    }
    throw new Error(`Помилка AI ембедінгу (${res.status})`);
  }
  const json = await res.json();
  return { embedding: json.data[0].embedding as number[], tokens: json.usage?.total_tokens ?? 0 };
}

/** Cleans raw speech transcript and extracts a list of items. */
export const extractItems = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ rawText: z.string().min(1).max(5000) }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;

    // Per-minute rate limit (anti-abuse, all plans)
    await checkRateLimit(supabase, userId);

    // Plan-based monthly cap
    const { data: profile } = await supabase
      .from("profiles")
      .select("plan")
      .eq("user_id", userId)
      .single();
    const planKey = (profile?.plan ?? "free") as keyof typeof PLAN_LIMITS;
    const limits = PLAN_LIMITS[planKey] ?? PLAN_LIMITS.free;
    const counter = await getOrCreateMonthly(supabase, userId);
    if (counter.transcriptions_count >= limits.transcriptions) {
      throw new LimitError(
        `Місячний ліміт плану ${planKey} (${limits.transcriptions} транскрипцій) вичерпано.`,
      );
    }

    const ai = await callAI({
      model: "google/gemini-2.5-flash",
      messages: [
        {
          role: "system",
          content:
            "Ти асистент, що отримує транскрипт мовлення українською мовою з описом речей у коробці. Прибери слова-паразити (ну, ееем, типу, так, от), повтори, заїкання. Виокрем кожний предмет як окремий пункт. Поверни ЛИШЕ JSON-об'єкт через function-call.",
        },
        { role: "user", content: data.rawText },
      ],
      tools: [
        {
          type: "function",
          function: {
            name: "save_items",
            description: "Збереже список окремих чистих назв речей",
            parameters: {
              type: "object",
              properties: {
                items: {
                  type: "array",
                  items: { type: "string" },
                  description: "Чисті, короткі назви предметів у називному відмінку",
                },
              },
              required: ["items"],
            },
          },
        },
      ],
      tool_choice: { type: "function", function: { name: "save_items" } },
    });

    const args = ai.choices?.[0]?.message?.tool_calls?.[0]?.function?.arguments;
    let items: string[] = [];
    try {
      items = JSON.parse(args ?? "{}").items ?? [];
    } catch {
      items = [];
    }
    items = items.map((s) => s.trim()).filter(Boolean);

    await logUsage(
      supabase,
      userId,
      "extract_items",
      "google/gemini-2.5-flash",
      ai.usage?.prompt_tokens ?? 0,
      ai.usage?.completion_tokens ?? 0,
    );

    await supabase
      .from("usage_counters")
      .update({ transcriptions_count: counter.transcriptions_count + 1 })
      .eq("id", counter.id);

    return { items };
  });

/** Save items with embeddings to a container. */
export const saveItems = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z
      .object({
        containerId: z.string().uuid(),
        items: z.array(z.string().min(1).max(200)).min(1).max(100),
        replace: z.boolean().default(false),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;

    if (data.replace) {
      await supabase.from("items").delete().eq("container_id", data.containerId);
    }

    const rows = await Promise.all(
      data.items.map(async (name) => ({
        container_id: data.containerId,
        user_id: userId,
        name,
        embedding: JSON.stringify(await embed(name)),
      })),
    );

    const { error } = await supabase.from("items").insert(rows as any);
    if (error) throw new Error(error.message);
    return { ok: true, count: rows.length };
  });

/** Semantic search across the user's items. */
export const searchItems = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ query: z.string().min(1).max(200) }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;

    const { data: profile } = await supabase
      .from("profiles")
      .select("plan")
      .eq("user_id", userId)
      .single();
    const counter = await getOrCreateMonthly(supabase, userId);
    if (profile?.plan === "free" && counter.searches_count >= FREE_LIMITS.searches) {
      throw new LimitError(
        `Місячний ліміт безкоштовного плану (${FREE_LIMITS.searches} пошуків) вичерпано.`,
      );
    }

    const queryEmbedding = await embed(data.query);
    const { data: matches, error } = await supabase.rpc("match_items", {
      query_embedding: queryEmbedding as any,
      match_count: 12,
    });
    if (error) throw new Error(error.message);

    await supabase
      .from("usage_counters")
      .update({ searches_count: counter.searches_count + 1 })
      .eq("id", counter.id);

    return { matches: matches ?? [] };
  });

/** Mark onboarding tutorial as completed. */
export const markTutorialDone = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    await supabase
      .from("profiles")
      .update({ tutorial_completed: true })
      .eq("user_id", userId);
    return { ok: true };
  });

/** Check if user can create another room/container under Free limits. */
export const canCreate = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ kind: z.enum(["room", "container"]) }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: profile } = await supabase
      .from("profiles")
      .select("plan")
      .eq("user_id", userId)
      .single();
    if (profile?.plan === "pro") return { allowed: true, plan: "pro" as const };

    if (data.kind === "room") {
      const { count } = await supabase
        .from("rooms")
        .select("id", { count: "exact", head: true });
      return {
        allowed: (count ?? 0) < FREE_LIMITS.rooms,
        used: count ?? 0,
        limit: FREE_LIMITS.rooms,
        plan: "free" as const,
      };
    }
    const { count } = await supabase
      .from("containers")
      .select("id", { count: "exact", head: true });
    return {
      allowed: (count ?? 0) < FREE_LIMITS.containers,
      used: count ?? 0,
      limit: FREE_LIMITS.containers,
      plan: "free" as const,
    };
  });
