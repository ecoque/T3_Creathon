// Üç noktalı ("afin") harita kalibrasyonu — bkz.
// supabase_venue_calibration_migration.sql için gerekçe. Bu dosya, admin'in
// TEK merkez noktasına (lib/zoneDensity.ts > gpsToMapPercent'in bugüne kadar
// kullandığı tek referans) ek olarak EN FAZLA 2 nokta daha biliniyorsa, GPS
// <-> kroki-yüzde dönüşümünü basit "kare + kuzey-yukarı" varsayımından tam
// bir 2B AFİN dönüşüme (öteleme + x/y'de bağımsız ölçek + gerçek dönüklük)
// yükseltiyor.
//
// Matematik: merkezi (kroki 50,50 <-> gerçek merkez lat/lng) sabit ORİJİN
// kabul edersek, geriye kalan 2 nokta için sadece 2x2'lik bir doğrusal
// sistem çözmek yeterli oluyor (merkez zaten (0,0)'a denk geldiği için
// öteleme terimi otomatik sıfırlanıyor) — 3x3'lük genel bir afin çözümünden
// çok daha basit, dışa bağımlılık gerektirmiyor.
//
// ÖNEMLİ SINIR: bu kalibrasyon SİSTEMATİK hataları (yanlış ölçek, yanlış
// dönüklük, tek-merkezin kendi konum hatası) düzeltir — ama her bir GPS
// okumasının kendi ANLIK gürültüsünü (bina içi sinyal yansımasından
// kaynaklanan 10-30 metrelik sapmalar) ortadan kaldırmaz, çünkü kalibrasyon
// noktalarının kendi GPS okuması da aynı gürültüden muzdarip. Bunu azaltmak
// için her noktanın GPS'i (özellikle check-in'den türetilenler) birden fazla
// örneğin ortalaması olarak alınıyor (bkz. supabase_venue_calibration_migration.sql
// > get_calibration_candidates, accuracy'ye göre filtreleme).

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useMemo } from 'react';

import { supabase } from './supabase';
import { gpsToMapPercent } from './zoneDensity';

const METERS_PER_DEGREE = 111320;

export type CalibrationPointSource = 'manual' | 'checkin_derived';

// `venue_calibration_points` tablosundaki, admin tarafından ONAYLANMIŞ bir
// kalibrasyon noktası.
export type CalibrationPoint = {
  id: string;
  mapX: number;
  mapY: number;
  lat: number;
  lng: number;
  source: CalibrationPointSource;
  label: string | null;
  accuracyM: number | null;
  sampleCount: number;
  createdAt: string;
};

// `get_calibration_candidates` RPC'sinden gelen, HENÜZ onaylanmamış aday —
// admin panelinde listelenip admin "ekle" demeden hiçbir yere kaydedilmiyor.
export type CalibrationCandidate = {
  targetType: 'session' | 'stand';
  targetId: string;
  label: string;
  mapX: number;
  mapY: number;
  lat: number;
  lng: number;
  accuracyM: number | null;
  sampleCount: number;
};

// Merkeze göre yerel doğu/kuzey (metre) <-> kroki-yüzde ofseti arasındaki
// afin dönüşüm. `gpsToMapPercent`teki (bkz. lib/zoneDensity.ts) tek-ölçekli
// projeksiyonun YERİNE, en az 2 ek nokta biliniyorsa kullanılıyor.
export type AffineTransform = {
  // east = a*dx + b*dy ; north = c*dx + d*dy  (dx = mapX-50, dy = mapY-50)
  a: number;
  b: number;
  c: number;
  d: number;
  centerLat: number;
  centerLng: number;
};

function localOffsetMeters(lat: number, lng: number, centerLat: number, centerLng: number) {
  // gpsToMapPercent ile BİREBİR aynı equirectangular yaklaşıklık — iki nokta
  // arasındaki tutarlılık için kasıtlı olarak aynı formül kullanılıyor.
  const north = (lat - centerLat) * METERS_PER_DEGREE;
  const east = (lng - centerLng) * METERS_PER_DEGREE * Math.cos((centerLat * Math.PI) / 180);
  return { east, north };
}

function localOffsetToGps(east: number, north: number, centerLat: number, centerLng: number) {
  const lat = centerLat + north / METERS_PER_DEGREE;
  const lng = centerLng + east / (METERS_PER_DEGREE * Math.cos((centerLat * Math.PI) / 180));
  return { lat, lng };
}

// Determinant sıfıra çok yakınsa (merkez + 2 nokta neredeyse aynı doğru
// üzerinde, ya da noktalardan biri merkeze aşırı yakın) dönüşüm sayısal
// olarak kararsız olur — bu durumda null dönüp çağıran tarafın eski
// tek-merkezli yönteme geri düşmesi bekleniyor (bkz. useVenueTransform).
const MIN_DETERMINANT = 1e-6;

