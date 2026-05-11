
-- Fix mutable search_path
create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- Restrict SECURITY DEFINER trigger function from public API
revoke execute on function public.handle_new_user() from public, anon, authenticated;
