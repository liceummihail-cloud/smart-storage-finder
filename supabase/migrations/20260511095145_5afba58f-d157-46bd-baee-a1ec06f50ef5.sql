CREATE OR REPLACE FUNCTION public.match_items(query_embedding extensions.vector, match_count integer DEFAULT 10)
 RETURNS TABLE(id uuid, name text, container_id uuid, container_label text, room_id uuid, room_name text, similarity double precision)
 LANGUAGE sql
 STABLE
 SET search_path TO 'public', 'extensions'
AS $function$
  select
    i.id,
    i.name,
    c.id as container_id,
    c.label as container_label,
    r.id as room_id,
    r.name as room_name,
    1 - (i.embedding OPERATOR(extensions.<=>) query_embedding) as similarity
  from public.items i
  join public.containers c on c.id = i.container_id
  join public.rooms r on r.id = c.room_id
  where i.user_id = auth.uid() and i.embedding is not null
  order by i.embedding OPERATOR(extensions.<=>) query_embedding
  limit match_count;
$function$;