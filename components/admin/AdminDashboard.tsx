import {
  Activity,
  BellRing,
  CalendarDays,
  CheckCircle2,
  ChevronRight,
  CircleAlert,
  Clock3,
  Edit3,
  Handshake,
  MapPin,
  Plus,
  QrCode,
  Radio,
  Send,
  Sparkles,
  Store,
  Users,
} from 'lucide-react-native';
import { useState, type ComponentType } from 'react';
import { Pressable, StyleSheet, Text, useWindowDimensions, View } from 'react-native';

import { colors } from '../../constants/theme';
import { useAdminStore } from '../../lib/adminStore';
import type { AdminSession, AdminViewType } from '../../types/admin';

type IconType = ComponentType<{ size?: number; color?: string }>;
type Props = {
  onNavigate: (view: AdminViewType) => void;
  onOpenCreateSession: () => void;
  onOpenCreateAnnouncement: () => void;
  onOpenQuickSession: (id: string) => void;
  onOpenEditSession: (session: AdminSession) => void;
  onNotify: (message: string) => void;
};

const alerts: {
  id: string;
  tone: 'red' | 'amber' | 'blue';
  title: string;
  description: string;
  action: string;
  view: AdminViewType;
}[] = [
  {
    id: 'al-1',
    tone: 'red',
    title: 'Zone C Girişim Alanı Yoğun',
    description: 'Anlık doluluk %88 (440/500 kişi). Saha yönlendirmesi önerilir.',
    action: 'Haritada İncele',
    view: 'map_management',
  },
  {
    id: 'al-2',
    tone: 'amber',
    title: 'Main Stage Kapasiteye Yaklaşıyor',
    description:
      'Doluluk %92 (736/800 kişi). Sıradaki keynote öncesi giriş kontrolü gerekebilir.',
    action: 'Salon Durumu',
    view: 'venues_and_stands',
  },
  {
    id: 'al-3',
    tone: 'blue',
    title: 'AI Stage: Panel 10 Dakika Sonra Başlıyor',
    description: 'Konuşmacılar hazır, salonda 210 kişi yerini aldı.',
    action: 'Programı Gör',
    view: 'program',
  },
  {
    id: 'al-4',
    tone: 'amber',
    title: 'Fintech Paneli 15 Dakika Gecikmeli',
    description:
      'Önceki oturum uzadığı için +15 dk gecikme uygulandı. 142 katılımcı bilgilendirildi.',
    action: 'Oturumu Yönet',
    view: 'program',
  },
];

function MetricCard({
  icon: Icon,
  title,
  value,
  note,
  accent,
  basis,
  onPress,
  muted,
}: {
  icon: IconType;
  title: string;
  value: string;
  note: string;
  accent: string;
  basis: '15%' | '31%' | '47%';
  onPress?: () => void;
  muted?: boolean;
}) {
  return (
    <Pressable
      disabled={!onPress}
      onPress={onPress}
      style={({ pressed }) => [
        st.metric,
        { flexBasis: basis },
        muted && st.metricMuted,
        pressed && st.pressed,
      ]}
    >
      <View style={st.metricHead}>
        <Text style={st.metricTitle}>{title}</Text>
        <Icon size={17} color={accent} />
      </View>
      <Text style={[st.metricValue, accent === colors.success && { color: accent }]}>{value}</Text>
      <Text style={[st.metricNote, { color: accent }]}>{note}</Text>
    </Pressable>
  );
}

const tones = {
  neutral: ['#ffffff', '#d5dae1', '#27313d', '#596575'],
  orange: ['#fff8f2', '#f3b47f', '#c85000', '#c85000'],
  dark: ['#122232', '#122232', '#ffffff', '#47d7a0'],
  green: ['#dcfce7', '#63dca8', '#07683f', '#078252'],
  amber: ['#b66a00', '#b66a00', '#ffffff', '#ffffff'],
} as const;

function Action({
  label,
  onPress,
  icon: Icon,
  tone = 'neutral',
}: {
  label: string;
  onPress: () => void;
  icon?: IconType;
  tone?: keyof typeof tones;
}) {
  const [backgroundColor, borderColor, textColor, iconColor] = tones[tone];
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        st.action,
        { backgroundColor, borderColor },
        pressed && st.pressed,
      ]}
    >
      {Icon ? <Icon size={13} color={iconColor} /> : null}
      <Text style={[st.actionText, { color: textColor }]}>{label}</Text>
    </Pressable>
  );
}

