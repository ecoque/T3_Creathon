-- TakeOff Companion App — ilk veri modeli
-- Supabase Dashboard > SQL Editor içine yapıştırıp "Run" ile çalıştır.
--
-- NOT (integration branch birleştirmesi): Bu dosya, canlı veritabanının kurulduğu
-- "sıfırdan kurulum" temel şemasıdır ve içeriği kerimyedek/master ile aynı
-- tablolara sahiptir (sadece users/meetings/checkins RLS politikaları ozge ve
-- nisa1 branch'lerindeki güvenlik sıkılaştırmasıyla güncellendi, bkz. aşağıdaki
-- RLS bölümü). ozge ve nisa1'in eklediği YENİ tablo/kolonlar canlı DB zaten
-- kurulu olduğu için burada yeniden CREATE TABLE ile ifade edilmiyor; bunun
-- yerine repo kökündeki idempotent (add column if not exists / create table if
-- not exists) migration dosyalarıyla uygulanmalı, önerilen sıra:
--   1) supabase_admin_migration.sql
--   2) supabase_admin_workspace_migration.sql
--   3) supabase_floor_plan_migration.sql
--   4) supabase_floor_plan_walls_migration.sql
--   5) supabase_stand_grid_migration.sql
--   6) supabase_zone_geofence_migration.sql
--   7) supabase_location_pings_delete_migration.sql
--   8) supabase_investor_core_flow_migration.sql
--   9) supabase_entrepreneur_core_flow_migration.sql
--   10) supabase_corporate_core_flow_migration.sql
-- Tüm migrationlar idempotent'tir (if not exists / create or replace), bu yüzden
-- bu sıradan sapma veya birden fazla çalıştırma güvenlidir. Tam ALTER/CREATE
-- listesi için entegrasyon raporuna bakın.

-- 1) auth.users'a bağlı uygulama kullanıcı kaydı (is_admin bayrağı burada)
create table public.users (
  id uuid primary key references auth.users (id) on delete cascade,
  email text not null,
  is_admin boolean not null default false,
  created_at timestamptz not null default now()
);

-- Yeni bir auth kullanıcısı kayıt olduğunda otomatik public.users satırı oluştur
create function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.users (id, email)
  values (new.id, new.email);
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- is_admin kontrolünü RLS policy'lerinde döngüye girmeden kullanmak için
create function public.is_admin()
returns boolean
language sql
security definer set search_path = public
stable
as $$
  select coalesce((select is_admin from public.users where id = auth.uid()), false);
$$;

-- 2) Profil
create table public.profiles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users (id) on delete cascade,
  full_name text not null,
  photo_url text,
  linkedin_url text,
  role text not null check (role in ('girisimci', 'yatirimci', 'kurum', 'ziyaretci')),
  sector text,
  interests text[] not null default '{}',
  goals text[] not null default '{}',
  created_at timestamptz not null default now(),
  unique (user_id)
);

-- 3) Ajanda oturumları
create table public.sessions (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  description text,
  start_time timestamptz not null,
  end_time timestamptz not null,
  location text
);

-- 4) Toplantı talepleri
create table public.meeting_requests (
  id uuid primary key default gen_random_uuid(),
  from_user_id uuid not null references public.users (id) on delete cascade,
  to_user_id uuid not null references public.users (id) on delete cascade,
  status text not null default 'pending' check (status in ('pending', 'accepted', 'rejected')),
  proposed_time timestamptz,
  created_at timestamptz not null default now()
);

-- 5) Rozetler
create table public.badges (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users (id) on delete cascade,
  name text not null,
  awarded_at timestamptz not null default now()
);

-- 6) Zonlar (kaba bölge tanımı)
create table public.zones (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  polygon jsonb not null
);

-- 7) Stantlar (admin tarafından eklenir)
create table public.stands (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  lat double precision not null,
  lng double precision not null,
  type text not null,
  sponsor text,
  zone_id uuid references public.zones (id)
);

