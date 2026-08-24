-- TakeOff admin workspace database expansion.
-- Run manually in Supabase Dashboard > SQL Editor.
-- This migration is idempotent and does not delete, drop or seed application data.

begin;

-- Existing participant-facing tables are extended in place so current app queries keep working.
alter table public.profiles
  add column if not exists title text,
  add column if not exists position text,
  add column if not exists company text,
  add column if not exists status text not null default 'active',
  add column if not exists updated_at timestamptz not null default now();

-- Private attendee operations data must never inherit profiles_select_all visibility.
create table if not exists public.admin_attendee_details (
  profile_id uuid primary key references public.profiles (id) on delete cascade,
  phone text,
  notes text,
  last_active_at timestamptz,
  current_zone text,
  badge_scanned boolean not null default false,
  updated_at timestamptz not null default now()
);

alter table public.admin_attendee_details
  add column if not exists phone text,
  add column if not exists notes text,
  add column if not exists last_active_at timestamptz,
  add column if not exists current_zone text,
  add column if not exists badge_scanned boolean not null default false,
  add column if not exists updated_at timestamptz not null default now();

alter table public.zones
  add column if not exists code text,
  add column if not exists capacity integer not null default 0,
  add column if not exists active_attendees integer not null default 0,
  add column if not exists peak_attendees integer not null default 0,
  add column if not exists avg_attendees integer not null default 0,
  add column if not exists description text,
  add column if not exists color text,
  add column if not exists updated_at timestamptz not null default now();

