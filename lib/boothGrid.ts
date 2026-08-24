// Stant krokisi: etkinlik alanı görünmez bir çizgiyle dört eşit bölgeye
// ayrılıyor — Zone A (sol üst), Zone B (sağ üst), Zone C (sol alt),
// Zone D (sağ alt). Admin, krokinin (gerçek fotoğraf veya soyut görünüm)
// herhangi bir noktasına serbestçe dokunarak bir standı oraya yerleştirebiliyor
// — kareye takılma yok. Stant numarası, dokunulan noktanın hangi zone'a
// düştüğüne göre otomatik atanıyor (örn. Zone A'daki ilk stant A101,
// sonraki A102, ...).
//
// Bu dosyadaki fonksiyonlar saf (yan etkisi yok) — hiçbir React/Supabase
// bağımlılığı içermiyor, bu yüzden hem UI hem de repository katmanından
// güvenle kullanılabiliyor.

import type { AdminBooth, AdminStage } from '../types/admin';

export const ZONE_ORDER: AdminBooth['zone'][] = ['Zone A', 'Zone B', 'Zone C', 'Zone D'];

export const ZONE_LETTER: Record<AdminBooth['zone'], string> = {
  'Zone A': 'A',
  'Zone B': 'B',
  'Zone C': 'C',
  'Zone D': 'D',
};

// Her zone kendi yüzler basamağından başlıyor: A 101, B 201, C 301, D 401.
export const ZONE_BASE_NUMBER: Record<AdminBooth['zone'], number> = {
  'Zone A': 101,
  'Zone B': 201,
  'Zone C': 301,
  'Zone D': 401,
};

// Krokideki dört bölge, alanın hangi çeyreğine denk geliyor — sadece
// köşedeki küçük "A/B/C/D" etiketini konumlandırmak için kullanılıyor.
export function zoneQuadrant(zone: AdminBooth['zone']) {
  const index = ZONE_ORDER.indexOf(zone);
  return { right: index % 2 === 1, bottom: index > 1 };
}

// zone'daki mevcut stant numaralarına bakarak bir sonraki numarayı üretir.
// Örn. Zone A'da hiç stant yoksa ilk stant "A101" olur, sonraki "A102" ...
// Bir stant silinse veya başka zone'a taşınsa bile numaralar geri kullanılmaz
// (gerçek etkinliklerdeki stant numaralandırma mantığıyla tutarlı).
export function nextBoothNumber(
  zone: AdminBooth['zone'],
  existingBoothNos: Array<string | null | undefined>,
) {
  const letter = ZONE_LETTER[zone];
  const base = ZONE_BASE_NUMBER[zone];
  const pattern = new RegExp(`^${letter}(\\d+)$`);
  let max = base - 1;
  existingBoothNos.forEach((boothNo) => {
    const match = String(boothNo || '').match(pattern);
    if (match) max = Math.max(max, Number(match[1]));
  });
  return `${letter}${Math.max(max + 1, base)}`;
}

// Bir stant krokiye yerleştirilmiş mi? Zone atanmamışsa (null) stant henüz
// krokide bir noktaya yerleştirilmemiş demektir — bkz. adminRepository >
// saveBooth/placeBooth ("yeni/henüz yerleştirilmemiş bir standa asla sahte
// bir zone atanmıyor").
export function isBoothPlaced(booth: Pick<AdminBooth, 'zone'>) {
  return booth.zone != null;
}

// isBoothPlaced ile birebir aynı kontrol (zone atanmışsa krokiye
// yerleştirilmiş demektir) — sahneler/alanlar için okunabilirlik amacıyla
// ayrı bir isimle dışa aktarılıyor. Bkz. types/admin.ts > AdminStage.zone.
export function isStagePlaced(stage: Pick<AdminStage, 'zone'>) {
  return stage.zone != null;
}

// zoneQuadrant'ın tersi: krokideki bir yüzde koordinatının (x, y — 0-100)
// hangi zone'un içine düştüğünü bulur. Hem stantlar hem de oturum yerleri
// (stage) krokiye serbestçe yerleştirildiğinde hangi zone'a ait sayılacakları
// bu şekilde otomatik belirleniyor.
export function zoneForPercent(xPercent: number, yPercent: number): AdminBooth['zone'] {
  const right = xPercent >= 50;
  const bottom = yPercent >= 50;
  return ZONE_ORDER[(bottom ? 2 : 0) + (right ? 1 : 0)];
}

// Zone başına tek bir vurgu rengi — admin Harita Yönetimi ekranı ve
// katılımcı (girişimci/yatırımcı/kurum/ziyaretçi) harita ekranı aynı
// paleti kullanır ki ikisi görsel olarak birebir tutarlı olsun.
export const ZONE_COLORS: Record<AdminBooth['zone'] & string, string> = {
  'Zone A': '#60a5fa',
  'Zone B': '#fb923c',
  'Zone C': '#34d399',
  'Zone D': '#c084fc',
};
