
-- 1. Add 'yearly' to enum
ALTER TYPE public.subscription_plan ADD VALUE IF NOT EXISTS 'yearly';

-- 2. Add language column
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS language text NOT NULL DEFAULT 'en';

-- 3. Daily usage counter table
CREATE TABLE IF NOT EXISTS public.usage_counters_daily (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  day date NOT NULL,
  transcriptions_count integer NOT NULL DEFAULT 0,
  searches_count integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(user_id, day)
);

GRANT SELECT, INSERT, UPDATE ON public.usage_counters_daily TO authenticated;
GRANT ALL ON public.usage_counters_daily TO service_role;

ALTER TABLE public.usage_counters_daily ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users view own daily usage" ON public.usage_counters_daily
  FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users insert own daily usage" ON public.usage_counters_daily
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users update own daily usage" ON public.usage_counters_daily
  FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- 4. Update rooms trigger for new limits
CREATE OR REPLACE FUNCTION public.enforce_free_rooms_limit()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  user_plan public.subscription_plan;
  room_count int;
  max_rooms int;
BEGIN
  SELECT plan INTO user_plan FROM public.profiles WHERE user_id = NEW.user_id;
  max_rooms := CASE user_plan
    WHEN 'yearly' THEN 15
    WHEN 'premium' THEN 15
    WHEN 'pro' THEN 10
    ELSE 1
  END;
  SELECT count(*) INTO room_count FROM public.rooms WHERE user_id = NEW.user_id;
  IF room_count >= max_rooms THEN
    RAISE EXCEPTION 'PLAN_ROOMS_LIMIT' USING ERRCODE = 'P0001';
  END IF;
  RETURN NEW;
END;
$function$;

-- 5. Update walls trigger
CREATE OR REPLACE FUNCTION public.enforce_walls_plan_limit()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  user_plan public.subscription_plan;
  max_walls int;
  cur_count int;
BEGIN
  SELECT plan INTO user_plan FROM public.profiles WHERE user_id = NEW.user_id;
  max_walls := CASE user_plan
    WHEN 'yearly' THEN 7
    WHEN 'premium' THEN 7
    WHEN 'pro' THEN 5
    ELSE 1
  END;
  SELECT count(*) INTO cur_count FROM public.walls WHERE room_id = NEW.room_id;
  IF cur_count >= max_walls THEN
    RAISE EXCEPTION 'PLAN_WALLS_LIMIT' USING ERRCODE = 'P0001';
  END IF;
  RETURN NEW;
END;
$function$;

-- 6. Monthly AI cost RPC
CREATE OR REPLACE FUNCTION public.get_monthly_ai_cost(_user_id uuid)
RETURNS numeric
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT COALESCE(SUM(cost_usd), 0)::numeric
  FROM public.ai_usage_log
  WHERE user_id = _user_id
    AND created_at >= date_trunc('month', now());
$$;

GRANT EXECUTE ON FUNCTION public.get_monthly_ai_cost(uuid) TO authenticated;
