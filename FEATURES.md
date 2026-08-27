# TakeOff Companion App — Özellik Dokümantasyonu

Bu doküman, T3 Vakfı **Take Off** girişimcilik etkinliği için geliştirilen mobil uygulamanın
(Expo + React Native + TypeScript, Supabase backend) tüm kod tabanı incelenerek çıkarılmış
kapsamlı bir özellik envanteridir.

---

## 1. Genel Bakış

- **Amaç:** Katılımcıları (Girişimci, Yatırımcı, Kurum/Partner/Sponsor, Ziyaretçi) rol bazlı,
  kişiselleştirilmiş tek bir mobil deneyimde buluşturmak. Program, ajanda, eşleştirme ve
  networking bilgisini etkinlik öncesi/sırası/sonrası tek yolculukta birleştirmek.
- **Stack:** Expo Router (dosya tabanlı navigasyon) + TypeScript · Supabase (Postgres + Auth +
  Realtime) · React Query (sunucu state) + Zustand (yerel UI state) · i18next/react-i18next ·
  react-native-maps yerine **özel çizilmiş (vektör) kroki + custom pinch-zoom canvas** ·
  expo-location + expo-task-manager (arka plan konum) · expo-camera (QR) +
  react-native-qrcode-svg · expo-print/expo-sharing (PDF) · expo-notifications.
