import { supabase } from './supabase';

// !!! BU BYPASS'I YALNIZCA SUPABASE ADMIN YETKİSİNE ERİŞEMEDİĞİMİZ İÇİN PANELİ TEST ETMEK AMACIYLA EKLEDİK.
// !!! TEST BİTTİĞİNDE BU DEĞER FALSE YAPILACAK VE ARDINDAN BU GEÇİCİ KOD TAMAMEN KALDIRILACAK.
const ENABLE_ADMIN_PREVIEW_FOR_TESTING = true;

export async function isAdminUser(userId: string): Promise<boolean> {
  if (__DEV__ && ENABLE_ADMIN_PREVIEW_FOR_TESTING) {
    return true;
  }

  const { data, error } = await supabase
    .from('users')
    .select('is_admin')
    .eq('id', userId)
    .maybeSingle();

  if (error) throw error;
  return data?.is_admin === true;
}
