-- TakeOff corporate / partner / sponsor core flow (additive migration).
-- Run manually in Supabase Dashboard > SQL Editor after the entrepreneur core migration.
-- Safe to re-run: application rows are not deleted, seeded, or rewritten.

begin;

-- These fields are intentionally public profile data. They contain only the
-- shareable need summary and matching labels shown to other participants.
-- Confidential context and follow-up notes belong in corporate_opportunities.
alter table public.profiles
  add column if not exists technology_need_summary text,
  add column if not exists technology_need_areas text[] not null default '{}';

-- Participant roles are account classes managed by onboarding/admin, not a
-- self-service profile preference. Reuse the shared protection contract so
-- running this latest flow migration also closes role self-promotion. The
-- trigger is UPDATE-only, therefore first-time onboarding INSERT still works.
create or replace function public.protect_admin_profile_fields()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  if auth.uid() is not null
    and auth.role() <> 'service_role'
    and not public.is_admin()
    and (
      new.status is distinct from old.status
      or new.role is distinct from old.role
    ) then
    raise exception 'Admin-managed profile fields cannot be changed by this user.';
  end if;
  return new;
end;
$$;

drop trigger if exists protect_admin_profile_fields on public.profiles;
create trigger protect_admin_profile_fields
  before update on public.profiles
  for each row execute function public.protect_admin_profile_fields();

comment on column public.profiles.technology_need_summary is
  'Public, shareable technology need summary used for corporate discovery matching.';
comment on column public.profiles.technology_need_areas is
  'Public matching labels for a corporate technology need; limited to five values.';

create or replace function public.are_valid_corporate_need_areas(need_areas text[])
returns boolean
language sql
immutable
set search_path = pg_catalog
as $$
  select
    coalesce(cardinality(need_areas), 0) <= 5
    and not exists (
      select 1
      from unnest(coalesce(need_areas, '{}'::text[])) as need_area(value)
      where value is null
        or char_length(btrim(value)) not between 1 and 80
    )
    and (
      select count(*) = count(distinct lower(btrim(value)))
      from unnest(coalesce(need_areas, '{}'::text[])) as need_area(value)
    );
$$;

revoke all on function public.are_valid_corporate_need_areas(text[]) from public, anon;
grant execute on function public.are_valid_corporate_need_areas(text[]) to authenticated, service_role;

-- Existing corporate profiles are not rejected or rewritten while this
-- migration is deployed. New and updated active corporate profiles must define
-- the need used by discovery. NOT VALID still enforces the checks for new rows
-- and future updates.
do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.profiles'::regclass
      and conname = 'profiles_technology_need_summary_max_length'
  ) then
    alter table public.profiles
      add constraint profiles_technology_need_summary_max_length
      check (
        technology_need_summary is null
        or char_length(technology_need_summary) <= 500
      )
      not valid;
  end if;

  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.profiles'::regclass
      and conname = 'profiles_technology_need_areas_max_count'
  ) then
    alter table public.profiles
      add constraint profiles_technology_need_areas_max_count
      check (coalesce(cardinality(technology_need_areas), 0) <= 5)
      not valid;
  end if;

  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.profiles'::regclass
      and conname = 'profiles_technology_need_areas_quality'
  ) then
    alter table public.profiles
      add constraint profiles_technology_need_areas_quality
      check (public.are_valid_corporate_need_areas(technology_need_areas))
      not valid;
  end if;

  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.profiles'::regclass
      and conname = 'profiles_corporate_identity_required'
  ) then
    alter table public.profiles
      add constraint profiles_corporate_identity_required
      check (
        role <> 'kurum'
        or status = 'passive'
        or (
          nullif(btrim(title), '') is not null
          and nullif(btrim(company), '') is not null
        )
      )
      not valid;
  end if;

  alter table public.profiles
    drop constraint if exists profiles_corporate_technology_need_required;
  alter table public.profiles
    add constraint profiles_corporate_technology_need_required
    check (
      role <> 'kurum'
      or status = 'passive'
      or (
        coalesce(
          char_length(btrim(technology_need_summary)) between 20 and 500,
          false
        )
        and coalesce(cardinality(technology_need_areas), 0) between 1 and 5
      )
    )
    not valid;
end
$$;

