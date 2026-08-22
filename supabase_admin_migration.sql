-- TakeOff Companion — mevcut Supabase projesine admin paneli yetkilerini ekler.
-- Supabase Dashboard > SQL Editor içinde bir kez çalıştırın.

begin;

alter table public.users enable row level security;
alter table public.profiles enable row level security;
alter table public.sessions enable row level security;
alter table public.meeting_requests enable row level security;
alter table public.badges enable row level security;
alter table public.zones enable row level security;
alter table public.stands enable row level security;
alter table public.checkins enable row level security;
alter table public.location_pings enable row level security;

-- Eski politika tüm kullanıcıların e-posta/admin bilgisini görmesine ve kendi
-- is_admin değerini değiştirmesine izin veriyordu.
drop policy if exists "users_select_all" on public.users;
drop policy if exists "users_update_self" on public.users;
drop policy if exists "users_select_self_or_admin" on public.users;
create policy "users_select_self_or_admin" on public.users
  for select to authenticated
  using (auth.uid() = id or public.is_admin());

-- Dashboard toplamlarının yalnızca admin tarafından okunabilmesi.
drop policy if exists "meetings_admin_select" on public.meeting_requests;
create policy "meetings_admin_select" on public.meeting_requests
  for select to authenticated
  using (public.is_admin());

drop policy if exists "checkins_admin_select" on public.checkins;
create policy "checkins_admin_select" on public.checkins
  for select to authenticated
  using (public.is_admin());

commit;

-- Bir kullanıcıyı admin yapmak için service role/Dashboard SQL Editor üzerinden:
-- update public.users set is_admin = true where email = 'admin@example.com';
