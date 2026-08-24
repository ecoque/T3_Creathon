import { useQuery } from '@tanstack/react-query';

import { supabase } from '../../lib/supabase';
import type { Session } from '../../types';

async function fetchEventSessions(): Promise<Session[]> {
  const { data, error } = await supabase
    .from('sessions')
    .select('*')
    .in('status', ['published', 'live', 'delayed', 'completed'])
    .order('start_time', { ascending: true });

  if (error) throw error;
  return (data ?? []) as Session[];
}

export function useEventSessions() {
  return useQuery({
    queryKey: ['sessions'],
    queryFn: fetchEventSessions,
  });
}
