import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import AsyncStorage from '@react-native-async-storage/async-storage';

import { supabase } from './supabase';

function storageKeyFor(userId: string) {
  return `takeoff:session_bookmarks:${userId}`;
}

async function fetchBookmarkedSessionIds(): Promise<Set<string>> {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return new Set();

  const raw = await AsyncStorage.getItem(storageKeyFor(user.id));
  if (!raw) return new Set();

  try {
    return new Set(JSON.parse(raw) as string[]);
  } catch {
    return new Set();
  }
}

// "Ajandam" işaretlemesi cihazda (AsyncStorage) kalıcı olarak saklanır; uygulama
// kapanıp açılsa bile kaybolmaz. Supabase'de ek bir tablo/migration gerektirmez —
// bunun bedeli, işaretin sadece bu cihaza özel olması (başka bir cihazda aynı
// hesapla girildiğinde görünmez).
export function useSessionBookmarks() {
  return useQuery({
    queryKey: ['session_bookmarks'],
    queryFn: fetchBookmarkedSessionIds,
    staleTime: Infinity,
  });
}

type ToggleArgs = { sessionId: string; bookmarked: boolean };

export function useToggleSessionBookmark() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ sessionId, bookmarked }: ToggleArgs) => {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) throw new Error('Oturum bulunamadı.');

      const current = queryClient.getQueryData<Set<string>>(['session_bookmarks']) ?? new Set<string>();
      const next = new Set(current);
      if (bookmarked) next.delete(sessionId);
      else next.add(sessionId);

      await AsyncStorage.setItem(storageKeyFor(user.id), JSON.stringify(Array.from(next)));
      return next;
    },
    // Diske yazma tamamlanmadan arayüz anında güncellensin (optimistic update);
    // yazma başarısız olursa (çok nadir, disk dolu vb.) önceki duruma geri alınır.
    onMutate: async ({ sessionId, bookmarked }: ToggleArgs) => {
      await queryClient.cancelQueries({ queryKey: ['session_bookmarks'] });
      const previous = queryClient.getQueryData<Set<string>>(['session_bookmarks']);

      queryClient.setQueryData<Set<string>>(['session_bookmarks'], (prev) => {
        const next = new Set(prev ?? []);
        if (bookmarked) next.delete(sessionId);
        else next.add(sessionId);
        return next;
      });

      return { previous };
    },
    onError: (_err, _vars, context) => {
      if (context?.previous) {
        queryClient.setQueryData(['session_bookmarks'], context.previous);
      }
    },
    onSuccess: (next) => {
      queryClient.setQueryData(['session_bookmarks'], next);
    },
  });
}