-- 8) Check-in'ler
create table public.checkins (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users (id) on delete cascade,
  target_type text not null check (target_type in ('session', 'stand')),
  target_id uuid not null,
  checked_in_at timestamptz not null default now()
);

-- 9) Konum ping'leri (arka plan takip)
create table public.location_pings (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users (id) on delete cascade,
  lat double precision not null,
  lng double precision not null,
  accuracy double precision,
  "timestamp" timestamptz not null default now()
);

-- ── RLS politikaları ──────────────────────────────────────────────
-- SQL Editor üzerinden oluşturulan tablolarda RLS otomatik açılmadığı için burada
-- açıkça etkinleştirilir. Policy eklenmezse tablo tamamen erişime kapalı kalır.
alter table public.users enable row level security;
alter table public.profiles enable row level security;
alter table public.sessions enable row level security;
alter table public.meeting_requests enable row level security;
alter table public.badges enable row level security;
alter table public.zones enable row level security;
alter table public.stands enable row level security;
alter table public.checkins enable row level security;
alter table public.location_pings enable row level security;

-- users: e-posta ve admin bayrağı yalnızca satırın sahibi veya admin tarafından okunur.
-- İstemciye update izni verilmez; aksi durumda kullanıcı kendi is_admin değerini açabilir.
create policy "users_select_self_or_admin" on public.users for select to authenticated
  using (auth.uid() = id or public.is_admin());

-- profiles: eşleştirme/keşif için herkes görebilir, sadece kendi profilini yazabilir
create policy "profiles_select_all" on public.profiles for select to authenticated using (true);
create policy "profiles_insert_self" on public.profiles for insert to authenticated with check (auth.uid() = user_id);
create policy "profiles_update_self" on public.profiles for update to authenticated using (auth.uid() = user_id);

-- sessions: herkes okuyabilir, sadece admin yazabilir
create policy "sessions_select_all" on public.sessions for select to authenticated using (true);
create policy "sessions_admin_write" on public.sessions for all to authenticated using (public.is_admin()) with check (public.is_admin());

-- meeting_requests: sadece taraf olduğun talepleri görebilir/güncelleyebilirsin
create policy "meetings_select_own" on public.meeting_requests for select to authenticated
  using (auth.uid() = from_user_id or auth.uid() = to_user_id);
create policy "meetings_insert_own" on public.meeting_requests for insert to authenticated
  with check (auth.uid() = from_user_id);
create policy "meetings_update_participant" on public.meeting_requests for update to authenticated
  using (auth.uid() = from_user_id or auth.uid() = to_user_id);
create policy "meetings_admin_select" on public.meeting_requests for select to authenticated
  using (public.is_admin());

-- badges: sadece kendi rozetlerini görebilirsin (kazanım sunucu tarafında/service role ile yazılır)
create policy "badges_select_own" on public.badges for select to authenticated using (auth.uid() = user_id);

-- zones & stands: herkes okuyabilir, sadece admin yazabilir
create policy "zones_select_all" on public.zones for select to authenticated using (true);
create policy "zones_admin_write" on public.zones for all to authenticated using (public.is_admin()) with check (public.is_admin());
create policy "stands_select_all" on public.stands for select to authenticated using (true);
create policy "stands_admin_write" on public.stands for all to authenticated using (public.is_admin()) with check (public.is_admin());

-- checkins: sadece kendi check-in'lerini yazabilir/görebilirsin
create policy "checkins_select_own" on public.checkins for select to authenticated using (auth.uid() = user_id);
create policy "checkins_insert_own" on public.checkins for insert to authenticated with check (auth.uid() = user_id);
create policy "checkins_admin_select" on public.checkins for select to authenticated using (public.is_admin());

-- location_pings: sadece kendi ping'lerini yazabilir/görebilirsin
create policy "pings_select_own" on public.location_pings for select to authenticated using (auth.uid() = user_id);
create policy "pings_insert_own" on public.location_pings for insert to authenticated with check (auth.uid() = user_id);
