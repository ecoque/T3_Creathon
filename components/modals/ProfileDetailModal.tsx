import { Calendar, Check, Handshake, Rocket, UserPlus, X } from 'lucide-react-native';
import { useTranslation } from 'react-i18next';
import { Image, Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { ROLE_LABEL_KEY } from '../../constants/roles';
import { colors } from '../../constants/theme';
import type { Profile } from '../../types';

type ProfileDetailModalProps = {
  visible: boolean;
  onClose: () => void;
  profile: Profile | null;
  score: number;
  isConnected: boolean;
  onOpenWhyMatch: () => void;
  onConnect: () => void;
  onRequestMeeting: () => void;
};

function initialsFor(name?: string) {
  if (!name) return '?';
  return name
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase())
    .join('');
}

export function ProfileDetailModal({
  visible,
  onClose,
  profile,
  score,
  isConnected,
  onOpenWhyMatch,
  onConnect,
  onRequestMeeting,
}: ProfileDetailModalProps) {
  const { t } = useTranslation();
  if (!profile) return null;

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.overlay}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />
        <View style={styles.card}>
          <View style={styles.header}>
            <Pressable style={styles.closeBtn} onPress={onClose} hitSlop={8}>
              <X size={18} color={colors.textMuted} />
            </Pressable>

            <View style={styles.avatarWrap}>
              {profile.photo_url ? (
                <Image source={{ uri: profile.photo_url }} style={styles.avatarImg} />
              ) : (
                <View style={styles.avatarFallback}>
                  <Text style={styles.avatarFallbackText}>{initialsFor(profile.full_name)}</Text>
                </View>
              )}
              <View style={styles.scoreBadge}>
                <Text style={styles.scoreBadgeText}>%{score}</Text>
              </View>
            </View>

            <Text style={styles.name}>{profile.full_name}</Text>
            <View style={styles.tagRow}>
              <View style={styles.tag}>
                <Text style={styles.tagTextPrimary}>{t(ROLE_LABEL_KEY[profile.role])}</Text>
              </View>
              {profile.sector ? (
                <View style={[styles.tag, styles.tagNeutral]}>
                  <Text style={styles.tagTextNeutral}>{profile.sector}</Text>
                </View>
              ) : null}
            </View>
          </View>

          <ScrollView style={styles.body} contentContainerStyle={{ gap: 18 }}>
            <Pressable style={styles.matchHighlight} onPress={onOpenWhyMatch}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, flex: 1 }}>
                <View style={styles.matchIcon}>
                  <Handshake size={16} color={colors.white} />
                </View>
                <Text style={styles.matchText} numberOfLines={2}>
                  {t('matching.whyMatched')}
                </Text>
              </View>
              <Text style={styles.matchLink}>{'>'}</Text>
            </Pressable>

            <View style={{ gap: 8 }}>
              <Text style={styles.sectionLabel}>{t('profile.interestsTitle')}</Text>
              <View style={styles.chipRow}>
                {profile.interests.map((interest, i) => (
                  <View key={i} style={styles.plainChip}>
                    <Text style={styles.plainChipText}>{interest}</Text>
                  </View>
                ))}
              </View>
            </View>

            <View style={{ gap: 8 }}>
              <Text style={styles.sectionLabel}>{t('profile.goalsTitle')}</Text>
              <View style={styles.chipRow}>
                {profile.goals.map((goal, i) => (
                  <View key={i} style={styles.goalChip}>
                    <Rocket size={12} color={colors.primary} />
                    <Text style={styles.goalChipText}>{goal}</Text>
                  </View>
                ))}
              </View>
            </View>
          </ScrollView>

          <View style={styles.footerRow}>
            <Pressable style={[styles.footerBtn, isConnected && styles.successBtn]} onPress={onConnect}>
              {isConnected ? <Check size={16} color={colors.white} /> : <UserPlus size={16} color={colors.textMuted} />}
              <Text style={[styles.footerBtnText, isConnected && { color: colors.white }]}>
                {isConnected ? t('matching.connected') : t('matching.connect')}
              </Text>
            </Pressable>
            <Pressable
              style={[styles.footerBtn, styles.footerBtnPrimary]}
              onPress={() => {
                onClose();
                onRequestMeeting();
              }}
            >
              <Calendar size={16} color={colors.white} />
              <Text style={[styles.footerBtnText, { color: colors.white }]}>{t('matching.requestMeeting')}</Text>
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
    maxHeight: '90%',
    overflow: 'hidden',
  },
  header: {
    backgroundColor: colors.primarySoft,
    paddingTop: 30,
    paddingBottom: 18,
    paddingHorizontal: 20,
    alignItems: 'center',
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
    backgroundColor: 'rgba(255,255,255,0.9)',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 1,
  },
  avatarWrap: { marginBottom: 10 },
  avatarImg: { width: 92, height: 92, borderRadius: 46, borderWidth: 4, borderColor: colors.white },
  avatarFallback: {
    width: 92,
    height: 92,
    borderRadius: 46,
    borderWidth: 4,
    borderColor: colors.white,
    backgroundColor: colors.secondaryContainer,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarFallbackText: { fontSize: 26, fontWeight: '800', color: colors.secondaryDark },
  scoreBadge: {
    position: 'absolute',
    top: -2,
    right: -2,
    backgroundColor: colors.primary,
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderWidth: 2,
    borderColor: colors.white,
  },
  scoreBadgeText: { color: colors.white, fontSize: 11, fontWeight: '800' },
  name: { fontSize: 20, fontWeight: '800', color: colors.text },
  tagRow: { flexDirection: 'row', gap: 8, marginTop: 8 },
  tag: { paddingHorizontal: 12, paddingVertical: 5, borderRadius: 999, backgroundColor: colors.primarySoft },
  tagTextPrimary: { fontSize: 11, fontWeight: '700', color: colors.primary },
  tagNeutral: { backgroundColor: colors.surfaceMuted },
  tagTextNeutral: { fontSize: 11, fontWeight: '700', color: colors.secondaryDark },
  body: { padding: 20 },
  matchHighlight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: colors.primarySoft,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.primaryLight,
    padding: 14,
  },
  matchIcon: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  matchText: { fontSize: 12, fontWeight: '700', color: colors.primary, flex: 1 },
  matchLink: { fontSize: 13, fontWeight: '800', color: colors.primary },
  sectionLabel: { fontSize: 11, fontWeight: '800', color: colors.textFaint, textTransform: 'uppercase', letterSpacing: 0.5 },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  plainChip: {
    backgroundColor: colors.surfaceMuted,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  plainChipText: { fontSize: 12, fontWeight: '600', color: colors.secondaryDark },
  goalChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: colors.primarySoft,
    borderWidth: 1,
    borderColor: colors.primaryLight,
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  goalChipText: { fontSize: 12, fontWeight: '700', color: colors.primary },
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
  successBtn: { backgroundColor: '#059669', borderColor: '#059669' },
  footerBtnPrimary: { backgroundColor: colors.primary, borderColor: colors.primary },
  footerBtnText: { fontSize: 13, fontWeight: '700', color: colors.text },
});
