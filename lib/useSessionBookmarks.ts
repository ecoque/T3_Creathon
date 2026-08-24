import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import AsyncStorage from '@react-native-async-storage/async-storage';

import { supabase } from './supabase';
import { useCurrentProfile } from './useCurrentProfile';

function legacyStorageKey(userId: string) {
  return `takeoff:session_bookmarks:${userId}`;
}

function legacyProcessedKey(userId: string) {
  return `takeoff:session_bookmarks:migrated:${userId}`;
}

async function importLegacyDeviceBookmarks(userId: string, serverIds: Set<string>) {
  const [raw, processedRaw] = await Promise.all([
    AsyncStorage.getItem(legacyStorageKey(userId)),
    AsyncStorage.getItem(legacyProcessedKey(userId)),
  ]);
  if (!raw) return serverIds;

  let legacyIds: string[] = [];
  let processedIds = new Set<string>();
  try {
    legacyIds = JSON.parse(raw) as string[];
    processedIds = new Set(processedRaw ? (JSON.parse(processedRaw) as string[]) : []);
  } catch {
    return serverIds;
  }

  const next = new Set(serverIds);
  legacyIds.filter((id) => next.has(id)).forEach((id) => processedIds.add(id));

  for (const sessionId of legacyIds.filter((id) => !next.has(id) && !processedIds.has(id))) {
    const { error } = await supabase.from('session_bookmarks').insert({ user_id: userId, session_id: sessionId });
    // Eski cihaz verisinin bir kısmı artık geçersiz veya yeni toplantılarla
    // çakışıyor olabilir. Geçerli seçimleri taşırken böyle satırları atlarız.
    if (!error) {
      next.add(sessionId);
      processedIds.add(sessionId);
    }
  }
  await AsyncStorage.setItem(legacyProcessedKey(userId), JSON.stringify(Array.from(processedIds)));
  return next;
}

async function fetchBookmarkedSessionIds(userId: string): Promise<Set<string>> {
  const { data, error } = await supabase
    .from('session_bookmarks')
    .select('session_id')
    .eq('user_id', userId);
  if (error) throw error;
  const serverIds = new Set((data ?? []).map((row) => row.session_id as string));
  return importLegacyDeviceBookmarks(userId, serverIds);
}

// Yeni seçimlerin tek gerçek kaynağı Supabase'dir. Önceki sürümde cihazda
// kalmış seçimler ilk yüklemede kayıp olmadan hesaba aktarılır.
export function useSessionBookmarks() {
  const { data: meResult } = useCurrentProfile();
  return useQuery({
    queryKey: ['session_bookmarks', meResult?.userId],
    queryFn: () => fetchBookmarkedSessionIds(meResult!.userId),
    enabled: !!meResult?.userId,
    staleTime: 30_000,
  });
}

type ToggleArgs = { sessionId: string; bookmarked: boolean };

export function useToggleSessionBookmark() {
  const queryClient = useQueryClient();
  const { data: meResult } = useCurrentProfile();
  const queryKey = ['session_bookmarks', meResult?.userId] as const;

  return useMutation({
    mutationFn: async ({ sessionId, bookmarked }: ToggleArgs) => {
      const userId = meResult?.userId;
      if (!userId) throw new Error('Oturum bulunamadı.');

      const result = bookmarked
        ? await supabase
            .from('session_bookmarks')
            .delete()
            .eq('user_id', userId)
            .eq('session_id', sessionId)
        : await supabase.from('session_bookmarks').insert({ user_id: userId, session_id: sessionId });
      if (result.error) throw result.error;
    },
    // Sunucu yanıtı beklenirken arayüz anında güncellenir; kayıt başarısızsa
    // önceki hesap verisine geri dönülür.
    onMutate: async ({ sessionId, bookmarked }: ToggleArgs) => {
      await queryClient.cancelQueries({ queryKey });
      const previous = queryClient.getQueryData<Set<string>>(queryKey);

      queryClient.setQueryData<Set<string>>(queryKey, (prev) => {
        const next = new Set(prev ?? []);
        if (bookmarked) next.delete(sessionId);
        else next.add(sessionId);
        return next;
      });

      return { previous };
    },
    onError: (_err, _vars, context) => {
      queryClient.setQueryData(queryKey, context?.previous ?? new Set<string>());
      queryClient.invalidateQueries({ queryKey });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey });
    },
  });
}
