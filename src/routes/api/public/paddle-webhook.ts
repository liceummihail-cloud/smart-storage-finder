import { createFileRoute } from "@tanstack/react-router";
import { createHmac, timingSafeEqual } from "crypto";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

// Paddle Billing webhook receiver.
// Configure in Paddle dashboard -> Notifications -> URL:
//   https://<your-domain>/api/public/paddle-webhook
// Set the signing secret as PADDLE_WEBHOOK_SECRET env var.
//
// Paddle sends a "Paddle-Signature" header in the form:
//   ts=<unix>;h1=<hmac_sha256_hex>
// where the signed payload is `<ts>:<raw_body>`.

type Plan = "free" | "pro" | "premium";

function planFromPriceId(priceId: string | null | undefined): Plan {
  if (!priceId) return "free";
  // These map to Paddle Price IDs created later in the dashboard.
  // Until products are created, env vars stay empty and the webhook
  // returns 200 without changing data — safe no-op.
  const proIds = (process.env.PADDLE_PRICE_IDS_PRO ?? "").split(",").map((s) => s.trim()).filter(Boolean);
  const premiumIds = (process.env.PADDLE_PRICE_IDS_PREMIUM ?? "").split(",").map((s) => s.trim()).filter(Boolean);
  if (premiumIds.includes(priceId)) return "premium";
  if (proIds.includes(priceId)) return "pro";
  return "free";
}

function mapStatus(s: string): "trialing" | "active" | "past_due" | "canceled" | "expired" | "paused" {
  switch (s) {
    case "trialing":
      return "trialing";
    case "active":
      return "active";
    case "past_due":
      return "past_due";
    case "paused":
      return "paused";
    case "canceled":
      return "canceled";
    default:
      return "expired";
  }
}

function verifySignature(rawBody: string, header: string | null, secret: string): boolean {
  if (!header) return false;
  const parts = Object.fromEntries(header.split(";").map((p) => p.split("=") as [string, string]));
  const ts = parts["ts"];
  const h1 = parts["h1"];
  if (!ts || !h1) return false;
  const signed = `${ts}:${rawBody}`;
  const expected = createHmac("sha256", secret).update(signed).digest("hex");
  try {
    return timingSafeEqual(Buffer.from(h1, "hex"), Buffer.from(expected, "hex"));
  } catch {
    return false;
  }
}

export const Route = createFileRoute("/api/public/paddle-webhook")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const secret = process.env.PADDLE_WEBHOOK_SECRET;
        const rawBody = await request.text();

        // If secret not yet configured, accept-and-log so Paddle setup can succeed.
        if (!secret) {
          console.warn("[paddle-webhook] PADDLE_WEBHOOK_SECRET not set; ignoring event");
          return new Response("not configured", { status: 200 });
        }

        const sig = request.headers.get("paddle-signature");
        if (!verifySignature(rawBody, sig, secret)) {
          return new Response("invalid signature", { status: 401 });
        }

        let event: any;
        try {
          event = JSON.parse(rawBody);
        } catch {
          return new Response("bad json", { status: 400 });
        }

        const eventType: string = event?.event_type ?? "";
        const data = event?.data ?? {};

        // We care about subscription lifecycle events.
        if (!eventType.startsWith("subscription.")) {
          return new Response("ignored", { status: 200 });
        }

        // user_id must be passed via custom_data when creating checkout.
        const userId: string | undefined = data?.custom_data?.user_id;
        if (!userId) {
          console.error("[paddle-webhook] missing custom_data.user_id");
          return new Response("missing user_id", { status: 400 });
        }

        const subscriptionId: string = data?.id;
        const customerId: string | undefined = data?.customer_id;
        const status = mapStatus(data?.status ?? "expired");
        const items = Array.isArray(data?.items) ? data.items : [];
        const priceId: string | undefined = items[0]?.price?.id;
        const plan = planFromPriceId(priceId);

        const periodStart = data?.current_billing_period?.starts_at ?? null;
        const periodEnd = data?.current_billing_period?.ends_at ?? null;
        const trialEnd = data?.trial_dates?.ends_at ?? null;
        const canceledAt = data?.canceled_at ?? null;

        const { error } = await supabaseAdmin
          .from("subscriptions")
          .upsert(
            {
              user_id: userId,
              provider: "paddle",
              provider_subscription_id: subscriptionId,
              provider_customer_id: customerId,
              status,
              plan,
              current_period_start: periodStart,
              current_period_end: periodEnd,
              trial_end: trialEnd,
              canceled_at: canceledAt,
              raw_event: event,
            },
            { onConflict: "provider,provider_subscription_id" },
          );

        if (error) {
          console.error("[paddle-webhook] db error", error);
          return new Response("db error", { status: 500 });
        }

        return new Response("ok", { status: 200 });
      },
    },
  },
});
