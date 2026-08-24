-- TakeOff entrepreneur core flow (additive migration).
-- Run manually in Supabase Dashboard > SQL Editor after the base schema.
-- Safe to re-run: application rows are not deleted or rewritten.

begin;

-- Keep this migration compatible with projects where the admin migration has
-- not yet been applied. Existing profile values are preserved.
alter table public.profiles
  add column if not exists title text,
  add column if not exists company text,
  add column if not exists status text not null default 'active';

-- Base profiles_update_self must not let a participant reactivate a profile
-- disabled by an administrator. Reuse the shared function/trigger names so
-- admin, investor, and entrepreneur migrations remain apply-order compatible.
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

-- Existing incomplete founder profiles are left untouched during deployment,
-- while every new or updated founder profile must provide the professional
-- identity used by discovery cards.
do $$
begin
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
      and conname = 'profiles_entrepreneur_identity_required'
  ) then
    alter table public.profiles
      add constraint profiles_entrepreneur_identity_required
      check (
        role <> 'girisimci'
        or status = 'passive'
        or (
          nullif(btrim(title), '') is not null
          and nullif(btrim(company), '') is not null
        )
      )
      not valid;
  end if;
end
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

-- A participant may only send a request as themselves, to another active
-- participant. Restrictive policy prevents older permissive policies from
-- bypassing this gate.
drop policy if exists "meetings_safe_insert_gate_v1" on public.meeting_requests;
create policy "meetings_safe_insert_gate_v1" on public.meeting_requests
  as restrictive for insert to authenticated
  with check (
    public.is_admin()
    or (
      auth.uid() = from_user_id
      and from_user_id <> to_user_id
      and public.is_active_user()
      and exists (
        select 1 from public.profiles target_profile
        where target_profile.user_id = to_user_id
          and target_profile.status = 'active'
      )
    )
  );

-- Active-account enforcement is needed for read and update as well. Keeping
-- it restrictive closes OR-policy bypasses from the base ownership policies.
drop policy if exists "meetings_active_account_gate_v2" on public.meeting_requests;
create policy "meetings_active_account_gate_v2" on public.meeting_requests
  as restrictive for all to authenticated
  using (public.is_admin() or public.is_active_user())
  with check (public.is_admin() or public.is_active_user());

-- Existing participant UPDATE policy is broad. The trigger keeps request
-- identity/time immutable and allows only the recipient to answer a pending
-- request. Admin and service-role maintenance remain available.
create or replace function public.protect_meeting_request_update()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  if auth.uid() is null or auth.role() = 'service_role' or public.is_admin() then
    return new;
  end if;

  if new.id is distinct from old.id
    or new.from_user_id is distinct from old.from_user_id
    or new.to_user_id is distinct from old.to_user_id
    or new.proposed_time is distinct from old.proposed_time
    or new.created_at is distinct from old.created_at then
    raise exception 'Meeting request identity and proposed time cannot be changed.';
  end if;

  if auth.uid() <> old.to_user_id
    or old.status <> 'pending'
    or new.status not in ('accepted', 'rejected') then
    raise exception 'Only the recipient can answer a pending meeting request.';
  end if;

  return new;
end;
$$;

do $$
begin
  if not exists (
    select 1 from pg_trigger
    where tgname = 'protect_meeting_request_update'
      and tgrelid = 'public.meeting_requests'::regclass
      and not tgisinternal
  ) then
    create trigger protect_meeting_request_update
      before update on public.meeting_requests
      for each row execute function public.protect_meeting_request_update();
  end if;
end
$$;

-- Notes are deliberately separated from meeting_requests: each participant
-- owns a private note, and the other participant (including admins) cannot
-- read it through the client API.
create table if not exists public.meeting_notes (
  id uuid primary key default gen_random_uuid(),
  meeting_request_id uuid not null references public.meeting_requests (id) on delete cascade,
  owner_user_id uuid not null references public.users (id) on delete cascade,
  note text not null check (char_length(btrim(note)) between 1 and 2000),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (meeting_request_id, owner_user_id)
);

alter table public.meeting_notes enable row level security;
revoke all on table public.meeting_notes from anon;
revoke all on table public.meeting_notes from authenticated;
grant select, insert, update, delete on table public.meeting_notes to authenticated;

create or replace function public.can_manage_accepted_meeting_note(target_meeting_id uuid)
returns boolean
language sql
security definer set search_path = public
stable
as $$
  select public.is_active_user() and exists (
    select 1 from public.meeting_requests request
    where request.id = target_meeting_id
      and request.status = 'accepted'
      and auth.uid() in (request.from_user_id, request.to_user_id)
  );
