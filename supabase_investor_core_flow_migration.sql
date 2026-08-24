-- TakeOff investor core flow (final, additive migration).
-- Run manually in Supabase Dashboard > SQL Editor.
-- Safe to re-run: no application rows are deleted or rewritten.

begin;

-- Keep the profile contract self-contained even when older admin migrations
-- were not applied in the same order.
alter table public.profiles
  add column if not exists title text,
  add column if not exists company text,
  add column if not exists status text not null default 'active',
  add column if not exists investment_thesis text,
  add column if not exists investment_focuses text[] not null default '{}';

-- profiles_update_self from the base schema must never allow a participant to
-- reactivate a passive account. Reuse the admin migration's function/trigger
-- names so either migration order produces the same protection.
create or replace function public.protect_admin_profile_fields()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  if auth.uid() is not null
    and auth.role() <> 'service_role'
    and not public.is_admin()
    and new.status is distinct from old.status then
    raise exception 'Admin-managed profile fields cannot be changed by this user.';
  end if;
  return new;
end;
$$;

do $$
begin
  if not exists (
    select 1 from pg_trigger
    where tgname = 'protect_admin_profile_fields'
      and tgrelid = 'public.profiles'::regclass
      and not tgisinternal
  ) then
    create trigger protect_admin_profile_fields
      before update on public.profiles
      for each row execute function public.protect_admin_profile_fields();
  end if;
end
$$;

comment on column public.profiles.investment_thesis is
  'Required for active investor profiles and used for discovery matching.';
comment on column public.profiles.investment_focuses is
  'One or two secondary investor focus areas; profiles.sector is the primary focus.';

-- NOT VALID avoids rewriting/rejecting historical rows during migration while
-- still enforcing the limits for every new or updated profile row.
do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.profiles'::regclass
      and conname = 'profiles_investment_thesis_max_length'
  ) then
    alter table public.profiles
      add constraint profiles_investment_thesis_max_length
      check (investment_thesis is null or char_length(investment_thesis) <= 280)
      not valid;
  end if;
  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.profiles'::regclass
      and conname = 'profiles_investment_thesis_required'
  ) then
    alter table public.profiles
      add constraint profiles_investment_thesis_required
      check (
        role <> 'yatirimci'
        or status = 'passive'
        or coalesce(investment_thesis ~ '[^[:space:]]', false)
      )
      not valid;
  end if;
  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.profiles'::regclass
      and conname = 'profiles_status_allowed_values'
  ) then
    alter table public.profiles
      add constraint profiles_status_allowed_values
      check (status in ('active', 'passive'))
      not valid;
  end if;
  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.profiles'::regclass
      and conname = 'profiles_investment_focuses_max_count'
  ) then
    alter table public.profiles
      add constraint profiles_investment_focuses_max_count
      check (coalesce(cardinality(investment_focuses), 0) <= 2)
      not valid;
  end if;
  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.profiles'::regclass
      and conname = 'profiles_investor_preferences_max_count'
  ) then
    alter table public.profiles
      add constraint profiles_investor_preferences_max_count
      check (role <> 'yatirimci' or cardinality(interests) <= 3)
      not valid;
  end if;
  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.profiles'::regclass
      and conname = 'profiles_investor_goals_max_count'
  ) then
    alter table public.profiles
      add constraint profiles_investor_goals_max_count
      check (role <> 'yatirimci' or cardinality(goals) <= 2)
      not valid;
  end if;
end
$$;

