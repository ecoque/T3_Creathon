import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { supabase } from './supabase';
import { useCurrentProfile } from './useCurrentProfile';
import type { Profile, StaffAssignment, Zone } from '../types';

export type StaffAssignmentWithDetails = StaffAssignment & {
  entrepreneurProfile: Profile | null;
  zone: Zone | null;
};

async function hydrateAssignments(rows: StaffAssignment[]): Promise<StaffAssignmentWithDetails[]> {
  const profileIds = Array.from(new Set(rows.map((row) => row.entrepreneur_profile_id)));
  const zoneIds = Array.from(new Set(rows.map((row) => row.zone_id).filter(Boolean))) as string[];

  const [profileResult, zoneResult] = await Promise.all([
    profileIds.length
      ? supabase.from('profiles').select('*').in('id', profileIds)
      : Promise.resolve({ data: [], error: null } as const),
    zoneIds.length
      ? supabase.from('zones').select('*').in('id', zoneIds)
      : Promise.resolve({ data: [], error: null } as const),
  ]);
  if (profileResult.error) throw profileResult.error;
  if (zoneResult.error) throw zoneResult.error;

  const profileById = new Map(((profileResult.data ?? []) as Profile[]).map((p) => [p.id, p]));
  const zoneById = new Map(((zoneResult.data ?? []) as Zone[]).map((z) => [z.id, z]));

  return rows.map((row) => ({
    ...row,
    entrepreneurProfile: profileById.get(row.entrepreneur_profile_id) ?? null,
    zone: row.zone_id ? zoneById.get(row.zone_id) ?? null : null,
  }));
}

// Görevli sekmesi: giriş yapmış görevlinin sorumlu olduğu girişimciler/zonlar.
async function fetchMyStaffAssignments(staffUserId: string): Promise<StaffAssignmentWithDetails[]> {
  const { data, error } = await supabase
    .from('staff_assignments')
    .select('*')
    .eq('staff_user_id', staffUserId)
    .order('created_at', { ascending: true });
  if (error) throw error;
  return hydrateAssignments((data ?? []) as StaffAssignment[]);
}

export function useMyStaffAssignments() {
  const { data: meResult } = useCurrentProfile();
  const userId = meResult?.userId;
  return useQuery({
    queryKey: ['staff_assignments', 'mine', userId],
    queryFn: () => fetchMyStaffAssignments(userId as string),
    enabled: !!userId,
    staleTime: 30_000,
  });
}

// Admin: tüm görevli atamaları (tek bir görevliye ait tüm satırlar dahil, o
// görevlinin kendi ekranında filtrelenerek gösterilir).
async function fetchAllStaffAssignments(): Promise<StaffAssignmentWithDetails[]> {
  const { data, error } = await supabase
    .from('staff_assignments')
    .select('*')
    .order('created_at', { ascending: true });
  if (error) throw error;
  return hydrateAssignments((data ?? []) as StaffAssignment[]);
}

export function useAllStaffAssignments() {
  return useQuery({
    queryKey: ['staff_assignments', 'all'],
    queryFn: fetchAllStaffAssignments,
    staleTime: 15_000,
  });
}

function useInvalidateStaffAssignments() {
  const queryClient = useQueryClient();
  return () => queryClient.invalidateQueries({ queryKey: ['staff_assignments'] });
}

export function useCreateStaffAssignment() {
  const invalidate = useInvalidateStaffAssignments();
  return useMutation({
    mutationFn: async (input: { staffUserId: string; entrepreneurProfileId: string; zoneId?: string | null }) => {
      const result = await supabase.from('staff_assignments').upsert(
        {
          staff_user_id: input.staffUserId,
          entrepreneur_profile_id: input.entrepreneurProfileId,
          zone_id: input.zoneId ?? null,
        },
        { onConflict: 'staff_user_id,entrepreneur_profile_id' },
      );
      if (result.error) throw result.error;
    },
    onSuccess: invalidate,
  });
}

// Admin: rolü 'gorevli' olan profiller (atama yapılabilecek görevliler) ve
// rolü 'girisimci' olan profiller (bir görevliye atanabilecek girişimciler).
async function fetchProfilesByRole(role: string): Promise<Profile[]> {
  const { data, error } = await supabase.from('profiles').select('*').eq('role', role).order('full_name');
  if (error) throw error;
  return (data ?? []) as Profile[];
}

export function useStaffMembers() {
  return useQuery({
    queryKey: ['profiles', 'role', 'gorevli'],
    queryFn: () => fetchProfilesByRole('gorevli'),
    staleTime: 15_000,
  });
}

export function useEntrepreneurProfiles() {
  return useQuery({
    queryKey: ['profiles', 'role', 'girisimci'],
    queryFn: () => fetchProfilesByRole('girisimci'),
    staleTime: 15_000,
  });
}

export function useDeleteStaffAssignment() {
  const invalidate = useInvalidateStaffAssignments();
  return useMutation({
    mutationFn: async (id: string) => {
      const result = await supabase.from('staff_assignments').delete().eq('id', id);
      if (result.error) throw result.error;
    },
    onSuccess: invalidate,
  });
}