$$;

create or replace function public.protect_meeting_note_identity()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  if new.id is distinct from old.id
    or new.meeting_request_id is distinct from old.meeting_request_id
    or new.owner_user_id is distinct from old.owner_user_id
    or new.created_at is distinct from old.created_at then
    raise exception 'Meeting note ownership cannot be changed.';
  end if;
  new.updated_at = now();
  return new;
end;
$$;

do $$
begin
  if not exists (
    select 1 from pg_trigger
    where tgname = 'protect_meeting_note_identity'
      and tgrelid = 'public.meeting_notes'::regclass
      and not tgisinternal
  ) then
    create trigger protect_meeting_note_identity
      before update on public.meeting_notes
      for each row execute function public.protect_meeting_note_identity();
  end if;
end
$$;

drop policy if exists "meeting_notes_select_own_v1" on public.meeting_notes;
create policy "meeting_notes_select_own_v1" on public.meeting_notes
  for select to authenticated
  using (
    owner_user_id = auth.uid()
    and public.can_manage_accepted_meeting_note(meeting_request_id)
  );

drop policy if exists "meeting_notes_insert_own_v1" on public.meeting_notes;
create policy "meeting_notes_insert_own_v1" on public.meeting_notes
  for insert to authenticated
  with check (
    owner_user_id = auth.uid()
    and public.can_manage_accepted_meeting_note(meeting_request_id)
  );

drop policy if exists "meeting_notes_update_own_v1" on public.meeting_notes;
create policy "meeting_notes_update_own_v1" on public.meeting_notes
  for update to authenticated
  using (
    owner_user_id = auth.uid()
    and public.can_manage_accepted_meeting_note(meeting_request_id)
  )
  with check (
    owner_user_id = auth.uid()
    and public.can_manage_accepted_meeting_note(meeting_request_id)
  );

drop policy if exists "meeting_notes_delete_own_v1" on public.meeting_notes;
create policy "meeting_notes_delete_own_v1" on public.meeting_notes
  for delete to authenticated
  using (
    owner_user_id = auth.uid()
    and public.can_manage_accepted_meeting_note(meeting_request_id)
  );

-- Restrictive gates keep privacy intact if another migration later adds a
-- permissive policy to this table.
drop policy if exists "meeting_notes_select_private_gate_v1" on public.meeting_notes;
create policy "meeting_notes_select_private_gate_v1" on public.meeting_notes
  as restrictive for select to authenticated
  using (
    owner_user_id = auth.uid()
    and public.can_manage_accepted_meeting_note(meeting_request_id)
  );

drop policy if exists "meeting_notes_insert_private_gate_v1" on public.meeting_notes;
create policy "meeting_notes_insert_private_gate_v1" on public.meeting_notes
  as restrictive for insert to authenticated
  with check (
    owner_user_id = auth.uid()
    and public.can_manage_accepted_meeting_note(meeting_request_id)
  );

drop policy if exists "meeting_notes_update_private_gate_v1" on public.meeting_notes;
create policy "meeting_notes_update_private_gate_v1" on public.meeting_notes
  as restrictive for update to authenticated
  using (
    owner_user_id = auth.uid()
    and public.can_manage_accepted_meeting_note(meeting_request_id)
  )
  with check (
    owner_user_id = auth.uid()
    and public.can_manage_accepted_meeting_note(meeting_request_id)
  );

drop policy if exists "meeting_notes_delete_private_gate_v1" on public.meeting_notes;
create policy "meeting_notes_delete_private_gate_v1" on public.meeting_notes
  as restrictive for delete to authenticated
  using (
    owner_user_id = auth.uid()
    and public.can_manage_accepted_meeting_note(meeting_request_id)
  );

-- Session bookmarks are account-scoped personal agenda rows. They are kept
-- private from other participants; availability functions only expose whether
-- a candidate slot is free, never which session caused a conflict.
create table if not exists public.session_bookmarks (
  user_id uuid not null references public.users (id) on delete cascade,
  session_id uuid not null references public.sessions (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, session_id)
);

alter table public.session_bookmarks enable row level security;
revoke all on table public.session_bookmarks from anon;
revoke all on table public.session_bookmarks from authenticated;
grant select, insert, delete on table public.session_bookmarks to authenticated;

drop policy if exists "session_bookmarks_select_own_v1" on public.session_bookmarks;
create policy "session_bookmarks_select_own_v1" on public.session_bookmarks
  for select to authenticated
  using (user_id = auth.uid() and public.is_active_user());

