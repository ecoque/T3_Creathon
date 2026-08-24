# Take Off Dijital Deneyim ve Mobil Uygulama — MVP Kontrol Listesi

Bu belge, Creathon Problem 6 ürün briefindeki zorunlu gereksinimleri ve rol bazlı temel akışları tek yerde takip etmek için kullanılır. Zorunlu MVP kutuları, ilgili gereksinim dört rolde de doğrulandığında işaretlenir. Rol akışlarındaki kutular ise kodun tamamlanma durumunu gösterir; canlı ortam geçerliliği için her akışın durum satırındaki migration ve kullanıcı testi koşulları ayrıca sağlanmalıdır.

## Problem ve amaç

Katılımcılar program, duyuru, harita, girişim, yatırımcı ve networking bilgilerine farklı kanallardan ulaşmak zorunda kaldığı için programları ve nitelikli bağlantıları kaçırabiliyor; deneyim kullanıcıya göre şekillenmiyor.

Amaç; kullanıcının rolü, ilgi alanı ve hedeflerine göre etkinlik öncesinden sonrasına uzanan tek, kişiselleştirilmiş bir mobil deneyim sunmaktır. Doğru içerik, kişi ve fırsat aynı kullanıcı yolculuğunda buluşmalıdır.

## Kullanıcı grupları ve hedefleri

- **Girişimci:** Doğru yatırımcı ve kurumları bulmak, bağlantıyı görüşmeye dönüştürmek.
- **Yatırımcı:** Yatırım tezine uygun girişimleri hızlıca keşfetmek ve önceliklendirmek.
- **Kurum / Partner / Sponsor:** Teknoloji ihtiyacına uygun girişimlerle iş birliği ve pilot fırsatı oluşturmak.
- **Ziyaretçi:** İlgi alanına göre programını planlamak ve etkinlik alanında kolayca yön bulmak.

## Zorunlu MVP gereksinimleri

Bu altı maddenin tamamı, dört kullanıcı grubunun ilgili deneyimlerinde doğrulanmadan genel MVP tamamlanmış sayılmaz.

- [ ] **01 — Profil ve rol bazlı onboarding:** Her rol kendi hedefi ve ihtiyacına uygun bilgi giriş deneyimi yaşar.
- [ ] **02 — Profile göre kişiselleştirme:** Rol, sektör, ilgi alanları ve hedefler alınır; öneriler bu profile göre şekillenir.
- [ ] **03 — Kişiselleştirilmiş ana sayfa ve akıllı ajanda:** Kullanıcıya özel program, oturumlar ve güncel aksiyonlar tek ekranda görünür.
- [ ] **04 — Girişim–yatırımcı–kurum eşleştirme:** Uygun taraflar rolün amacına göre eşleştirilir ve önceliklendirilir.
- [ ] **05 — Filtreleme ve açıklanabilir eşleşme:** Kullanıcı uygun profilleri filtreler ve eşleşme gerekçesini açıkça görür.
- [ ] **06 — Bağlantı ve toplantı planlama:** İstek gönderilir, uygun saat seçilir ve görüşme kişisel ajandaya eklenir.

## Temel rol akışları

- [x] **AKIŞ 01 — Girişimci:** Profilini tamamlar → uygun girişimleri, kurumları ve yatırımcıları görür → toplantı talep eder → görüşme notunu kaydeder.
  Durum: Kod tamamlandı. `supabase_entrepreneur_core_flow_migration.sql` uygulanmış ve akış kullanıcı tarafından test edilmiş olmalıdır.

- [x] **AKIŞ 02 — Yatırımcı:** Yatırım tezini tanımlar → uygun girişimleri ve kurumları önceliklendirir → kısa liste oluşturur → toplantı planlar.
  Durum: Kod tamamlandı. Zorunlu yatırım tezi dahil `supabase_investor_core_flow_migration.sql` ve ardından güncel girişimci migration'ı uygulanmış olmalıdır.

- [x] **AKIŞ 03 — Kurum / Partner / Sponsor:** Teknoloji ihtiyacını tanımlar → uygun girişimleri ve kurumları görür → toplantı yapar → kurumsal fırsatını takip eder.
  Durum: Kod, migration ve ana kullanıcı kontrolleri tamamlandı. Kullanıcı; kurum onboarding'ini, ihtiyaç bazlı oturum önerisini, eşleşme/açıklama/filtrelemeyi, toplantının kabul edilip fırsata bağlanmasını, fırsat kartını ve başka kurumsal hesabın fırsatı veya özel notları göremediğini doğruladı. Aşama geçmişi ve sonraki aksiyon takibi kodda mevcut; geçmiş toplantının tamamlandı aşamasına geçirilmesi tarih beklediği için isteğe bağlı bırakıldı. Güncel `supabase_corporate_core_flow_migration.sql` uygulanmış olmalıdır.

- [ ] **AKIŞ 04 — Ziyaretçi:** İlgi alanına göre programını planlar → kişisel ajandasını oluşturur → etkinlik alanında yön bulur.
  Durum: Ayrıntılı rol denetimi ve uçtan uca kullanıcı testi bekliyor.

## Son güncelleme

- **2026-08-24:** Girişimci ve yatırımcı akışlarının kodu tamamlandı olarak kaydedildi; canlı geçerlilikleri ilgili migration ve test koşullarına bağlıdır. Kurum/Partner/Sponsor akışı için kod ve veri modeli denetimi başlatıldı; ziyaretçi akışı sonraki aşamada ele alınacak.
- **2026-08-24:** Kurum akışında onboarding, ihtiyaç bazlı öneri/eşleştirme ve özel fırsat takip ekranı geliştirildi; güvenlik incelemesi sonrası rol yükseltme, silinemez aşama geçmişi ve toplantı-aşama bütünlüğü sıkılaştırıldı. Kullanıcı doğrulaması tamamlandı.
- **2026-08-24:** Kurum akışı tamamlandı: teknoloji ihtiyacı onboarding'i ve buna göre oturum önerisi; girişim/kurum keşfi, eşleşme açıklaması ve toplantı talebi; kabul edilmiş toplantının fırsata bağlanması; fırsat kartı, aşama takibi ve fırsat/özel notların farklı bir kurumsal hesapta gizli kalması doğrulandı. Geçmiş toplantının tamamlandı aşaması için tarih beklemek zorunlu test olarak tutulmadı.
