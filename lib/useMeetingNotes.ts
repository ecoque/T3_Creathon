import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { listOwnMeetingNotes, saveOwnMeetingNote } from './meetingNotesRepository';

const notesKey = (userId?: string) => ['meeting-notes', userId] as const;

export function useMeetingNotes(userId?: string) {
  const queryClient = useQueryClient();
  const query = useQuery({
    queryKey: notesKey(userId),
    queryFn: () => listOwnMeetingNotes(userId!),
    enabled: !!userId,
    staleTime: 15_000,
    retry: false,
  });
  const saveMutation = useMutation({
    mutationFn: ({ meetingRequestId, note }: { meetingRequestId: string; note: string }) => {
      if (!userId) throw new Error('Missing authenticated user.');
      return saveOwnMeetingNote(userId, meetingRequestId, note);
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: notesKey(userId) }),
  });

  return {
    rows: query.data ?? [],
    byMeetingId: new Map((query.data ?? []).map((row) => [row.meeting_request_id, row])),
    isLoading: query.isLoading,
    refetch: query.refetch,
    queryError: query.error,
    saveError: saveMutation.error,
    save: saveMutation.mutateAsync,
    isSaving: saveMutation.isPending,
  };
}