create table if not exists public.investor_shortlists (
  id uuid primary key default gen_random_uuid(),
  owner_user_id uuid not null references public.users (id) on delete cascade,
  profile_id uuid not null references public.profiles (id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (owner_user_id, profile_id)
);

alter table public.investor_shortlists enable row level security;
revoke all on table public.investor_shortlists from anon;
revoke all on table public.investor_shortlists from authenticated;
grant select, insert, delete on table public.investor_shortlists to authenticated;

-- Replacing only this migration's policy names makes a re-run deterministic.
-- These operations change authorization rules only; shortlist rows are untouched.
drop policy if exists "investor_shortlists_select_own" on public.investor_shortlists;
drop policy if exists "investor_shortlists_insert_own" on public.investor_shortlists;
drop policy if exists "investor_shortlists_update_own" on public.investor_shortlists;
drop policy if exists "investor_shortlists_delete_own" on public.investor_shortlists;
drop policy if exists "investor_shortlists_select_own_active_v2" on public.investor_shortlists;
create policy "investor_shortlists_select_own_active_v2" on public.investor_shortlists
  for select to authenticated
  using (
    auth.uid() = owner_user_id
    and exists (
      select 1 from public.profiles owner_profile
      where owner_profile.user_id = auth.uid()
        and owner_profile.role = 'yatirimci'
        and owner_profile.status = 'active'
    )
    and exists (
      select 1 from public.profiles target_profile
      where target_profile.id = profile_id
        and target_profile.role in ('girisimci', 'kurum')
        and target_profile.status = 'active'
    )
  );

drop policy if exists "investor_shortlists_insert_own_active_v2" on public.investor_shortlists;
create policy "investor_shortlists_insert_own_active_v2" on public.investor_shortlists
  for insert to authenticated
  with check (
    auth.uid() = owner_user_id
    and exists (
      select 1 from public.profiles owner_profile
      where owner_profile.user_id = auth.uid()
        and owner_profile.role = 'yatirimci'
        and owner_profile.status = 'active'
    )
    and exists (
      select 1 from public.profiles target_profile
      where target_profile.id = profile_id
        and target_profile.role in ('girisimci', 'kurum')
        and target_profile.status = 'active'
    )
  );

drop policy if exists "investor_shortlists_delete_own_active_v2" on public.investor_shortlists;
create policy "investor_shortlists_delete_own_active_v2" on public.investor_shortlists
  for delete to authenticated
  using (
    auth.uid() = owner_user_id
    and exists (
      select 1 from public.profiles owner_profile
      where owner_profile.user_id = auth.uid()
        and owner_profile.role = 'yatirimci'
        and owner_profile.status = 'active'
    )
  );

-- Restrictive gates remain effective even if a differently named permissive
-- policy already exists in a live project. They prevent OR-policy bypasses.
drop policy if exists "investor_shortlists_select_gate_v2" on public.investor_shortlists;
create policy "investor_shortlists_select_gate_v2" on public.investor_shortlists
  as restrictive for select to authenticated
  using (
    auth.uid() = owner_user_id
    and exists (
      select 1 from public.profiles owner_profile
      where owner_profile.user_id = auth.uid()
        and owner_profile.role = 'yatirimci'
        and owner_profile.status = 'active'
    )
    and exists (
      select 1 from public.profiles target_profile
      where target_profile.id = profile_id
        and target_profile.role in ('girisimci', 'kurum')
        and target_profile.status = 'active'
    )
  );

drop policy if exists "investor_shortlists_insert_gate_v2" on public.investor_shortlists;
create policy "investor_shortlists_insert_gate_v2" on public.investor_shortlists
  as restrictive for insert to authenticated
  with check (
    auth.uid() = owner_user_id
    and exists (
      select 1 from public.profiles owner_profile
      where owner_profile.user_id = auth.uid()
        and owner_profile.role = 'yatirimci'
        and owner_profile.status = 'active'
    )
    and exists (
      select 1 from public.profiles target_profile
      where target_profile.id = profile_id
        and target_profile.role in ('girisimci', 'kurum')
        and target_profile.status = 'active'
    )
  );

drop policy if exists "investor_shortlists_delete_gate_v2" on public.investor_shortlists;
create policy "investor_shortlists_delete_gate_v2" on public.investor_shortlists
  as restrictive for delete to authenticated
  using (
    auth.uid() = owner_user_id
    and exists (
      select 1 from public.profiles owner_profile
      where owner_profile.user_id = auth.uid()
        and owner_profile.role = 'yatirimci'
        and owner_profile.status = 'active'
    )
  );

commit;
