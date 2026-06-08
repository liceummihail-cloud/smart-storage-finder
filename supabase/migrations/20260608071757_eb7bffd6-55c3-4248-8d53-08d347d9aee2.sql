
ALTER TABLE public.walls ADD COLUMN IF NOT EXISTS photo_url text;

-- Backfill: for each room with containers but no walls, create "Основна"
ALTER TABLE public.walls DISABLE TRIGGER enforce_walls_plan_limit_trg;

WITH rooms_needing AS (
  SELECT DISTINCT r.id AS room_id, r.user_id, r.photo_url
  FROM public.rooms r
  WHERE NOT EXISTS (SELECT 1 FROM public.walls w WHERE w.room_id = r.id)
    AND EXISTS (SELECT 1 FROM public.containers c WHERE c.room_id = r.id)
),
inserted AS (
  INSERT INTO public.walls (room_id, user_id, name, position, photo_url)
  SELECT room_id, user_id, 'Основна', 0, photo_url FROM rooms_needing
  RETURNING id, room_id
)
UPDATE public.containers c
SET wall_id = i.id
FROM inserted i
WHERE c.room_id = i.room_id AND c.wall_id IS NULL;

ALTER TABLE public.walls ENABLE TRIGGER enforce_walls_plan_limit_trg;
