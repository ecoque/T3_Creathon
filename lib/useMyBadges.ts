import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { supabase } from './supabase';
import { useCurrentProfile } from './useCurrentProfile';
import type { Badge } from '../types';

// QR içeriği: 'takeoff:session:<session_id>' — bkz. AdminSessionQR.tsx (üretim)
// ve app/profile/scan-badge.tsx (okuma).
const QR_PREFIX = 'takeoff:session:';

export function parseSessionQrValue(raw: string): string | null {
  const trimmed = raw.trim();
  if (!trimmed.startsWith(QR_PREFIX)) return null;
  const sessionId = trimmed.slice(QR_PREFIX.length).trim();
  return sessionId.length ? sessionId : null;
}

export function buildSessionQrValue(sessionId: string): string {
  return `${QR_PREFIX}${sessionId}`;
}

async function fetchMyBadges(userId: string): Promise<Badge[]> {
  const { data, error } = await supabase
    .from('badges')
    .select('*')
    .eq('user_id', userId)
    .order('awarded_at', { ascending: false });
  if (error) throw error;
  return (data ?? []) as Badge[];
}

export function useMyBadges() {
  const { data: meResult } = useCurrentProfile();
  const userId = meResult?.userId;
  return useQuery({
    queryKey: ['badges', 'mine', userId],
    queryFn: () => fetchMyBadges(userId as string),
    enabled: !!userId,
    staleTime: 15_000,
  });
}

export type AwardBadgeResult = { status: 'awarded' | 'already_owned'; sessionTitle: string };

// QR tarama sonucu: session_id'yi doğrular, rozeti (varsa) ekler. Aynı
// oturumdan ikinci tarama unique(user_id, session_id) sayesinde no-op olur.
async function awardBadgeFromSessionId(userId: string, sessionId: string): Promise<AwardBadgeResult> {
  const sessionResult = await supabase.from('sessions').select('id, title').eq('id', sessionId).maybeSingle();
  if (sessionResult.error) throw sessionResult.error;
  if (!sessionResult.data) throw new Error('QR koduna ait bir oturum bulunamadı.');
  const sessionTitle = sessionResult.data.title as string;

  const existing = await supabase
    .from('badges')
    .select('id')
    .eq('user_id', userId)
    .eq('session_id', sessionId)
    .maybeSingle();
  if (existing.error) throw existing.error;
  if (existing.data) return { status: 'already_owned', sessionTitle };

  const insertResult = await supabase.from('badges').upsert(
    { user_id: userId, session_id: sessionId, name: sessionTitle, awarded_at: new Date().toISOString() },
    { onConflict: 'user_id,session_id', ignoreDuplicates: true },
  );
  if (insertResult.error) throw insertResult.error;
  return { status: 'awarded', sessionTitle };
}

export function useAwardBadgeFromQr() {
  const queryClient = useQueryClient();
  const { data: meResult } = useCurrentProfile();
  return useMutation({
    mutationFn: async (sessionId: string) => {
      const userId = meResult?.userId;
      if (!userId) throw new Error('Oturum bulunamadı.');
      return awardBadgeFromSessionId(userId, sessionId);
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['badges', 'mine'] }),
  });
}