function addMinutes(time: string, minutes: number) {
  const [hour, minute] = time.split(':').map(Number);
  if (!Number.isFinite(hour) || !Number.isFinite(minute)) return time;
  const next = (hour * 60 + minute + minutes) % 1440;
  return `${String(Math.floor(next / 60)).padStart(2, '0')}:${String(next % 60).padStart(2, '0')}`;
}

export function AdminDashboard({
  onNavigate,
  onOpenCreateSession,
  onOpenCreateAnnouncement,
  onOpenQuickSession,
  onOpenEditSession,
  onNotify,
}: Props) {
  const store = useAdminStore();
  const { width: windowWidth } = useWindowDimensions();
  const [layoutWidth, setLayoutWidth] = useState(0);
  const width = layoutWidth || windowWidth;
  const heroHorizontal = width >= 760;
  const split = width >= 880;
  const basis: '15%' | '31%' | '47%' =
    width >= 1080 ? '15%' : width >= 620 ? '31%' : '47%';
  const live = store.sessions.filter((session) => session.status === 'live');
  const delayed = store.sessions.filter((session) => session.status === 'delayed');
  const upcoming = store.sessions
    .filter((session) => session.status === 'published' || session.status === 'delayed')
    .slice(0, 4);
  const today = store.sessions.filter((session) => session.day === '24');
  const activeBooths = store.booths.filter((booth) => booth.status === 'active').length;

  async function delaySession(session: AdminSession, minutes: number) {
    if (await store.delaySession(session.id, minutes))
      onNotify(`${session.title}: +${minutes} dk gecikme uygulandı ve bildirim gönderildi.`);
  }

  async function setStatus(session: AdminSession, status: 'live' | 'completed') {
    if (await store.updateSessionStatus(session.id, status)) {
      onNotify(
        status === 'live'
          ? `${session.title} canlı olarak başlatıldı.`
          : `${session.title} tamamlandı olarak işaretlendi.`,
      );
    }
  }

  function SessionCard({ session, isDelayed }: { session: AdminSession; isDelayed?: boolean }) {
    const minutes = session.delayMinutes || 15;
    return (
      <View style={[st.sessionCard, isDelayed ? st.sessionDelayed : st.sessionLive]}>
        <View style={st.sessionTop}>
          <View style={st.sessionCopy}>
            <View style={st.sessionMeta}>
              {isDelayed ? (
                <View style={st.delayPill}>
                  <CircleAlert size={12} color="#fff" />
                  <Text style={st.statusText}>+{minutes} DK GECİKTİ</Text>
                </View>
              ) : (
                <View style={st.livePill}>
                  <Radio size={12} color="#fff" />
                  <Text style={st.statusText}>CANLI</Text>
                </View>
              )}
              {isDelayed ? (
                <View style={st.delayTimePill}>
                  <Clock3 size={13} color="#805000" />
                  <Text style={st.delayTimeText}>
                    Planlanan: {session.time} → Yeni: {addMinutes(session.time, minutes)}
                  </Text>
                </View>
              ) : (
                <Text style={st.sessionTime}>
                  {session.time} – {session.endTime} ({session.duration})
                </Text>
              )}
              <View style={isDelayed ? st.delayStagePill : st.stagePill}>
                {isDelayed ? <MapPin size={12} color="#805000" /> : null}
                <Text style={isDelayed ? st.delayStageText : st.stageText}>{session.stageName}</Text>
              </View>
            </View>
            <Text style={st.sessionTitle}>{session.title}</Text>
            <Text style={st.sessionSub}>
              Konuşmacılar:{' '}
              {session.speakers.map((speaker) => speaker.name).join(', ') ||
                (isDelayed ? 'Açık Katılım / Atölye' : 'Açık Katılım')}
              {isDelayed ? ` • ${session.category}` : ''}
            </Text>
          </View>
          <View>
            <Text style={isDelayed ? st.delayParticipant : st.participant}>
              {session.checkedInCount} / {session.capacity} Katılımcı
            </Text>
            <Text style={isDelayed ? st.delayParticipantSub : st.participantSub}>
              {session.bookmarkedCount} kişi ajandasına ekledi
            </Text>
          </View>
        </View>
        <View style={[st.actionBar, isDelayed ? st.delayActionBorder : st.liveActionBorder]}>
          <Text style={isDelayed ? st.delayActionLabel : st.actionLabel}>
            {isDelayed ? 'Gecikme Yönetimi:' : 'Hızlı Koordinasyon:'}
          </Text>
          {isDelayed ? (
            <>
              <Action
                label="Hızlı Yönet & Başlat"
                icon={Sparkles}
                tone="amber"
                onPress={() => onOpenQuickSession(session.id)}
              />
              <Action
                label="Canlı Başlat"
                icon={Radio}
                tone="green"
                onPress={() => setStatus(session, 'live')}
              />
              <Action
                label="Detay Düzenle"
                icon={Edit3}
                onPress={() => onOpenEditSession(session)}
              />
              <Action label="+5 dk Daha Ekle" tone="orange" onPress={() => delaySession(session, 5)} />
            </>
          ) : (
            <>
              <Action label="Düzenle" icon={Edit3} onPress={() => onOpenEditSession(session)} />
              <Action label="+5 dk" tone="orange" onPress={() => delaySession(session, 5)} />
              <Action label="+10 dk" tone="orange" onPress={() => delaySession(session, 10)} />
              <Action label="+15 dk" tone="orange" onPress={() => delaySession(session, 15)} />
              <Action
                label="Alan Değiştir"
                icon={MapPin}
                onPress={() => onOpenQuickSession(session.id)}
              />
              <Action
                label="Tamamlandı"
                icon={CheckCircle2}
                tone="dark"
                onPress={() => setStatus(session, 'completed')}
              />
            </>
          )}
        </View>
      </View>
    );
  }

  return (
    <View
      style={st.root}
      onLayout={(event) => {
        const next = Math.round(event.nativeEvent.layout.width);
        if (next !== layoutWidth) setLayoutWidth(next);
      }}
    >
      <View style={[st.hero, heroHorizontal && st.heroRow]}>
        <View style={st.heroCopy}>
          <View style={st.heroMeta}>
            <View style={st.coordinationPill}>
              <View style={st.greenDot} />
              <Text style={st.coordinationText}>CANLI ETKİNLİK KOORDİNASYONU</Text>
            </View>
            <Text style={st.heroDate}>24 Ekim 2026 • Gün 1 • 14:22</Text>
          </View>
          <Text style={st.heroTitle}>Take Off İstanbul Durum Ekranı</Text>
          <Text style={st.heroSub}>
            Sahnelerdeki canlı akışları takip edin, anlık program gecikmelerini yönetin ve
            katılımcılara operasyonel duyurular gönderin.
          </Text>
        </View>
          <View
            style={[
              st.heroActions,
              !heroHorizontal && st.heroActionsMobile,
              heroHorizontal && st.heroActionsWide,
            ]}
          >
            <Pressable style={[st.heroActionButton, st.heroSecondary]} onPress={onOpenCreateSession}>
              <Plus size={16} color="#fff" />
              <Text style={st.heroButtonText}>Yeni Oturum Ekle</Text>
            </Pressable>
            <Pressable style={[st.heroActionButton, st.heroPrimary]} onPress={onOpenCreateAnnouncement}>
            <BellRing size={16} color="#fff" />
            <Text style={st.heroButtonText}>Yeni Duyuru Gönder</Text>
          </Pressable>
        </View>
      </View>

      <View style={st.metricGrid}>
        <MetricCard
          icon={CalendarDays}
          title="Bugünkü Oturumlar"
          value={`${today.length} Oturum`}
          note={`${live.length} Canlı Akış`}
          accent="#c85000"
          basis={basis}
          onPress={() => onNavigate('program')}
        />
        <MetricCard
          icon={Radio}
          title="Devam Edenler"
          value={`${live.length} Oturum`}
          note="Sahnelerde Yayında"
          accent={colors.success}
          basis={basis}
          onPress={() => onNavigate('program')}
        />
        <MetricCard
          icon={Store}
          title="Aktif Stantlar"
          value={`${activeBooths} Stant`}
          note="4 Bölgede Aktif"
          accent="#c85000"
          basis={basis}
          onPress={() => onNavigate('venues_and_stands')}
        />
        <MetricCard
          icon={Users}
          title="Mekânda Katılımcı"
          value="1.890"
          note="2.420 kayıtlı (%78)"
          accent="#6941ff"
          basis={basis}
          onPress={() => onNavigate('attendees')}
        />
        <MetricCard
          icon={Handshake}
          title="Bugünkü B2B"
          value="42"
          note="Katılımcı Randevusu (Pasif)"
          accent="#b75d00"
          basis={basis}
          muted
        />
        <MetricCard
          icon={QrCode}
          title="Toplam Check-in"
          value="1.640"
          note="Kapı Girişi Tamamlandı"
          accent="#008f7a"
          basis={basis}
          muted
        />
      </View>

      <View style={[st.columns, split && st.columnsSplit]}>
        <View style={[st.leftColumn, split && st.leftColumnSplit]}>
          <View style={st.panel}>
            <View style={st.panelHead}>
              <View style={st.panelTitleLine}>
                <View style={st.sectionDot} />
                <Text style={st.panelTitle}>Şu Anda Devam Eden Oturumlar (Canlı)</Text>
              </View>
              <Pressable style={st.link} onPress={() => onNavigate('program')}>
                <Text style={st.linkText}>Tüm Programı Gör</Text>
                <ChevronRight size={14} color="#c85000" />
              </Pressable>
            </View>
            {live.map((session) => (
              <SessionCard key={session.id} session={session} />
            ))}
            {delayed.map((session) => (
              <SessionCard key={session.id} session={session} isDelayed />
            ))}
            {!live.length && !delayed.length ? (
              <View style={st.empty}>
                <CheckCircle2 size={20} color={colors.success} />
                <View style={st.flex}>
                  <Text style={st.emptyTitle}>Canlı veya gecikmiş oturum yok</Text>
                  <Text style={st.emptySub}>Program akışı şu anda planlandığı gibi ilerliyor.</Text>
                </View>
              </View>
            ) : null}
          </View>

          <View style={st.panel}>
            <View style={st.panelHead}>
              <View style={st.flex}>
                <Text style={st.panelTitle}>Yaklaşan Oturumlar</Text>
                <Text style={st.panelSub}>Önümüzdeki saatlerde başlayacak program akışı</Text>
              </View>
              <Pressable style={st.smallPrimary} onPress={onOpenCreateSession}>
                <Plus size={14} color="#fff" />
                <Text style={st.smallPrimaryText}>Oturum Ekle</Text>
              </Pressable>
            </View>
            {upcoming.map((session, index) => (
              <View key={session.id} style={st.upcomingRow}>
                <View style={st.upcomingTimeBox}>
                  <Text style={st.upcomingTime}>{session.time}</Text>
                  <Text style={st.upcomingWhen}>
                    {index === 0 ? '12 dk sonra' : index === 1 ? '27 dk sonra' : 'Bugün'}
                  </Text>
                </View>
                <View style={st.upcomingCopy}>
                  <Text style={st.upcomingTitle}>{session.title}</Text>
                  <Text style={st.upcomingSub} numberOfLines={1}>
                    {session.speakers.map((speaker) => speaker.name).join(', ') || 'Açık Oturum'}
                  </Text>
                  <Text style={st.upcomingStage}>{session.stageName}</Text>
                  <Text style={st.upcomingCount}>{session.bookmarkedCount} kişi kayıtlı</Text>
                  <Pressable style={st.manage} onPress={() => onOpenQuickSession(session.id)}>
                    <Text style={st.manageText}>Düzenle / Geciktir</Text>
                  </Pressable>
                </View>
              </View>
            ))}
          </View>
        </View>

        <View style={[st.rightColumn, split && st.rightColumnSplit]}>
          <View style={st.panel}>
            <View style={st.panelHeadBorder}>
              <View style={st.panelTitleLine}>
                <CircleAlert size={17} color="#c85000" />
                <Text style={st.panelTitle}>Operasyon Uyarıları</Text>
              </View>
              <View style={st.alarmCount}>
                <Text style={st.alarmText}>{alerts.length} Alarm</Text>
              </View>
            </View>
            {alerts.map((alert) => (
              <View
                key={alert.id}
                style={[
                  st.alert,
                  alert.tone === 'red'
                    ? st.alertRed
                    : alert.tone === 'amber'
                      ? st.alertAmber
                      : st.alertBlue,
                ]}
              >
                <View style={st.alertHead}>
                  <Text style={st.alertTitle}>{alert.title}</Text>
                  <Pressable onPress={() => onNavigate(alert.view)}>
                    <Text style={st.alertAction}>{alert.action} →</Text>
                  </Pressable>
                </View>
                <Text style={st.alertSub}>{alert.description}</Text>
              </View>
            ))}
          </View>

          <View style={st.panel}>
            <View style={st.panelHeadBorder}>
              <View style={st.panelTitleLine}>
                <BellRing size={17} color="#c85000" />
                <Text style={st.panelTitle}>Son Duyurular</Text>
              </View>
              <Pressable onPress={() => onNavigate('announcements')}>
                <Text style={st.linkText}>Tümü</Text>
              </Pressable>
            </View>
            {store.announcements.slice(0, 3).map((item) => (
              <View key={item.id} style={st.announcement}>
                <View style={st.announcementHead}>
                  <Text style={st.announcementTitle} numberOfLines={1}>
                    {item.title}
                  </Text>
                  <Text style={st.announcementTime}>
                    {item.sentAt || item.scheduledFor || 'Bugün'}
                  </Text>
                </View>
                <Text style={st.announcementMessage} numberOfLines={2}>
                  {item.message}
                </Text>
                <Text style={st.announcementTarget}>Hedef: {item.targetAudience}</Text>
              </View>
            ))}
            <Pressable style={st.announcementButton} onPress={onOpenCreateAnnouncement}>
              <Send size={15} color="#e76a17" />
              <Text style={st.announcementButtonText}>Yeni Duyuru Oluştur</Text>
            </Pressable>
          </View>
        </View>
      </View>

      <View style={st.panel}>
        <View>
          <Text style={st.panelTitle}>Son Admin İşlemleri</Text>
          <Text style={st.panelSub}>Operasyon günlüğü</Text>
        </View>
        <View style={st.logGrid}>
          {store.logs.slice(0, 6).map((log) => (
            <View key={log.id} style={st.logRow}>
              <Activity size={14} color="#c85000" />
              <View style={st.flex}>
                <Text style={st.logTitle}>{log.action}</Text>
                <Text style={st.logSub}>
                  {log.target} • {log.adminName}
                </Text>
              </View>
              <Text style={st.logTime}>{log.timestamp}</Text>
            </View>
          ))}
        </View>
      </View>
    </View>
  );
}

