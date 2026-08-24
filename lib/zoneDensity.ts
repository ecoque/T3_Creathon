// Bölge (zone) tanımları artık poligon köşe noktaları yerine daha basit bir
// modelle çalışıyor: bir merkez GPS noktası + metre cinsinden yarıçap. Bu dosya,
// location_pings tablosundaki gerçek konum verisini bu dairesel bölgelerle
// eşleştirip "şu an kaç kişi bu bölgede" sayısını hesaplayan saf fonksiyonları
// içerir — hiçbir yan etkisi yok, test edilmesi kolay.

export type LivePing = {
  user_id: string;
  lat: number;
  lng: number;
  timestamp: string;
};

export type ZoneCircle = {
  id: string;
  centerLat: number | null;
  centerLng: number | null;
  radiusMeters: number;
};

// Bir kullanıcının konumunu "şu an neredeyim" için anlamlı saymamız gereken
// pencere: bundan daha eski ping'ler, kişi etkinlik alanından ayrılmış olabilir
// diye sayıma dahil edilmez.
export const LIVE_WINDOW_MS = 5 * 60 * 1000;

// Haversine formülü: iki GPS noktası arasındaki mesafeyi metre cinsinden verir.
export function distanceMeters(aLat: number, aLng: number, bLat: number, bLng: number): number {
  const EARTH_RADIUS_M = 6371000;
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const dLat = toRad(bLat - aLat);
  const dLng = toRad(bLng - aLng);
  const lat1 = toRad(aLat);
  const lat2 = toRad(bLat);
  const sinDLat = Math.sin(dLat / 2);
  const sinDLng = Math.sin(dLng / 2);
  const a = sinDLat * sinDLat + Math.cos(lat1) * Math.cos(lat2) * sinDLng * sinDLng;
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return EARTH_RADIUS_M * c;
}

// Aynı kullanıcıdan pencere içinde birden fazla ping gelmiş olabilir; sadece en
// güncel konumu "şu an neredeyim" sorusu için anlamlıdır.
function latestPingPerUser(pings: LivePing[]): LivePing[] {
  const byUser = new Map<string, LivePing>();
  for (const ping of pings) {
    const existing = byUser.get(ping.user_id);
    if (!existing || new Date(ping.timestamp).getTime() > new Date(existing.timestamp).getTime()) {
      byUser.set(ping.user_id, ping);
    }
  }
  return Array.from(byUser.values());
}

// Her bölge için, merkeze yarıçap içinde bulunan benzersiz kullanıcı sayısını
// döndürür. Bir kullanıcı birden fazla bölgeye denk gelirse (iç içe geçmiş
// yarıçaplar), listede önce gelen bölgeye sayılır.
export function computeLiveZoneOccupancy(zones: ZoneCircle[], pings: LivePing[]): Map<string, number> {
  const latest = latestPingPerUser(pings);
  const counts = new Map<string, number>();
  for (const zone of zones) counts.set(zone.id, 0);

  for (const ping of latest) {
    for (const zone of zones) {
      if (zone.centerLat == null || zone.centerLng == null) continue;
      const distance = distanceMeters(ping.lat, ping.lng, zone.centerLat, zone.centerLng);
      if (distance <= zone.radiusMeters) {
        counts.set(zone.id, (counts.get(zone.id) || 0) + 1);
        break;
      }
    }
  }
  return counts;
}