// pointA / pointB: merkez DIŞINDAKİ 2 kalibrasyon noktası. Merkezin kendisi
// ayrı bir parametre olarak lat/lng ile veriliyor (kroki-yüzdesi zaten sabit
// 50,50 kabul ediliyor, bkz. dosya başı).
export function computeAffineTransform(
  centerLat: number,
  centerLng: number,
  pointA: { mapX: number; mapY: number; lat: number; lng: number },
  pointB: { mapX: number; mapY: number; lat: number; lng: number },
): AffineTransform | null {
  const dx1 = pointA.mapX - 50;
  const dy1 = pointA.mapY - 50;
  const dx2 = pointB.mapX - 50;
  const dy2 = pointB.mapY - 50;

  const determinant = dx1 * dy2 - dx2 * dy1;
  if (!Number.isFinite(determinant) || Math.abs(determinant) < MIN_DETERMINANT) return null;

  const offsetA = localOffsetMeters(pointA.lat, pointA.lng, centerLat, centerLng);
  const offsetB = localOffsetMeters(pointB.lat, pointB.lng, centerLat, centerLng);

  // [e1,e2] = M * [dx1,dx2; dy1,dy2] gibi düşünülürse: a,b katsayıları
  // e1 = a*dx1 + b*dy1 ve e2 = a*dx2 + b*dy2 denklemlerinin Cramer kuralıyla
  // çözümü. c,d için de aynı katsayı matrisiyle, sağ taraf north değerleri.
  const a = (offsetA.east * dy2 - offsetB.east * dy1) / determinant;
  const b = (dx1 * offsetB.east - dx2 * offsetA.east) / determinant;
  const c = (offsetA.north * dy2 - offsetB.north * dy1) / determinant;
  const d = (dx1 * offsetB.north - dx2 * offsetA.north) / determinant;

  if (![a, b, c, d].every(Number.isFinite)) return null;
  return { a, b, c, d, centerLat, centerLng };
}

// GPS -> kroki yüzde konumu (afin dönüşümle). M matrisinin tersini alıp
// (east,north)'tan (dx,dy)'ye dönüyoruz.
export function gpsToMapPercentAffine(lat: number, lng: number, transform: AffineTransform): { x: number; y: number } | null {
  const { a, b, c, d, centerLat, centerLng } = transform;
  const determinant = a * d - b * c;
  if (!Number.isFinite(determinant) || Math.abs(determinant) < MIN_DETERMINANT) return null;

  const { east, north } = localOffsetMeters(lat, lng, centerLat, centerLng);
  const dx = (d * east - b * north) / determinant;
  const dy = (a * north - c * east) / determinant;

  return {
    x: Math.max(0, Math.min(100, 50 + dx)),
    y: Math.max(0, Math.min(100, 50 + dy)),
  };
}

// Ters yön: kroki yüzde konumu -> GPS (afin dönüşümle). Admin'in yeni bir
// kalibrasyon noktası eklerken/gözden geçirirken "bu kroki noktası gerçekte
// yaklaşık nereye denk geliyor" diye tahmin göstermek gibi ek kullanımlar
// için de uygun; şu an aktif olarak sadece test/gelecekteki genişletmeler
// için dışa aktarılıyor.
export function mapPercentToGpsAffine(mapX: number, mapY: number, transform: AffineTransform): { lat: number; lng: number } {
  const { a, b, c, d, centerLat, centerLng } = transform;
  const dx = mapX - 50;
  const dy = mapY - 50;
  const east = a * dx + b * dy;
  const north = c * dx + d * dy;
  return localOffsetToGps(east, north, centerLat, centerLng);
}

// Merkezle birlikte bir ÜÇGEN oluşturan aday/nokta çiftleri arasından, bu
// üçgenin alanını en büyükleyen çifti seçer — determinant'ın (yukarıdaki
// computeAffineTransform'daki) büyüklüğü doğrudan bu alanla orantılı olduğu
// için, bu seçim aynı zamanda dönüşümü SAYISAL OLARAK EN KARARLI yapan
// çifti seçmek anlamına geliyor (merkeze çok yakın ya da birbirleriyle
// merkez üzerinden aynı doğruda olan noktalar otomatik elenmiş oluyor).
export function pickBestCalibrationPair<T extends { mapX: number; mapY: number }>(points: T[]): [T, T] | null {
  if (points.length < 2) return null;
  let best: [T, T] | null = null;
  let bestArea = -1;
  for (let i = 0; i < points.length; i++) {
    for (let j = i + 1; j < points.length; j++) {
      const dx1 = points[i].mapX - 50;
      const dy1 = points[i].mapY - 50;
      const dx2 = points[j].mapX - 50;
      const dy2 = points[j].mapY - 50;
      const area = Math.abs(dx1 * dy2 - dx2 * dy1);
      if (area > bestArea) {
        bestArea = area;
        best = [points[i], points[j]];
      }
    }
  }
  return bestArea > 0 ? best : null;
}

