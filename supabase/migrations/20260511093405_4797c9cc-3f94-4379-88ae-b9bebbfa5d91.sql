-- Enforce Freemium plan limits at the database level
CREATE OR REPLACE FUNCTION public.enforce_free_rooms_limit()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  user_plan public.subscription_plan;
  room_count int;
BEGIN
  SELECT plan INTO user_plan FROM public.profiles WHERE user_id = NEW.user_id;
  IF user_plan IS NULL OR user_plan = 'free' THEN
    SELECT count(*) INTO room_count FROM public.rooms WHERE user_id = NEW.user_id;
    IF room_count >= 3 THEN
      RAISE EXCEPTION 'FREE_PLAN_ROOMS_LIMIT' USING ERRCODE = 'P0001';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS enforce_free_rooms_limit_trg ON public.rooms;
CREATE TRIGGER enforce_free_rooms_limit_trg
BEFORE INSERT ON public.rooms
FOR EACH ROW EXECUTE FUNCTION public.enforce_free_rooms_limit();

CREATE OR REPLACE FUNCTION public.enforce_free_containers_limit()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  user_plan public.subscription_plan;
  c_count int;
BEGIN
  SELECT plan INTO user_plan FROM public.profiles WHERE user_id = NEW.user_id;
  IF user_plan IS NULL OR user_plan = 'free' THEN
    SELECT count(*) INTO c_count FROM public.containers WHERE user_id = NEW.user_id;
    IF c_count >= 30 THEN
      RAISE EXCEPTION 'FREE_PLAN_CONTAINERS_LIMIT' USING ERRCODE = 'P0001';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS enforce_free_containers_limit_trg ON public.containers;
CREATE TRIGGER enforce_free_containers_limit_trg
BEFORE INSERT ON public.containers
FOR EACH ROW EXECUTE FUNCTION public.enforce_free_containers_limit();