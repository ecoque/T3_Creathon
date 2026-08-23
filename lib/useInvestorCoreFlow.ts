import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import {
  addInvestorShortlist,
  listInvestorShortlist,
  removeInvestorShortlist,
} from './investorShortlistRepository';

const shortlistKey = (userId?: string) => ['investor-shortlist', userId] as const;

export function useInvestorCoreFlow(userId?: string, enabled = false) {
  const queryClient = useQueryClient();
  const query = useQuery({
    queryKey: shortlistKey(userId),
    queryFn: () => listInvestorShortlist(userId!),
    enabled: enabled && !!userId,
    staleTime: 15_000,
    retry: false,
  });

  const addMutation = useMutation({
    mutationFn: (profileId: string) => {
      if (!userId) throw new Error('Missing authenticated user.');
      return addInvestorShortlist(userId, profileId);
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: shortlistKey(userId) }),
  });

  const removeMutation = useMutation({
    mutationFn: (profileId: string) => {
      if (!userId) throw new Error('Missing authenticated user.');
      return removeInvestorShortlist(userId, profileId);
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: shortlistKey(userId) }),
  });

  return {
    rows: query.data ?? [],
    profileIds: new Set((query.data ?? []).map((row) => row.profile_id)),
    isLoading: query.isLoading,
    isUnavailable: !!query.error,
    error: query.error ?? addMutation.error ?? removeMutation.error,
    add: addMutation.mutateAsync,
    remove: removeMutation.mutateAsync,
    isMutating: addMutation.isPending || removeMutation.isPending,
  };
}
