import { router } from 'expo-router';

import { supabase } from './supabase';

// Giriş/kayıt sonrası: bu kullanıcının zaten bir profili var mı diye bakıp
// ona göre ana sayfaya ya da onboarding'e yönlendiriyor. Hem "Giriş Yap" hem
// "Kayıt Ol" akışında kullanılıyor ki profili olan biri her seferinde
// baştan rol/ilgi alanı seçme ekranına düşmesin.
export async function routeAfterAuth(userId: string) {
  const { data: profile, error } = await supabase
    .from('profiles')
    .select('id')
    .eq('user_id', userId)
    .maybeSingle();

  if (!error && profile) {
    router.replace('/(tabs)/home');
  } else {
    router.replace('/onboarding');
  }
}