-- Each row is a private pipeline item owned by one active corporate account.
-- A target may be an active startup or another institution. The optional
-- meeting link must point to an accepted meeting between those exact parties.
create table if not exists public.corporate_opportunities (
  id uuid primary key default gen_random_uuid(),
  owner_user_id uuid not null,
  target_profile_id uuid not null,
  meeting_request_id uuid,
  title text not null,
  stage text not null default 'identified',
  next_action text,
  next_action_at timestamptz,
  private_notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint corporate_opportunities_owner_profile_fkey
    foreign key (owner_user_id) references public.profiles (user_id) on delete cascade,
  constraint corporate_opportunities_target_profile_fkey
    foreign key (target_profile_id) references public.profiles (id) on delete cascade,
  constraint corporate_opportunities_meeting_request_fkey
    foreign key (meeting_request_id) references public.meeting_requests (id) on delete restrict
);

alter table public.corporate_opportunities
  add column if not exists owner_user_id uuid,
  add column if not exists target_profile_id uuid,
  add column if not exists meeting_request_id uuid,
  add column if not exists title text,
  add column if not exists stage text not null default 'identified',
  add column if not exists next_action text,
  add column if not exists next_action_at timestamptz,
  add column if not exists private_notes text,
  add column if not exists created_at timestamptz not null default now(),
  add column if not exists updated_at timestamptz not null default now();

comment on table public.corporate_opportunities is
  'Private corporate opportunity pipeline. Client access is limited to the active corporate owner.';
comment on column public.corporate_opportunities.private_notes is
  'Confidential owner-only notes; never exposed through public profile matching.';

do $$
begin
  -- Replace only the automatic FK names used by an earlier local draft. This
  -- changes relationship rules, not application rows, and keeps upgrades as
  -- deterministic as clean installs.
  alter table public.corporate_opportunities
    drop constraint if exists corporate_opportunities_owner_user_id_fkey;
  alter table public.corporate_opportunities
    drop constraint if exists corporate_opportunities_target_profile_id_fkey;
  alter table public.corporate_opportunities
    drop constraint if exists corporate_opportunities_meeting_request_id_fkey;

  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.corporate_opportunities'::regclass
      and conname = 'corporate_opportunities_owner_profile_fkey'
  ) then
    alter table public.corporate_opportunities
      add constraint corporate_opportunities_owner_profile_fkey
      foreign key (owner_user_id) references public.profiles (user_id)
      on delete cascade not valid;
  end if;

  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.corporate_opportunities'::regclass
      and conname = 'corporate_opportunities_target_profile_fkey'
  ) then
    alter table public.corporate_opportunities
      add constraint corporate_opportunities_target_profile_fkey
      foreign key (target_profile_id) references public.profiles (id)
      on delete cascade not valid;
  end if;

  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.corporate_opportunities'::regclass
      and conname = 'corporate_opportunities_meeting_request_fkey'
  ) then
    alter table public.corporate_opportunities
      add constraint corporate_opportunities_meeting_request_fkey
      foreign key (meeting_request_id) references public.meeting_requests (id)
      on delete restrict not valid;
  end if;

  alter table public.corporate_opportunities
    drop constraint if exists corporate_opportunities_stage_allowed_values;
  alter table public.corporate_opportunities
    add constraint corporate_opportunities_stage_allowed_values
    check (
      stage is not null
      and stage in (
        'identified',
        'contacted',
        'meeting_scheduled',
        'meeting_completed',
        'evaluation',
        'pilot',
        'won',
        'closed'
      )
    )
    not valid;

  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.corporate_opportunities'::regclass
      and conname = 'corporate_opportunities_meeting_required_for_stage'
  ) then
    alter table public.corporate_opportunities
      add constraint corporate_opportunities_meeting_required_for_stage
      check (
        stage not in (
          'meeting_scheduled',
          'meeting_completed',
          'evaluation',
          'pilot',
          'won'
        )
        or meeting_request_id is not null
      )
      not valid;
  end if;

  alter table public.corporate_opportunities
    drop constraint if exists corporate_opportunities_title_length;
  alter table public.corporate_opportunities
    add constraint corporate_opportunities_title_length
    check (title is not null and char_length(btrim(title)) between 1 and 160)
    not valid;

  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.corporate_opportunities'::regclass
      and conname = 'corporate_opportunities_relationship_required'
  ) then
    alter table public.corporate_opportunities
      add constraint corporate_opportunities_relationship_required
      check (owner_user_id is not null and target_profile_id is not null)
      not valid;
  end if;

  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.corporate_opportunities'::regclass
      and conname = 'corporate_opportunities_next_action_length'
  ) then
    alter table public.corporate_opportunities
      add constraint corporate_opportunities_next_action_length
      check (next_action is null or char_length(next_action) <= 500)
      not valid;
  end if;

  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.corporate_opportunities'::regclass
      and conname = 'corporate_opportunities_private_notes_length'
  ) then
    alter table public.corporate_opportunities
      add constraint corporate_opportunities_private_notes_length
      check (private_notes is null or char_length(private_notes) <= 4000)
      not valid;
  end if;

  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.corporate_opportunities'::regclass
      and conname = 'corporate_opportunities_next_action_consistent'
  ) then
    alter table public.corporate_opportunities
      add constraint corporate_opportunities_next_action_consistent
      check (
        next_action_at is null
        or nullif(btrim(next_action), '') is not null
      )
      not valid;
  end if;
