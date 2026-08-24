-- TakeOff water station tracking (map markers + staff/admin refill workflow).
-- Run manually in Supabase Dashboard > SQL Editor.
-- Safe to re-run: no application rows are deleted or rewritten.
-- Depends on: supabase_staff_migration.sql (for the 'gorevli' role and the
-- public.is_staff() helper). This file also (re)defines is_staff() itself so
-- it works even if run before the staff migration.

begin;

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

create table if not exists public.water_stations (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  zone_id uuid references public.zones (id) on delete set null,
  map_x double precision not null default 50,
  map_y double precision not null default 50,
  status text not null default 'active',
  reported_by uuid references public.users (id) on delete set null,
  reported_at timestamptz,
  resolved_at timestamptz,
  created_at timestamptz not null default now()
);

alter table public.water_stations
  add column if not exists name text,
  add column if not exists zone_id uuid references public.zones (id) on delete set null,
  add column if not exists map_x double precision not null default 50,
  add column if not exists map_y double precision not null default 50,
  add column if not exists status text not null default 'active',
  add column if not exists reported_by uuid references public.users (id) on delete set null,
  add column if not exists reported_at timestamptz,
  add column if not exists resolved_at timestamptz,
  add column if not exists created_at timestamptz not null default now();

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.water_stations'::regclass and conname = 'water_stations_status_check'
  ) then
    alter table public.water_stations
      add constraint water_stations_status_check
      check (status in ('active', 'reported_empty', 'dispatched', 'resolved'));
  end if;
end
$$;

alter table public.water_stations enable row level security;

do $$
begin
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'water_stations' and policyname = 'water_stations_select_all') then
    create policy "water_stations_select_all" on public.water_stations for select to authenticated using (true);
  end if;
  -- Only admin creates/removes stations (krokiye yerleştirme); staff or admin
  -- can update a station's status (report empty / dispatch / resolve).
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'water_stations' and policyname = 'water_stations_admin_all') then
    create policy "water_stations_admin_all" on public.water_stations for all to authenticated
      using (public.is_admin()) with check (public.is_admin());
  end if;
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'water_stations' and policyname = 'water_stations_staff_update') then
    create policy "water_stations_staff_update" on public.water_stations for update to authenticated
      using (public.is_admin() or public.is_staff())
      with check (public.is_admin() or public.is_staff());
  end if;
end
$$;

commit;