drop policy if exists "session_bookmarks_insert_own_v1" on public.session_bookmarks;
create policy "session_bookmarks_insert_own_v1" on public.session_bookmarks
  for insert to authenticated
  with check (
    user_id = auth.uid()
    and public.is_active_user()
    and exists (select 1 from public.sessions visible_session where visible_session.id = session_id)
  );

drop policy if exists "session_bookmarks_delete_own_v1" on public.session_bookmarks;
create policy "session_bookmarks_delete_own_v1" on public.session_bookmarks
  for delete to authenticated
  using (user_id = auth.uid() and public.is_active_user());

-- Restrictive gates keep ownership and active-account rules intact if another
-- migration later adds a broad permissive policy.
drop policy if exists "session_bookmarks_select_private_gate_v1" on public.session_bookmarks;
create policy "session_bookmarks_select_private_gate_v1" on public.session_bookmarks
  as restrictive for select to authenticated
  using (user_id = auth.uid() and public.is_active_user());

drop policy if exists "session_bookmarks_insert_private_gate_v1" on public.session_bookmarks;
create policy "session_bookmarks_insert_private_gate_v1" on public.session_bookmarks
  as restrictive for insert to authenticated
  with check (
    user_id = auth.uid()
    and public.is_active_user()
    and exists (select 1 from public.sessions visible_session where visible_session.id = session_id)
  );

drop policy if exists "session_bookmarks_delete_private_gate_v1" on public.session_bookmarks;
create policy "session_bookmarks_delete_private_gate_v1" on public.session_bookmarks
  as restrictive for delete to authenticated
  using (user_id = auth.uid() and public.is_active_user());

create index if not exists session_bookmarks_session_user_idx
  on public.session_bookmarks (session_id, user_id);

-- A participant cannot add a session that overlaps an active meeting or a
-- different saved session. The same advisory lock is used by meeting inserts,
-- so simultaneous actions cannot create an inconsistent personal agenda.
create or replace function public.protect_session_bookmark_insert_availability()
returns trigger
language plpgsql
security invoker set search_path = public
as $$
declare
  bookmarked_start timestamptz;
  bookmarked_end timestamptz;
begin
  if auth.uid() is null or auth.role() = 'service_role' then
    return new;
  end if;

  if auth.uid() <> new.user_id or not public.is_active_user() then
    raise exception 'A participant can only manage their own active agenda.';
  end if;

  perform pg_advisory_xact_lock(hashtextextended('session:' || new.session_id::text, 0));
  perform pg_advisory_xact_lock(hashtextextended(new.user_id::text, 0));

  select session.start_time, session.end_time
    into bookmarked_start, bookmarked_end
  from public.sessions session
  where session.id = new.session_id;

  if bookmarked_start is null or bookmarked_end is null then
    raise exception 'The selected session is unavailable.';
  end if;

  if exists (
    select 1
    from public.meeting_requests request
    where request.status in ('pending', 'accepted')
      and new.user_id in (request.from_user_id, request.to_user_id)
      and request.proposed_time is not null
      and request.proposed_time < bookmarked_end
      and request.proposed_time + interval '30 minutes' > bookmarked_start
  ) then
    raise exception 'This session overlaps one of your meetings.';
  end if;

  if exists (
    select 1
    from public.session_bookmarks existing_bookmark
    join public.sessions existing_session on existing_session.id = existing_bookmark.session_id
    where existing_bookmark.user_id = new.user_id
      and existing_bookmark.session_id <> new.session_id
      and existing_session.start_time < bookmarked_end
      and existing_session.end_time > bookmarked_start
  ) then
    raise exception 'This session overlaps another session in your agenda.';
  end if;

  return new;
end;
$$;

revoke all on function public.protect_session_bookmark_insert_availability() from public, anon, authenticated;

do $$
begin
  if not exists (
    select 1 from pg_trigger
    where tgname = 'protect_session_bookmark_insert_availability'
      and tgrelid = 'public.session_bookmarks'::regclass
      and not tgisinternal
  ) then
    create trigger protect_session_bookmark_insert_availability
      before insert on public.session_bookmarks
      for each row execute function public.protect_session_bookmark_insert_availability();
  end if;
end
$$;

-- Admin program edits use the same session/user lock order. A reschedule is
-- rejected when it would silently create a conflict in any participant's
-- existing agenda; no bookmark or meeting row is rewritten or removed.
create or replace function public.protect_bookmarked_session_schedule_update()
returns trigger
language plpgsql
security definer set search_path = public
as $$
declare
  affected_user record;