end
$$;

-- One current pipeline item per owner/target keeps retries idempotent and
-- avoids duplicate cards for the same business relationship. Never guess
-- which historical row to keep: an old draft with duplicates must be reviewed
-- manually before the security migration can continue.
do $$
begin
  if exists (
    select 1
    from public.corporate_opportunities
    where owner_user_id is not null and target_profile_id is not null
    group by owner_user_id, target_profile_id
    having count(*) > 1
  ) then
    raise exception 'Duplicate corporate opportunities require manual review before migration.'
      using hint = 'Keep or merge exactly one row per owner_user_id/target_profile_id pair, then rerun this migration.';
  end if;
end
$$;

alter table public.corporate_opportunities
  drop constraint if exists corporate_opportunities_owner_target_key;
drop index if exists public.corporate_opportunities_owner_target_key;
create unique index corporate_opportunities_owner_target_key
  on public.corporate_opportunities (owner_user_id, target_profile_id);

create index if not exists corporate_opportunities_owner_stage_idx
  on public.corporate_opportunities (owner_user_id, stage, updated_at desc);

alter table public.corporate_opportunities enable row level security;
revoke all on table public.corporate_opportunities from anon;
revoke all on table public.corporate_opportunities from authenticated;
grant select, insert, update on table public.corporate_opportunities to authenticated;

-- The trigger protects ownership and relationship integrity even if a broad
-- UPDATE policy is accidentally introduced later. Admin client sessions do not
-- receive a privacy bypass; service-role maintenance remains possible.
create or replace function public.protect_corporate_opportunity_write()
returns trigger
language plpgsql
security definer set search_path = public
as $$
declare
  target_user_id uuid;
  linked_meeting_time timestamptz;
  privileged_writer boolean := auth.uid() is null or auth.role() = 'service_role';
begin
  if not privileged_writer and auth.uid() <> new.owner_user_id then
    raise exception 'A corporate opportunity can only be managed by its owner.';
  end if;

  if not exists (
    select 1 from public.profiles owner_profile
    where owner_profile.user_id = new.owner_user_id
      and owner_profile.role = 'kurum'
      and (
        owner_profile.status = 'active'
        or (privileged_writer and tg_op = 'UPDATE')
      )
  ) then
    raise exception 'Only an active corporate account can manage opportunities.';
  end if;

  select target_profile.user_id
    into target_user_id
  from public.profiles target_profile
  where target_profile.id = new.target_profile_id
    and target_profile.role in ('girisimci', 'kurum')
    and (
      tg_op = 'UPDATE'
      or target_profile.status = 'active'
    );

  if target_user_id is null or target_user_id = new.owner_user_id then
    raise exception 'An opportunity requires a different startup or institution.';
  end if;

  if tg_op = 'UPDATE' and (
    new.id is distinct from old.id
    or new.owner_user_id is distinct from old.owner_user_id
    or new.target_profile_id is distinct from old.target_profile_id
    or new.created_at is distinct from old.created_at
  ) then
    raise exception 'Corporate opportunity ownership and target cannot be changed.';
  end if;

  if new.meeting_request_id is not null then
    select request.proposed_time
      into linked_meeting_time
    from public.meeting_requests request
    where request.id = new.meeting_request_id
      and request.status = 'accepted'
      and new.owner_user_id in (request.from_user_id, request.to_user_id)
      and target_user_id in (request.from_user_id, request.to_user_id);

    if linked_meeting_time is null then
      raise exception 'The linked meeting must be accepted, scheduled, and belong to both opportunity parties.';
    end if;
  end if;

  if new.stage in (
    'meeting_scheduled',
    'meeting_completed',
    'evaluation',
    'pilot',
    'won'
  ) and new.meeting_request_id is null then
    raise exception 'This opportunity stage requires an accepted meeting.';
  end if;

  if new.stage in (
    'meeting_completed',
    'evaluation',
    'pilot',
    'won'
  ) and linked_meeting_time > now() then
    raise exception 'A future meeting cannot be marked as completed or evaluated.';
  end if;

  -- "meeting_scheduled" represents an accepted meeting that is still ahead.
  -- A past accepted slot stays linked, but the owner must explicitly confirm
  -- completion (or keep the opportunity in an earlier stage).
  if new.stage = 'meeting_scheduled' and linked_meeting_time <= now() then
    raise exception 'A past meeting cannot remain in the scheduled stage.';
  end if;

  new.updated_at = now();
  return new;
