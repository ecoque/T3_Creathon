-- TakeOff daily meals + dynamic personal meal-slot assignment.
-- Run manually in Supabase Dashboard > SQL Editor.
-- Safe to re-run: no application rows are deleted or rewritten.

begin;

-- 1) Daily menu, set by admin (one row per event day).
create table if not exists public.meals (
  id uuid primary key default gen_random_uuid(),
  event_date date not null,
  title text not null,
  description text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.meals
  add column if not exists event_date date,
  add column if not exists title text,
  add column if not exists description text,
  add column if not exists created_at timestamptz not null default now(),
  add column if not exists updated_at timestamptz not null default now();

-- One menu per calendar day; admin edits (upserts) the same row instead of
-- piling up duplicates for the same date.
create unique index if not exists meals_event_date_key on public.meals (event_date);

-- 2) Personal meal time slot, computed once per user per day and cached here
-- so it never changes after the first computation (bkz. lib/useMeals.ts).
create table if not exists public.meal_assignments (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users (id) on delete cascade,
  event_date date not null,
  slot_start timestamptz not null,
  slot_end timestamptz not null,
  created_at timestamptz not null default now(),
  unique (user_id, event_date)
);

alter table public.meal_assignments
  add column if not exists user_id uuid references public.users (id) on delete cascade,
  add column if not exists event_date date,
  add column if not exists slot_start timestamptz,
  add column if not exists slot_end timestamptz,
  add column if not exists created_at timestamptz not null default now();

alter table public.meals enable row level security;
alter table public.meal_assignments enable row level security;

do $$
begin
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'meals' and policyname = 'meals_select_all') then
    create policy "meals_select_all" on public.meals for select to authenticated using (true);
  end if;
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'meals' and policyname = 'meals_admin_write') then
    create policy "meals_admin_write" on public.meals for all to authenticated using (public.is_admin()) with check (public.is_admin());
  end if;

  -- A user may only read/insert their own cached slot; the assignment is
  -- computed client-side on first app open of the day and never updated
  -- afterwards, so no update/delete policy is needed.
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'meal_assignments' and policyname = 'meal_assignments_select_own') then
    create policy "meal_assignments_select_own" on public.meal_assignments for select to authenticated
      using (auth.uid() = user_id or public.is_admin());
  end if;
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'meal_assignments' and policyname = 'meal_assignments_insert_own') then
    create policy "meal_assignments_insert_own" on public.meal_assignments for insert to authenticated
      with check (auth.uid() = user_id);
  end if;
end
$$;

commit;
