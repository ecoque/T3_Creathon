import { Bell, Calendar, MessageSquare, Sparkles, X } from 'lucide-react-native';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Modal, Pressable, StyleSheet, Switch, Text, View } from 'react-native';

import { colors } from '../../constants/theme';

type NotificationsModalProps = {
  visible: boolean;
  onClose: () => void;
};

// Not: Bildirim tercihleri şu an yalnızca UI seviyesinde tutulur; backend şemasında
// henüz bir "notification_settings" tablosu yok.
export function NotificationsModal({ visible, onClose }: NotificationsModalProps) {
  const { t } = useTranslation();
  const [meetingAlerts, setMeetingAlerts] = useState(true);
  const [sessionReminders, setSessionReminders] = useState(true);
  const [aiMatches, setAiMatches] = useState(true);
  const [announcements, setAnnouncements] = useState(false);

  const rows = [
    {
      icon: Calendar,
      title: t('modals.notifMeetings'),
      desc: t('modals.notifMeetingsDesc'),
      value: meetingAlerts,
      onChange: setMeetingAlerts,
    },
    {
      icon: Bell,
      title: t('modals.notifSessions'),
      desc: t('modals.notifSessionsDesc'),
      value: sessionReminders,
      onChange: setSessionReminders,
    },
    {
      icon: Sparkles,
      title: t('modals.notifMatches'),
      desc: t('modals.notifMatchesDesc'),
      value: aiMatches,
      onChange: setAiMatches,
    },
    {
      icon: MessageSquare,
      title: t('modals.notifAnnouncements'),
      desc: t('modals.notifAnnouncementsDesc'),
      value: announcements,
      onChange: setAnnouncements,
    },
  ];

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.overlay}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />
        <View style={styles.card}>
          <View style={styles.headerRow}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              <View style={styles.headerIcon}>
                <Bell size={16} color={colors.primary} />
              </View>
              <Text style={styles.title}>{t('modals.notificationsTitle')}</Text>
            </View>
            <Pressable onPress={onClose} hitSlop={8}>
              <X size={20} color={colors.textMuted} />
            </Pressable>
          </View>

          <View style={styles.body}>
            {rows.map((row) => (
              <View key={row.title} style={styles.row}>
                <View style={{ flexDirection: 'row', gap: 8, flex: 1 }}>
                  <row.icon size={15} color={colors.primary} />
                  <View style={{ flex: 1, gap: 2 }}>
                    <Text style={styles.rowTitle}>{row.title}</Text>
                    <Text style={styles.rowDesc}>{row.desc}</Text>
                  </View>
                </View>
                <Switch
                  value={row.value}
                  onValueChange={row.onChange}
                  trackColor={{ true: colors.primary, false: colors.surfaceHigh }}
                  thumbColor={colors.white}
                />
              </View>
            ))}
          </View>

          <View style={styles.footer}>
            <Pressable style={styles.saveBtn} onPress={onClose}>
              <Text style={styles.saveBtnText}>{t('modals.saveSettings')}</Text>
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: 'rgba(25,28,29,0.6)', justifyContent: 'center', padding: 16 },
  card: {
    backgroundColor: colors.white,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: colors.border,
    overflow: 'hidden',
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 18,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  headerIcon: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: colors.primarySoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: { fontSize: 16, fontWeight: '800', color: colors.text },
  body: { padding: 18, gap: 12 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
    backgroundColor: colors.background,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 12,
  },
  rowTitle: { fontSize: 13, fontWeight: '700', color: colors.text },
  rowDesc: { fontSize: 11, color: colors.textFaint },
  footer: { padding: 18, borderTopWidth: 1, borderTopColor: colors.border },
  saveBtn: {
    backgroundColor: colors.primary,
    borderRadius: 14,
    paddingVertical: 13,
    alignItems: 'center',
  },
  saveBtnText: { color: colors.white, fontWeight: '700', fontSize: 14 },
});
