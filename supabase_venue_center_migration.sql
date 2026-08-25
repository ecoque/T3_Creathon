-- Etkinlik alanının TEK, etkinlik-geneli merkez GPS noktası + yoğunluk ısı
-- haritası. Önceden her bölge (zone) KENDİ merkez/yarıçapını tutuyordu (bkz.
-- supabase_zone_geofence_migration.sql) — admin için 4 ayrı GPS kurulumu
-- gerektiriyordu. Kullanıcı: "etkinlik alanının koordinatları her etkinliğe
-- göre değişiyor, admin TEK bir merkezi (gerekirse kendi bulunduğu konumu)
-- ayarlayabilsin, katılımcı konumlarına göre haritanın neresinde yoğunluk
-- olduğu (kırmızı=yoğun, yeşil=az yoğun) görülebilsin" istedi.
--
-- Supabase Dashboard > SQL Editor içine yapıştırıp "Run" ile çalıştır.
-- Bu migration çalıştırılmadan admin panelinin GERİ KALANI yine de normal
-- çalışır — sadece yoğunluk ısı haritası ve bölge bazlı CANLI kişi sayısı
-- (manuel girilen sayıya düşer) devre dışı kalır (bkz.
-- lib/adminRepository.ts > fetchAdminWorkspace, RPC çağrısı ayrı bir
-- try/catch içinde).

alter table public.event_settings
  add column if not exists venue_center_lat double precision,
  add column if not exists venue_center_lng double precision,
  add column if not exists venue_radius_meters double precision not null default 150;

-- Katılımcının (girişimci/yatırımcı/kurum/ziyaretçi) krokide gördüğü yoğunluk
-- ısı haritası, TÜM kullanıcıların yaklaşık konumuna ihtiyaç duyuyor — ama
-- RLS normal bir kullanıcının SADECE KENDİ ham location_pings kaydını
-- okumasına izin veriyor (bkz. supabase_schema.sql > "pings_select_own").
-- Bu fonksiyon SECURITY DEFINER olarak (fonksiyonu oluşturan rolün, tipik
-- olarak RLS'yi atlayan `postgres` rolünün, yetkileriyle) çalışır ve
-- İSTEMCİYE HİÇBİR ZAMAN HAM KONUM/KULLANICI VERİSİ DÖNMEZ — sadece
-- ızgaradaki her hücrede kaç benzersiz kullanıcı olduğunu (cnt) döner. Admin
-- panelindeki ısı haritası da tutarlılık için aynı fonksiyonu kullanıyor
-- (bkz. lib/adminRepository.ts, lib/useLiveDensity.ts).
--
-- Krokinin "yukarısı" kuzey, "sağı" doğu kabul edilir (basit bir varsayım —
-- krokinin gerçek pusula yönü farklıysa ısı lekesi hafif dönük görünebilir;
-- şu an için bir "kroki yönü/rotasyon" ayarı YOK, bilinçli bir sadelik
-- tercihi).
create or replace function public.get_live_density_grid(
  p_grid_cols integer default 8,
  p_grid_rows integer default 14,
  p_live_window_seconds integer default 300
)
returns table (cell_x integer, cell_y integer, cnt integer)
language plpgsql
security definer
set search_path = public
stable
as $$
declare
  v_center_lat double precision;
  v_center_lng double precision;
  v_radius_m double precision;
begin
  select venue_center_lat, venue_center_lng, coalesce(venue_radius_meters, 150)
    into v_center_lat, v_center_lng, v_radius_m
  from public.event_settings
  limit 1;

  -- Merkez henüz ayarlanmadıysa boş sonuç dön — ısı haritası admin merkezi
  -- ayarlayana kadar hiç gösterilmez (bkz. AdminMapManagement.tsx,
  -- app/(tabs)/map.tsx: `settings.venueCenterLat != null` kontrolü).
  if v_center_lat is null or v_center_lng is null or v_radius_m is null or v_radius_m <= 0 then
    return;
  end if;

  return query
  with latest_pings as (
    -- Aynı kullanıcıdan pencere içinde birden fazla ping gelmiş olabilir;
    -- sadece en güncel konumu "şu an neredeyim" sorusu için anlamlı.
    select distinct on (lp.user_id) lp.user_id, lp.lat, lp.lng
    from public.location_pings lp
    where lp."timestamp" >= now() - make_interval(secs => greatest(p_live_window_seconds, 1))
    order by lp.user_id, lp."timestamp" desc
  ),
  positioned as (
    select
      -- Kuzey (lat artışı) krokide YUKARI (küçük y) demek — 0-100 aralığına kırpılır.
      greatest(0::double precision, least(100::double precision,
        50 - ((lat - v_center_lat) * 111320.0 / v_radius_m) * 50
      )) as y_pct,
      -- Doğu (lng artışı) krokide SAĞA (büyük x) demek.
      greatest(0::double precision, least(100::double precision,
        50 + ((lng - v_center_lng) * 111320.0 * cos(radians(v_center_lat)) / v_radius_m) * 50
      )) as x_pct
    from latest_pings
  )
  select
    least(p_grid_cols - 1, floor(x_pct / (100.0 / p_grid_cols))::int) as cell_x,
    least(p_grid_rows - 1, floor(y_pct / (100.0 / p_grid_rows))::int) as cell_y,
    count(*)::int as cnt
  from positioned
  group by cell_x, cell_y;
end;
$$;

-- İstemci (hem admin hem katılımcı) bu fonksiyonu doğrudan supabase.rpc(...)
-- ile çağırıyor (bkz. lib/useLiveDensity.ts) — bu yüzden `authenticated`
-- rolüne açık EXECUTE izni gerekiyor (RLS policy'lerin içinde kullanılan
-- public.is_admin() gibi fonksiyonlardan farklı olarak, bunlar hiçbir zaman
-- doğrudan RPC ile çağrılmıyordu).
grant execute on function public.get_live_density_grid(integer, integer, integer) to authenticated;

-- Not: public.zones.center_lat / center_lng / radius_meters kolonları artık
-- KULLANILMIYOR (bkz. yukarıdaki gerekçe) — zararsız, kasıtlı olarak
-- silinmedi. İstenirse ileride `alter table public.zones drop column ...`
-- ile temizlenebilir.
