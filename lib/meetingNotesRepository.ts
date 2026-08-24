import { supabase } from './supabase';
import type { MeetingNote } from '../types';

export async function listOwnMeetingNotes(ownerUserId: string): Promise<MeetingNote[]> {
  const { data, error } = await supabase
    .from('meeting_notes')
    .select('id,meeting_request_id,owner_user_id,note,created_at,updated_at')
    .eq('owner_user_id', ownerUserId)
    .order('updated_at', { ascending: false });
  if (error) throw error;
  return (data ?? []) as MeetingNote[];
}

export async function saveOwnMeetingNote(
  ownerUserId: string,
  meetingRequestId: string,
  note: string,
): Promise<void> {
  const { error } = await supabase.from('meeting_notes').upsert(
    {
      owner_user_id: ownerUserId,
      meeting_request_id: meetingRequestId,
      note: note.trim(),
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'meeting_request_id,owner_user_id' },
  );
  if (error) throw error;
}
