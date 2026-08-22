import { Check, Sparkles, UserPlus, X, Calendar } from 'lucide-react-native';
import { useTranslation } from 'react-i18next';
import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { colors } from '../../constants/theme';
import type { Profile } from '../../types';

type WhyMatchModalProps = {
  visible: boolean;
  onClose: () => void;
  profile: Profile | null;
  score: number;
  reasons: string[];
  isConnected: boolean;
  onConnect: () => void;
  onRequestMeeting: () => void;
};

export function WhyMatchModal({
  visible,
  onClose,
  profile,
  score,
  reasons,
  isConnected,
  onConnect,
  onRequestMeeting,
}: WhyMatchModalProps) {
  const { t } = useTranslation();
  if (!profile) return null;

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.overlay}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />
        <View style={styles.card}>
          <Pressable style={styles.closeBtn} onPress={onClose} hitSlop={8}>
            <X size={20} color={colors.textFaint} />
          </Pressable>

          <View style={styles.header}>
            <View style={styles.iconCircle}>
              <Sparkles size={28} color={colors.primary} />
            </View>
            <Text style={styles.title}>{t('modals.whyMatchTitle')}</Text>
            <Text style={styles.subtitle}>
              {t('matching.matchScore', { score })} — {profile.full_name}
            </Text>
          </View>

          <ScrollView style={styles.body} contentContainerStyle={{ gap: 10 }}>
            <Text style={styles.sectionLabel}>{t('modals.reasonsTitle')}</Text>
            {reasons.length === 0 ? (
              <Text style={styles.reasonText}>—</Text>
            ) : (
              reasons.map((reason, idx) => (
                <View key={idx} style={styles.reasonRow}>
                  <View style={styles.reasonDot} />
                  <Text style={styles.reasonText}>{reason}</Text>
                </View>
              ))
            )}
          </ScrollView>

          <View style={styles.footer}>
            <Pressable
              style={[styles.primaryBtn, isConnected && styles.successBtn]}
              onPress={onConnect}
            >
              {isConnected ? <Check size={16} color={colors.white} /> : <UserPlus size={16} color={colors.white} />}
              <Text style={styles.primaryBtnText}>
                {isConnected ? t('matching.connected') : t('matching.connect')}
              </Text>
            </Pressable>
            <Pressable
              style={styles.secondaryBtn}
              onPress={() => {
                onClose();
                onRequestMeeting();
              }}
            >
              <Calendar size={16} color={colors.textMuted} />
              <Text style={styles.secondaryBtnText}>{t('matching.requestMeeting')}</Text>
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(25,28,29,0.6)',
    justifyContent: 'center',
    padding: 16,
  },
  card: {
    backgroundColor: colors.white,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: colors.border,
    maxHeight: '85%',
    overflow: 'hidden',
  },
  closeBtn: {
    position: 'absolute',
    top: 14,
    right: 14,
    zIndex: 1,
    padding: 6,
  },
  header: {
    paddingTop: 32,
    paddingBottom: 16,
    paddingHorizontal: 24,
    alignItems: 'center',
    borderBottomWidth: 1,
    borderBottomColor: colors.surfaceMuted,
  },
  iconCircle: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: colors.primarySoft,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  title: { fontSize: 20, fontWeight: '800', color: colors.text },
  subtitle: { fontSize: 13, color: colors.textMuted, marginTop: 6, textAlign: 'center' },
  body: { backgroundColor: colors.background, padding: 20, maxHeight: 320 },
  sectionLabel: { fontSize: 11, fontWeight: '800', color: colors.text, textTransform: 'uppercase', letterSpacing: 0.5 },
  reasonRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    backgroundColor: colors.white,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 12,
  },
  reasonDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: colors.primary, marginTop: 6 },
  reasonText: { fontSize: 13, color: colors.textMuted, flex: 1, fontWeight: '500' },
  footer: {
    padding: 20,
    gap: 10,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    backgroundColor: colors.white,
  },
  primaryBtn: {
    flexDirection: 'row',
    gap: 8,
    backgroundColor: colors.primary,
    borderRadius: 14,
    paddingVertical: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  successBtn: { backgroundColor: '#059669' },
  primaryBtnText: { color: colors.white, fontWeight: '700', fontSize: 14 },
  secondaryBtn: {
    flexDirection: 'row',
    gap: 8,
    backgroundColor: colors.surfaceMuted,
    borderRadius: 14,
    paddingVertical: 14,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: colors.border,
  },
  secondaryBtnText: { color: colors.text, fontWeight: '700', fontSize: 14 },
});
