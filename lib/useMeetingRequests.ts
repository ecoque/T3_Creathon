import { useQuery } from '@tanstack/react-query';

import { supabase } from './supabase';
import type { MeetingRequest, Profile } from '../types';

export type MeetingRequestItem = MeetingRequest & {
  direction: 'incoming' | 'outgoing';
  otherProfile: Profile | null;
};

async function fetchMeetingRequests(): Promise<{ userId: string; items: MeetingRequestItem[] }> {
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return { userId: '', items: [] };

  const { data: requests, error } = await supabase
    .from('meeting_requests')
    .select('*')
    .or(`from_user_id.eq.${user.id},to_user_id.eq.${user.id}`)
    .order('created_at', { ascending: false });

  if (error) throw error;

  const rows = (requests ?? []) as MeetingRequest[];
  const otherIds = Array.from(
    new Set(rows.map((r) => (r.from_user_id === user.id ? r.to_user_id : r.from_user_id))),
  );

  let profilesById = new Map<string, Profile>();
  if (otherIds.length > 0) {
    const { data: profiles, error: profilesError } = await supabase
      .from('profiles')
      .select('*')
      .in('user_id', otherIds);
    if (profilesError) throw profilesError;
    profilesById = new Map((profiles as Profile[]).map((p) => [p.user_id, p]));
  }

  const items: MeetingRequestItem[] = rows.map((r) => {
    const direction = r.from_user_id === user.id ? 'outgoing' : 'incoming';
    const otherId = direction === 'outgoing' ? r.to_user_id : r.from_user_id;
    return { ...r, direction, otherProfile: profilesById.get(otherId) ?? null };
  });

  return { userId: user.id, items };
}

export function useMeetingRequests() {
  return useQuery({
    queryKey: ['meeting_requests'],
    queryFn: fetchMeetingRequests,
    staleTime: 15_000,
  });
}