- **Roller:** `girisimci`, `yatirimci`, `kurum`, `ziyaretci` (onboarding'de seçilebilir) +
  `gorevli` (staff, yalnızca admin tarafından atanır) + admin (`users.is_admin`, ayrı bir
  yetkilendirme kanalı, katılımcı rollerinden bağımsız).

---

## 2. Kimlik Doğrulama ve Yönlendirme

- **`app/auth/index.tsx`** — Supabase e-posta/şifre ile giriş, kayıt ve şifre sıfırlama isteği.
- **`app/auth/reset-password.tsx`** — Deep link (`takeoffcompanion://reset-password#access_token=...`)
  üzerinden gelen şifre kurtarma token'larını manuel parse edip yeni şifre belirleme.
- **`app/index.tsx`** — Uygulama giriş kapısı: oturum → admin bayrağı → profil var/yok/durum
  kontrolü yapıp `/auth`, `/admin`, `/onboarding` veya `/(tabs)/home`'a yönlendirir. Pasif
  (deaktive edilmiş) kullanıcıları otomatik oturumdan çıkarır.
- **`app/_layout.tsx` → `SessionGate`** — Uygulama boyunca her 15 saniyede bir ve
  `AppState`/auth event değişiminde çalışan sürekli bir auth/rol koruma katmanı; rol bazlı sekme
  erişimini de zorlar (örn. ziyaretçi `meetings`/`discover`'a giremez, ziyaretçi olmayan
  `events`'e giremez).
- **`lib/resolvePostAuthRoute.ts`** — Giriş sonrası profil var mı kontrolüyle ana sayfa/onboarding
  yönlendirmesi.
- **`lib/adminAccess.ts` / `lib/useIsAdmin.ts`** — Admin yetkisi kontrolü (`users.is_admin`).

---

## 3. Onboarding

- **`app/onboarding/index.tsx`** — Rol seçimi (Girişimci / Yatırımcı / Kurum / Ziyaretçi),
  Zustand `onboardingStore`'a yazılır.
- **`app/onboarding/profile.tsx`** — Role özel sektör/ilgi alanı/hedef seçimi (kurum için ayrıca
  "teknoloji ihtiyaç alanları"); gönderimde `profiles` satırı oluşturulur.
- **`app/onboarding/location-privacy.tsx`** — Şu an placeholder (Faz 2 TODO); gerçek konum
  onay akışı `app/profile/privacy.tsx` altında ayrı olarak yaşıyor.

---

## 4. Kişiselleştirilmiş Ana Sayfa ve Akıllı Ajanda

**`app/(tabs)/home.tsx`**

- Günlük/haftalık/aylık birleşik **Akıllı Ajanda**: etkinlik oturumları + kabul edilmiş/bekleyen
  toplantılar tek görünümde birleştirilir.
- 60 dakikadan uzun boşluklara otomatik olarak AI destekli networking önerileri
  (`rankMatches` ile sıralanmış) eklenir.
- Oturum kaydetme (bookmark), günlük öğün kartı, kurumsal fırsat hızlı erişim kartı.
- Ziyaretçi rolünde `VisitorEventsScreen`'e devredilir.

---

## 5. Eşleştirme (Matching) Sistemi

**`app/(tabs)/discover.tsx`** — Rol bazlı puanlanmış aday listesi, öne çıkan/diğer adaylar
ayrımı, hızlı rol filtreleri, `FilterModal` (sektör/ilgi alanı/rol), yatırımcı kısa liste
toggle'ı, kurumsal fırsat oluşturma kısayolu, `WhyMatchModal`, `ScheduleMeetingModal`. Ziyaretçi
için `VisitorAgendaScreen`'e (kayıtlı oturumlar ajandası) devredilir.

### Puanlama Algoritması (`features/matching/scoring.ts`)

`computeMatchScore(a, b)`, `a`'nın rolüne göre dallanır:

| Fonksiyon | Kapsam | Puanlama mantığı |
|---|---|---|
| `computeInvestorPriorityScore` | Yatırımcı → girişimci/kurum | Taban 20; sektör eşleşmesi +44 (birincil) veya +18 (`investment_focuses` ikincil listesi); ortak ilgi alanı başına ×2 için 8 puan; ortak hedef başına ×2 için 4 puan; serbest metin `investment_thesis` token örtüşmesi ×3 için 3 puan. 100'de sınırlı. |
| `computeEntrepreneurPriorityScore` | Girişimci → girişimci/kurum/yatırımcı | Rol bazlı taban puan (yatırımcı 26, kurum 24, girişimci 14); aynı sektör +36; ortak ilgi alanı ×3 için 8 puan; ortak hedef ×2 için 5 puan. 100'de sınırlı. |
| `computeCorporatePriorityScore` | Kurum → girişimci/kurum | Taban 24 (girişimci) / 14 (kurum); `technology_need_areas` ↔ aday sektör/ilgi/hedef eşleşmesi ×3 için 16 puan; aynı sektör +14; ortak ilgi ×2 için 6 puan; `technology_need_summary` serbest metin örtüşmesi ×3 için 4 puan. 100'de sınırlı. |
| Genel fallback | Ziyaretçi veya tanımsız rol | Rol tamamlayıcılık tablosu (`COMPLEMENTARY_ROLES`, örn. girişimci↔yatırımcı/kurum) 20 puan; aynı sektör +40; ilgi alanı başına +10; hedef başına +5. Sınırsız, gerekçe lokalizasyonu yok. |

- `rankMatches(user, candidates)` — tüm adayları puana göre azalan sıralar.
- `localizeMatchReasons` — yapılandırılmış gerekçeleri (i18n anahtarı + parametre) "Neden
  Eşleşti" modalı ve kart önizlemeleri için okunabilir metne çevirir.
- Metin normalizasyonu Türkçe karakterleri (ı→i vb.) ve büyük/küçük harfi dikkate alır.

---

## 6. Toplantı Planlama

**`app/(tabs)/meetings.tsx`** — Gelen/giden toplantı istekleri sekmeleri, kabul/red, özel
toplantı notları (`MeetingNoteModal`), kabul edilmiş toplantıdan kurumsal fırsat oluşturma.

- **`ScheduleMeetingModal.tsx`** — Katılımcı seçimi + tarih/saat ile toplantı isteği oluşturma.
- **`lib/useMeetingRequests.ts`** — kullanıcıyı ilgilendiren tüm gelen+giden istekleri karşı
  tarafın profiliyle birleştirerek getirir.
- **`lib/meetingNotesRepository.ts` / `useMeetingNotes.ts`** — sahibine özel, toplantı başına
  benzersiz not CRUD'u.

---

## 7. Rol Bazlı Özel Akışlar (Core Flows)

Her akış kendi migration'ı arkasında; migration henüz uygulanmamışsa UI "migration gerekli"
uyarısı gösterir (`features/investor/schema.ts`, `features/corporate/schema.ts` — Postgres/
PostgREST "eksik kolon/tablo" hatalarını (`PGRST204`, `PGRST205`, `42703`, `42P01`) tespit eder).

- **Yatırımcı kısa liste** (`lib/investorShortlistRepository.ts`, `useInvestorCoreFlow.ts`) —
  beğenilen/yıldızlanan girişim profillerini kaydetme.
- **Kurumsal fırsat CRM'i** (`lib/corporateOpportunitiesRepository.ts`,
  `useCorporateOpportunities.ts`, `app/(tabs)/opportunities.tsx`,
  `components/modals/CorporateOpportunityModal.tsx`) — pipeline/aşama takibi, aşama geçmişi
  (`corporate_opportunity_stage_history`), özel notlar, toplantıdan fırsat oluşturma, aynı hedef
  için tekrarlı fırsat koruması.
- **Girişimci toplantı notları** — yukarıda toplantı bölümünde.

---

## 8. Etkinlik Programı ve Ziyaretçi Deneyimi

- **`features/agenda/sessionRecommendations.ts` → `rankSessionsForProfile`** — deterministik,
  açıklanabilir oturum sıralama: profil sektörü (40 puan), ilgi alanları (ilk 3 için ×15 puan),
  hedefler (ilk 2 için ×8 puan) oturum başlığı/açıklaması/kategorisi/etiketleriyle
  karşılaştırılır; eşitlikte en erken başlangıç saati öne alınır.
- **`features/agenda/useEventSessions.ts`** — yayınlanmış/canlı/ertelenmiş/tamamlanmış
  oturumları başlangıç saatine göre getiren React Query hook'u.
- **`features/visitor/VisitorEventsScreen.tsx`** — ziyaretçinin tam program tarayıcısı: arama,
  gün filtresi, kategori filtresi, "sana özel önerilen" oturumlar, öğün kartı, bookmark.
- **`features/visitor/VisitorAgendaScreen.tsx`** — ziyaretçinin kaydettiği oturumlar, güne göre
  gruplanmış (SectionList), kayıttan çıkarma.
- **`lib/useSessionBookmarks.ts`** — bookmark yönetimi + eski cihaz-yerel (AsyncStorage)
  kayıtların sunucu tablosuna tek seferlik göçü.
- Not: Ziyaretçi rolü eşleşme/toplantı akışlarına erişemez; tüm programı filtreleyip kişisel
  ajandasına ekleyebilir.

---

## 9. Etkinlik Alanı Haritası ve Konum (Faz 2 Katmanı)

**`app/(tabs)/map.tsx`** — Bölge katmanlı (stand/sahne/su istasyonu/yoğunluk), pinch-zoom/pan
etkileşimli kroki ekranı; iki nokta seçerek veya canlı GPS'ten A* rota planlama; canlı "buradasın"
GPS noktası; canlı kalabalık-yoğunluk ısı haritası; pusula; su istasyonu durum/raporlama.

Katmanların birbirine bağlanışı:

1. **Kroki modeli** (`lib/floorPlanGrid.ts`) — mekan fotoğraf değil, admin tarafından elle
   çizilmiş vektör bir plan; sabit 16:28 dikey oran ızgarası; sabit, taşınamaz giriş kapısı
   işaretçisi.
2. **Yerleşim** (`lib/boothGrid.ts`) — stand/sahneler yüzde koordinatlı serbest yerleşim, 4
   otomatik çeyrek "bölge"den (A–D) birine düşer, bölge başına otomatik artan stand numarası.
3. **Admin düzenleme** (`components/admin/AdminMapManagement.tsx` + `lib/adminRepository.ts`) —
   admin stand/sahneleri sürükler, duvarları ızgaraya snap ederek çizer (`snapToGrid`), tek bir
   mekan GPS merkezi + yarıçapı belirler (`event_settings.venue_center_lat/lng/radius_meters`),
   isteğe bağlı kalibrasyon noktaları onaylar.
4. **Kalibrasyon** (`lib/venueCalibration.ts`) — ≥2 onaylı kalibrasyon noktasıyla tam 2B afin
   dönüşüm (rotasyon + bağımsız x/y ölçek) hesaplanır; en sayısal-kararlı nokta çifti seçilir
   (merkeze göre maksimum üçgen alanı); yetersiz veri durumunda basit tek-merkez projeksiyonuna
   (`lib/zoneDensity.ts > gpsToMapPercent`) geri düşer.
5. **GPS→harita projeksiyonu** (`projectGpsToMap`) — önce afin dönüşümü, yoksa tek-merkez
   equirectangular projeksiyonu dener.
6. **Canlı konum takibi**:
   - `lib/locationTracking.ts` — arka plan (veya izin yoksa yalnız ön plan) periyodik (60sn/50m)
     konum ping'i `location_pings` tablosuna yazılır; açık kullanıcı onayına bağlıdır
     (`app/profile/privacy.tsx`), "geçmişimi sil" aksiyonu mevcuttur.
   - Harita ekranı ayrıca "buradasın" noktası için bağımsız bir `watchPositionAsync` aboneliği
     çalıştırır (arka plan takip hattından bağımsız).
7. **Kalabalık yoğunluk ısı haritası** (`lib/zoneDensity.ts` + `lib/useLiveDensity.ts`) — ham
   ping'ler başka kullanıcılara asla açılmaz (RLS çapraz-kullanıcı okumayı engeller);
   `SECURITY DEFINER` bir Postgres RPC'si (`get_live_density_grid`) tüm kullanıcıların son 5
   dakikalık ping'lerini sunucu tarafında 8×14'lük bir ızgarada anonimleştirerek toplar; istemci
   yalnızca anonim hücre sayıları alır, yeşil→sarı→kırmızı yoğunluk renginde yarı saydam ısı
   lekeleri olarak çizilir (20 saniyede bir polling).
8. **Rota planlama** (`lib/routePlanner.ts`) — stand/sahneleri şişirilmiş dairesel engel, admin
   duvarlarını kalın çizgi-segment engeli sayan 90×60 ızgara üzerinde A* algoritması; görüş-hattı
   sadeleştirme ("string pulling") ve doğal yürüyüş rotası için Bezier köşe yumuşatma; mesafe/ETA
   `lib/venueCalibration.ts > routeDistanceMeters` ile 1.2 m/s varsayılan yürüme hızı kullanılarak
   hesaplanır.
9. **Oturum→harita entegrasyonu** — bir oturum/ajanda öğesinden "Haritada Gör" dokunulduğunda
   ilgili sahne pin'i otomatik seçilir ve mevcutsa GPS'ten tek seferlik rota denenir; izin/mekan
   merkezi yoksa sessizce hiçbir şey yapmaz.

---

## 10. Rozetler (Badges) ve QR Check-in

- Admin, oturum başına QR kod üretir (`components/admin/AdminSessionQR.tsx`,
  `react-native-qrcode-svg`, format: `takeoff:session:<id>`).
- Katılımcı `app/profile/scan-badge.tsx` (lazy `expo-camera`) ile tarar; `useMyBadges.ts` içindeki
  `useAwardBadgeFromQr` idempotent rozet ataması yapar (benzersiz `(user_id, session_id)` kısıtı
  ile aynı oturuma tekrar tarama hata vermeden yok sayılır).
- Kamera native modülü yoksa (Expo Go gibi) zarifçe "kullanılamıyor/yeni build gerekli" durumuna
  düşer.

---

## 11. Sertifika ve Kroki (Harita) PDF Dışa Aktarımı

- **`lib/certificateExport.ts`** (`app/(tabs)/profile.tsx`'te kullanılır) — kullanıcı adı +
  kazanılan rozetleri içeren yazdırılabilir HTML sertifika üretir; lazy `expo-print`/
  `expo-sharing` ile paylaşılabilir PDF'e dönüştürür.
- **`lib/krokiExport.ts`** (`AdminMapManagement.tsx`'te kullanılır) — admin'in çizdiği mekan
  planını (duvarlar + pin'ler) PDF dışa aktarım/paylaşım için HTML/SVG belgesine render eder.

---

## 12. Günlük Öğün Sistemi

- **`lib/useMeals.ts`** — kullanıcı id'sinden hash ile deterministik günlük öğün slotu atama:
  12:00–13:30 arasında dokuzar 10 dakikalık slota kullanıcıları sözde-rastgele dağıtır; kullanıcının
  kaydettiği oturumlar/kabul edilmiş toplantılarıyla çakışmayı önler; kullanıcı-gün başına bir kez
  kalıcı hale getirilir.
- **`components/MealCard.tsx`** — Home ve Visitor Events ekranlarında ortak öğün + kişisel slot
  kartı.
- Admin tarafında **`components/admin/AdminMeals.tsx`** ile günlük menü CRUD'u.

---

## 13. Su İstasyonları

- **`lib/useWaterStations.ts`** — istasyon listesi + durum yaşam döngüsü:
  `active → reported_empty → dispatched → resolved`.
- Katılımcı/staff tarafında raporlama, admin tarafında `components/admin/AdminWaterStations.tsx`
  ile CRUD + istek kuyruğu yönetimi.
- Harita ekranında su istasyonu katmanı olarak görselleştirilir.

---

## 14. Görevli (Staff) Rolü

- Onboarding'de seçilemez; yalnızca admin panelinden atanır
  (`components/admin/AdminStaffAssignments.tsx`, `lib/useStaffAssignments.ts`).
- **`app/(tabs)/staff.tsx`** — atanmış girişimci/bölge listesi + su istasyonu boş raporlama/durum
  ilerletme aracı; normal katılımcı sekmelerinin üzerine binen ayrı bir sekme.

---

## 15. Admin Paneli

**`app/admin/`** — `is_admin` korumalı, katılımcı akışından tamamen ayrı, kendi auth guard'ına
sahip (`app/admin/_layout.tsx`) sahne arkası panel. Tüm panel `AdminWorkspace.tsx` altında
birleşir (sidebar navigasyon, bölüm yönlendirme, çıkış).

| Bileşen | Sorumluluk |
|---|---|
| `AdminDashboard.tsx` | Genel bakış: istatistikler, hızlı aksiyonlar, son etkinlik |
| `AdminProgram.tsx` | Oturum/program yönetimi (oluştur/düzenle/ertele/durum değiştir/sahne ata) |
| `AdminSessionQR.tsx` | Oturum bazlı check-in QR kodu üretimi |
| `AdminMapManagement.tsx` | Duvar çizimi, stand/sahne sürükle-bırak yerleştirme, mekan merkezi/kalibrasyon, kroki PDF dışa aktarım |
| `AdminVenuesAndStands.tsx` | Stand/alan yönetimi (ekle/düzenle/durum aç-kapa/ara) |
| `AdminWaterStations.tsx` | Su istasyonu CRUD + durum isteği kuyruğu |
| `AdminMeals.tsx` | Günlük öğün menüsü CRUD'u |
| `AdminAttendees.tsx` | Katılımcı yönetimi (rol düzenleme, aktif/pasif, arama) |
| `AdminStaffAssignments.tsx` | Görevli↔girişimci/bölge atama |
| `AdminAnnouncements.tsx` | Duyuru oluşturma + erişim/tıklama istatistikleri |
| `AdminNotificationsDrawer.tsx` | Sistem uyarı/log bildirimleri çekmecesi |
| `AdminWorkspaceModals.tsx` | Oturum/sahne/bölge/stand düzenleyici ortak modal formları |

Veri katmanı: `lib/adminRepository.ts` (Supabase CRUD) + `lib/adminDbStore.ts` (Zustand store,
yükleme/hata/mutasyon durumu) + `lib/adminStore.ts` (re-export).

---

## 16. Diğer Ortak Bileşenler

- **`components/AppHeader.tsx`** — logo, bildirim zili, filtre ikonu içeren paylaşılan üst başlık.
- **`components/ZoomPanCanvas.tsx`** — `PanResponder` + `Animated` üzerine kurulmuş özel
  pinch-zoom/pan sarmalayıcı (gesture-handler/reanimated bağımlılığı yok), kroki görüntüleme için.
- **`components/TakeOffLogo.tsx`** — çoklu varyant/boyut logo bileşeni.
- **`components/ScreenPlaceholder.tsx`** — henüz uygulanmamış ekranlar için genel yer tutucu.
- **`components/modals/`** — `FilterModal`, `ProfileDetailModal`, `WhyMatchModal`,
  `ScheduleMeetingModal`, `SessionDetailModal`, `MeetingNoteModal`, `NotificationsModal`,
  `CorporateOpportunityModal`.

---

## 17. Bildirimler

- Şu an yalnızca UI seviyesinde: `NotificationsModal.tsx` (katılımcı tercihleri) ve
  `AdminNotificationsDrawer.tsx`/`AdminAnnouncements.tsx` (admin oluşturma/log).
- Ayrı bir `notification_settings`/push-teslim backend tablosu henüz yok.
- Meetings sekmesindeki bekleyen-toplantı-sayısı rozeti, en yakın canlı uygulama-içi bildirim
  sinyalidir.

---

## 18. Çoklu Dil Desteği (i18n)

- **`lib/i18n.ts`** — i18next kurulumu, cihaz dili tespiti (açılışta tr/en ile sınırlı), Türkçe
  fallback.
- **`locales/`** — `tr.json`, `en.json` dolu; `ar.json`, `es.json`, `fr.json` boş iskelet (Faz 2).

---

## 19. Veritabanı Şeması (Supabase Migration'ları)

Migration'lar sırayla uygulanmalıdır (bkz. `README.md`). Her dosyanın eklediği ana
tablo/özellikler:

| Dosya | Eklediği başlıca tablo/özellikler |
|---|---|
| `supabase_schema.sql` | Temel şema: `users` (auth-linked, `is_admin`), `profiles` (rol/sektör/ilgi/hedef), `sessions`, `meeting_requests`, `badges`, `zones`, `stands`, `checkins`, `location_pings`, `is_admin()` fonksiyonu, tam RLS seti |
| `supabase_admin_migration.sql` | Temel admin yetkileri ve RLS güvenlik güncellemesi |
| `supabase_admin_workspace_migration.sql` | `admin_attendee_details`, `stages`, `announcements`, `event_settings`, `admin_logs` |
| `supabase_investor_core_flow_migration.sql` | `profiles.title/company/status/investment_thesis/investment_focuses`, `investor_shortlists` |
| `supabase_entrepreneur_core_flow_migration.sql` | `profiles.title/company/status`, `meeting_notes`, `session_bookmarks` |
| `supabase_corporate_core_flow_migration.sql` | `profiles.technology_need_summary/technology_need_areas`, `corporate_opportunities`, `corporate_opportunity_stage_history` |
| `supabase_location_pings_delete_migration.sql` | Kullanıcının kendi konum geçmişini silme RLS politikası |
| `supabase_badges_certificate_migration.sql` | `badges.session_id`, benzersiz `(user_id, session_id)`, `badges_insert_own` RLS |
| `supabase_floor_plan_migration.sql` | `event_settings`'e kroki-fotoğraf ilişkili kolonlar |
| `supabase_floor_plan_walls_migration.sql` | `event_settings.floor_plan_walls` (admin duvar segmentleri JSON) |
| `supabase_venue_center_migration.sql` | `event_settings.venue_center_lat/lng/radius_meters`, `get_live_density_grid` (SECURITY DEFINER RPC) |
| `supabase_venue_calibration_migration.sql` | `venue_calibration_points`, `get_calibration_candidates` RPC |
| `supabase_zone_geofence_migration.sql` | Eski bölge bazlı geofence kolonları (tek-merkez modeli ile artık kullanım dışı, uyumluluk için tutuluyor) |
| `supabase_stand_grid_migration.sql` | `stands`'e harita-ızgara yerleşim kolonları |
| `supabase_meals_migration.sql` | `meals`, `meal_assignments` |
| `supabase_water_stations_migration.sql` | `water_stations` |
| `supabase_staff_migration.sql` | `profiles.role` kısıtına `gorevli` eklenmesi, `staff_assignments` |

---

## 20. Bilinen Eksikler / Placeholder'lar

- **`app/onboarding/location-privacy.tsx`** — placeholder, kullanılmıyor (gerçek akış
  `app/profile/privacy.tsx`'te).
- **`app/profile/[id].tsx`** — placeholder, kullanılmıyor (gerçek akış `ProfileDetailModal`'da).
- **Push bildirim backend'i** — henüz yok, yalnızca UI/log seviyesinde.
- **AKIŞ 04 (Ziyaretçi) — mekan alanında yön bulma** — `CREATHON_MVP_CHECKLIST.md`'ye göre
  son doğrulama/test bekliyor (harita + rota planlama kodu mevcut, kullanıcı testi tamamlanmamış).
- **`location_pings` otomatik temizliği** — README'de belirtilen "etkinlik bitiminde silinmeli"
  politikası için tam otomasyon (örn. scheduled function) henüz kurulmamış; yalnızca kullanıcının
  manuel "geçmişimi sil" aksiyonu var.

---

## 21. Klasör Yapısı Özeti

```
app/                     Expo Router ekranları (dosya tabanlı navigasyon)
  index.tsx              Giriş kapısı / rota çözümleme
  _layout.tsx             Root layout + SessionGate
  auth/                   Giriş, kayıt, şifre sıfırlama
  onboarding/             Rol seçimi, profil formu, konum-gizlilik (placeholder)
  (tabs)/                 home, discover, events, map, meetings, opportunities, profile, staff
  profile/                [id] (placeholder), edit, privacy, scan-badge
  admin/                  is_admin korumalı sahne arkası panel
components/               Paylaşılan UI + admin/ + modals/
features/                 agenda, corporate, investor, matching, visitor (alan bazlı mantık)
lib/                      Supabase client, repository/hook katmanı, harita/konum matematiği, i18n
constants/                Tema/design token, mock admin verisi, roller, mekan noktaları
types/                    Paylaşılan TypeScript tipleri
locales/                  tr, en (dolu) + ar, es, fr (boş iskelet)
*.sql (root)               Supabase migration dosyaları
```
