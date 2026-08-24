import { useQuery } from '@tanstack/react-query';

import { supabase } from './supabase';

export async function checkIsAdmin(userId: string): Promise<boolean> {
  const { data, error } = await supabase.from('users').select('is_admin').eq('id', userId).maybeSingle();
  if (error) throw error;

  return data?.is_admin ?? false;
}

// Oturum açmış kullanıcının is_admin bayrağını getirir. Bu, 4 katılımcı
// rolünden (girisimci/yatirimci/kurum/ziyaretci) tamamen ayrı bir yetki kontrolüdür.
export function useIsAdmin() {
  return useQuery({
    queryKey: ['me', 'is_admin'],
    queryFn: async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) return false;
      return checkIsAdmin(user.id);
    },
    staleTime: 30_000,
  });
}
