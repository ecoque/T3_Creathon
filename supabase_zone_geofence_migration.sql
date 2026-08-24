-- Bölgeler (zones) artık poligon köşe noktaları yerine daha basit ve admin
-- panelinden düzenlenebilir bir modelle çalışıyor: bir merkez GPS noktası +
-- metre cinsinden yarıçap. location_pings verisi bu daire içine düşen
-- kullanıcılar sayılarak canlı yoğunluk hesaplanıyor.
-- Supabase Dashboard > SQL Editor içine yapıştırıp "Run" ile çalıştır.

alter table public.zones
  add column if not exists center_lat double precision,
  add column if not exists center_lng double precision,
  add column if not exists radius_meters double precision not null default 60;

-- Hiç zon tanımlanmamışsa, başlangıç için bir örnek zon ekle (Özge'nin test
-- sırasında location_pings'e düşen güncel konumu merkez alınarak). Admin
-- panelinden (Harita Yönetimi > Bölge Özetleri) adı, konumu ve yarıçapı
-- istendiği zaman değiştirilebilir.
insert into public.zones (name, polygon, center_lat, center_lng, radius_meters)
select 'Ana Alan', '[]'::jsonb, 39.9374238, 32.8301888, 100
where not exists (select 1 from public.zones);
