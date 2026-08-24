import { useQuery } from '@tanstack/react-query';

import { supabase } from './supabase';
import { useCurrentProfile } from './useCurrentProfile';
import type { Profile } from '../types';

async function fetchOtherProfiles(myUserId: string): Promise<Profile[]> {
  const { data, error } = await supabase
    .from('profiles')
    .select('*')
    .eq('status', 'active')
    .neq('user_id', myUserId);
  if (error) throw error;
  return (data ?? []) as Profile[];
}

// Keşfet ve Ajanda ekranları aynı "diğer katılımcılar" sorgusunu paylaşır,
// böylece ikisi de aynı React Query cache'ini kullanır.
export function useOtherProfiles(options?: { enabled?: boolean }) {
  const { data: meResult } = useCurrentProfile();
  return useQuery({
    queryKey: ['profiles', 'others', meResult?.userId],
    queryFn: () => fetchOtherProfiles(meResult!.userId),
    enabled: !!meResult?.userId && (options?.enabled ?? true),
  });
}
