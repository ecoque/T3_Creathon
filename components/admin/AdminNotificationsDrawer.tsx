import {
  AlertTriangle,
  ArrowRight,
  BellRing,
  CheckCircle2,
  Clock3,
  ShieldAlert,
  Trash2,
  X,
} from 'lucide-react-native';
import { useEffect, useMemo, useState, type ComponentType } from 'react';
import { Modal, Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { colors } from '../../constants/theme';
import { useAdminStore } from '../../lib/adminStore';
import type { AdminLogItem, AdminViewType } from '../../types/admin';

type NotificationLevel = 'high' | 'warning' | 'info' | 'success';
type NotificationIcon = ComponentType<{ size?: number; color?: string }>;

type AdminOperationNotification = {
  id: string;
  level: NotificationLevel;
  title: string;
  message: string;
  time: string;
  actionText: string;
  viewTarget: AdminViewType;
};

type AdminNotificationsDrawerProps = {
  visible: boolean;
  onClose: () => void;
  onNavigate: (view: AdminViewType) => void;
  onUnreadCountChange?: (count: number) => void;
};

const LEVEL_PRESENTATION: Record<
  NotificationLevel,
  {
    label: string;
    icon: NotificationIcon;
    accent: string;
    background: string;
    border: string;
  }
> = {
  high: {
    label: 'Kritik',
    icon: ShieldAlert,
    accent: colors.danger,
    background: '#fff5f4',
    border: colors.dangerBorder,
  },
  warning: {
    label: 'Uyarı',
    icon: AlertTriangle,
    accent: '#965900',
    background: '#fffaf0',
    border: '#f2d49b',
  },
  info: {
    label: 'Bilgi',
    icon: Clock3,
    accent: '#2563a6',
    background: '#f3f8ff',
    border: '#bfd8f3',
  },
  success: {
    label: 'Tamamlandı',
    icon: CheckCircle2,
    accent: colors.success,
    background: '#f3fbf5',
    border: colors.successBorder,
  },
};

function logTarget(log: AdminLogItem | undefined): AdminViewType {
  if (log?.type === 'session') return 'program';
  if (log?.type === 'booth' || log?.type === 'stage') return 'venues_and_stands';
  if (log?.type === 'announcement') return 'announcements';
  return 'dashboard';
}

export function AdminNotificationsDrawer({
  visible,
  onClose,
  onNavigate,
  onUnreadCountChange,
}: AdminNotificationsDrawerProps) {
  const { stages, zones, sessions, logs } = useAdminStore();
  const insets = useSafeAreaInsets();
  const [readIds, setReadIds] = useState<Set<string>>(() => new Set());
  const [dismissedIds, setDismissedIds] = useState<Set<string>>(() => new Set());

  const notifications = useMemo<AdminOperationNotification[]>(() => {
    const capacityStage = [...stages]
      .filter((stage) => stage.capacity > 0 && stage.status === 'active')
      .sort(
        (left, right) =>
          right.currentOccupancy / right.capacity - left.currentOccupancy / left.capacity,
      )[0];
    const crowdedZone = [...zones].sort(
      (left, right) => right.densityPercent - left.densityPercent,
    )[0];
    const delayedSession = sessions.find((session) => session.status === 'delayed');
    const completedUpdate = logs.find((log) => log.type === 'announcement') || logs[0];
    const items: AdminOperationNotification[] = [];

    if (capacityStage && capacityStage.currentOccupancy / capacityStage.capacity >= 0.85) {
      const percent = Math.round((capacityStage.currentOccupancy / capacityStage.capacity) * 100);
      items.push({
        id: `capacity-${capacityStage.id}`,
        level: 'high',
        title: `${capacityStage.name} kapasite limitine yaklaştı`,
        message: `Salon doluluğu %${percent} seviyesine ulaştı (${capacityStage.currentOccupancy} / ${capacityStage.capacity} kişi). Güvenlik yönlendirmesi önerilir.`,
        time: '2 dakika önce',
        actionText: 'Canlı durumu incele',
        viewTarget: 'dashboard',
      });
    }

    if (crowdedZone && crowdedZone.densityPercent >= 65) {
      items.push({
        id: `density-${crowdedZone.id}`,
        level: 'warning',
        title: `${crowdedZone.code} yoğunluk artışı`,
        message: `${crowdedZone.name} alanında doluluk %${crowdedZone.densityPercent} seviyesinde. Saha giriş ve çıkış akışının izlenmesi önerilir.`,
        time: '6 dakika önce',
        actionText: 'Alan yoğunluğunu aç',
        viewTarget: 'map_management',
      });
    }

    if (delayedSession) {
      items.push({
        id: `delay-${delayedSession.id}`,
        level: 'info',
        title: `${delayedSession.stageName} gecikme bildirimi`,
        message: `${delayedSession.title} oturumu ${delayedSession.delayMinutes || 0} dakika gecikmeli başlatılacak. ${delayedSession.bookmarkedCount} katılımcının programında yer alıyor.`,
        time: '18 dakika önce',
        actionText: 'Programı gör',
        viewTarget: 'program',
      });
    }

    if (completedUpdate) {
      items.push({
        id: `update-${completedUpdate.id}`,
        level: 'success',
        title: 'Operasyon güncellemesi tamamlandı',
        message: `${completedUpdate.action} ${completedUpdate.target}`,
        time: completedUpdate.timestamp,
        actionText: 'İlgili sayfayı aç',
        viewTarget: logTarget(completedUpdate),
      });
    }

    return items;
  }, [logs, sessions, stages, zones]);

  const visibleNotifications = useMemo(
    () => notifications.filter((notification) => !dismissedIds.has(notification.id)),
    [dismissedIds, notifications],
  );
  const unreadCount = visibleNotifications.filter(
    (notification) => !readIds.has(notification.id),
  ).length;

  useEffect(() => {
    onUnreadCountChange?.(unreadCount);
  }, [onUnreadCountChange, unreadCount]);

  function markAllAsRead() {
    setReadIds((current) => {
      const next = new Set(current);
      visibleNotifications.forEach((notification) => next.add(notification.id));
      return next;
    });
  }

  function dismissNotification(id: string) {
    setDismissedIds((current) => new Set(current).add(id));
  }

  function clearAll() {
    setDismissedIds((current) => {
      const next = new Set(current);
      visibleNotifications.forEach((notification) => next.add(notification.id));
      return next;
    });
  }

  function openNotification(notification: AdminOperationNotification) {
    setReadIds((current) => new Set(current).add(notification.id));
    onNavigate(notification.viewTarget);
    onClose();
  }

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      statusBarTranslucent
      navigationBarTranslucent={Platform.OS === 'android'}
      onRequestClose={onClose}
    >
      <View style={styles.overlay}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Bildirimleri kapat"
          style={StyleSheet.absoluteFill}
          onPress={onClose}
        />
        <View
          style={[
            styles.drawer,
            { paddingTop: Math.max(insets.top, 14), paddingBottom: Math.max(insets.bottom, 14) },
          ]}
        >
          <View style={styles.header}>
            <View style={styles.headerTitleRow}>
              <View style={styles.headerIcon}>
                <BellRing size={17} color={colors.primary} />
              </View>
              <View style={styles.flex}>
                <View style={styles.titleLine}>
                  <Text style={styles.title}>Operasyon Uyarıları</Text>
                  {unreadCount > 0 ? (
                    <View style={styles.countBadge}>
                      <Text style={styles.countText}>{unreadCount}</Text>
                    </View>
                  ) : null}
                </View>
                <Text style={styles.subtitle}>Canlı etkinlik süreci ve acil durum akışı</Text>
              </View>
            </View>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Bildirimleri kapat"
              hitSlop={8}
              style={styles.closeButton}
              onPress={onClose}
            >
              <X size={19} color={colors.textMuted} />
            </Pressable>
          </View>

          {visibleNotifications.length > 0 ? (
            <View style={styles.toolbar}>
              <Text style={styles.toolbarText}>
                {unreadCount > 0 ? `${unreadCount} okunmamış bildirim` : 'Tüm bildirimler okundu'}
              </Text>
              {unreadCount > 0 ? (
                <Pressable accessibilityRole="button" hitSlop={6} onPress={markAllAsRead}>
                  <Text style={styles.markAllText}>Tümünü okundu yap</Text>
                </Pressable>
              ) : null}
            </View>
          ) : null}

          <ScrollView contentContainerStyle={styles.body} showsVerticalScrollIndicator={false}>
            {visibleNotifications.length === 0 ? (
              <View style={styles.emptyState}>
                <View style={styles.emptyIcon}>
                  <CheckCircle2 size={25} color={colors.success} />
                </View>
                <Text style={styles.emptyTitle}>Bekleyen uyarı yok</Text>
                <Text style={styles.emptyText}>
                  Tüm operasyon uyarıları temizlendi. Sistem canlı akışı sorunsuz devam ediyor.
                </Text>
              </View>
            ) : (
              visibleNotifications.map((notification) => {
                const presentation = LEVEL_PRESENTATION[notification.level];
                const Icon = presentation.icon;
                const isRead = readIds.has(notification.id);
                return (
                  <View
                    key={notification.id}
                    style={[
                      styles.notification,
                      {
                        backgroundColor: isRead ? colors.surface : presentation.background,
                        borderColor: isRead ? colors.borderStrong : presentation.border,
                      },
                    ]}
                  >
                    <View style={styles.notificationHeader}>
                      <View style={styles.notificationTitleRow}>
                        <Icon size={17} color={presentation.accent} />
                        <View style={styles.flex}>
                          <View style={styles.typeLine}>
                            {!isRead ? <View style={styles.unreadDot} /> : null}
                            <Text style={[styles.typeLabel, { color: presentation.accent }]}>
                              {presentation.label}
                            </Text>
                            <Text style={styles.time}>{notification.time}</Text>
                          </View>
                          <Text style={styles.notificationTitle}>{notification.title}</Text>
                        </View>
                      </View>
                      <Pressable
                        accessibilityRole="button"
                        accessibilityLabel={`${notification.title} bildirimini sil`}
                        hitSlop={8}
                        style={styles.deleteButton}
                        onPress={() => dismissNotification(notification.id)}
                      >
                        <Trash2 size={15} color={colors.textMuted} />
                      </Pressable>
                    </View>
                    <Text style={styles.message}>{notification.message}</Text>
                    <Pressable
                      accessibilityRole="button"
                      style={styles.actionButton}
                      onPress={() => openNotification(notification)}
                    >
                      <Text style={styles.actionText}>{notification.actionText}</Text>
                      <ArrowRight size={14} color={colors.primary} />
                    </Pressable>
                  </View>
                );
              })
            )}
          </ScrollView>

          <View style={styles.footer}>
            {visibleNotifications.length > 0 ? (
              <Pressable accessibilityRole="button" hitSlop={6} onPress={clearAll}>
                <Text style={styles.clearText}>Tümünü sil</Text>
              </Pressable>
            ) : (
              <Text style={styles.monitoringText}>Sistem anlık izleniyor</Text>
            )}
            <Pressable accessibilityRole="button" style={styles.closeAction} onPress={onClose}>
              <Text style={styles.closeActionText}>Kapat</Text>
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, minWidth: 0 },
  overlay: {
    flex: 1,
    alignItems: 'flex-end',
    backgroundColor: 'rgba(8,18,28,0.45)',
  },
  drawer: {
    width: Platform.OS === 'web' ? 440 : '100%',
    maxWidth: '100%',
    height: '100%',
    backgroundColor: colors.surface,
  },
  header: {
    minHeight: 74,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    paddingHorizontal: 17,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    backgroundColor: colors.surfaceMuted,
  },
  headerTitleRow: { flex: 1, minWidth: 0, flexDirection: 'row', alignItems: 'center', gap: 10 },
  headerIcon: {
    width: 34,
    height: 34,
    borderRadius: 11,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.primarySoft,
  },
  titleLine: { flexDirection: 'row', alignItems: 'center', gap: 7 },
  title: { color: colors.text, fontSize: 14, fontWeight: '900' },
  subtitle: { color: colors.textMuted, fontSize: 10, marginTop: 3 },
  countBadge: {
    minWidth: 22,
    height: 20,
    paddingHorizontal: 6,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.primarySoft,
  },
  countText: { color: colors.primary, fontSize: 10, fontWeight: '900' },
  closeButton: {
    width: 34,
    height: 34,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  toolbar: {
    minHeight: 43,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    paddingHorizontal: 17,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  toolbarText: { flex: 1, color: colors.textMuted, fontSize: 10, fontWeight: '600' },
  markAllText: { color: colors.primary, fontSize: 10, fontWeight: '900' },
  body: { flexGrow: 1, padding: 15, gap: 11 },
  notification: { padding: 14, borderWidth: 1, borderRadius: 16 },
  notificationHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 8,
  },
  notificationTitleRow: {
    flex: 1,
    minWidth: 0,
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 9,
  },
  typeLine: { flexDirection: 'row', alignItems: 'center', gap: 5, marginBottom: 4 },
  unreadDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: colors.primary },
  typeLabel: { fontSize: 9, fontWeight: '900', textTransform: 'uppercase', letterSpacing: 0.4 },
  time: { color: colors.textFaint, fontSize: 9, fontWeight: '600' },
  notificationTitle: { color: colors.text, fontSize: 12, fontWeight: '900', lineHeight: 17 },
  deleteButton: {
    width: 30,
    height: 30,
    borderRadius: 9,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.72)',
  },
  message: { color: colors.textMuted, fontSize: 11, lineHeight: 17, marginTop: 9, marginLeft: 26 },
  actionButton: {
    minHeight: 34,
    alignSelf: 'flex-end',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 11,
    marginTop: 11,
    borderWidth: 1,
    borderColor: colors.borderStrong,
    borderRadius: 10,
    backgroundColor: colors.surface,
  },
  actionText: { color: colors.primary, fontSize: 10, fontWeight: '900' },
  emptyState: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 30 },
  emptyIcon: {
    width: 50,
    height: 50,
    borderRadius: 25,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.successBg,
    marginBottom: 11,
  },
  emptyTitle: { color: colors.text, fontSize: 13, fontWeight: '900' },
  emptyText: {
    maxWidth: 300,
    color: colors.textMuted,
    textAlign: 'center',
    fontSize: 11,
    lineHeight: 17,
    marginTop: 5,
  },
  footer: {
    minHeight: 60,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    paddingHorizontal: 17,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    backgroundColor: colors.surfaceMuted,
  },
  clearText: { color: colors.danger, fontSize: 10, fontWeight: '900' },
  monitoringText: { color: colors.textMuted, fontSize: 10 },
  closeAction: {
    minHeight: 34,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 16,
    borderWidth: 1,
    borderColor: colors.borderStrong,
    borderRadius: 10,
    backgroundColor: colors.surface,
  },
  closeActionText: { color: colors.text, fontSize: 10, fontWeight: '900' },
});
