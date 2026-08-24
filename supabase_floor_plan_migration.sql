-- Admin artık gerçek etkinlik alanı krokisini (fotoğraf/çizim) uygulamaya
-- yükleyebiliyor; bu resim Harita Yönetimi ekranında arka plan olarak
-- gösteriliyor ve stant/oturum yerleri bu resmin üzerine yerleştiriliyor.
-- Supabase Dashboard > SQL Editor içine yapıştırıp "Run" ile çalıştır.

-- 1) Krokinin URL'sini tutacak kolon.
alter table public.event_settings
  add column if not exists floor_plan_url text;

-- 2) Yüklenen kroki resimlerinin saklanacağı public storage bucket.
insert into storage.buckets (id, name, public)
values ('floor-plans', 'floor-plans', true)
on conflict (id) do nothing;

-- 3) Herkes krokiyi görebilsin (katılımcı uygulaması da ileride kullanabilir),
-- ama sadece admin yükleyip değiştirebilsin.
do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'storage' and tablename = 'objects' and policyname = 'floor_plans_public_read'
  ) then
    create policy "floor_plans_public_read" on storage.objects
      for select to public using (bucket_id = 'floor-plans');
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'storage' and tablename = 'objects' and policyname = 'floor_plans_admin_write'
  ) then
    create policy "floor_plans_admin_write" on storage.objects
      for insert to authenticated with check (bucket_id = 'floor-plans' and public.is_admin());
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'storage' and tablename = 'objects' and policyname = 'floor_plans_admin_update'
  ) then
    create policy "floor_plans_admin_update" on storage.objects
      for update to authenticated using (bucket_id = 'floor-plans' and public.is_admin());
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'storage' and tablename = 'objects' and policyname = 'floor_plans_admin_delete'
  ) then
    create policy "floor_plans_admin_delete" on storage.objects
      for delete to authenticated using (bucket_id = 'floor-plans' and public.is_admin());
  end if;
end $$;