const st = StyleSheet.create({
  root: { gap: 18 },
  flex: { flex: 1, minWidth: 0 },
  pressed: { opacity: 0.72 },
  hero: {
    minHeight: 190,
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 18,
    padding: 23,
    borderWidth: 1,
    borderColor: '#243449',
    borderRadius: 19,
    backgroundColor: '#111b2d',
  },
  heroRow: { minHeight: 160, flexDirection: 'row', alignItems: 'center' },
  heroCopy: { flex: 1, minWidth: 0, maxWidth: 700 },
  heroMeta: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 8 },
  coordinationPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderWidth: 1,
    borderColor: 'rgba(52,211,153,0.35)',
    borderRadius: 99,
    backgroundColor: 'rgba(16,185,129,0.15)',
  },
  greenDot: { width: 7, height: 7, borderRadius: 4, backgroundColor: '#34d399' },
  coordinationText: { color: '#6ee7b7', fontSize: 10, fontWeight: '900' },
  heroDate: { color: '#a6b4c7', fontSize: 10, fontWeight: '700' },
  heroTitle: { color: '#fff', fontSize: 22, lineHeight: 28, fontWeight: '900', marginTop: 8 },
  heroSub: { color: '#d0d8e5', fontSize: 12, lineHeight: 18, marginTop: 5 },
  heroActions: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  heroActionsMobile: { width: '100%' },
  heroActionsWide: { justifyContent: 'flex-end', maxWidth: 370 },
  heroActionButton: { flex: 1, minWidth: 0 },
  heroSecondary: {
    minHeight: 41,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 15,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.22)',
    borderRadius: 11,
    backgroundColor: 'rgba(255,255,255,0.09)',
  },
  heroPrimary: {
    minHeight: 41,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 15,
    borderRadius: 11,
    backgroundColor: '#c85000',
  },
  heroButtonText: { color: '#fff', fontSize: 11, fontWeight: '900' },
  metricGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  metric: {
    flexGrow: 1,
    minWidth: 0,
    minHeight: 100,
    justifyContent: 'space-between',
    padding: 15,
    borderWidth: 1,
    borderColor: '#dfe3e8',
    borderRadius: 16,
    backgroundColor: '#fff',
  },
  metricMuted: { backgroundColor: '#fcfcfd' },
  metricHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 6 },
  metricTitle: { flexShrink: 1, color: '#687386', fontSize: 10, fontWeight: '600' },
  metricValue: { color: '#111827', fontSize: 18, lineHeight: 24, fontWeight: '900' },
  metricNote: { fontSize: 9, lineHeight: 13, fontWeight: '700' },
  columns: { gap: 18 },
  columnsSplit: { flexDirection: 'row', alignItems: 'flex-start' },
  leftColumn: { gap: 18 },
  leftColumnSplit: { flex: 2, minWidth: 0 },
  rightColumn: { gap: 18 },
  rightColumnSplit: { flex: 1, minWidth: 280 },
  panel: {
    gap: 13,
    padding: 18,
    borderWidth: 1,
    borderColor: '#dfe3e8',
    borderRadius: 17,
    backgroundColor: '#fff',
  },
  panelHead: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    flexWrap: 'wrap',
    gap: 10,
  },
  panelHeadBorder: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#edf0f3',
  },
  panelTitleLine: { flexDirection: 'row', alignItems: 'center', gap: 8, flexShrink: 1 },
  sectionDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: '#10b981' },
  panelTitle: { flexShrink: 1, color: '#111827', fontSize: 13, lineHeight: 18, fontWeight: '900' },
  panelSub: { color: '#7a8492', fontSize: 10, lineHeight: 15, marginTop: 2 },
  link: { flexDirection: 'row', alignItems: 'center', gap: 2 },
  linkText: { color: '#c85000', fontSize: 10, fontWeight: '900' },
  sessionCard: { gap: 13, padding: 15, borderWidth: 1, borderRadius: 15 },
  sessionLive: { borderColor: '#5ee0ae', backgroundColor: '#f1fdf8' },
  sessionDelayed: { borderColor: '#efc468', backgroundColor: '#fff9e9' },
  sessionTop: { flexDirection: 'row', alignItems: 'flex-start', flexWrap: 'wrap', gap: 12 },
  sessionCopy: { flex: 1, minWidth: 230 },
  sessionMeta: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 8 },
  livePill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
    backgroundColor: '#079966',
  },
  delayPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 10,
    backgroundColor: '#d68a0b',
  },
  statusText: { color: '#fff', fontSize: 9, fontWeight: '900' },
  sessionTime: { color: '#1f2937', fontSize: 10, fontWeight: '900' },
  delayTimePill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 9,
    paddingVertical: 5,
    borderWidth: 1,
    borderColor: '#e8c66f',
    borderRadius: 10,
    backgroundColor: '#fff1bd',
  },
  delayTimeText: { color: '#724800', fontSize: 9, fontWeight: '900' },
  stagePill: {
    paddingHorizontal: 11,
    paddingVertical: 5,
    borderWidth: 1,
    borderColor: '#9ceaca',
    borderRadius: 11,
    backgroundColor: '#c9fae5',
  },
  stageText: { color: '#08714a', fontSize: 10, fontWeight: '900' },
  delayStagePill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 9,
    paddingVertical: 5,
    borderWidth: 1,
    borderColor: '#e4bc62',
    borderRadius: 10,
    backgroundColor: '#ffe49a',
  },
  delayStageText: { color: '#724800', fontSize: 9, fontWeight: '900' },
  sessionTitle: { color: '#111827', fontSize: 13, lineHeight: 18, fontWeight: '900', marginTop: 7 },
  sessionSub: { color: '#526071', fontSize: 10, lineHeight: 15, marginTop: 3 },
  participant: { color: '#374151', fontSize: 10, fontWeight: '900' },
  participantSub: { color: '#687386', fontSize: 9, marginTop: 3 },
  delayParticipant: { color: '#704600', fontSize: 10, fontWeight: '900' },
  delayParticipantSub: { color: '#8a5a0a', fontSize: 9, marginTop: 3 },
  actionBar: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 8, paddingTop: 12, borderTopWidth: 1 },
  liveActionBorder: { borderTopColor: '#a7ead0' },
  delayActionBorder: { borderTopColor: '#efd591' },
  actionLabel: { color: '#3d4857', fontSize: 9, fontWeight: '900' },
  delayActionLabel: { color: '#805000', fontSize: 9, fontWeight: '900' },
  action: {
    minHeight: 30,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 10,
    borderWidth: 1,
    borderRadius: 10,
  },
  actionText: { fontSize: 9, fontWeight: '900' },
  empty: { flexDirection: 'row', alignItems: 'center', gap: 9, padding: 12, borderRadius: 12, backgroundColor: '#effcf6' },
  emptyTitle: { color: '#133426', fontSize: 11, fontWeight: '900' },
  emptySub: { color: '#587064', fontSize: 9, marginTop: 2 },
  smallPrimary: { minHeight: 32, flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 10, borderRadius: 10, backgroundColor: '#c85000' },
  smallPrimaryText: { color: '#fff', fontSize: 9, fontWeight: '900' },
  upcomingRow: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 11, paddingTop: 12, borderTopWidth: 1, borderTopColor: '#edf0f3' },
  upcomingTimeBox: { width: 58 },
  upcomingTime: { color: '#111827', fontSize: 13, fontWeight: '900' },
  upcomingWhen: { color: '#7a8492', fontSize: 8, marginTop: 2 },
  upcomingCopy: { flex: 1, minWidth: 170 },
  upcomingTitle: { color: '#111827', fontSize: 10, fontWeight: '900' },
  upcomingSub: { color: '#7a8492', fontSize: 9, marginTop: 2 },
  upcomingStage: { color: '#4d5968', fontSize: 9, fontWeight: '700', marginTop: 4 },
  upcomingCount: { color: '#c85000', fontSize: 9, fontWeight: '900', marginTop: 2 },
  manage: { alignSelf: 'flex-start', minHeight: 28, justifyContent: 'center', marginTop: 9, paddingHorizontal: 9, borderWidth: 1, borderColor: '#d5dae1', borderRadius: 9, backgroundColor: '#fff' },
  manageText: { color: '#374151', fontSize: 8, fontWeight: '900' },
  alarmCount: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 99, backgroundColor: '#fff0e5' },
  alarmText: { color: '#c85000', fontSize: 8, fontWeight: '900' },
  alert: { gap: 5, padding: 11, borderWidth: 1, borderRadius: 11 },
  alertRed: { borderColor: '#fecaca', backgroundColor: '#fff6f6' },
  alertAmber: { borderColor: '#f5d98a', backgroundColor: '#fffaf0' },
  alertBlue: { borderColor: '#bfdbfe', backgroundColor: '#f5f9ff' },
  alertHead: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: 6 },
  alertTitle: { flex: 1, color: '#111827', fontSize: 10, lineHeight: 14, fontWeight: '900' },
  alertAction: { color: '#c85000', fontSize: 8, fontWeight: '900' },
  alertSub: { color: '#606b79', fontSize: 9, lineHeight: 14 },
  announcement: { gap: 4, padding: 11, borderRadius: 11, backgroundColor: '#f7f8fa' },
  announcementHead: { flexDirection: 'row', alignItems: 'center', gap: 7 },
  announcementTitle: { flex: 1, color: '#111827', fontSize: 10, fontWeight: '900' },
  announcementTime: { color: '#8b95a3', fontSize: 7 },
  announcementMessage: { color: '#606b79', fontSize: 9, lineHeight: 13 },
  announcementTarget: { color: '#c85000', fontSize: 8, fontWeight: '800' },
  announcementButton: { minHeight: 38, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 7, borderRadius: 10, backgroundColor: '#111827' },
  announcementButtonText: { color: '#fff', fontSize: 10, fontWeight: '900' },
  logGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  logRow: { flexGrow: 1, flexBasis: 320, minWidth: 250, flexDirection: 'row', alignItems: 'flex-start', gap: 8, padding: 10, borderRadius: 10, backgroundColor: '#f7f8fa' },
  logTitle: { color: '#27313d', fontSize: 9, fontWeight: '800' },
  logSub: { color: '#778291', fontSize: 8, lineHeight: 12, marginTop: 2 },
  logTime: { color: '#8b95a3', fontSize: 8 },
});
