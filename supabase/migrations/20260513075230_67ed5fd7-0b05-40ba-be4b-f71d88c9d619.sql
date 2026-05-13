
-- ============ WALLS ============
CREATE TABLE public.walls (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  room_id uuid NOT NULL REFERENCES public.rooms(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  name text NOT NULL,
  position integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.walls ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage own walls - select" ON public.walls FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users manage own walls - insert" ON public.walls FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users manage own walls - update" ON public.walls FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users manage own walls - delete" ON public.walls FOR DELETE USING (auth.uid() = user_id);
CREATE INDEX walls_room_idx ON public.walls(room_id, position);

-- containers can optionally belong to a wall
ALTER TABLE public.containers ADD COLUMN wall_id uuid REFERENCES public.walls(id) ON DELETE SET NULL;
CREATE INDEX containers_wall_idx ON public.containers(wall_id);

-- ============ SECURITY (PIN + biometric) ============
CREATE TABLE public.user_security (
  user_id uuid PRIMARY KEY,
  pin_hash text,
  biometric_enabled boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.user_security ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users view own security" ON public.user_security FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users insert own security" ON public.user_security FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users update own security" ON public.user_security FOR UPDATE USING (auth.uid() = user_id);
CREATE TRIGGER user_security_updated_at BEFORE UPDATE ON public.user_security
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ============ SUBSCRIPTIONS: extend existing plan enum ============
-- Existing enum: subscription_plan ('free', 'pro' presumably). Add 'premium'.
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_enum WHERE enumlabel = 'premium' AND enumtypid = 'public.subscription_plan'::regtype) THEN
    ALTER TYPE public.subscription_plan ADD VALUE 'premium';
  END IF;
END $$;

-- ============ Update free-plan trigger: 1 room only, walls require pro+ ============
CREATE OR REPLACE FUNCTION public.enforce_free_rooms_limit()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  user_plan public.subscription_plan;
  room_count int;
  max_rooms int;
BEGIN
  SELECT plan INTO user_plan FROM public.profiles WHERE user_id = NEW.user_id;
  max_rooms := CASE user_plan
    WHEN 'premium' THEN 1000000
    WHEN 'pro' THEN 10
    ELSE 1
  END;
  SELECT count(*) INTO room_count FROM public.rooms WHERE user_id = NEW.user_id;
  IF room_count >= max_rooms THEN
    RAISE EXCEPTION 'PLAN_ROOMS_LIMIT' USING ERRCODE = 'P0001';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS enforce_free_rooms_limit_trg ON public.rooms;
CREATE TRIGGER enforce_free_rooms_limit_trg BEFORE INSERT ON public.rooms
  FOR EACH ROW EXECUTE FUNCTION public.enforce_free_rooms_limit();

-- Walls limit: free=0, pro=10/room, premium=unlimited
CREATE OR REPLACE FUNCTION public.enforce_walls_plan_limit()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  user_plan public.subscription_plan;
  max_walls int;
  cur_count int;
BEGIN
  SELECT plan INTO user_plan FROM public.profiles WHERE user_id = NEW.user_id;
  max_walls := CASE user_plan
    WHEN 'premium' THEN 1000000
    WHEN 'pro' THEN 10
    ELSE 0
  END;
  IF max_walls = 0 THEN
    RAISE EXCEPTION 'PLAN_WALLS_REQUIRES_UPGRADE' USING ERRCODE = 'P0001';
  END IF;
  SELECT count(*) INTO cur_count FROM public.walls WHERE room_id = NEW.room_id;
  IF cur_count >= max_walls THEN
    RAISE EXCEPTION 'PLAN_WALLS_LIMIT' USING ERRCODE = 'P0001';
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER enforce_walls_plan_limit_trg BEFORE INSERT ON public.walls
  FOR EACH ROW EXECUTE FUNCTION public.enforce_walls_plan_limit();
