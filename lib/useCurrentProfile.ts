import { useQuery } from '@tanstack/react-query';

import { supabase } from './supabase';
import type { Profile } from '../types';

async function fetchCurrentProfile(): Promise<{ userId: string; profile: Profile | null }> {
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { userId: '', profile: null };
  }

  const { data, error } = await supabase.from('profiles').select('*').eq('user_id', user.id).maybeSingle();
  if (error) throw error;

  return { userId: user.id, profile: (data as Profile) ?? null };
}

// Oturum açmış kullanıcının kendi profilini (varsa) getirir. Header, Profil ve
// eşleştirme ekranları bu ortak sorguyu paylaşır.
export function useCurrentProfile() {
  return useQuery({
    queryKey: ['me', 'profile'],
    queryFn: fetchCurrentProfile,
    staleTime: 30_000,
  });
}