begin
  if new.start_time is not distinct from old.start_time
    and new.end_time is not distinct from old.end_time then
    return new;
  end if;

  if new.end_time <= new.start_time then
    raise exception 'Session end time must be after its start time.';
  end if;

  perform pg_advisory_xact_lock(hashtextextended('session:' || new.id::text, 0));

  for affected_user in
    select distinct bookmark.user_id
    from public.session_bookmarks bookmark
    where bookmark.session_id = new.id
    order by bookmark.user_id
  loop
    perform pg_advisory_xact_lock(hashtextextended(affected_user.user_id::text, 0));
  end loop;

  if exists (
    select 1
    from public.session_bookmarks bookmark
    join public.meeting_requests request
      on bookmark.user_id in (request.from_user_id, request.to_user_id)
    where bookmark.session_id = new.id
      and request.status in ('pending', 'accepted')
      and request.proposed_time is not null
      and request.proposed_time < new.end_time
      and request.proposed_time + interval '30 minutes' > new.start_time
  ) then
    raise exception 'This schedule change conflicts with a participant meeting.';
  end if;

  if exists (
    select 1
    from public.session_bookmarks current_bookmark
    join public.session_bookmarks other_bookmark
      on other_bookmark.user_id = current_bookmark.user_id
      and other_bookmark.session_id <> current_bookmark.session_id
    join public.sessions other_session on other_session.id = other_bookmark.session_id
    where current_bookmark.session_id = new.id
      and other_session.start_time < new.end_time
      and other_session.end_time > new.start_time
  ) then
    raise exception 'This schedule change conflicts with another saved session.';
  end if;

  return new;
end;
$$;

revoke all on function public.protect_bookmarked_session_schedule_update() from public, anon, authenticated;

do $$
begin
  if not exists (
    select 1 from pg_trigger
    where tgname = 'protect_bookmarked_session_schedule_update'
      and tgrelid = 'public.sessions'::regclass
      and not tgisinternal
  ) then
    create trigger protect_bookmarked_session_schedule_update
      before update of start_time, end_time on public.sessions
      for each row execute function public.protect_bookmarked_session_schedule_update();
  end if;
end
$$;

-- Availability is intentionally exposed as a list of free candidate slots,
-- not as the target participant's private meeting rows. A slot is free only
-- when neither participant has a pending or accepted 30-minute meeting.
create index if not exists meeting_requests_from_availability_idx
  on public.meeting_requests (from_user_id, proposed_time)
  where status in ('pending', 'accepted') and proposed_time is not null;

create index if not exists meeting_requests_to_availability_idx
  on public.meeting_requests (to_user_id, proposed_time)
  where status in ('pending', 'accepted') and proposed_time is not null;

create or replace function public.is_allowed_event_meeting_slot(candidate_slot timestamptz)
returns boolean
language sql
set search_path = pg_catalog
stable
as $$
  select exists (
    select 1
    from unnest(array[24, 25, 26, 27]) as event_day(day_number)
    cross join (
      values (9, 30), (11, 0), (14, 0), (15, 30), (16, 45), (17, 30)
    ) as event_time(slot_hour, slot_minute)
    where candidate_slot = make_timestamptz(
      2026,
      10,
      event_day.day_number,
      event_time.slot_hour,
      event_time.slot_minute,
      0,
      'Europe/Istanbul'
    )
  );
$$;

revoke all on function public.is_allowed_event_meeting_slot(timestamptz) from public, anon, authenticated;

create or replace function public.get_meeting_available_slots(
  target_user_id uuid,
  candidate_slots timestamptz[]
)
returns table (slot timestamptz)
language plpgsql
security definer set search_path = public
stable
as $$
declare
  requesting_user_id uuid := auth.uid();
  candidate_count integer := coalesce(cardinality(candidate_slots), 0);
