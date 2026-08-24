// Krokinin artık bir fotoğraf DEĞİL, admin'in tamamen kendi çizdiği bir
// vektör plan olduğu yeni model için paylaşılan sabitler.
//
// Neden gerekli: Admin ve katılımcı ekranlarının krokiyi AYNI en-boy oranında
// göstermesi lazım ki admin'in çizdiği duvarlar/yerleştirdiği pinler iki
// tarafta da birebir aynı yerde görünsün — daha önce fotoğraf kırpma yüzünden
// yaşanan kayma sorunuyla (bkz. lib/useImageAspectRatio.ts) aynı ders, sadece
// artık bir fotoğrafın gerçek oranını ölçmek yerine SABİT bir oranımız var
// (çünkü ölçülecek bir fotoğraf yok).
//
// GRID_COLS/GRID_ROWS, admin krokiyi elle çizerken (özellikle duvar çizerken)
// dokunduğu noktayı en yakın ızgara kesişimine "yapıştırmak" (snap) için
// kullanılan referans ızgara — çizgiler böylece yamuk/eğri çıkmıyor. Stant ve
// sahne yerleştirme bu ızgaraya bağlı DEĞİL, onlar hâlâ tamamen serbest
// (yüzde bazlı) konumlanıyor; sadece duvar çizimi ızgaraya oturuyor.
//
// Oran bilinçli olarak DİKEY (portre) — Take Off etkinlik alanı büyük ve
// kullanıcı krokinin enine değil boyuna uzun bir dikdörtgen olmasını istedi
// ("harita da uzun bir dikdörtgen olabilir"). Önceden 24x16 (yatay, 3:2) idi;
// sonra 16x24 (dikey, 2:3) yapıldı; kullanıcı hâlâ küçük geldiğini belirtip
// "aşağıya doğru biraz daha uzat" deyince 16x28'e çıkarıldı (dikey oran daha
// da belirginleşti) — admin ve katılımcı ekranındaki kroki kutusu artık
// sayfada aşağıya doğru daha fazla yer kaplıyor, altta boşta kalan alanı
// dolduruyor. Bu SADECE görsel bir oran; stant/sahne/duvar konumları hâlâ
// yüzde (0-100) uzayında tutulduğu için bu değişiklik hiçbir kaydedilmiş
// veriyi bozmuyor, sadece aynı yüzde noktalarını farklı bir dikdörtgene
// oturtuyor.
export const GRID_COLS = 16;
export const GRID_ROWS = 28;
export const FLOOR_PLAN_ASPECT_RATIO = GRID_COLS / GRID_ROWS;

function clampPercent(value: number) {
  return Math.max(0, Math.min(100, value));
}

// Yüzde (0-100) bir noktayı en yakın ızgara kesişimine yuvarlar. Duvar
// çiziminde başlangıç/bitiş noktaları için kullanılıyor (bkz.
// AdminMapManagement.tsx > handleCanvasPress).
export function snapToGrid(xPercent: number, yPercent: number) {
  const stepX = 100 / GRID_COLS;
  const stepY = 100 / GRID_ROWS;
  return {
    x: clampPercent(Math.round(xPercent / stepX) * stepX),
    y: clampPercent(Math.round(yPercent / stepY) * stepY),
  };
}

// Krokinin alt kenarına yakın, SABİT (admin tarafından taşınamayan/silinemeyen)
// bir "giriş kapısı" işareti — yüzde (0-100) koordinat uzayında. Admin ve
// katılımcı ekranlarında (AdminMapManagement.tsx, app/(tabs)/map.tsx) ve PDF
// dışa aktarımında (lib/krokiExport.ts) aynı sabit çizgi gösteriliyor —
// sadece görsel bir referans, rota bulmaya (lib/routePlanner.ts) dahil
// edilmiyor.
export const ENTRANCE_GATE_LINE = { x1: 35, y1: 99, x2: 65, y2: 99 };
export const ENTRANCE_GATE_COLOR = '#16a34a';
export const ENTRANCE_GATE_LABEL = 'GİRİŞ';
