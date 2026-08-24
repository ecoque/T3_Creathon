-- TakeOff QR check-in badges + personal certificate export.
-- Run manually in Supabase Dashboard > SQL Editor.
-- Safe to re-run: no application rows are deleted or rewritten.

begin;

-- Links a badge to the session whose QR code was scanned to earn it. Nullable
-- so any pre-existing/manually-awarded badge rows remain valid.
alter table public.badges
  add column if not exists session_id uuid references public.sessions (id) on delete set null;

-- A user can only earn one badge per session (scanning the same QR twice is a
-- no-op, handled client-side via upsert(..., { ignoreDuplicates: true })).
create unique index if not exists badges_user_id_session_id_key
  on public.badges (user_id, session_id);

-- The base schema only ever let a user SELECT their own badges (rows were
-- assumed to be written by a service role). The QR scan flow now inserts
-- from the client, so the participant needs an INSERT policy on their own
-- rows too.
do $$
begin
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'badges' and policyname = 'badges_insert_own') then
    create policy "badges_insert_own" on public.badges for insert to authenticated
      with check (auth.uid() = user_id);
  end if;
end
$$;

commit;
