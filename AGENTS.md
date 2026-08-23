# AGENTS.md

Bu dosya depo kurallari, komutlar, degismezler ve gorev delegasyonu icin tek gercek kaynaktir. Her kullanici isteginde once bu dosya okunmali ve asagidaki politika uygulanmalidir.

## Gorev triyaji ve delegasyon

Her istegi once karmasiklik sinifina ayir:

- **S (kucuk):** Tek dosyali veya mekanik is; metin, rename, kucuk stil, import duzeltmesi ve basit bug. `hizli-isci` ajanina devret.
- **M (orta):** 2-3 dosyali, bilinen desenlerle yapilan standart gelistirme. `orta-isci` ajanina devret.
- **L (buyuk):** Cok dosyali ozellik, sema/migration, auth/route/guvenlik, kafa karistiran bug veya mimari karar. `usta` ajanina devret. Kapsam genisse yalnizca bagimsiz parcalari paralel calistir.

Kararsiz kalinirsa bir ust sinif secilir. Kullanici ozellikle istemedikce gereksiz paralel ajan acilmaz.

### Model dagilimi

- `hizli-isci`: Luna, medium - mekanik ve sinirlari belirgin kucuk isler.
- `kasif`: Luna, low - salt dosya/kod kesfi ve baglam toplama.
- `orta-isci`: Terra, medium - gunluk orta buyuklukte gelistirme isleri.
- `usta`: Sol, high - mimari, karmasik hata, auth, migration ve guvenlik.
- `hakem`: Terra, high - standart diff incelemesi.
- `hakem-kritik`: Sol, high - auth, migration, RLS, guvenlik ve veri silme incelemesi.

Bir ajan ayni problemde basarisiz olursa model sirasiyla `Luna -> Terra -> Sol` olarak yukselt. Salt kesif yapan ajan dosya degistirmez. Ajanlar commit atmaz; commit yalnizca ana oturum tarafindan atilir.

## Review politikasi

Onemsiz salt metin degisiklikleri haric her kod degisikliginden sonra ilgili diff `hakem` tarafindan incelenir. Auth, migration, RLS, guvenlik veya veri silme ile ilgili diff'lerde `hakem-kritik` kullanilir. Urunu bozan veya degismez ihlali bulgulari duzeltilmeden is tamamlanmis sayilmaz; yalnizca iyilestirme onerileri kullaniciya raporlanir ve otomatik uygulanmaz.

## Guvenli calisma degismezleri

- Dosya silme veya tasima isleminden once kullanicidan o islem icin acik ve guncel izin al.
- Kullanicinin masaustundeki veya workspace olarak ekledigi kaynak klasorler hicbir kosulda silinmez; ozellikle `C:/Users/WIN_10/Desktop/remix-takeoff-summit` korunur.
- Mevcut kullanici degisikliklerini koru; ilgisiz dirty worktree degisikliklerini ezme.
- Yerel dosya duzenlemelerinde `apply_patch` kullan.
- Yikici komutlar, genis kapsamli yollar, cozulmemis glob'lar ve geri donussuz Git islemleri kullanma.
- Degisiklikleri orantili bicimde dogrula: uygun oldugunda typecheck, lint ve test/build komutlarini calistir; sonuclari raporla.
- Supabase, auth, RLS ve migration degisikliklerinde veri guvenligini ve geri alinabilirligi ayrica kontrol et.

## Calisma ilkeleri

- Once mevcut kodu, package komutlarini ve ilgili bagimliliklari incele; gereksiz dosya okumaktan kacin.
- Kullanici istegi degisiklik gerektirmiyorsa yalnizca teshis et ve dis sistemlerde degisiklik yapma.
- Degisiklik tamamlandiginda dosya yollarini, dogrulama sonuclarini ve kalan uyari/oneri listesini kisa bicimde raporla.
