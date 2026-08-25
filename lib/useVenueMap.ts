// Katılımcı tarafındaki (girişimci/yatırımcı/kurum/ziyaretçi) Harita
// ekranının okuma-amaçlı veri kaynağı. Admin panelinin Harita Yönetimi
// ekranıyla (lib/adminRepository.ts) AYNI Supabase tablolarını (`stands`,
// `stages`, `event_settings`) okur, böylece katılımcı her zaman adminin
// gerçekten ayarladığı krokiyi ve stant/sahne konumlarını görür — ayrı bir
// mock veri seti yok. Sadece OKUMA yapıyor (yazma yok), bu yüzden admin'in
// zustand store'u (`useAdminStore`) yerine diğer katılımcı hook'larıyla
// (bkz. useOtherProfiles.ts) aynı, hafif react-query deseni kullanılıyor.
//
// Zone (A/B/C/D) bilgisi, `zones` tablosuna hiç bakmadan doğrudan
// `zoneForPercent(mapX, mapY)` ile konumdan türetiliyor — admin tarafı da
// bir stant/sahneyi kaydederken zone'u zaten aynı fonksiyonla hesaplayıp
// yazdığı için (bkz. adminRepository.placeBooth/updateStagePosition), bu
// ikisi konum değiştikçe otomatik olarak tutarlı kalıyor.

import { useQuery } from '@tanstack/react-query';

import { zoneForPercent } from './boothGrid';
import { supabase } from './supabase';
import type { AdminBooth, AdminStage, FloorPlanWall } from '../types/admin';

type Row = Record<string, any>;

export type VenueMapData = {
  booths: AdminBooth[];
  stages: AdminStage[];
  floorPlanUrl?: string;
  // Admin'in krokiye elle çizdiği duvar çizgileri — rota bulma (bkz.
  // lib/routePlanner.ts) bunları da birer engel sayıyor.
  floorPlanWalls: FloorPlanWall[];
  // Etkinlik alanının tek merkez GPS noktası — admin ayarlamadıysa null, bu
  // durumda katılımcı haritasında yoğunluk ısı haritası GÖSTERİLMEZ (bkz.
  // app/(tabs)/map.tsx, lib/useLiveDensity.ts).
  venueCenterLat: number | null;
  venueCenterLng: number | null;
  // "Şu anki Konumumu Kullan" (rota bulma > başlangıç) hesaplaması için
  // gereken yarıçap — bkz. lib/zoneDensity.ts > gpsToMapPercent.
  venueRadiusMeters: number;
};

function mapBoothRow(row: Row): AdminBooth {
  const mapX = Number(row.map_x ?? row.lng ?? 50);
  const mapY = Number(row.map_y ?? row.lat ?? 50);
  return {
    id: row.id,
    boothNo: row.booth_no || '',
    companyName: row.company_name || row.name,
    category: (row.category || row.type || 'Yapay Zeka') as AdminBooth['category'],
    description: row.description || '',
    logo: row.logo_url || '',
    // zone_id null ise (henüz krokiye yerleştirilmemiş) zone de null kalmalı
    // — bkz. lib/boothGrid.ts > isBoothPlaced.
    zone: row.zone_id ? zoneForPercent(mapX, mapY) : null,
    sponsorTier: (row.sponsor_tier || row.sponsor || 'Startup') as AdminBooth['sponsorTier'],
    mapX,
    mapY,
    status: (row.status || 'active') as AdminBooth['status'],
    contactPerson: row.contact_person || '',
    contactEmail: row.contact_email || '',
    qrCodeUrl: row.qr_code_url || undefined,
    totalVisits: Number(row.total_visits || 0),
  };
}

function mapStageRow(row: Row): AdminStage {
  const mapX = Number(row.map_x ?? 50);
  const mapY = Number(row.map_y ?? 50);
  return {
    id: row.id,
    name: row.name,
    type: (row.type || 'Diğer') as AdminStage['type'],
    // zone_id null ise (henüz krokiye yerleştirilmemiş) zone de null kalmalı
    // — bkz. lib/boothGrid.ts > isStagePlaced. Katılımcı ekranı henüz
    // yerleştirilmemiş alanları hiç göstermemeli (bkz. app/(tabs)/map.tsx).
    zone: row.zone_id ? zoneForPercent(mapX, mapY) : null,
    capacity: Number(row.capacity || 0),
    currentOccupancy: Number(row.current_occupancy || 0),
    mapX,
    mapY,
    status: (row.status || 'active') as AdminStage['status'],
    currentSessionId: row.current_session_id || undefined,
    description: row.description || '',
  };
}

async function fetchVenueMap(): Promise<VenueMapData> {
  const [stageResult, standResult, settingsResult] = await Promise.all([
    supabase.from('stages').select('*').order('name'),
    supabase.from('stands').select('*').order('name'),
    // select('*') kullanıyoruz ki `floor_plan_walls` migration'ı henüz
    // çalıştırılmamışsa bile sorgu patlamasın (kolon yoksa aşağıda zaten []
    // varsayılıyor) — bkz. supabase_floor_plan_walls_migration.sql.
    supabase.from('event_settings').select('*').limit(1),
  ]);
  if (stageResult.error) throw stageResult.error;
  if (standResult.error) throw standResult.error;
  if (settingsResult.error) throw settingsResult.error;

  const stages = ((stageResult.data || []) as Row[]).map(mapStageRow);
  const booths = ((standResult.data || []) as Row[]).map(mapBoothRow);
  const settingsRow = (settingsResult.data || [])[0] as Row | undefined;
  const floorPlanUrl = settingsRow?.floor_plan_url || undefined;
  const floorPlanWalls = (Array.isArray(settingsRow?.floor_plan_walls) ? settingsRow!.floor_plan_walls : []) as FloorPlanWall[];
  const venueCenterLat = settingsRow?.venue_center_lat != null ? Number(settingsRow.venue_center_lat) : null;
  const venueCenterLng = settingsRow?.venue_center_lng != null ? Number(settingsRow.venue_center_lng) : null;
  const venueRadiusMeters = settingsRow?.venue_radius_meters ? Number(settingsRow.venue_radius_meters) : 150;

  return { booths, stages, floorPlanUrl, floorPlanWalls, venueCenterLat, venueCenterLng, venueRadiusMeters };
}

export function useVenueMap() {
  return useQuery({
    queryKey: ['venue-map'],
    queryFn: fetchVenueMap,
    staleTime: 30_000,
  });
}
