import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { supabase } from './supabase';
import type { WaterStation, WaterStationStatus } from '../types';

// Paylaşılan durum -> çeviri anahtarı eşlemesi (app/(tabs)/map.tsx ve
// app/(tabs)/staff.tsx aynı anahtarları kullanır).
export const WATER_STATION_STATUS_LABEL_KEY: Record<WaterStationStatus, string> = {
  active: 'waterStations.statusActive',
  reported_empty: 'waterStations.statusReportedEmpty',
  dispatched: 'waterStations.statusDispatched',
  resolved: 'waterStations.statusResolved',
};

async function fetchWaterStations(): Promise<WaterStation[]> {
  const { data, error } = await supabase.from('water_stations').select('*').order('name');
  if (error) throw error;
  return (data ?? []) as WaterStation[];
}

export function useWaterStations() {
  return useQuery({
    queryKey: ['water_stations'],
    queryFn: fetchWaterStations,
    staleTime: 15_000,
  });
}

function useInvalidateWaterStations() {
  const queryClient = useQueryClient();
  return () => queryClient.invalidateQueries({ queryKey: ['water_stations'] });
}

// Görevli veya admin haritada bir su istasyonuna dokunup "Su Bitti" der.
export function useReportWaterStationEmpty() {
  const invalidate = useInvalidateWaterStations();
  return useMutation({
    mutationFn: async (stationId: string) => {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) throw new Error('Oturum bulunamadı.');
      const result = await supabase
        .from('water_stations')
        .update({ status: 'reported_empty', reported_by: user.id, reported_at: new Date().toISOString() })
        .eq('id', stationId);
      if (result.error) throw result.error;
    },
    onSuccess: invalidate,
  });
}

// Admin (ya da görevli) su talebini "Yola Çıktı" / "Tamamlandı" ile ilerletir.
export function useAdvanceWaterStationStatus() {
  const invalidate = useInvalidateWaterStations();
  return useMutation({
    mutationFn: async ({ stationId, status }: { stationId: string; status: WaterStationStatus }) => {
      const payload: Record<string, unknown> = { status };
      if (status === 'resolved') payload.resolved_at = new Date().toISOString();
      const result = await supabase.from('water_stations').update(payload).eq('id', stationId);
      if (result.error) throw result.error;
    },
    onSuccess: invalidate,
  });
}

// Admin: örnek su istasyonu ekleme (haritaya benzer x/y koordinat girişi).
export function useCreateWaterStation() {
  const invalidate = useInvalidateWaterStations();
  return useMutation({
    mutationFn: async (input: { name: string; mapX: number; mapY: number; zoneId?: string | null }) => {
      const result = await supabase.from('water_stations').insert({
        name: input.name,
        map_x: input.mapX,
        map_y: input.mapY,
        zone_id: input.zoneId ?? null,
        status: 'active',
      });
      if (result.error) throw result.error;
    },
    onSuccess: invalidate,
  });
}

// Admin, Harita Yönetimi ekranındaki krokide bir su sebili etiketini
// sürükleyip bıraktığında konumunu günceller (bkz. AdminMapManagement.tsx >
// DraggablePin) — stant/sahne sürüklemesiyle (placeBooth/updateStagePosition)
// birebir aynı desen. Su sebilinin adı artık "Su İstasyonları" sekmesinde
// olduğu gibi sabit merkezde kalmıyor, admin krokide istediği yere taşıyabilir.
export function useUpdateWaterStationPosition() {
  const invalidate = useInvalidateWaterStations();
  return useMutation({
    mutationFn: async ({ stationId, mapX, mapY }: { stationId: string; mapX: number; mapY: number }) => {
      const result = await supabase.from('water_stations').update({ map_x: mapX, map_y: mapY }).eq('id', stationId);
      if (result.error) throw result.error;
    },
    onSuccess: invalidate,
  });
}

export function useDeleteWaterStation() {
  const invalidate = useInvalidateWaterStations();
  return useMutation({
    mutationFn: async (stationId: string) => {
      const result = await supabase.from('water_stations').delete().eq('id', stationId);
      if (result.error) throw result.error;
    },
    onSuccess: invalidate,
  });
}