// ── Supabase erişimi ────────────────────────────────────────────────

type Row = Record<string, any>;

function mapCalibrationPointRow(row: Row): CalibrationPoint {
  return {
    id: row.id,
    mapX: Number(row.map_x),
    mapY: Number(row.map_y),
    lat: Number(row.lat),
    lng: Number(row.lng),
    source: (row.source || 'manual') as CalibrationPointSource,
    label: row.label ?? null,
    accuracyM: row.accuracy_m != null ? Number(row.accuracy_m) : null,
    sampleCount: Number(row.sample_count || 1),
    createdAt: row.created_at,
  };
}

async function fetchCalibrationPoints(): Promise<CalibrationPoint[]> {
  const { data, error } = await supabase
    .from('venue_calibration_points')
    .select('*')
    .order('created_at', { ascending: true });
  // Migration henüz çalıştırılmadıysa tablo yok — sessizce boş dön, geri
  // kalan her şey (tek-merkezli eski yöntem) normal çalışmaya devam etsin
  // (bkz. supabase_venue_center_migration.sql'deki aynı desen).
  if (error) return [];
  return ((data || []) as Row[]).map(mapCalibrationPointRow);
}

// Hem admin paneli (kalibrasyon yönetimi) hem katılımcı haritası (GPS
// dönüşümü için, bkz. app/(tabs)/map.tsx) bu hook'u kullanıyor.
export function useCalibrationPoints() {
  return useQuery({
    queryKey: ['venue_calibration_points'],
    queryFn: fetchCalibrationPoints,
    staleTime: 30_000,
  });
}

async function fetchCalibrationCandidates(): Promise<CalibrationCandidate[]> {
  const result = await supabase.rpc('get_calibration_candidates');
  // RPC henüz oluşturulmamışsa (migration çalıştırılmadıysa) ya da çağıran
  // admin değilse (fonksiyon içi is_admin() kontrolü) sessizce boş dön.
  if (result.error) return [];
  return ((result.data || []) as Row[]).map((row) => ({
    targetType: row.target_type,
    targetId: row.target_id,
    label: row.label || (row.target_type === 'stand' ? 'Stant' : 'Oturum'),
    mapX: Number(row.map_x),
    mapY: Number(row.map_y),
    lat: Number(row.lat),
    lng: Number(row.lng),
    accuracyM: row.accuracy_m != null ? Number(row.accuracy_m) : null,
    sampleCount: Number(row.sample_count || 1),
  }));
}

// Sadece admin panelinde kullanılıyor — check-in'lerden otomatik türetilen
// aday kalibrasyon noktalarını listeler (henüz hiçbir yere kaydedilmemiş,
// bkz. dosya başındaki CalibrationCandidate açıklaması).
export function useCalibrationCandidates() {
  return useQuery({
    queryKey: ['venue_calibration_candidates'],
    queryFn: fetchCalibrationCandidates,
    staleTime: 30_000,
  });
}

function useInvalidateCalibrationPoints() {
  const queryClient = useQueryClient();
  return () => queryClient.invalidateQueries({ queryKey: ['venue_calibration_points'] });
}

export type NewCalibrationPointInput = {
  mapX: number;
  mapY: number;
  lat: number;
  lng: number;
  source: CalibrationPointSource;
  label?: string | null;
  accuracyM?: number | null;
  sampleCount?: number;
};

// Hem "admin elle bir noktaya gidip GPS'ini kaydetti" (source: 'manual')
// hem "bir check-in adayı onaylandı" (source: 'checkin_derived') akışı bu
// TEK mutation'ı kullanıyor — ikisi de sonuçta aynı tabloya aynı şekilde
// yazılıyor, farkları sadece verinin nereden geldiği (kayıt amaçlı `source`).
export function useAddCalibrationPoint() {
  const invalidate = useInvalidateCalibrationPoints();
  return useMutation({
    mutationFn: async (input: NewCalibrationPointInput) => {
      const result = await supabase.from('venue_calibration_points').insert({
        map_x: input.mapX,
        map_y: input.mapY,
        lat: input.lat,
        lng: input.lng,
        source: input.source,
        label: input.label ?? null,
        accuracy_m: input.accuracyM ?? null,
        sample_count: input.sampleCount ?? 1,
      });
      if (result.error) throw result.error;
    },
    onSuccess: invalidate,
  });
}

