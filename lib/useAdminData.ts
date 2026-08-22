import { useQuery } from '@tanstack/react-query';

import { supabase } from './supabase';
import type { CheckIn, MeetingRequest, Profile, Session, Stand, User, Zone } from '../types';

export const ADMIN_DATA_QUERY_KEY = ['admin', 'overview'] as const;

export type AdminData = {
  profiles: Profile[];
  users: User[];
  sessions: Session[];
  stands: Stand[];
  zones: Zone[];
  meetingRequests: MeetingRequest[];
  checkins: CheckIn[];
  warnings: string[];
};

async function fetchAdminData(): Promise<AdminData> {
  const [profiles, users, sessions, stands, zones, meetingRequests, checkins] = await Promise.all([
    supabase.from('profiles').select('*').order('full_name'),
    supabase.from('users').select('*').order('created_at', { ascending: false }),
    supabase.from('sessions').select('*').order('start_time'),
    supabase.from('stands').select('*').order('name'),
    supabase.from('zones').select('*').order('name'),
    supabase.from('meeting_requests').select('*').order('created_at', { ascending: false }),
    supabase.from('checkins').select('*').order('checked_in_at', { ascending: false }),
  ]);

  const results = [profiles, users, sessions, stands, zones, meetingRequests, checkins];
  const warnings = results.flatMap((result) => (result.error ? [result.error.message] : []));

  if (warnings.length === results.length) {
    throw new Error(warnings[0] ?? 'Admin verileri alınamadı.');
  }

  return {
    profiles: (profiles.data ?? []) as Profile[],
    users: (users.data ?? []) as User[],
    sessions: (sessions.data ?? []) as Session[],
    stands: (stands.data ?? []) as Stand[],
    zones: (zones.data ?? []) as Zone[],
    meetingRequests: (meetingRequests.data ?? []) as MeetingRequest[],
    checkins: (checkins.data ?? []) as CheckIn[],
    warnings: Array.from(new Set(warnings)),
  };
}

export function useAdminData() {
  return useQuery({
    queryKey: ADMIN_DATA_QUERY_KEY,
    queryFn: fetchAdminData,
    staleTime: 15_000,
  });
}