begin
  if requesting_user_id is null then
    raise exception 'Authentication is required.';
  end if;

  if target_user_id is null or target_user_id = requesting_user_id then
    raise exception 'A different meeting participant is required.';
  end if;

  if candidate_count < 1 or candidate_count > 64 then
    raise exception 'Between 1 and 64 candidate slots are required.';
  end if;

  if exists (
    select 1
    from unnest(candidate_slots) as candidate(slot)
    where not public.is_allowed_event_meeting_slot(candidate.slot)
  ) then
    raise exception 'Only configured event meeting slots can be queried.';
  end if;

  if not public.is_active_user() then
    raise exception 'Only active participants can request availability.';
  end if;

  if not exists (
    select 1 from public.profiles target_profile
    where target_profile.user_id = target_user_id
      and target_profile.status = 'active'
  ) then
    raise exception 'The selected participant is unavailable.';
  end if;

  return query
  select proposed.slot
  from unnest(candidate_slots) as proposed(slot)
  where public.is_allowed_event_meeting_slot(proposed.slot)
    and proposed.slot >= now()
    and not exists (
      select 1
      from public.meeting_requests request
      where request.status in ('pending', 'accepted')
        and request.proposed_time is not null
        and (
          requesting_user_id in (request.from_user_id, request.to_user_id)
          or target_user_id in (request.from_user_id, request.to_user_id)
        )
        and request.proposed_time < proposed.slot + interval '30 minutes'
        and request.proposed_time + interval '30 minutes' > proposed.slot
    )
    and not exists (
      select 1
      from public.session_bookmarks bookmark
      join public.sessions session on session.id = bookmark.session_id
      where bookmark.user_id in (requesting_user_id, target_user_id)
        and session.start_time < proposed.slot + interval '30 minutes'
        and session.end_time > proposed.slot
    )
  order by proposed.slot;
end;
$$;

revoke all on function public.get_meeting_available_slots(uuid, timestamptz[]) from public, anon;
grant execute on function public.get_meeting_available_slots(uuid, timestamptz[]) to authenticated;

-- The availability query is advisory UI state, so validate it again while the
-- row is inserted. Per-user transaction locks prevent simultaneous requests
-- from booking the same participant into overlapping slots.
create or replace function public.protect_meeting_request_insert_availability()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  if auth.uid() is null or auth.role() = 'service_role' or public.is_admin() then
    return new;
  end if;

  if auth.uid() <> new.from_user_id then
    raise exception 'A participant can only send their own meeting request.';
  end if;

  if new.status <> 'pending' then
    raise exception 'Participant meeting requests must start as pending.';
  end if;

  if new.proposed_time is null or new.proposed_time < now() then
    raise exception 'A future meeting time is required.';
  end if;

  if not public.is_allowed_event_meeting_slot(new.proposed_time) then
    raise exception 'Only configured event meeting slots can be requested.';
  end if;

  if new.from_user_id = new.to_user_id then
    raise exception 'A meeting participant cannot request themselves.';
  end if;

  if new.from_user_id::text < new.to_user_id::text then
    perform pg_advisory_xact_lock(hashtextextended(new.from_user_id::text, 0));
    perform pg_advisory_xact_lock(hashtextextended(new.to_user_id::text, 0));
  else
    perform pg_advisory_xact_lock(hashtextextended(new.to_user_id::text, 0));
    perform pg_advisory_xact_lock(hashtextextended(new.from_user_id::text, 0));
  end if;

  if exists (
    select 1
    from public.meeting_requests request
    where request.from_user_id = new.from_user_id
      and request.to_user_id = new.to_user_id
      and request.status = 'pending'
      and request.proposed_time >= now()
  ) then
    raise exception 'There is already a pending request for this participant.';
  end if;

  if (
    select count(*)
    from public.meeting_requests request
    where request.from_user_id = new.from_user_id
      and request.status = 'pending'
      and request.proposed_time >= now()
  ) >= 10 then
    raise exception 'Resolve existing pending requests before sending another.';
  end if;

  if exists (
    select 1
    from public.meeting_requests request
    where request.status in ('pending', 'accepted')
      and request.proposed_time is not null
      and (
        new.from_user_id in (request.from_user_id, request.to_user_id)
        or new.to_user_id in (request.from_user_id, request.to_user_id)
      )
      and request.proposed_time < new.proposed_time + interval '30 minutes'
      and request.proposed_time + interval '30 minutes' > new.proposed_time
  ) then
    raise exception 'The selected meeting time is no longer available.';
  end if;

  if exists (
    select 1
    from public.session_bookmarks bookmark
    join public.sessions session on session.id = bookmark.session_id
    where bookmark.user_id in (new.from_user_id, new.to_user_id)
      and session.start_time < new.proposed_time + interval '30 minutes'
      and session.end_time > new.proposed_time
  ) then
    raise exception 'The selected meeting time conflicts with a saved session.';
  end if;

  return new;
end;
$$;

do $$
begin
  if not exists (
    select 1 from pg_trigger
    where tgname = 'protect_meeting_request_insert_availability'
      and tgrelid = 'public.meeting_requests'::regclass
      and not tgisinternal
  ) then
    create trigger protect_meeting_request_insert_availability
      before insert on public.meeting_requests
      for each row execute function public.protect_meeting_request_insert_availability();
  end if;
end
$$;

commit;
