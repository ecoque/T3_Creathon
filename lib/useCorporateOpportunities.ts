import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import {
  createCorporateOpportunity,
  listCorporateOpportunities,
  updateCorporateOpportunity,
  type CorporateOpportunityInput,
} from './corporateOpportunitiesRepository';

const opportunityKey = (userId?: string) => ['corporate-opportunities', userId] as const;

type SaveOpportunityArgs = CorporateOpportunityInput & { id?: string };

export function useCorporateOpportunities(userId?: string, enabled = false) {
  const queryClient = useQueryClient();
  const query = useQuery({
    queryKey: opportunityKey(userId),
    queryFn: () => listCorporateOpportunities(userId!),
    enabled: enabled && !!userId,
    staleTime: 15_000,
    retry: false,
  });

  const saveMutation = useMutation({
    mutationFn: (input: SaveOpportunityArgs) => {
      if (!userId) throw new Error('Missing authenticated user.');
      const { id, ...payload } = input;
      return id
        ? updateCorporateOpportunity(userId, id, payload)
        : createCorporateOpportunity(userId, payload);
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: opportunityKey(userId) });
    },
  });

  return {
    items: query.data?.items ?? [],
    history: query.data?.history ?? [],
    isLoading: query.isLoading,
    queryError: query.error,
    saveError: saveMutation.error,
    isSaving: saveMutation.isPending,
    save: saveMutation.mutateAsync,
    clearSaveError: saveMutation.reset,
    refetch: query.refetch,
  };
}
