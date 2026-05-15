
-- Subscriptions table
CREATE TABLE public.subscriptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  provider text NOT NULL CHECK (provider IN ('paddle', 'google_play', 'stripe', 'manual')),
  provider_subscription_id text NOT NULL,
  provider_customer_id text,
  status text NOT NULL CHECK (status IN ('trialing', 'active', 'past_due', 'canceled', 'expired', 'paused')),
  plan public.subscription_plan NOT NULL,
  current_period_start timestamptz,
  current_period_end timestamptz,
  trial_end timestamptz,
  canceled_at timestamptz,
  raw_event jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (provider, provider_subscription_id)
);

CREATE INDEX idx_subscriptions_user ON public.subscriptions(user_id);
CREATE INDEX idx_subscriptions_status ON public.subscriptions(user_id, status);

ALTER TABLE public.subscriptions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users view own subscriptions"
  ON public.subscriptions FOR SELECT
  USING (auth.uid() = user_id);

-- Updated-at trigger
CREATE TRIGGER trg_subscriptions_updated_at
  BEFORE UPDATE ON public.subscriptions
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Trial field on profiles
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS trial_ends_at timestamptz;

-- Function: recompute profiles.plan from highest active subscription
CREATE OR REPLACE FUNCTION public.sync_user_plan_from_subscription()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  uid uuid;
  best_plan public.subscription_plan;
BEGIN
  uid := COALESCE(NEW.user_id, OLD.user_id);

  SELECT plan INTO best_plan
  FROM public.subscriptions
  WHERE user_id = uid
    AND status IN ('trialing', 'active', 'past_due')
    AND (current_period_end IS NULL OR current_period_end > now())
  ORDER BY CASE plan WHEN 'premium' THEN 2 WHEN 'pro' THEN 1 ELSE 0 END DESC
  LIMIT 1;

  UPDATE public.profiles
  SET plan = COALESCE(best_plan, 'free')
  WHERE user_id = uid;

  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_sync_plan_after_subscription_change
  AFTER INSERT OR UPDATE OR DELETE ON public.subscriptions
  FOR EACH ROW EXECUTE FUNCTION public.sync_user_plan_from_subscription();
