
CREATE OR REPLACE FUNCTION public.get_monthly_ai_cost(_user_id uuid)
RETURNS numeric
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF auth.uid() IS NULL OR auth.uid() <> _user_id THEN
    RAISE EXCEPTION 'forbidden' USING ERRCODE = '42501';
  END IF;
  RETURN (
    SELECT COALESCE(SUM(cost_usd), 0)::numeric
    FROM public.ai_usage_log
    WHERE user_id = _user_id
      AND created_at >= date_trunc('month', now())
  );
END;
$$;
