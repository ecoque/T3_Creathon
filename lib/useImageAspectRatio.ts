// Krokinin (etkinlik alanı fotoğrafının) GERÇEK en-boy oranını okuyup admin ve
// katılımcı ekranlarının İKİSİNİN DE bu orana göre boyutlanmasını sağlayan
// paylaşılan hook.
//
// Neden gerekli: admin tarafındaki `AdminMapManagement.tsx` ve katılımcı
// tarafındaki `app/(tabs)/map.tsx`, krokiyi farklı sabit yükseklikte kutular
// (admin: 540/500, katılımcı: 340) içinde `resizeMode="cover"` ile
// gösteriyordu. "cover" fotoğrafı KIRPARAK kutuyu dolduruyor; kutuların
// en-boy oranı birbirinden (ve fotoğrafın kendi oranından) farklı olduğu için
// aynı fotoğraf her ekranda FARKLI kırpılıyordu. Stant/sahne pinleri ve
// admin'in elle çizdiği duvarlar yüzde (0-100) koordinatlarıyla konumlandığı
// için, bu farklı kırpma admin'de doğru görünen bir duvarın katılımcı
// ekranında kaymış görünmesine yol açıyordu — ikisi de kroki kutusunun
// yüzdesini aynı sayıyor ama kutunun içinde GÖRÜNEN fotoğraf alanı farklı.
//
// Çözüm: kutunun en-boy oranını (`aspectRatio` stili) fotoğrafın kendi gerçek
// oranına eşitlemek. Bu durumda "cover"/"contain" hiç kırpma/boşluk
// yapmadan fotoğrafı birebir dolduruyor, dolayısıyla aynı yüzde koordinatı
// admin'de ve katılımcıda her zaman fotoğrafın AYNI noktasına denk geliyor —
// ekranın genişliği farklı olsa bile (yükseklik otomatik oranla hesaplanıyor).
import { useEffect, useState } from 'react';
import { Image } from 'react-native';

// Henüz gerçek en-boy oranı bilinmezken (resim yüklenene kadar ya da hiç
// kroki yokken) kullanılan varsayılan oran — admin ve katılımcı ekranı bu
// süre boyunca da AYNI kutu boyutunu göstersin diye iki tarafta da bu sabit
// kullanılıyor.
export const DEFAULT_FLOOR_PLAN_ASPECT_RATIO = 4 / 3;

export function useImageAspectRatio(uri?: string | null) {
  const [aspectRatio, setAspectRatio] = useState(DEFAULT_FLOOR_PLAN_ASPECT_RATIO);

  useEffect(() => {
    if (!uri) {
      setAspectRatio(DEFAULT_FLOOR_PLAN_ASPECT_RATIO);
      return;
    }
    let cancelled = false;
    Image.getSize(
      uri,
      (width, height) => {
        if (!cancelled && width > 0 && height > 0) {
          setAspectRatio(width / height);
        }
      },
      () => {
        // Boyut okunamazsa (ör. geçici ağ hatası) varsayılana düş — kroki
        // yine de görünür kalsın, sadece oran tahmini olur.
        if (!cancelled) setAspectRatio(DEFAULT_FLOOR_PLAN_ASPECT_RATIO);
      },
    );
    return () => {
      cancelled = true;
    };
  }, [uri]);

  return aspectRatio;
}