end;
$$;

revoke all on function public.protect_corporate_opportunity_write() from public, anon, authenticated;

-- Recreate integrity triggers deterministically so a rerun also repairs an
-- older draft with the same trigger name but a different event/function.
drop trigger if exists protect_corporate_opportunity_write
  on public.corporate_opportunities;
create trigger protect_corporate_opportunity_write
  before insert or update on public.corporate_opportunities
  for each row execute function public.protect_corporate_opportunity_write();

-- Stage changes are append-only and private. Keeping a history makes the
-- "track the corporate opportunity" requirement auditable while allowing the
-- lightweight MVP UI to move a card backward when follow-up circumstances change.
create table if not exists public.corporate_opportunity_stage_history (
  id uuid primary key default gen_random_uuid(),
  opportunity_id uuid not null references public.corporate_opportunities (id) on delete cascade,
  owner_user_id uuid not null,
  from_stage text,
  to_stage text not null,
  changed_by_user_id uuid references public.users (id) on delete set null,
  changed_at timestamptz not null default now()
);

alter table public.corporate_opportunity_stage_history
  add column if not exists opportunity_id uuid references public.corporate_opportunities (id) on delete cascade,
  add column if not exists owner_user_id uuid,
  add column if not exists from_stage text,
  add column if not exists to_stage text,
  add column if not exists changed_by_user_id uuid references public.users (id) on delete set null,
  add column if not exists changed_at timestamptz not null default now();

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.corporate_opportunity_stage_history'::regclass
      and conname = 'corporate_opportunity_history_identity_required'
  ) then
    alter table public.corporate_opportunity_stage_history
      add constraint corporate_opportunity_history_identity_required
      check (
        opportunity_id is not null
        and owner_user_id is not null
        and to_stage is not null
      )
      not valid;
  end if;

  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.corporate_opportunity_stage_history'::regclass
      and conname = 'corporate_opportunity_history_stage_values'
  ) then
    alter table public.corporate_opportunity_stage_history
      add constraint corporate_opportunity_history_stage_values
      check (
        (from_stage is null or from_stage in (
          'identified', 'contacted', 'meeting_scheduled', 'meeting_completed',
          'evaluation', 'pilot', 'won', 'closed'
        ))
        and to_stage in (
          'identified', 'contacted', 'meeting_scheduled', 'meeting_completed',
          'evaluation', 'pilot', 'won', 'closed'
        )
      )
      not valid;
  end if;
end
$$;

create index if not exists corporate_opportunity_history_owner_time_idx
  on public.corporate_opportunity_stage_history (owner_user_id, changed_at desc);

alter table public.corporate_opportunity_stage_history enable row level security;
revoke all on table public.corporate_opportunity_stage_history from anon;
revoke all on table public.corporate_opportunity_stage_history from authenticated;
grant select on table public.corporate_opportunity_stage_history to authenticated;

drop policy if exists "corporate_opportunity_history_select_own_v1"
  on public.corporate_opportunity_stage_history;
create policy "corporate_opportunity_history_select_own_v1"
  on public.corporate_opportunity_stage_history
  for select to authenticated
  using (
    owner_user_id = auth.uid()
    and exists (
      select 1 from public.profiles owner_profile
      where owner_profile.user_id = auth.uid()
        and owner_profile.role = 'kurum'
        and owner_profile.status = 'active'
    )
  );

drop policy if exists "corporate_opportunity_history_select_private_gate_v1"
  on public.corporate_opportunity_stage_history;
create policy "corporate_opportunity_history_select_private_gate_v1"
  on public.corporate_opportunity_stage_history
  as restrictive for select to authenticated
  using (owner_user_id = auth.uid());

create or replace function public.record_corporate_opportunity_stage_change()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  if tg_op = 'INSERT' or new.stage is distinct from old.stage then
    insert into public.corporate_opportunity_stage_history (
      opportunity_id,
      owner_user_id,
      from_stage,
      to_stage,
      changed_by_user_id
    ) values (
      new.id,
      new.owner_user_id,
      case when tg_op = 'UPDATE' then old.stage else null end,
      new.stage,
      auth.uid()
    );
  end if;
  return new;
end;
$$;

