-- location_pings tablosunda şimdiye kadar sadece "kendi ping'ini ekle/oku" policy'leri
-- vardı (bkz. supabase_schema.sql). Profil > Gizlilik ekranındaki "Verilerimi Sil"
-- butonunun gerçekten çalışabilmesi için silme (delete) izni ekliyoruz.
-- Supabase Dashboard > SQL Editor içine yapıştırıp "Run" ile çalıştır.

create policy "pings_delete_own" on public.location_pings for delete to authenticated
  using (auth.uid() = user_id);
