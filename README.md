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

## Supabase migration sırası

Migration dosyalarını Supabase Dashboard > SQL Editor içinde aşağıdaki sırayla çalıştırın:

1. `supabase_schema.sql` — boş bir projede temel kullanıcı, profil, program, toplantı ve
   etkinlik tablolarını oluşturur. Yalnız ilk kurulum içindir; tekrar çalıştırılabilir değildir.
2. `supabase_admin_migration.sql` — temel admin yetkilerini ve RLS kurallarını güvenli hale
   getirir. Yeniden çalıştırılabilir.
3. `supabase_admin_workspace_migration.sql` — admin panelinin oturum, alan, stand, duyuru,
   katılımcı ve ayar tablolarını/alanlarını ekler. Yeniden çalıştırılabilir.
4. `supabase_investor_core_flow_migration.sql` — zorunlu yatırım tezi, yatırım odakları ve
   yatırımcı kısa listesini RLS ile ekler. `NOT VALID` kontroller sayesinde eski kayıtları
   değiştirmez; mevcut aktif yatırımcı bir sonraki profil güncellemesinde tezini tamamlar.
   Yeniden çalıştırılabilir.
5. `supabase_entrepreneur_core_flow_migration.sql` — girişimci kimliği, özel görüşme notları,
   hesapla senkron ajanda ve çakışmasız toplantı uygunluğunu ekler. Ortak güvenlik yardımcı
   fonksiyonlarının güncel sürümünü içerir ve yeniden çalıştırılabilir. Yatırımcı migration'ından
   sonra çalıştırılmalıdır.
6. `supabase_corporate_core_flow_migration.sql` — kurumun teknoloji ihtiyacını, özel fırsat
   takibini, aşama geçmişini ve toplantı–fırsat bütünlüğünü RLS ile ekler. Rol yükseltme ve
   silinemez fırsat geçmişi korumalarının güncel sürümünü içerdiği için **en son
   çalıştırılmalıdır** ve yeniden çalıştırılabilir. Bundan sonra önceki rol migration'larını
   tek başına yeniden çalıştırmayın. Eski bir taslaktan aynı kurum–hedef çifti için birden
   fazla fırsat kaldıysa migration hiçbir satırı otomatik silmez; mükerrerleri manuel
   uzlaştırmanızı isteyen açık bir hata verip transaction'ı geri alır.

Daha önce yatırımcı ve girişimci migration'larını çalıştırmış bir projeye yeni yatırım tezi
zorunluluğunu eklerken önce güncel `supabase_investor_core_flow_migration.sql`, hemen ardından
`supabase_entrepreneur_core_flow_migration.sql` dosyasını yeniden çalıştırın. Böylece yatırımcı
kısıtı eklenirken ortak yardımcı fonksiyonların en güncel sürümü yine en son uygulanmış olur.
Kurum akışı kurulmuş projelerde bu ikisinin hemen ardından güncel
`supabase_corporate_core_flow_migration.sql` dosyasını da çalıştırın.

`supabase_location_pings_delete_migration.sql`, kullanıcıya yalnız kendi konum kayıtlarını
silme izni veren bağımsız ve tek seferlik bir migration'dır. Politika zaten varsa yeniden
çalıştırmak hata verir.

Bu migration'lar çalıştırıldıkları anda uygulama kayıtlarını silmez, seed etmez veya mevcut
satırları yeniden yazmaz. Dosyalardaki `DROP POLICY` ifadeleri yalnız yetkilendirme kurallarını
güvenli sürümleriyle değiştirmek içindir. Yine de canlı projede çalıştırmadan önce güncel bir
veritabanı yedeği almak önerilir.

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
