import { useQuery } from '@tanstack/react-query';

import { supabase } from './supabase';
import type { Profile } from '../types';

export async function getProfileForUser(userId: string): Promise<Profile | null> {
  const { data, error } = await supabase.from('profiles').select('*').eq('user_id', userId).maybeSingle();
  if (error) throw error;

  return (data as Profile) ?? null;
}

async function fetchCurrentProfile(): Promise<{ userId: string; profile: Profile | null }> {
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { userId: '', profile: null };
  }

  const profile = await getProfileForUser(user.id);
  return { userId: user.id, profile };
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
