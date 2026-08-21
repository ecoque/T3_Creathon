# TakeOff Companion App

T3 Vakfı **Take Off** girişimcilik etkinliği için katılımcıları (Girişimci, Yatırımcı,
Kurum/Partner, Ziyaretçi) rol bazlı, kişiselleştirilmiş tek bir mobil deneyimde buluşturan
uygulama. Program, ajanda, eşleştirme ve networking bilgisi tek bir yerde toplanır; etkinlik
öncesi, sırası ve sonrasını aynı yolculukta birleştirir.

## Zorunlu MVP Gereksinimleri

1. Rol bazlı onboarding
2. Rol/sektör/ilgi alanı/hedef toplama, önerileri buna göre şekillendirme
3. Kişiselleştirilmiş ana sayfa + akıllı ajanda
4. Girişim–yatırımcı–kurum eşleştirme
5. Eşleşme gerekçesinin açıkça gösterilmesi
6. Bağlantı kurma + toplantı planlama (talep/kabul/red + ajandaya ekleme)

GPS/NFC/harita özellikleri bu 6 maddenin üzerine binen bir katman olarak Faz 2'de eklenir.

## Teknoloji Stack

- **Frontend:** Expo (React Native + TypeScript), Expo Router (dosya tabanlı navigasyon)
- **Backend/DB:** Supabase (Postgres + Auth + Realtime + Storage)
- **State/Veri yönetimi:** React Query (sunucu verisi/cache) + Zustand (hafif yerel/UI state,
  örn. onboarding'de seçilen rol, ayarlar toggle'ları). İkisi farklı problemleri çözüyor:
  React Query sunucudan gelen veriyi cache'ler ve senkronize eder, Zustand ise bunun
  dışında kalan basit istemci-taraflı state için minimal bir katman sağlar.
- **i18n:** i18next + react-i18next (başlangıçta tr/en, ar/es/fr için boş altyapı hazır)
- **Harita:** react-native-maps (Faz 2)
- **Arka plan konum:** expo-location + expo-task-manager (Faz 2) — **Dev Client şart**
- **NFC:** react-native-nfc-manager (Faz 2) — **Dev Client şart**
- **QR:** expo-camera (barkod tarama dahil) + react-native-qrcode-svg
- **Bildirim:** expo-notifications
- **Lint/Format:** ESLint (eslint-config-expo) + Prettier

## Neden Dev Client?

Bu proje NFC okuma, harita ve **arka planda sürekli konum takibi** gibi native modül
gerektiren özellikler kullanacak. Bunlar standart Expo Go uygulamasında çalışmaz, bu yüzden
proje EAS (Expo Application Services) Dev Client ile yapılandırıldı.

## Kurulum

```bash
npm install
cp .env.example .env
# .env içine kendi Supabase URL ve anon key değerlerinizi girin
```

### Geliştirme sunucusunu başlatma

```bash
npx expo start --dev-client
```

### Dev Client build alma (native modüller için gerekli)

```bash
npm install -g eas-cli
eas login
eas build:configure
eas build --profile development --platform android   # veya --platform ios
```

Build tamamlandığında EAS'in verdiği QR kod/linkle cihaza Dev Client uygulamasını kurun,
ardından `npx expo start --dev-client` ile geliştirme sunucusuna bağlanın.

## Klasör Yapısı

```
app/            Expo Router ekranları/rotaları (dosya tabanlı navigasyon)
  onboarding/    Rol seçimi, profil formu, konum izni & gizlilik ekranı
  (tabs)/        Ana sekme navigasyonu: ajanda, keşfet, toplantılar, harita, profil
  profile/[id]/  Diğer katılımcıların profil detay ekranı
  admin/         is_admin korumalı, katılımcı akışından ayrı sahne arkası ekranlar
components/      Paylaşılan UI bileşenleri
features/        Alan bazlı mantık için klasörler (onboarding, agenda, matching,
                 meetings, badges, location, admin) — Faz 2'de doldurulacak
lib/             Supabase client, i18n kurulumu, API yardımcıları
constants/       Tema/design token'lar
types/           Paylaşılan TypeScript tipleri
locales/         tr.json, en.json (dolu) + ar.json, es.json, fr.json (boş iskelet)
```

## Gizlilik Notu (önemli)

Uygulama, etkinlik sırasında yoğunluk haritası ve rota önerisi sunmak için **arka planda
konum verisi toplayacak** (`location_pings` tablosu). Bu MVP'nin bir parçası olarak
düşünülmeli, sonradan eklenecek bir detay değil:

- Kullanıcı açık onay vermeden konum takibi başlamaz, istediği an ayarlardan kapatabilir.
- Konum kapalıyken uygulamanın geri kalanı (eşleştirme, ajanda, toplantı) sorunsuz çalışır.
- Etkinlik bitiminde (veya belirlenecek bir süre sonra) `location_pings` verisinin
  silinmesi gerekir. Faz 2'de bunun için basit bir Supabase scheduled function ya da
  manuel bir temizlik script'i eklenecek — 4 günlük süreçte tam otomasyon şart değil,
  ama plan burada ve kod tabanında belirtilmiş olmalı.

Detaylı akış ve ekranlar Faz 2'de eklenecek.

## Ekip İş Bölümü

| Alan                        | Sorumlu | Notlar                                                            |
| --------------------------- | ------- | ----------------------------------------------------------------- |
| Mobile/Frontend Lead        |         | Expo ekranları, harita/NFC/konum UI                               |
| Backend/Data Lead           |         | Supabase, eşleştirme algoritması, zon agregasyonu, rota hesaplama |
| Product/UX + İçerik         |         | Akış tasarımı, metinler, gizlilik/onay metinleri, çok dillilik    |
| Full-stack/Entegrasyon + QA |         | Toplantı/ajanda entegrasyonu, test, PR review, sunum              |
