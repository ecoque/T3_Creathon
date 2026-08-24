import {
  BellRing,
  CircleAlert,
  Clock3,
  Eye,
  MousePointerClick,
  Plus,
  Send,
  Smartphone,
  Trash2,
  Users,
} from 'lucide-react-native';
import { useEffect, useMemo, useState, type ComponentType } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, useWindowDimensions, View } from 'react-native';

import { colors } from '../../constants/theme';
import type { AdminAnnouncement } from '../../types/admin';

type AnnouncementTab = 'all' | AdminAnnouncement['status'];
type IconType = ComponentType<{ size?: number; color?: string }>;

type AdminAnnouncementsProps = {
  announcements: AdminAnnouncement[];
  onOpenCreateAnnouncement: () => void;
  onDeleteAnnouncement: (announcement: AdminAnnouncement) => void;
};

const STATUS: Record<
  AdminAnnouncement['status'],
  { label: string; color: string; backgroundColor: string; borderColor: string }
> = {
  sent: {
    label: 'GÖNDERİLDİ',
    color: colors.success,
    backgroundColor: colors.successBg,
    borderColor: colors.successBorder,
  },
  scheduled: {
    label: 'PLANLANDI',
    color: '#24549a',
    backgroundColor: '#e7f0ff',
    borderColor: '#c7daf5',
  },
  draft: {
    label: 'TASLAK',
    color: colors.textMuted,
    backgroundColor: colors.surfaceMuted,
    borderColor: colors.borderStrong,
  },
};

function formatNumber(value: number) {
  return value.toLocaleString('tr-TR');
}

function MetricCard({
  icon: Icon,
  value,
  label,
  note,
  color,
  compact,
}: {
  icon: IconType;
  value: string | number;
  label: string;
  note: string;
  color: string;
  compact: boolean;
}) {
  return (
    <View style={[styles.metricCard, compact && styles.metricCardCompact]}>
      <View style={[styles.metricIcon, { backgroundColor: color + '16' }]}>
        <Icon size={18} color={color} />
      </View>
      <View style={styles.metricCopy}>
        <Text style={styles.metricValue}>{value}</Text>
        <Text style={styles.metricLabel}>{label}</Text>
        <Text numberOfLines={1} style={styles.metricNote}>
          {note}
        </Text>
      </View>
    </View>
  );
}

function StatusPill({ status }: { status: AdminAnnouncement['status'] }) {
  const palette = STATUS[status];
  return (
    <View
      style={[
        styles.statusPill,
        { backgroundColor: palette.backgroundColor, borderColor: palette.borderColor },
      ]}
    >
      <Text style={[styles.statusText, { color: palette.color }]}>{palette.label}</Text>
    </View>
  );
}