revoke all on function public.record_corporate_opportunity_stage_change()
  from public, anon, authenticated;

drop trigger if exists record_corporate_opportunity_stage_change
  on public.corporate_opportunities;
create trigger record_corporate_opportunity_stage_change
  after insert or update of stage on public.corporate_opportunities
  for each row execute function public.record_corporate_opportunity_stage_change();

-- Once an accepted meeting is attached to an opportunity, changing its status
-- or deleting it would make the pipeline record internally inconsistent.
-- Maintenance can first unlink or close the opportunity explicitly.
create or replace function public.protect_corporate_opportunity_meeting_link()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  if not exists (
    select 1
    from public.corporate_opportunities opportunity
    where opportunity.meeting_request_id = old.id
  ) then
    if tg_op = 'DELETE' then
      return old;
    end if;
    return new;
  end if;

  if tg_op = 'DELETE' then
    raise exception 'A meeting linked to a corporate opportunity cannot be changed or deleted.';
  end if;

  if new.status is distinct from old.status
    or new.from_user_id is distinct from old.from_user_id
    or new.to_user_id is distinct from old.to_user_id
    or new.proposed_time is distinct from old.proposed_time then
    raise exception 'A meeting linked to a corporate opportunity cannot be changed or deleted.';
  end if;

  return new;
end;
$$;

revoke all on function public.protect_corporate_opportunity_meeting_link() from public, anon, authenticated;

drop trigger if exists protect_corporate_opportunity_meeting_link
  on public.meeting_requests;
create trigger protect_corporate_opportunity_meeting_link
  before update of status, from_user_id, to_user_id, proposed_time or delete
  on public.meeting_requests
  for each row execute function public.protect_corporate_opportunity_meeting_link();

-- The table is new, so owner policies are the only permissive access path.
-- Restrictive gates additionally protect confidentiality if another migration
-- later adds a broader permissive policy.
drop policy if exists "corporate_opportunities_select_own_v1" on public.corporate_opportunities;
create policy "corporate_opportunities_select_own_v1" on public.corporate_opportunities
  for select to authenticated
  using (
    owner_user_id = auth.uid()
    and exists (
      select 1 from public.profiles owner_profile
      where owner_profile.user_id = auth.uid()
        and owner_profile.role = 'kurum'
        and owner_profile.status = 'active'
    )
  );

drop policy if exists "corporate_opportunities_insert_own_v1" on public.corporate_opportunities;
create policy "corporate_opportunities_insert_own_v1" on public.corporate_opportunities
  for insert to authenticated
  with check (
    owner_user_id = auth.uid()
    and exists (
      select 1 from public.profiles owner_profile
      where owner_profile.user_id = auth.uid()
        and owner_profile.role = 'kurum'
        and owner_profile.status = 'active'
    )
  );

drop policy if exists "corporate_opportunities_update_own_v1" on public.corporate_opportunities;
create policy "corporate_opportunities_update_own_v1" on public.corporate_opportunities
  for update to authenticated
  using (
    owner_user_id = auth.uid()
    and exists (
      select 1 from public.profiles owner_profile
      where owner_profile.user_id = auth.uid()
        and owner_profile.role = 'kurum'
        and owner_profile.status = 'active'
    )
  )
  with check (owner_user_id = auth.uid());

drop policy if exists "corporate_opportunities_delete_own_v1" on public.corporate_opportunities;
-- Closing is the auditable end state. Authenticated clients intentionally do
-- not receive DELETE privilege/policies, so stage history cannot be erased by
-- deleting its parent through the API. Service-role maintenance remains able
-- to perform exceptional cleanup.

drop policy if exists "corporate_opportunities_select_private_gate_v1" on public.corporate_opportunities;
create policy "corporate_opportunities_select_private_gate_v1" on public.corporate_opportunities
  as restrictive for select to authenticated
  using (owner_user_id = auth.uid());

drop policy if exists "corporate_opportunities_insert_private_gate_v1" on public.corporate_opportunities;
create policy "corporate_opportunities_insert_private_gate_v1" on public.corporate_opportunities
  as restrictive for insert to authenticated
  with check (owner_user_id = auth.uid());

drop policy if exists "corporate_opportunities_update_private_gate_v1" on public.corporate_opportunities;
create policy "corporate_opportunities_update_private_gate_v1" on public.corporate_opportunities
  as restrictive for update to authenticated
  using (owner_user_id = auth.uid())
  with check (owner_user_id = auth.uid());

drop policy if exists "corporate_opportunities_delete_private_gate_v1" on public.corporate_opportunities;

commit;
