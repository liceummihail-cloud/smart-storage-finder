import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

const TRIAL_DAYS = 7;

/**
 * Returns the user's currently effective subscription state.
 * Computed from the `subscriptions` table + `profiles.trial_ends_at`.
 */
export const getMySubscription = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;

    const [{ data: profile }, { data: subs }] = await Promise.all([
      supabase
        .from("profiles")
        .select("plan, trial_ends_at")
        .eq("user_id", userId)
        .maybeSingle(),
      supabase
        .from("subscriptions")
        .select(
          "id, provider, status, plan, current_period_end, trial_end, canceled_at, created_at",
        )
        .eq("user_id", userId)
        .order("created_at", { ascending: false })
        .limit(5),
    ]);

    const trialEndsAt = profile?.trial_ends_at ?? null;
    const trialActive =
      !!trialEndsAt && new Date(trialEndsAt).getTime() > Date.now();

    return {
      plan: (profile?.plan ?? "free") as "free" | "pro" | "yearly" | "premium",
      trialEndsAt,
      trialActive,
      subscriptions: subs ?? [],
    };
  });

/**
 * Starts a 7-day Pro trial. Available once per user (idempotent: re-calling
 * after expiry is rejected). Uses the admin client to bypass RLS so we can
 * insert a `provider='manual'` subscription row, which the trigger then
 * uses to flip profiles.plan to 'pro'.
 */
export const startProTrial = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { userId } = context;

    // Reject if user already has any subscription history (trial or paid).
    const { data: existing } = await supabaseAdmin
      .from("subscriptions")
      .select("id")
      .eq("user_id", userId)
      .limit(1)
      .maybeSingle();

    if (existing) {
      return { ok: false as const, reason: "already_used" };
    }

    const trialEnd = new Date(Date.now() + TRIAL_DAYS * 24 * 60 * 60 * 1000);

    const { error: insertErr } = await supabaseAdmin.from("subscriptions").insert({
      user_id: userId,
      provider: "manual",
      provider_subscription_id: `trial_${userId}`,
      status: "trialing",
      plan: "pro",
      current_period_start: new Date().toISOString(),
      current_period_end: trialEnd.toISOString(),
      trial_end: trialEnd.toISOString(),
    });

    if (insertErr) {
      console.error("[startProTrial] insert error", insertErr);
      return { ok: false as const, reason: "db_error" };
    }

    await supabaseAdmin
      .from("profiles")
      .update({ trial_ends_at: trialEnd.toISOString() })
      .eq("user_id", userId);

    return { ok: true as const, trialEndsAt: trialEnd.toISOString() };
  });

/**
 * Placeholder for Paddle Checkout. Returns a stub URL until Paddle is
 * connected and PADDLE_CLIENT_TOKEN + price IDs are configured.
 */
export const createCheckoutSession = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) =>
    z.object({ plan: z.enum(["pro", "yearly"]) }).parse(data),
  )
  .handler(async ({ data, context }) => {
    const token = process.env.PADDLE_API_KEY;
    if (!token) {
      return {
        ok: false as const,
        reason: "not_configured" as const,
        message:
          "Платежі ще не підключені. Оплата буде доступна, коли активуємо Paddle.",
      };
    }

    // When PADDLE_API_KEY exists, build a Transaction via Paddle API and
    // return its checkout URL. Implemented in the next iteration once the
    // user enables Paddle and we know the live price IDs.
    return {
      ok: false as const,
      reason: "not_implemented" as const,
      message: `Checkout для плану ${data.plan} (user ${context.userId}) — в розробці.`,
    };
  });
