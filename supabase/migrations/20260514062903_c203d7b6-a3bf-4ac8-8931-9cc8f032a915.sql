
CREATE TABLE public.ai_rate_limit (
  user_id uuid NOT NULL,
  window_start timestamptz NOT NULL,
  count int NOT NULL DEFAULT 0,
  PRIMARY KEY (user_id, window_start)
);
ALTER TABLE public.ai_rate_limit ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users view own rate limit" ON public.ai_rate_limit FOR SELECT USING (auth.uid() = user_id);

CREATE TABLE public.ai_usage_log (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  operation text NOT NULL,
  model text NOT NULL,
  input_tokens int NOT NULL DEFAULT 0,
  output_tokens int NOT NULL DEFAULT 0,
  cost_usd numeric(10,6) NOT NULL DEFAULT 0
);
ALTER TABLE public.ai_usage_log ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users view own usage log" ON public.ai_usage_log FOR SELECT USING (auth.uid() = user_id);
CREATE INDEX ai_usage_log_user_created_idx ON public.ai_usage_log (user_id, created_at DESC);

-- Atomic rate limit increment. Returns the count for the current minute window.
CREATE OR REPLACE FUNCTION public.increment_ai_rate_limit(_user_id uuid)
RETURNS int
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  win timestamptz := date_trunc('minute', now());
  cur int;
BEGIN
  INSERT INTO public.ai_rate_limit (user_id, window_start, count)
  VALUES (_user_id, win, 1)
  ON CONFLICT (user_id, window_start) DO UPDATE SET count = ai_rate_limit.count + 1
  RETURNING count INTO cur;

  -- Opportunistic cleanup: remove rows older than 10 minutes
  IF random() < 0.01 THEN
    DELETE FROM public.ai_rate_limit WHERE window_start < now() - interval '10 minutes';
  END IF;

  RETURN cur;
END;
$$;

-- Insert into usage log (server-only via service role, but keep open via SECURITY DEFINER for RLS-scoped clients)
CREATE OR REPLACE FUNCTION public.log_ai_usage(
  _user_id uuid,
  _operation text,
  _model text,
  _input_tokens int,
  _output_tokens int,
  _cost_usd numeric
) RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.ai_usage_log (user_id, operation, model, input_tokens, output_tokens, cost_usd)
  VALUES (_user_id, _operation, _model, _input_tokens, _output_tokens, _cost_usd);
END;
$$;