function AnnouncementCard({
  announcement,
  selected,
  onSelect,
  onDelete,
}: {
  announcement: AdminAnnouncement;
  selected: boolean;
  onSelect: () => void;
  onDelete: () => void;
}) {
  const openRate = announcement.recipientCount
    ? Math.round((announcement.readCount / announcement.recipientCount) * 100)
    : 0;
  const deliveryTime =
    announcement.sentAt || announcement.scheduledFor || 'Henüz gönderim zamanı belirlenmedi';

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected }}
      accessibilityLabel={`${announcement.title} duyurusunu önizle`}
      style={[styles.announcementCard, selected && styles.announcementCardSelected]}
      onPress={onSelect}
    >
      <View style={styles.cardTop}>
        <View style={styles.cardStatusLine}>
          <StatusPill status={announcement.status} />
          <View style={styles.deliveryLine}>
            <Clock3 size={12} color={colors.textMuted} />
            <Text style={styles.deliveryText}>{deliveryTime}</Text>
          </View>
        </View>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`${announcement.title} duyurusunu sil`}
          hitSlop={8}
          style={styles.deleteButton}
          onPress={(event) => {
            event.stopPropagation();
            onDelete();
          }}
        >
          <Trash2 size={16} color={colors.danger} />
        </Pressable>
      </View>

      <Text style={styles.cardTitle}>{announcement.title}</Text>
      <Text numberOfLines={2} style={styles.cardMessage}>
        {announcement.message}
      </Text>

      <View style={styles.targetLine}>
        <View style={styles.audiencePill}>
          <Users size={12} color={colors.primary} />
          <Text style={styles.audienceText}>{announcement.targetAudience}</Text>
        </View>
        {announcement.targetZone ? (
          <View style={styles.zonePill}>
            <Text style={styles.zoneText}>{announcement.targetZone}</Text>
          </View>
        ) : null}
      </View>

      {announcement.status === 'sent' ? (
        <View style={styles.performanceGrid}>
          <View style={styles.performanceItem}>
            <Send size={13} color={colors.primary} />
            <View>
              <Text style={styles.performanceValue}>
                {formatNumber(announcement.recipientCount)}
              </Text>
              <Text style={styles.performanceLabel}>Alıcı</Text>
            </View>
          </View>
          <View style={styles.performanceItem}>
            <Eye size={13} color={colors.success} />
            <View>
              <Text style={styles.performanceValue}>%{openRate}</Text>
              <Text style={styles.performanceLabel}>
                {formatNumber(announcement.readCount)} okuma
              </Text>
            </View>
          </View>
          <View style={styles.performanceItem}>
            <MousePointerClick size={13} color="#24549a" />
            <View>
              <Text style={styles.performanceValue}>{formatNumber(announcement.clickCount)}</Text>
              <Text style={styles.performanceLabel}>Tıklama</Text>
            </View>
          </View>
        </View>
      ) : (
        <View style={styles.estimateLine}>
          <Users size={13} color={colors.textMuted} />
          <Text style={styles.estimateText}>
            Planlanan kitle: yaklaşık {formatNumber(announcement.recipientCount)} kişi
          </Text>
        </View>
      )}
    </Pressable>
  );
}

function PhonePreview({ announcement }: { announcement: AdminAnnouncement | null }) {
  return (
    <View style={styles.previewPanel}>
      <View style={styles.previewHeading}>
        <View style={styles.previewTitleLine}>
          <Smartphone size={17} color={colors.primary} />
          <Text style={styles.previewTitle}>Mobil Bildirim Görünümü</Text>
        </View>
        <Text style={styles.previewSubtitle}>Seçilen duyurunun kullanıcı cihazındaki hali</Text>
      </View>

      {announcement ? (
        <View style={styles.phone}>
          <View style={styles.notch} />
          <View style={styles.lockScreenTime}>
            <Text style={styles.phoneTime}>14:24</Text>
            <Text style={styles.phoneDate}>Cuma, 24 Ekim</Text>
          </View>

          <View style={styles.notification}>
            <View style={styles.notificationHeader}>
              <View style={styles.notificationBrand}>
                <View style={styles.notificationLogo}>
                  <Text style={styles.notificationLogoText}>T</Text>
                </View>
                <Text style={styles.notificationApp}>TakeOff Summit</Text>
              </View>
              <Text style={styles.notificationNow}>Şimdi</Text>
            </View>
            <Text numberOfLines={2} style={styles.notificationTitle}>
              {announcement.title}
            </Text>
            <Text numberOfLines={4} style={styles.notificationMessage}>
              {announcement.message}
            </Text>
            {announcement.ctaText ? (
              <View style={styles.notificationCta}>
                <Text style={styles.notificationCtaText}>{announcement.ctaText}</Text>
                <Text style={styles.notificationChevron}>›</Text>
              </View>
            ) : null}
          </View>

          <View style={styles.homeIndicator} />
        </View>
      ) : (
        <View style={styles.previewEmpty}>
          <BellRing size={24} color={colors.textMuted} />
          <Text style={styles.previewEmptyTitle}>Önizlenecek duyuru yok</Text>
          <Text style={styles.previewEmptyBody}>Bir duyuru oluşturduğunuzda burada görünür.</Text>
        </View>
      )}
    </View>
  );
}

