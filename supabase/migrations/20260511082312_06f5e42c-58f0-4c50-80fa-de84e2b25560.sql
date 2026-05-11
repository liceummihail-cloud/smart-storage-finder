
-- Enable pgvector for semantic search
create extension if not exists vector;

-- Plan enum
create type public.subscription_plan as enum ('free', 'pro');

-- Profiles
create table public.profiles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique references auth.users(id) on delete cascade,
  display_name text,
  tutorial_completed boolean not null default false,
  plan public.subscription_plan not null default 'free',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.profiles enable row level security;

create policy "Users can view own profile"
  on public.profiles for select
  using (auth.uid() = user_id);

create policy "Users can update own profile"
  on public.profiles for update
  using (auth.uid() = user_id);

create policy "Users can insert own profile"
  on public.profiles for insert
  with check (auth.uid() = user_id);

-- Rooms
create table public.rooms (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  photo_url text,
  created_at timestamptz not null default now()
);

alter table public.rooms enable row level security;

create policy "Users manage own rooms - select"
  on public.rooms for select using (auth.uid() = user_id);
create policy "Users manage own rooms - insert"
  on public.rooms for insert with check (auth.uid() = user_id);
create policy "Users manage own rooms - update"
  on public.rooms for update using (auth.uid() = user_id);
create policy "Users manage own rooms - delete"
  on public.rooms for delete using (auth.uid() = user_id);

-- Containers
create table public.containers (
  id uuid primary key default gen_random_uuid(),
  room_id uuid not null references public.rooms(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  label text not null,
  x numeric not null check (x >= 0 and x <= 1),
  y numeric not null check (y >= 0 and y <= 1),
  created_at timestamptz not null default now()
);

alter table public.containers enable row level security;

create policy "Users manage own containers - select"
  on public.containers for select using (auth.uid() = user_id);
create policy "Users manage own containers - insert"
  on public.containers for insert with check (auth.uid() = user_id);
create policy "Users manage own containers - update"
  on public.containers for update using (auth.uid() = user_id);
create policy "Users manage own containers - delete"
  on public.containers for delete using (auth.uid() = user_id);

create index containers_room_idx on public.containers(room_id);

-- Items
create table public.items (
  id uuid primary key default gen_random_uuid(),
  container_id uuid not null references public.containers(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  embedding vector(768),
  created_at timestamptz not null default now()
);

alter table public.items enable row level security;

create policy "Users manage own items - select"
  on public.items for select using (auth.uid() = user_id);
create policy "Users manage own items - insert"
  on public.items for insert with check (auth.uid() = user_id);
create policy "Users manage own items - update"
  on public.items for update using (auth.uid() = user_id);
create policy "Users manage own items - delete"
  on public.items for delete using (auth.uid() = user_id);

create index items_container_idx on public.items(container_id);
create index items_embedding_idx on public.items using hnsw (embedding vector_cosine_ops);

-- Usage counters (monthly)
create table public.usage_counters (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  month date not null,
  transcriptions_count integer not null default 0,
  searches_count integer not null default 0,
  unique (user_id, month)
);

alter table public.usage_counters enable row level security;

create policy "Users view own usage"
  on public.usage_counters for select using (auth.uid() = user_id);

-- updated_at trigger fn
create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger profiles_updated_at
  before update on public.profiles
  for each row execute function public.set_updated_at();

-- Auto-create profile on signup
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (user_id, display_name)
  values (new.id, coalesce(new.raw_user_meta_data->>'display_name', split_part(new.email, '@', 1)));
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Semantic search RPC (user-scoped via auth.uid())
create or replace function public.match_items(
  query_embedding vector(768),
  match_count int default 10
)
returns table (
  id uuid,
  name text,
  container_id uuid,
  container_label text,
  room_id uuid,
  room_name text,
  similarity float
)
language sql stable
security invoker
set search_path = public
as $$
  select
    i.id,
    i.name,
    c.id as container_id,
    c.label as container_label,
    r.id as room_id,
    r.name as room_name,
    1 - (i.embedding <=> query_embedding) as similarity
  from public.items i
  join public.containers c on c.id = i.container_id
  join public.rooms r on r.id = c.room_id
  where i.user_id = auth.uid() and i.embedding is not null
  order by i.embedding <=> query_embedding
  limit match_count;
$$;

-- Storage bucket
insert into storage.buckets (id, name, public)
values ('room-photos', 'room-photos', false)
on conflict (id) do nothing;

create policy "Users read own room photos"
  on storage.objects for select
  using (bucket_id = 'room-photos' and auth.uid()::text = (storage.foldername(name))[1]);

create policy "Users upload own room photos"
  on storage.objects for insert
  with check (bucket_id = 'room-photos' and auth.uid()::text = (storage.foldername(name))[1]);

create policy "Users delete own room photos"
  on storage.objects for delete
  using (bucket_id = 'room-photos' and auth.uid()::text = (storage.foldername(name))[1]);
