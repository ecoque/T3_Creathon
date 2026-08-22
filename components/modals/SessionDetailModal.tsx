import { Bookmark, Check, Clock, MapPin, X } from 'lucide-react-native';
import { useTranslation } from 'react-i18next';
import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { colors } from '../../constants/theme';
import type { Session } from '../../types';

type SessionDetailModalProps = {
  visible: boolean;
  onClose: () => void;
  session: Session | null;
  isBookmarked: boolean;
  onToggleBookmark: () => void;
  onShowOnMap: () => void;
};

export function SessionDetailModal({
  visible,
  onClose,
  session,
  isBookmarked,
  onToggleBookmark,
  onShowOnMap,
}: SessionDetailModalProps) {
  const { t } = useTranslation();
  if (!session) return null;

  const start = new Date(session.start_time);
  const end = new Date(session.end_time);
  const timeLabel = `${start.toLocaleDateString('tr-TR', { day: '2-digit', month: 'short' })} • ${start.toLocaleTimeString(
    'tr-TR',
    { hour: '2-digit', minute: '2-digit' },
  )} - ${end.toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' })}`;

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.overlay}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />
        <View style={styles.card}>
          <View style={styles.header}>
            <Pressable style={styles.closeBtn} onPress={onClose} hitSlop={8}>
              <X size={18} color={colors.textMuted} />
            </Pressable>
            <Text style={styles.title} numberOfLines={3}>
              {session.title}
            </Text>
            <View style={styles.timeRow}>
              <Clock size={14} color={colors.primary} />
              <Text style={styles.timeText}>{timeLabel}</Text>
            </View>
          </View>

          <ScrollView style={styles.body} contentContainerStyle={{ gap: 18 }}>
            {session.location ? (
              <Pressable style={styles.locationBox} onPress={onShowOnMap}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, flex: 1 }}>
                  <View style={styles.locationIcon}>
                    <MapPin size={18} color={colors.primary} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.locationLabel}>{t('modals.sessionLocation')}</Text>
                    <Text style={styles.locationValue}>{session.location}</Text>
                  </View>
                </View>
                <Text style={styles.locationLink}>{t('modals.sessionShowMap')}</Text>
              </Pressable>
            ) : null}

            {session.description ? (
              <View style={{ gap: 6 }}>
                <Text style={styles.sectionLabel}>{t('modals.sessionAbout')}</Text>
                <Text style={styles.description}>{session.description}</Text>
              </View>
            ) : null}
          </ScrollView>

          <View style={styles.footerRow}>
            <Pressable
              style={[styles.footerBtn, isBookmarked && styles.footerBtnActive]}
              onPress={onToggleBookmark}
            >
              {isBookmarked ? <Check size={16} color={colors.white} /> : <Bookmark size={16} color={colors.text} />}
              <Text style={[styles.footerBtnText, isBookmarked && { color: colors.white }]}>
                {isBookmarked ? t('home.addedToAgenda') : t('home.addToAgenda')}
              </Text>
            </Pressable>
            <Pressable style={[styles.footerBtn, styles.footerBtnDark]} onPress={onShowOnMap}>
              <MapPin size={16} color={colors.white} />
              <Text style={[styles.footerBtnText, { color: colors.white }]}>{t('modals.sessionShowMap')}</Text>
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
    borderRadius: 24,
    borderWidth: 1,
    borderColor: colors.border,
    maxHeight: '85%',
    overflow: 'hidden',
  },
  header: {
    padding: 20,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  closeBtn: {
    position: 'absolute',
    top: 14,
    right: 14,
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: colors.background,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 1,
  },
  title: { fontSize: 19, fontWeight: '800', color: colors.text, paddingRight: 32 },
  timeRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 10 },
  timeText: { fontSize: 12, fontWeight: '700', color: colors.text },
  body: { padding: 20 },
  locationBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: colors.background,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 14,
  },
  locationIcon: {
    width: 36,
    height: 36,
    borderRadius: 12,
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  locationLabel: { fontSize: 10, fontWeight: '800', color: colors.textFaint },
  locationValue: { fontSize: 14, fontWeight: '700', color: colors.text },
  locationLink: { fontSize: 12, fontWeight: '800', color: colors.primary },
  sectionLabel: { fontSize: 11, fontWeight: '800', color: colors.textFaint, textTransform: 'uppercase', letterSpacing: 0.5 },
  description: { fontSize: 13, color: colors.textMuted, lineHeight: 20 },
  footerRow: {
    flexDirection: 'row',
    gap: 10,
    padding: 18,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  footerBtn: {
    flex: 1,
    flexDirection: 'row',
    gap: 6,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 13,
    borderRadius: 14,
    backgroundColor: colors.surfaceMuted,
    borderWidth: 1,
    borderColor: colors.border,
  },
  footerBtnActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  footerBtnDark: { backgroundColor: colors.text, borderColor: colors.text },
  footerBtnText: { fontSize: 13, fontWeight: '700', color: colors.text },
});