export function AdminAnnouncements({
  announcements,
  onOpenCreateAnnouncement,
  onDeleteAnnouncement,
}: AdminAnnouncementsProps) {
  const { width } = useWindowDimensions();
  const compact = width < 700;
  const wide = width >= 1100;
  const [selectedTab, setSelectedTab] = useState<AnnouncementTab>('all');
  const [previewId, setPreviewId] = useState<string | null>(announcements[0]?.id || null);

  const counts = useMemo(
    () => ({
      all: announcements.length,
      sent: announcements.filter((item) => item.status === 'sent').length,
      scheduled: announcements.filter((item) => item.status === 'scheduled').length,
      draft: announcements.filter((item) => item.status === 'draft').length,
    }),
    [announcements],
  );
  const filteredAnnouncements = useMemo(
    () => announcements.filter((item) => selectedTab === 'all' || item.status === selectedTab),
    [announcements, selectedTab],
  );
  const recipients = announcements
    .filter((item) => item.status === 'sent')
    .reduce((sum, item) => sum + item.recipientCount, 0);
  const reads = announcements
    .filter((item) => item.status === 'sent')
    .reduce((sum, item) => sum + item.readCount, 0);
  const clicks = announcements
    .filter((item) => item.status === 'sent')
    .reduce((sum, item) => sum + item.clickCount, 0);
  const openRate = recipients ? Math.round((reads / recipients) * 100) : 0;
  const previewAnnouncement = announcements.find((item) => item.id === previewId) || null;

  useEffect(() => {
    if (!announcements.length) {
      setPreviewId(null);
      return;
    }
    if (!previewId || !announcements.some((item) => item.id === previewId)) {
      setPreviewId(announcements[0].id);
    }
  }, [announcements, previewId]);

  const tabs: { value: AnnouncementTab; label: string }[] = [
    { value: 'all', label: `Tümü (${counts.all})` },
    { value: 'sent', label: `Gönderilenler (${counts.sent})` },
    { value: 'scheduled', label: `Planlananlar (${counts.scheduled})` },
    { value: 'draft', label: `Taslaklar (${counts.draft})` },
  ];

  return (
    <View style={styles.root}>
      <View style={[styles.header, compact && styles.headerCompact]}>
        <View style={styles.headerCopy}>
          <Text style={styles.title}>Duyuru & Canlı Bildirim Yönetimi</Text>
          <Text style={styles.subtitle}>
            Katılımcılara, yatırımcılara veya belirli bölge ve oturum gruplarına anlık push bildirim
            gönderin.
          </Text>
        </View>
        <Pressable
          accessibilityRole="button"
          style={[styles.createButton, compact && styles.createButtonCompact]}
          onPress={onOpenCreateAnnouncement}
        >
          <Plus size={17} color={colors.white} />
          <Text style={styles.createButtonText}>Yeni Duyuru Yayınla</Text>
        </Pressable>
      </View>

      <View style={styles.metricGrid}>
        <MetricCard
          icon={Send}
          value={counts.sent}
          label="Gönderildi"
          note={`${formatNumber(recipients)} alıcı`}
          color={colors.primary}
          compact={compact}
        />
        <MetricCard
          icon={Clock3}
          value={counts.scheduled}
          label="Planlandı"
          note="Gönderim bekliyor"
          color="#24549a"
          compact={compact}
        />
        <MetricCard
          icon={Eye}
          value={`%${openRate}`}
          label="Okunma"
          note={`${formatNumber(reads)} görüntüleme`}
          color={colors.success}
          compact={compact}
        />
        <MetricCard
          icon={MousePointerClick}
          value={formatNumber(clicks)}
          label="Tıklama"
          note="CTA etkileşimi"
          color="#7c3aed"
          compact={compact}
        />
      </View>

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.tabs}
      >
        {tabs.map((tab) => {
          const active = selectedTab === tab.value;
          return (
            <Pressable
              key={tab.value}
              accessibilityRole="button"
              accessibilityState={{ selected: active }}
              style={[styles.tab, active && styles.tabActive]}
              onPress={() => setSelectedTab(tab.value)}
            >
              <Text style={[styles.tabText, active && styles.tabTextActive]}>{tab.label}</Text>
            </Pressable>
          );
        })}
      </ScrollView>

      <View style={[styles.content, wide && styles.contentWide]}>
        <View style={styles.listColumn}>
          {filteredAnnouncements.map((announcement) => (
            <AnnouncementCard
              key={announcement.id}
              announcement={announcement}
              selected={announcement.id === previewId}
              onSelect={() => setPreviewId(announcement.id)}
              onDelete={() => onDeleteAnnouncement(announcement)}
            />
          ))}
          {!filteredAnnouncements.length ? (
            <View style={styles.emptyState}>
              <CircleAlert size={25} color={colors.textMuted} />
              <Text style={styles.emptyTitle}>Duyuru bulunamadı</Text>
              <Text style={styles.emptyBody}>
                Bu durumda bir duyuru yok. Başka bir filtre seçebilir veya yeni duyuru
                yayınlayabilirsiniz.
              </Text>
            </View>
          ) : null}
        </View>
        <View style={styles.previewColumn}>
          <PhonePreview announcement={previewAnnouncement} />
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { gap: 15 },
  header: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 18,
  },
  headerCompact: { flexDirection: 'column' },
  headerCopy: { flex: 1, gap: 5 },
  title: { color: colors.text, fontSize: 22, lineHeight: 28, fontWeight: '900' },
  subtitle: {
    color: colors.textMuted,
    fontSize: 13,
    lineHeight: 19,
    fontWeight: '500',
    maxWidth: 760,
  },
  createButton: {
    minHeight: 44,
    paddingHorizontal: 17,
    borderRadius: 13,
    backgroundColor: colors.primary,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  createButtonCompact: { alignSelf: 'stretch' },
  createButtonText: { color: colors.white, fontSize: 13, fontWeight: '800' },
  metricGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  metricCard: {
    minWidth: 185,
    flex: 1,
    minHeight: 91,
    padding: 13,
    borderRadius: 15,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  metricCardCompact: { minWidth: '47%' },
  metricIcon: {
    width: 36,
    height: 36,
    borderRadius: 11,
    alignItems: 'center',
    justifyContent: 'center',
  },
  metricCopy: { flex: 1, gap: 1 },
  metricValue: { color: colors.text, fontSize: 18, fontWeight: '900' },
  metricLabel: { color: colors.text, fontSize: 11, fontWeight: '800' },
  metricNote: { color: colors.textMuted, fontSize: 9, fontWeight: '600' },
  tabs: {
    gap: 8,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: colors.borderStrong,
  },
  tab: {
    minHeight: 36,
    paddingHorizontal: 13,
    borderRadius: 11,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tabActive: { backgroundColor: colors.text, borderColor: colors.text },
  tabText: { color: colors.textMuted, fontSize: 11, fontWeight: '800' },
  tabTextActive: { color: colors.white },
  content: { gap: 14 },
  contentWide: { flexDirection: 'row', alignItems: 'flex-start', gap: 18 },
  listColumn: { flex: 2, gap: 11 },
  previewColumn: { flex: 1, minWidth: 300 },
  announcementCard: {
    backgroundColor: colors.surface,
    borderRadius: 17,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 14,
    gap: 10,
  },
  announcementCardSelected: {
    borderColor: colors.primary,
    borderWidth: 2,
    padding: 13,
    backgroundColor: '#fffdfa',
  },
  cardTop: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 8,
  },
  cardStatusLine: { flex: 1, flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 8 },
  statusPill: {
    minHeight: 24,
    paddingHorizontal: 8,
    borderRadius: 7,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  statusText: { fontSize: 9, fontWeight: '900', letterSpacing: 0.4 },
  deliveryLine: { flexDirection: 'row', alignItems: 'center', gap: 4, flexShrink: 1 },
  deliveryText: { color: colors.textMuted, fontSize: 10, fontWeight: '700', flexShrink: 1 },
  deleteButton: {
    width: 34,
    height: 34,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.dangerBorder,
    backgroundColor: colors.dangerBg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardTitle: { color: colors.text, fontSize: 15, lineHeight: 20, fontWeight: '900' },
  cardMessage: { color: colors.textMuted, fontSize: 12, lineHeight: 18, fontWeight: '500' },
  targetLine: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 7 },
  audiencePill: {
    minHeight: 27,
    paddingHorizontal: 8,
    borderRadius: 8,
    backgroundColor: colors.surfaceMuted,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  audienceText: { color: colors.textMuted, fontSize: 10, fontWeight: '800' },
  zonePill: {
    minHeight: 27,
    paddingHorizontal: 8,
    borderRadius: 8,
    backgroundColor: colors.primarySoft,
    justifyContent: 'center',
  },
  zoneText: { color: colors.primary, fontSize: 10, fontWeight: '900' },
  performanceGrid: {
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 14,
  },
  performanceItem: { minWidth: 86, flexDirection: 'row', alignItems: 'center', gap: 6 },
  performanceValue: { color: colors.text, fontSize: 11, fontWeight: '900' },
  performanceLabel: { color: colors.textMuted, fontSize: 8, fontWeight: '600' },
  estimateLine: {
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  estimateText: { color: colors.textMuted, fontSize: 10, fontWeight: '600' },
  previewPanel: {
    padding: 17,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: colors.borderStrong,
    backgroundColor: colors.surfaceContainer,
    alignItems: 'center',
    gap: 15,
  },
  previewHeading: { alignItems: 'center', gap: 3 },
  previewTitleLine: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  previewTitle: { color: colors.text, fontSize: 12, fontWeight: '900' },
  previewSubtitle: { color: colors.textMuted, fontSize: 9, textAlign: 'center' },
  phone: {
    width: '100%',
    maxWidth: 280,
    minHeight: 390,
    padding: 12,
    borderRadius: 35,
    borderWidth: 4,
    borderColor: '#303438',
    backgroundColor: '#1a1c1e',
    alignItems: 'center',
  },
  notch: { width: 90, height: 15, borderRadius: 10, backgroundColor: '#000000' },
  lockScreenTime: { alignItems: 'center', marginTop: 18, marginBottom: 23 },
  phoneTime: { color: colors.white, fontSize: 29, lineHeight: 34, fontWeight: '300' },
  phoneDate: { color: '#c8ccd0', fontSize: 9, fontWeight: '500' },
  notification: {
    width: '100%',
    borderRadius: 17,
    padding: 11,
    backgroundColor: '#f8f8f8',
    gap: 5,
  },
  notificationHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  notificationBrand: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  notificationLogo: {
    width: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  notificationLogoText: { color: colors.white, fontSize: 9, fontWeight: '900' },
  notificationApp: { color: colors.text, fontSize: 9, fontWeight: '900' },
  notificationNow: { color: '#7b8186', fontSize: 8, fontWeight: '500' },
  notificationTitle: { color: colors.text, fontSize: 11, lineHeight: 15, fontWeight: '900' },
  notificationMessage: { color: colors.textMuted, fontSize: 10, lineHeight: 14, fontWeight: '500' },
  notificationCta: {
    paddingTop: 6,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  notificationCtaText: { color: colors.primary, fontSize: 9, fontWeight: '900' },
  notificationChevron: { color: colors.textMuted, fontSize: 16, lineHeight: 16 },
  homeIndicator: {
    width: 76,
    height: 4,
    borderRadius: 4,
    backgroundColor: '#ffffff66',
    marginTop: 'auto',
    marginBottom: 1,
  },
  previewEmpty: { minHeight: 300, alignItems: 'center', justifyContent: 'center', gap: 7 },
  previewEmptyTitle: { color: colors.text, fontSize: 13, fontWeight: '900' },
  previewEmptyBody: { color: colors.textMuted, fontSize: 10, textAlign: 'center' },
  emptyState: {
    minHeight: 180,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 17,
    padding: 22,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 7,
  },
  emptyTitle: { color: colors.text, fontSize: 14, fontWeight: '900' },
  emptyBody: { color: colors.textMuted, fontSize: 11, lineHeight: 17, textAlign: 'center' },
});