create table if not exists public.stages (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  type text not null default 'Other',
  zone_id uuid references public.zones (id) on delete set null,
  capacity integer not null default 0,
  current_occupancy integer not null default 0,
  map_x double precision not null default 50,
  map_y double precision not null default 50,
  status text not null default 'active',
  description text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.stages
  add column if not exists name text,
  add column if not exists type text not null default 'Other',
  add column if not exists zone_id uuid references public.zones (id) on delete set null,
  add column if not exists capacity integer not null default 0,
  add column if not exists current_occupancy integer not null default 0,
  add column if not exists map_x double precision not null default 50,
  add column if not exists map_y double precision not null default 50,
  add column if not exists status text not null default 'active',
  add column if not exists description text,
  add column if not exists created_at timestamptz not null default now(),
  add column if not exists updated_at timestamptz not null default now();

alter table public.sessions
  add column if not exists stage_id uuid references public.stages (id) on delete set null,
  add column if not exists category text not null default 'Panel',
  add column if not exists status text not null default 'published',
  add column if not exists delay_minutes integer not null default 0,
  add column if not exists capacity integer not null default 0,
  add column if not exists bookmarked_count integer not null default 0,
  add column if not exists checked_in_count integer not null default 0,
  add column if not exists speakers jsonb not null default '[]'::jsonb,
  add column if not exists tags text[] not null default '{}',
  add column if not exists cover_image text,
  add column if not exists created_at timestamptz not null default now(),
  add column if not exists updated_at timestamptz not null default now();

alter table public.stages
  add column if not exists current_session_id uuid references public.sessions (id) on delete set null;

alter table public.stands
  add column if not exists booth_no text,
  add column if not exists company_name text,
  add column if not exists category text,
  add column if not exists description text,
  add column if not exists logo_url text,
  add column if not exists sponsor_tier text,
  add column if not exists map_x double precision not null default 50,
  add column if not exists map_y double precision not null default 50,
  add column if not exists status text not null default 'active',
  add column if not exists contact_person text,
  add column if not exists contact_email text,
  add column if not exists qr_code_url text,
  add column if not exists total_visits integer not null default 0,
  add column if not exists created_at timestamptz not null default now(),
  add column if not exists updated_at timestamptz not null default now();

create table if not exists public.announcements (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  message text not null,
  target_audience text not null default 'Tüm Katılımcılar',
  target_zone text,
  target_session_id uuid references public.sessions (id) on delete set null,
  target_booth_id uuid references public.stands (id) on delete set null,
  cta_text text,
  cta_url text,
  sent_at timestamptz,
  scheduled_for timestamptz,
  status text not null default 'draft',
  recipient_count integer not null default 0,
  read_count integer not null default 0,
  click_count integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.announcements
  add column if not exists title text,
  add column if not exists message text,
  add column if not exists target_audience text not null default 'Tüm Katılımcılar',
  add column if not exists target_zone text,
  add column if not exists target_session_id uuid references public.sessions (id) on delete set null,
  add column if not exists target_booth_id uuid references public.stands (id) on delete set null,
  add column if not exists cta_text text,
  add column if not exists cta_url text,
  add column if not exists sent_at timestamptz,
  add column if not exists scheduled_for timestamptz,
  add column if not exists status text not null default 'draft',
  add column if not exists recipient_count integer not null default 0,
  add column if not exists read_count integer not null default 0,
  add column if not exists click_count integer not null default 0,
  add column if not exists created_at timestamptz not null default now(),
  add column if not exists updated_at timestamptz not null default now();

create table if not exists public.event_settings (
  id boolean primary key default true check (id),
  settings_key text not null default 'default' unique,
  event_name text not null default 'Take Off İstanbul',
  edition text,
  event_dates text not null default '',
  venue_name text not null default '',
  venue_address text,
  start_date date,
  end_date date,
  logo_url text,
  opening_time text not null default '09:00',
  closing_time text not null default '18:00',
  location_tracking_start text not null default '09:00',
  location_tracking_end text not null default '18:00',
  tracking_disclaimer text,
  default_language text not null default 'tr',
  timezone text not null default 'Europe/Istanbul',
  auto_notify_schedule_changes boolean not null default true,
  enable_anonymous_zone_tracking boolean not null default true,
  require_check_in_qr boolean not null default false,
  notification_triggers jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

alter table public.event_settings
  add column if not exists settings_key text not null default 'default',
  add column if not exists event_name text not null default 'Take Off İstanbul',
  add column if not exists edition text,
  add column if not exists event_dates text not null default '',
  add column if not exists venue_name text not null default '',
  add column if not exists venue_address text,
  add column if not exists start_date date,
  add column if not exists end_date date,
  add column if not exists logo_url text,
  add column if not exists opening_time text not null default '09:00',
  add column if not exists closing_time text not null default '18:00',
  add column if not exists location_tracking_start text not null default '09:00',
  add column if not exists location_tracking_end text not null default '18:00',
  add column if not exists tracking_disclaimer text,
  add column if not exists default_language text not null default 'tr',
  add column if not exists timezone text not null default 'Europe/Istanbul',
  add column if not exists auto_notify_schedule_changes boolean not null default true,
  add column if not exists enable_anonymous_zone_tracking boolean not null default true,
  add column if not exists require_check_in_qr boolean not null default false,
  add column if not exists notification_triggers jsonb not null default '{}'::jsonb,
  add column if not exists updated_at timestamptz not null default now();

create unique index if not exists event_settings_settings_key_key
  on public.event_settings (settings_key);

create table if not exists public.admin_logs (
  id uuid primary key default gen_random_uuid(),
  admin_user_id uuid references public.users (id) on delete set null,
  action text not null,
  target text not null,
  type text not null default 'system',
  created_at timestamptz not null default now()
);

alter table public.admin_logs
  add column if not exists admin_user_id uuid references public.users (id) on delete set null,
  add column if not exists action text,
  add column if not exists target text,
  add column if not exists type text not null default 'system',
  add column if not exists created_at timestamptz not null default now();

alter table public.profiles enable row level security;
alter table public.sessions enable row level security;
alter table public.zones enable row level security;
alter table public.stands enable row level security;
alter table public.stages enable row level security;
alter table public.announcements enable row level security;
alter table public.event_settings enable row level security;
alter table public.admin_logs enable row level security;
alter table public.admin_attendee_details enable row level security;

-- Even if an older project granted table-level UPDATE, clients cannot update users/is_admin.
revoke update on table public.users from anon, authenticated;

-- Existing self-profile UPDATE policies must not let participants change admin-managed fields.
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

create or replace function public.is_active_user()
returns boolean
language sql
security definer set search_path = public
stable
as $$
  select coalesce(
    (select status = 'active' from public.profiles where user_id = auth.uid()),
    false
  );
$$;

do $$
begin
  if not exists (select 1 from pg_trigger where tgname = 'protect_admin_profile_fields') then
    create trigger protect_admin_profile_fields
      before update on public.profiles
      for each row execute function public.protect_admin_profile_fields();
  end if;
end
$$;

-- Replace the old unconditional session reader. This is a policy-only change; no data is removed.
drop policy if exists "sessions_select_all" on public.sessions;
drop policy if exists "sessions_participant_read" on public.sessions;
create policy "sessions_participant_read" on public.sessions
  for select to authenticated
  using (
    public.is_admin() or
    (public.is_active_user() and status in ('published', 'live', 'delayed', 'completed'))
  );

-- Policies are created only when absent; existing participant ownership policies remain intact.
do $$
begin
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'profiles' and policyname = 'profiles_admin_update') then
    create policy "profiles_admin_update" on public.profiles for update to authenticated using (public.is_admin()) with check (public.is_admin());
  end if;
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'profiles' and policyname = 'profiles_admin_delete') then
    create policy "profiles_admin_delete" on public.profiles for delete to authenticated using (public.is_admin());
  end if;
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'profiles' and policyname = 'profiles_active_account_gate') then
    create policy "profiles_active_account_gate" on public.profiles as restrictive for select to authenticated
      using (public.is_admin() or public.is_active_user() or auth.uid() = user_id);
  end if;
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'profiles' and policyname = 'profiles_active_update_gate') then
    create policy "profiles_active_update_gate" on public.profiles as restrictive for update to authenticated
      using (public.is_admin() or public.is_active_user())
      with check (public.is_admin() or public.is_active_user());
  end if;
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'sessions' and policyname = 'sessions_admin_workspace_write') then
    create policy "sessions_admin_workspace_write" on public.sessions for all to authenticated using (public.is_admin()) with check (public.is_admin());
  end if;
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'sessions' and policyname = 'sessions_visibility_gate') then
    create policy "sessions_visibility_gate" on public.sessions as restrictive for select to authenticated
      using (public.is_admin() or (public.is_active_user() and status in ('published', 'live', 'delayed', 'completed')));
  end if;
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'zones' and policyname = 'zones_admin_workspace_write') then
    create policy "zones_admin_workspace_write" on public.zones for all to authenticated using (public.is_admin()) with check (public.is_admin());
  end if;
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'stands' and policyname = 'stands_admin_workspace_write') then
    create policy "stands_admin_workspace_write" on public.stands for all to authenticated using (public.is_admin()) with check (public.is_admin());
  end if;
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'stages' and policyname = 'stages_authenticated_read') then
    create policy "stages_authenticated_read" on public.stages for select to authenticated using (true);
  end if;
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'stages' and policyname = 'stages_admin_write') then
    create policy "stages_admin_write" on public.stages for all to authenticated using (public.is_admin()) with check (public.is_admin());
  end if;
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'announcements' and policyname = 'announcements_read') then
    create policy "announcements_read" on public.announcements for select to authenticated using (public.is_admin());
  end if;
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'announcements' and policyname = 'announcements_admin_write') then
    create policy "announcements_admin_write" on public.announcements for all to authenticated using (public.is_admin()) with check (public.is_admin());
  end if;
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'announcements' and policyname = 'announcements_admin_visibility_gate') then
    create policy "announcements_admin_visibility_gate" on public.announcements as restrictive for select to authenticated using (public.is_admin());
  end if;
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'event_settings' and policyname = 'event_settings_authenticated_read') then
    create policy "event_settings_authenticated_read" on public.event_settings for select to authenticated using (true);
  end if;
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'event_settings' and policyname = 'event_settings_admin_write') then
    create policy "event_settings_admin_write" on public.event_settings for all to authenticated using (public.is_admin()) with check (public.is_admin());
  end if;
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'admin_logs' and policyname = 'admin_logs_admin_read') then
    create policy "admin_logs_admin_read" on public.admin_logs for select to authenticated using (public.is_admin());
  end if;
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'admin_logs' and policyname = 'admin_logs_admin_insert') then
    create policy "admin_logs_admin_insert" on public.admin_logs for insert to authenticated with check (public.is_admin() and admin_user_id = auth.uid());
  end if;
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'admin_attendee_details' and policyname = 'admin_attendee_details_admin_all') then
    create policy "admin_attendee_details_admin_all" on public.admin_attendee_details for all to authenticated
      using (public.is_admin()) with check (public.is_admin());
  end if;
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'badges' and policyname = 'badges_admin_select') then
    create policy "badges_admin_select" on public.badges for select to authenticated using (public.is_admin());
  end if;
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'location_pings' and policyname = 'pings_admin_select') then
    create policy "pings_admin_select" on public.location_pings for select to authenticated using (public.is_admin());
  end if;
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'meeting_requests' and policyname = 'meetings_active_account_gate') then
    create policy "meetings_active_account_gate" on public.meeting_requests as restrictive for all to authenticated
      using (public.is_admin() or public.is_active_user()) with check (public.is_admin() or public.is_active_user());
  end if;
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'zones' and policyname = 'zones_active_account_gate') then
    create policy "zones_active_account_gate" on public.zones as restrictive for select to authenticated
      using (public.is_admin() or public.is_active_user());
  end if;
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'stands' and policyname = 'stands_active_account_gate') then
    create policy "stands_active_account_gate" on public.stands as restrictive for select to authenticated
      using (public.is_admin() or public.is_active_user());
  end if;
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'stages' and policyname = 'stages_active_account_gate') then
    create policy "stages_active_account_gate" on public.stages as restrictive for select to authenticated
      using (public.is_admin() or public.is_active_user());
  end if;
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'event_settings' and policyname = 'event_settings_active_account_gate') then
    create policy "event_settings_active_account_gate" on public.event_settings as restrictive for select to authenticated
      using (public.is_admin() or public.is_active_user());
  end if;
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'badges' and policyname = 'badges_active_account_gate') then
    create policy "badges_active_account_gate" on public.badges as restrictive for select to authenticated
      using (public.is_admin() or public.is_active_user());
  end if;
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'checkins' and policyname = 'checkins_active_account_gate') then
    create policy "checkins_active_account_gate" on public.checkins as restrictive for all to authenticated
      using (public.is_admin() or public.is_active_user()) with check (public.is_admin() or public.is_active_user());
  end if;
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'location_pings' and policyname = 'pings_active_account_gate') then
    create policy "pings_active_account_gate" on public.location_pings as restrictive for all to authenticated
      using (public.is_admin() or public.is_active_user()) with check (public.is_admin() or public.is_active_user());
  end if;
end
$$;

commit;
