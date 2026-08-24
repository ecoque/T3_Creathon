-- Krokideki duvarları temsil eden çizgi listesi.
-- Admin, kroki fotoğrafını yükledikten sonra üzerine (Harita Yönetimi
-- ekranından) elle duvar çizgileri çiziyor; rota bulma algoritması
-- (lib/routePlanner.ts) bu çizgileri stant/sahne gibi birer engel sayıp
-- etraflarından dolanıyor. Her satır { id, x1, y1, x2, y2 } biçiminde,
-- x/y krokideki yüzde (0-100) koordinatları.
--
-- event_settings üzerindeki mevcut RLS politikaları (herkes okuyabilir,
-- sadece admin yazabilir) bu yeni kolonu da otomatik kapsıyor — satır
-- bazlı olduğu için ayrı bir politika gerekmiyor.

alter table public.event_settings
  add column if not exists floor_plan_walls jsonb not null default '[]'::jsonb;
