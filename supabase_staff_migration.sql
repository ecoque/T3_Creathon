-- TakeOff staff ("gorevli") role + entrepreneur/zone responsibility assignment.
-- Run manually in Supabase Dashboard > SQL Editor.
-- Safe to re-run: no application rows are deleted or rewritten.
--
-- NOTE: 'gorevli' is intentionally NOT selectable from the onboarding role
-- picker (app/onboarding/index.tsx keeps its own hardcoded 4-role list).
-- Only the admin panel (components/admin/AdminAttendees.tsx + the attendee
-- editor's role dropdown) can move a profile into this role.

begin;

-- Widen the participant role check constraint to also accept the staff role.
-- The constraint has no explicit name in supabase_schema.sql, so Postgres
-- auto-named it '<table>_<column>_check'; drop-then-recreate under that same
-- name keeps this idempotent regardless of how many times it is re-run.
do $$
begin
  if exists (
    select 1 from pg_constraint
    where conrelid = 'public.profiles'::regclass and conname = 'profiles_role_check'
  ) then
    alter table public.profiles drop constraint profiles_role_check;
  end if;
end
$$;

alter table public.profiles
  add constraint profiles_role_check
  check (role in ('girisimci', 'yatirimci', 'kurum', 'ziyaretci', 'gorevli'));

-- Mirrors public.is_admin(): lets RLS policies check "is this caller staff?"
-- without recursing into profiles' own RLS.
create or replace function public.is_staff()
returns boolean
language sql
security definer set search_path = public
stable
as $$
  select exists (
    select 1 from public.profiles p
    where p.user_id = auth.uid() and p.role = 'gorevli'
  );
$$;

-- A staff member can be responsible for one or more entrepreneurs and/or a
-- zone; zone_id is optional (a staff member may only be tied to specific
-- entrepreneurs with no zone-wide duty).
create table if not exists public.staff_assignments (
  id uuid primary key default gen_random_uuid(),
  staff_user_id uuid not null references public.users (id) on delete cascade,
  entrepreneur_profile_id uuid not null references public.profiles (id) on delete cascade,
  zone_id uuid references public.zones (id) on delete set null,
  created_at timestamptz not null default now(),
  unique (staff_user_id, entrepreneur_profile_id)
);

alter table public.staff_assignments
  add column if not exists staff_user_id uuid references public.users (id) on delete cascade,
  add column if not exists entrepreneur_profile_id uuid references public.profiles (id) on delete cascade,
  add column if not exists zone_id uuid references public.zones (id) on delete set null,
  add column if not exists created_at timestamptz not null default now();

alter table public.staff_assignments enable row level security;

do $$
begin
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'staff_assignments' and policyname = 'staff_assignments_admin_all') then
    create policy "staff_assignments_admin_all" on public.staff_assignments for all to authenticated
      using (public.is_admin()) with check (public.is_admin());
  end if;
  -- A staff member can see their own assignment list (used by the "Görevli"
  -- tab) but cannot create/edit/delete it themselves — only admin manages it.
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'staff_assignments' and policyname = 'staff_assignments_self_select') then
    create policy "staff_assignments_self_select" on public.staff_assignments for select to authenticated
      using (auth.uid() = staff_user_id);
  end if;
end
$$;

commit;
