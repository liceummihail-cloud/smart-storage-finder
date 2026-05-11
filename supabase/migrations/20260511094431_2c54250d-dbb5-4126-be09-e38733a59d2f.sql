create policy "Users create own usage"
on public.usage_counters
for insert
to authenticated
with check (auth.uid() = user_id);

create policy "Users update own usage"
on public.usage_counters
for update
to authenticated
using (auth.uid() = user_id)
with check (auth.uid() = user_id);