-- Stantlar artık serbest yüzde koordinatı yerine krokideki bir kareye
-- (zone_col, zone_row) yerleştiriliyor. İkisi de null ise stant henüz
-- krokiye yerleştirilmemiş demektir. Stant numarası (booth_no) da admin
-- tarafından elle girilmek yerine bulunduğu zone'a göre otomatik atanıyor
-- (örn. Zone A'daki ilk stant A101, sonraki A102, ...).
-- Supabase Dashboard > SQL Editor içine yapıştırıp "Run" ile çalıştır.

alter table public.stands
  add column if not exists zone_col integer,
  add column if not exists zone_row integer;
