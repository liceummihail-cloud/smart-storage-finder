
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
  IF auth.uid() IS NULL OR auth.uid() <> _user_id THEN
    RAISE EXCEPTION 'forbidden' USING ERRCODE = '42501';
  END IF;
  INSERT INTO public.ai_rate_limit (user_id, window_start, count)
  VALUES (_user_id, win, 1)
  ON CONFLICT (user_id, window_start) DO UPDATE SET count = ai_rate_limit.count + 1
  RETURNING count INTO cur;
  IF random() < 0.01 THEN
    DELETE FROM public.ai_rate_limit WHERE window_start < now() - interval '10 minutes';
  END IF;
  RETURN cur;
END;
$$;

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
  IF auth.uid() IS NULL OR auth.uid() <> _user_id THEN
    RAISE EXCEPTION 'forbidden' USING ERRCODE = '42501';
  END IF;
  INSERT INTO public.ai_usage_log (user_id, operation, model, input_tokens, output_tokens, cost_usd)
  VALUES (_user_id, _operation, _model, _input_tokens, _output_tokens, _cost_usd);
END;
$$;

REVOKE EXECUTE ON FUNCTION public.increment_ai_rate_limit(uuid) FROM anon, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.log_ai_usage(uuid, text, text, int, int, numeric) FROM anon, PUBLIC;
GRANT EXECUTE ON FUNCTION public.increment_ai_rate_limit(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.log_ai_usage(uuid, text, text, int, int, numeric) TO authenticated;