export function useDeleteCalibrationPoint() {
  const invalidate = useInvalidateCalibrationPoints();
  return useMutation({
    mutationFn: async (id: string) => {
      const result = await supabase.from('venue_calibration_points').delete().eq('id', id);
      if (result.error) throw result.error;
    },
    onSuccess: invalidate,
  });
}

// Merkez + onaylanmış kalibrasyon noktalarından, kullanıma hazır bir afin
// dönüşüm türetir. En az 2 onaylı ek nokta yoksa (ya da merkez ayarlı
// değilse, ya da noktalar sayısal olarak kararsızsa) `transform: null` döner
// — çağıran taraf (bkz. projectGpsToMap) bu durumda eski tek-merkezli
// yönteme sorunsuzca geri düşüyor.
export function useVenueTransform(centerLat: number | null | undefined, centerLng: number | null | undefined) {
  const { data: points = [] } = useCalibrationPoints();

  return useMemo(() => {
    if (centerLat == null || centerLng == null || points.length < 2) {
      return { transform: null as AffineTransform | null, pointCount: points.length };
    }
    const pair = pickBestCalibrationPair(points);
    if (!pair) return { transform: null as AffineTransform | null, pointCount: points.length };
    const transform = computeAffineTransform(centerLat, centerLng, pair[0], pair[1]);
    return { transform, pointCount: points.length };
  }, [centerLat, centerLng, points]);
}

// Katılımcı ve admin ekranlarının GPS'i krokiye yerleştirirken çağırması
// gereken TEK fonksiyon: afin dönüşüm varsa (bkz. useVenueTransform) onu
// kullanır, yoksa (kalibrasyon noktası hiç girilmemişse, ya da girilenler
// sayısal olarak kararsızsa) `lib/zoneDensity.ts > gpsToMapPercent`'teki
// eski tek-merkezli/kare-varsayımlı yönteme sorunsuzca geri düşer — hiçbir
// çağıran taraf bu ikisi arasındaki farkı bilmek zorunda değil.
export function projectGpsToMap(
  lat: number,
  lng: number,
  venue: { centerLat: number | null; centerLng: number | null; radiusMeters: number },
  transform: AffineTransform | null,
): { x: number; y: number } | null {
  if (transform) {
    const viaAffine = gpsToMapPercentAffine(lat, lng, transform);
    if (viaAffine) return viaAffine;
  }
  if (venue.centerLat == null || venue.centerLng == null) return null;
  return gpsToMapPercent(lat, lng, venue.centerLat, venue.centerLng, venue.radiusMeters);
}

// Bir rota yolunun (bkz. lib/routePlanner.ts > RoutePoint[], kroki yüzde
// uzayında art arda noktalar) toplam GERÇEK DÜNYA uzunluğunu metre olarak
// hesaplar — "Haritada Gör" ile otomatik kurulan rotanın (bkz.
// app/(tabs)/map.tsx > autoRouteToLocation) mesafe/süre tahmini için.
//
// Afin dönüşüm varsa (bkz. computeAffineTransform) onun SADECE doğrusal
// kısmı (a,b,c,d) kullanılıyor: bu katsayılar merkezden bağımsız olarak HER
// İKİ nokta arasındaki (dx,dy) percent-farkını metreye çeviriyor, çünkü
// dönüşümün öteleme kısmı zaten merkezi 50,50'ye sabitlemek için ayrı
// tutuluyor (bkz. dosya başındaki matematik notu) — yani bu doğrusal
// eşleme kroki üzerindeki HERHANGİ iki nokta arasında da geçerli, sadece
// merkezden ölçülen mesafeler için değil. Afin dönüşüm yoksa,
// `lib/zoneDensity.ts > distanceFromVenueCenterMeters`teki AYNI tek-ölçekli
// varsayım (yüzde farkı / 50 * radiusMeters) her segment için uygulanıyor.
export function routeDistanceMeters(
  path: { x: number; y: number }[],
  radiusMeters: number,
  transform: AffineTransform | null,
): number | null {
  if (path.length < 2) return 0;
  if (!transform && (!radiusMeters || radiusMeters <= 0)) return null;
  let total = 0;
  for (let i = 1; i < path.length; i++) {
    const dx = path[i].x - path[i - 1].x;
    const dy = path[i].y - path[i - 1].y;
    if (transform) {
      const east = transform.a * dx + transform.b * dy;
      const north = transform.c * dx + transform.d * dy;
      total += Math.sqrt(east * east + north * north);
    } else {
      const metersPerPercent = radiusMeters / 50;
      total += Math.sqrt(dx * dx + dy * dy) * metersPerPercent;
    }
  }
  return total;
}
