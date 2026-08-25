// Etkinlik alanının yoğunluk (kalabalık) hesaplama/görselleştirme mantığı.
//
// ÖNCEDEN: her bölgenin (Zone A/B/C/D) KENDİ merkez GPS noktası + yarıçapı
// vardı — admin'in 4 ayrı geofence kurması gerekiyordu (bkz. eski
// supabase_zone_geofence_migration.sql, `computeLiveZoneOccupancy`/
// `ZoneCircle`). Kullanıcı bunu "etkinlik alanının koordinatları her
// etkinlikte değişiyor, admin TEK bir merkezi ayarlayabilsin, gerekirse
// kendi bulunduğu konumu kullansın" isteğiyle basitleştirdi: artık TEK bir
// `EventSettings.venueCenterLat/venueCenterLng/venueRadiusMeters` var (bkz.
// types/admin.ts, AdminMapManagement.tsx > VenueCenterModal). Zone (A/B/C/D)
// ataması zaten krokideki çeyreğe göre otomatik belirleniyor (bkz.
// lib/boothGrid.ts > zoneForPercent) — GPS'ten bağımsız. Bu dosya artık gerçek
// yoğunluk hesaplamasını (kişi konumlarının bu TEK merkeze göre krokideki
// yaklaşık x/y yüzdesine çevrilmesi + ısı haritası hücrelerine gruplanması)
// Postgres tarafında yapıyor (bkz. supabase_venue_center_migration.sql >
// get_live_density_grid — sebebi: normal katılımcılar RLS gereği başka
// kullanıcıların ham konumunu okuyamıyor, sadece admin okuyabiliyor; bu
// yüzden gruplama sunucu tarafında, SECURITY DEFINER bir fonksiyonla
// yapılıp sadece ÖZETLENMİŞ hücre sayıları istemciye dönüyor — bkz.
// lib/useLiveDensity.ts). Bu dosyadaki fonksiyonlar o özetlenmiş hücreleri
// krokideki bir "ısı lekesi" görselleştirmesine çeviren SAF (yan etkisiz)
// yardımcılardır.

// Isı haritası için kullanılan ızgara — krokinin duvar-çizimi ızgarasından
// (bkz. lib/floorPlanGrid.ts > GRID_COLS/GRID_ROWS, 16x28) bilinçli olarak
// FARKLI ve daha KABA: tek tek kişi sayısını anlamlı gruplamak için çok ince
// bir ızgara gürültülü olurdu. Oran (8:14 = 4:7) krokinin dikey (16:28)
// oranıyla birebir aynı tutuldu ki ısı lekeleri krokide yamulmasın.
export const HEATMAP_GRID_COLS = 8;
export const HEATMAP_GRID_ROWS = 14;

// Bir kullanıcının konumunu "şu an neredeyim" için anlamlı saymamız gereken
// pencere: bundan daha eski ping'ler, kişi etkinlik alanından ayrılmış olabilir
// diye sayıma dahil edilmez. `get_live_density_grid` RPC'sinin varsayılan
// penceresiyle (bkz. supabase_venue_center_migration.sql) aynı süreyi tutar.
export const LIVE_WINDOW_MS = 5 * 60 * 1000;

// Sunucudan (get_live_density_grid RPC) dönen, ısı haritası ızgarasındaki
// TEK bir hücre — sadece o hücrede son 5 dakika içinde ping atmış benzersiz
// kullanıcı sayısını taşır, hiçbir ham konum/kimlik bilgisi içermez.
export type DensityGridCell = {
  cellX: number;
  cellY: number;
  count: number;
};

// Krokide çizilecek TEK bir yumuşak ısı lekesi — yüzde (0-100) koordinatında
// merkez noktası + 0-1 arası bağıl yoğunluk (en kalabalık hücreye göre
// normalize edilmiş; en kalabalık hücre her zaman 1'e denk gelir).
export type HeatBlob = {
  x: number;
  y: number;
  intensity: number;
};

// Ham hücre sayılarını krokide render edilecek ısı lekelerine çevirir. Boş
// (count=0) hücreler atlanır — sadece dolu hücreler için bir leke üretilir.
// Yoğunluk, dönen hücreler arasındaki EN KALABALIK hücreye göre bağıl olarak
// hesaplanır (mutlak bir "kapasite" sabiti yok) — bu yüzden az sayıda kişi
// olsa bile en yoğun nokta her zaman kırmızıya yakın görünür.
export function heatBlobsFromGrid(
  cells: DensityGridCell[],
  gridCols: number = HEATMAP_GRID_COLS,
  gridRows: number = HEATMAP_GRID_ROWS,
): HeatBlob[] {
  const occupied = cells.filter((cell) => cell.count > 0);
  if (!occupied.length) return [];
  const maxCount = Math.max(...occupied.map((cell) => cell.count));
  const stepX = 100 / gridCols;
  const stepY = 100 / gridRows;
  return occupied.map((cell) => ({
    x: (cell.cellX + 0.5) * stepX,
    y: (cell.cellY + 0.5) * stepY,
    intensity: maxCount > 0 ? cell.count / maxCount : 0,
  }));
}

// Yoğunluk rengi: yeşil (az yoğun) → sarı → kırmızı (çok yoğun) — kullanıcının
// istediği "yoğun yerler kırmızı, az yoğun yerler yeşil" renk kodlaması.
// 0 ile 0.5 arası yeşilden sarıya, 0.5 ile 1 arası sarıdan kırmızıya
// düz (lineer) bir geçiş.
export function densityColor(intensity: number): string {
  const t = Math.max(0, Math.min(1, intensity));
  const stops: [number, [number, number, number]][] = [
    [0, [34, 197, 94]], // yeşil #22c55e
    [0.5, [245, 158, 11]], // amber #f59e0b
    [1, [239, 68, 68]], // kırmızı #ef4444
  ];
  let lower = stops[0];
  let upper = stops[stops.length - 1];
  for (let i = 0; i < stops.length - 1; i++) {
    if (t >= stops[i][0] && t <= stops[i + 1][0]) {
      lower = stops[i];
      upper = stops[i + 1];
      break;
    }
  }
  const span = upper[0] - lower[0] || 1;
  const localT = (t - lower[0]) / span;
  const mix = (a: number, b: number) => Math.round(a + (b - a) * localT);
  const [r, g, b] = [
    mix(lower[1][0], upper[1][0]),
    mix(lower[1][1], upper[1][1]),
    mix(lower[1][2], upper[1][2]),
  ];
  return `rgb(${r}, ${g}, ${b})`;
}
