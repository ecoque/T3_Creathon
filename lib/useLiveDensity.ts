// Krokideki yoğunluk (kalabalık) ısı haritasının CANLI veri kaynağı — hem
// admin Harita Yönetimi ekranında (bkz. AdminMapManagement.tsx) hem katılımcı
// haritasında (bkz. app/(tabs)/map.tsx) AYNI şekilde kullanılıyor.
//
// Neden ayrı bir Postgres RPC'si (`get_live_density_grid`, bkz.
// supabase_venue_center_migration.sql) ve doğrudan `location_pings` tablosu
// DEĞİL: RLS, normal bir katılımcının SADECE KENDİ ham konum kaydını
// okumasına izin veriyor (bkz. supabase_schema.sql > "pings_select_own"),
// başka kullanıcıların ham lat/lng'sini asla göremiyor — bu kasıtlı bir
// gizlilik sınırı. Isı haritası için yine de TÜM kullanıcıların yaklaşık
// konumuna ihtiyaç var; bunu, sunucu tarafında (SECURITY DEFINER, RLS'yi
// atlayan) bir fonksiyonla ÖNCEDEN GRUPLANMIŞ hücre sayılarına indirgeyerek
// çözüyoruz — istemciye hiçbir zaman ham kullanıcı/konum verisi gelmiyor,
// sadece "şu hücrede N kişi var" bilgisi geliyor. Admin zaten tüm ham
// pings'i okuyabiliyor (bkz. lib/adminRepository.ts) ama admin panelinin
// ısı haritası da tutarlılık için aynı RPC'yi kullanıyor.
import { useQuery } from '@tanstack/react-query';

import { supabase } from './supabase';
import { HEATMAP_GRID_COLS, HEATMAP_GRID_ROWS, type DensityGridCell } from './zoneDensity';

type Row = Record<string, any>;

async function fetchLiveDensityGrid(): Promise<DensityGridCell[]> {
  const result = await supabase.rpc('get_live_density_grid', {
    p_grid_cols: HEATMAP_GRID_COLS,
    p_grid_rows: HEATMAP_GRID_ROWS,
  });
  // RPC henüz oluşturulmamışsa (supabase_venue_center_migration.sql
  // çalıştırılmadıysa) hata fırlatmak yerine sessizce boş ızgara döndürüyoruz
  // — ısı haritası o zaman sadece görünmez kalır, ekranın geri kalanı
  // (kroki, pinler, rota bulma) normal çalışmaya devam eder.
  if (result.error) return [];
  return ((result.data || []) as Row[]).map((row) => ({
    cellX: Number(row.cell_x),
    cellY: Number(row.cell_y),
    count: Number(row.cnt),
  }));
}

// 20 saniyede bir yenileniyor — su istasyonu/canlı doluluk gibi diğer "canlı"
// verilerle (bkz. lib/useWaterStations.ts) benzer bir tazelik hedefi, sürekli
// GPS hassasiyetinde anlık bir akış değil.
export function useLiveDensityGrid() {
  return useQuery({
    queryKey: ['live_density_grid'],
    queryFn: fetchLiveDensityGrid,
    staleTime: 15_000,
    refetchInterval: 20_000,
  });
}
