-- Üç noktalı ("afin") harita kalibrasyonu — GPS <-> kroki-yüzde dönüşümünü
-- tek bir merkez + varsayılan (kare, kuzey-yukarı) ölçekten, GERÇEKTEN
-- ölçülmüş bir dönüşüme yükseltir.
--
-- KÖK SORUN: `get_live_density_grid`/`gpsToMapPercent` (bkz.
-- supabase_venue_center_migration.sql, lib/zoneDensity.ts) TEK bir merkez
-- noktası + TEK bir yarıçap kullanıyor ve x/y ekseninde AYNI ölçeği,
-- krokinin "yukarısı = coğrafi kuzey" olduğunu varsayıyor. Bina kare değilse
-- ya da kroki gerçek kuzeye göre döndürülmüş çizildiyse, merkezden uzaklaştıkça
-- bu varsayımlar sistematik olarak sapıyor.
--
-- ÇÖZÜM: admin'in merkez noktasına (kroki 50,50) ek olarak 2 nokta DAHA
-- biliniyorsa (toplam 3 nokta — bkz. lib/venueCalibration.ts), bu 3 nokta
-- ARTIK tam bir 2B afin dönüşümü (öteleme + x/y'de bağımsız ölçek + gerçek
-- dönüklük) belirlemeye yetiyor. Bu dosya SADECE bu ek 2 noktanın nereden
-- geleceğiyle ilgili: admin elle bir noktaya gidip GPS'ini kaydedebilir
-- (`source='manual'`) VEYA aşağıdaki RPC ile, katılımcıların zaten yaptığı
-- stant/oturum check-in'lerinden OTOMATİK türetilebilir (`source=
-- 'checkin_derived'`) — bir katılımcı bir standın QR'ını okuttuğunda, o an
-- GPS'i + standın (zaten bilinen) kroki konumu birlikte ücretsiz bir
-- kalibrasyon noktası oluşturuyor, kimse elle bir şey yapmadan.
--
-- Supabase Dashboard > SQL Editor içine yapıştırıp "Run" ile çalıştır. Bu
-- migration çalıştırılmadan uygulamanın GERİ KALANI normal çalışmaya devam
-- eder — sadece kalibrasyon özelliği (afin dönüşüm) devre dışı kalır, mevcut
-- tek-merkezli yöntem (bkz. lib/zoneDensity.ts > gpsToMapPercent) hiç
-- değişmeden fallback olarak kullanılmaya devam eder (bkz.
-- lib/venueCalibration.ts > useVenueTransform).

begin;

-- Kabul edilmiş (admin tarafından onaylanmış) ekstra kalibrasyon noktaları.
-- Merkez noktası burada TUTULMUYOR — o zaten event_settings.venue_center_lat/
-- lng'de var, kroki-yüzdesi de her zaman sabit (50,50) olduğu için ayrıca
-- saklanmasına gerek yok. Bu tabloda genelde 0-2 satır bulunur (afin dönüşüm
-- için merkez + bu tablodan 2 nokta yeterli); admin isterse daha fazla
-- ekleyip en iyi ikisini (bkz. pickBestCalibrationPair) otomatik seçtirebilir.
create table if not exists public.venue_calibration_points (
  id uuid primary key default gen_random_uuid(),
  map_x double precision not null,
  map_y double precision not null,
  lat double precision not null,
  lng double precision not null,
  source text not null default 'manual' check (source in ('manual', 'checkin_derived')),
  label text,
  accuracy_m double precision,
  sample_count integer not null default 1,
  created_at timestamptz not null default now()
);

alter table public.venue_calibration_points
  add column if not exists map_x double precision,
  add column if not exists map_y double precision,
  add column if not exists lat double precision,
  add column if not exists lng double precision,
  add column if not exists source text not null default 'manual',
  add column if not exists label text,
  add column if not exists accuracy_m double precision,
  add column if not exists sample_count integer not null default 1,
  add column if not exists created_at timestamptz not null default now();

alter table public.venue_calibration_points enable row level security;

do $$
begin
  -- Herkes okuyabilir: bu noktalar bir stant/oturumun YAKLAŞIK gerçek
  -- konumunu taşıyor (kişisel bir kullanıcı konumu değil — tıpkı
  -- venue_center_lat/lng gibi zaten "genel" bilgi), ve katılımcı tarafındaki
  -- GPS->kroki dönüşümünün (rota başlangıcı, "şu anda buradasınız" noktası)
  -- doğru çalışması için katılımcının da bu noktaları okuyabilmesi gerekiyor.
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'venue_calibration_points' and policyname = 'venue_calibration_points_select_all') then
    create policy "venue_calibration_points_select_all" on public.venue_calibration_points for select to authenticated using (true);
  end if;
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'venue_calibration_points' and policyname = 'venue_calibration_points_admin_write') then
    create policy "venue_calibration_points_admin_write" on public.venue_calibration_points for all to authenticated using (public.is_admin()) with check (public.is_admin());
  end if;
end
$$;

-- Check-in + konum ping eşleştirmesinden ADAY kalibrasyon noktaları üretir.
-- Aday demek: admin panelinde listelenip TEK TEK onaylanana kadar hiçbir şey
-- kalıcı olarak kaydedilmiyor demek (bkz. lib/venueCalibration.ts >
-- useCalibrationCandidates + confirmCandidateAsCalibrationPoint) — bu
-- fonksiyon sadece OKUMA yapar, `venue_calibration_points` tablosuna hiçbir
-- şey yazmaz.
--
-- GİZLİLİK: `checkins` ve `location_pings` tabloları RLS ile normal bir
-- kullanıcının SADECE KENDİ satırlarını okumasına izin veriyor (bkz.
-- supabase_schema.sql). Bu fonksiyon da `get_live_density_grid` ile AYNI
-- desende (SECURITY DEFINER, RLS'yi atlayan bir rolle çalışıyor) — ama onun
-- aksine, İSTEMCİYE HİÇBİR ZAMAN HANGİ KULLANICININ NE ZAMAN NEREDE OLDUĞU
-- dönmüyor: her satır bir stant/oturum (target_type + target_id) başına
-- ORTALANMIŞ tek bir sonuç, kaç farklı check-in'den türetildiği
-- (sample_count) dışında hiçbir kullanıcı/zaman bilgisi taşımıyor. Ayrıca
-- fonksiyon SADECE admin çağırdığında sonuç döner (aşağıdaki
-- `public.is_admin()` kontrolü) — katılımcı tarafında bu RPC'yi çağıran
-- hiçbir kod yok, ama savunma amaçlı ek bir katman.
create or replace function public.get_calibration_candidates(
  p_time_window_seconds integer default 180,
  p_max_accuracy_m double precision default 30
)
returns table (
  target_type text,
  target_id uuid,
  label text,
  map_x double precision,
  map_y double precision,
  lat double precision,
  lng double precision,
  accuracy_m double precision,
  sample_count integer
)
language plpgsql
security definer
set search_path = public
stable
as $$
begin
  if not public.is_admin() then
    return;
  end if;

  return query
  with matched as (
    -- Her check-in için, AYNI kullanıcının check-in anına en yakın (±pencere
    -- içindeki) TEK bir konum ping'i eşleştirilir. `accuracy` bilinmiyorsa
    -- (bazı cihazlarda gelmeyebiliyor) reddetmek yerine kabul ediyoruz —
    -- daha sıkı bir filtre isteniyorsa p_max_accuracy_m parametresiyle ayrı
    -- ayarlanabilir.
    select
      c.target_type,
      c.target_id,
      lp.lat,
      lp.lng,
      lp.accuracy
    from public.checkins c
    join lateral (
      select lp2.lat, lp2.lng, lp2.accuracy
      from public.location_pings lp2
      where lp2.user_id = c.user_id
        and lp2."timestamp" between c.checked_in_at - make_interval(secs => p_time_window_seconds)
                                 and c.checked_in_at + make_interval(secs => p_time_window_seconds)
      order by abs(extract(epoch from (lp2."timestamp" - c.checked_in_at)))
      limit 1
    ) lp on true
    where lp.accuracy is null or lp.accuracy <= p_max_accuracy_m
  ),
  resolved as (
    -- 'stand' için doğrudan stands.map_x/map_y; 'session' için
    -- sessions -> stages üzerinden map_x/map_y'ye ulaşılıyor (bir oturumun
    -- kendi kroki konumu yok, sadece bağlı olduğu sahnenin var).
    select
      m.target_type,
      m.target_id,
      s.map_x as stand_map_x,
      s.map_y as stand_map_y,
      st.map_x as stage_map_x,
      st.map_y as stage_map_y,
      coalesce(nullif(trim(s.company_name), ''), s.name) as stand_label,
      sess.title as session_label,
      m.lat,
      m.lng,
      m.accuracy
    from matched m
    left join public.stands s on m.target_type = 'stand' and s.id = m.target_id
    left join public.sessions sess on m.target_type = 'session' and sess.id = m.target_id
    left join public.stages st on sess.stage_id = st.id
  )
  select
    r.target_type,
    r.target_id,
    max(coalesce(r.stand_label, r.session_label, r.target_type)) as label,
    avg(coalesce(r.stand_map_x, r.stage_map_x)) as map_x,
    avg(coalesce(r.stand_map_y, r.stage_map_y)) as map_y,
    avg(r.lat) as lat,
    avg(r.lng) as lng,
    avg(r.accuracy) as accuracy_m,
    count(*)::int as sample_count
  from resolved r
  where coalesce(r.stand_map_x, r.stage_map_x) is not null
    and coalesce(r.stand_map_y, r.stage_map_y) is not null
  group by r.target_type, r.target_id;
end;
$$;

-- İstemci (sadece admin paneli — bkz. lib/venueCalibration.ts) doğrudan
-- supabase.rpc(...) ile çağırıyor, bu yüzden `authenticated` rolüne EXECUTE
-- izni gerekiyor (fonksiyonun kendi içindeki is_admin() kontrolü, admin
-- olmayanlar için zaten boş sonuç döndürüyor).
grant execute on function public.get_calibration_candidates(integer, double precision) to authenticated;

commit;
