import { useQueryClient } from '@tanstack/react-query';
import { router } from 'expo-router';
import { Bell, ChevronRight, Edit3, Flag, LogOut, MapPin, Rocket } from 'lucide-react-native';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Image, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { AppHeader } from '../../components/AppHeader';
import { NotificationsModal } from '../../components/modals/NotificationsModal';
import { ROLE_LABEL_KEY } from '../../constants/roles';
import { colors } from '../../constants/theme';
import { supabase } from '../../lib/supabase';
import { useCurrentProfile } from '../../lib/useCurrentProfile';

function initialsFor(name?: string) {
  if (!name) return '?';
  return name.split(' ').filter(Boolean).slice(0, 2).map((p) => p[0]?.toUpperCase()).join('');
}

export default function MyProfileScreen() {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const { data: meResult } = useCurrentProfile();
  const profile = meResult?.profile;
  const [notificationsOpen, setNotificationsOpen] = useState(false);

  async function handleLogout() {
    await supabase.auth.signOut();
    queryClient.clear();
    router.replace('/auth');
  }

  return (
    <View style={styles.screen}>
      <AppHeader
        activeTab="profil"
        profile={profile}
        onOpenNotifications={() => setNotificationsOpen(true)}
      />
      <ScrollView contentContainerStyle={styles.content}>
        {!profile ? (
          <View style={styles.emptyState}>
            <Text style={styles.emptyTitle}>{t('profile.noProfileTitle')}</Text>
            <Text style={styles.emptyBody}>{t('profile.noProfileBody')}</Text>
          </View>
        ) : (
          <>
            <View style={styles.card}>
              <Pressable style={styles.editBtn} onPress={() => router.push('/profile/edit')}>
                <Edit3 size={16} color={colors.textMuted} />
              </Pressable>

              <View style={styles.avatarWrap}>
                {profile.photo_url ? (
                  <Image source={{ uri: profile.photo_url }} style={styles.avatarImg} />
                ) : (
                  <View style={[styles.avatarImg, styles.avatarFallback]}>
                    <Text style={styles.avatarFallbackText}>{initialsFor(profile.full_name)}</Text>
                  </View>
                )}
              </View>

              <Text style={styles.name}>{profile.full_name}</Text>
              <View style={styles.roleTag}>
                <Text style={styles.roleTagText}>{t(ROLE_LABEL_KEY[profile.role])}</Text>
              </View>
              {profile.title || profile.company ? (
                <View style={styles.identityMeta}>
                  <Text style={styles.identityMetaText}>{[profile.title, profile.company].filter(Boolean).join(' · ')}</Text>
                </View>
              ) : null}
            </View>

            {profile.sector ? (
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>{t(profile.role === 'yatirimci' ? 'investor.primaryFocus' : 'profile.sectorTitle')}</Text>
                <View style={styles.chipRow}>
                  <View style={styles.neutralChip}>
                    <Text style={styles.neutralChipText}>{profile.sector}</Text>
                  </View>
                </View>
              </View>
            ) : null}

            {profile.role === 'yatirimci' && (profile.investment_focuses?.length ?? 0) > 0 ? (
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>{t('investor.secondaryFocuses')}</Text>
                <View style={styles.chipRow}>
                  {profile.investment_focuses?.map((focus) => (
                    <View key={focus} style={styles.interestChip}>
                      <Text style={styles.interestChipText}>{focus}</Text>
                    </View>
                  ))}
                </View>
              </View>
            ) : null}

            {profile.role === 'yatirimci' && profile.investment_thesis?.trim() ? (
              <View style={styles.thesisCard}>
                <Text style={styles.sectionTitle}>{t('investor.thesis')}</Text>
                <Text style={styles.thesisText}>{profile.investment_thesis.trim()}</Text>
              </View>
            ) : null}

            {profile.role === 'kurum' && ((profile.technology_need_areas?.length ?? 0) > 0 || profile.technology_need_summary?.trim()) ? (
              <View style={styles.thesisCard}>
                <Text style={styles.sectionTitle}>{t('corporate.publicNeedTitle')}</Text>
                {(profile.technology_need_areas?.length ?? 0) > 0 ? (
                  <View style={styles.chipRow}>
                    {profile.technology_need_areas?.map((area) => (
                      <View key={area} style={styles.interestChip}><Text style={styles.interestChipText}>{area}</Text></View>
                    ))}
                  </View>
                ) : null}
                {profile.technology_need_summary?.trim() ? <Text style={styles.thesisText}>{profile.technology_need_summary.trim()}</Text> : null}
              </View>
            ) : null}

            <View style={styles.section}>
              <Text style={styles.sectionTitle}>{t(profile.role === 'yatirimci' ? 'investor.preferencesLabel' : 'profile.interestsTitle')}</Text>
              <View style={styles.chipRow}>
                {profile.interests.map((interest, i) => (
                  <View key={i} style={styles.interestChip}>
                    <Text style={styles.interestChipText}>{interest}</Text>
                  </View>
                ))}
              </View>
            </View>

            <View style={styles.section}>
              <Text style={styles.sectionTitle}>{t('profile.goalsTitle')}</Text>
              <View style={styles.chipRow}>
                {profile.goals.map((goal, i) => {
                  const isMentor = goal.toLowerCase().includes('mentor');
                  const Icon = isMentor ? Flag : Rocket;
                  return (
                    <View key={i} style={styles.goalChip}>
                      <Icon size={12} color={colors.primary} />
                      <Text style={styles.goalChipText}>{goal}</Text>
                    </View>
                  );
                })}
              </View>
            </View>

            <View style={styles.menuCard}>
              <Pressable style={styles.menuRow} onPress={() => router.push('/profile/privacy')}>
                <View style={styles.menuIcon}>
                  <MapPin size={18} color={colors.textMuted} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.menuTitle}>{t('profile.menuPrivacy')}</Text>
                  <Text style={styles.menuDesc}>{t('profile.menuPrivacyDesc')}</Text>
                </View>
                <ChevronRight size={18} color={colors.textFaint} />
              </Pressable>
              <View style={styles.menuDivider} />
              <Pressable style={styles.menuRow} onPress={() => setNotificationsOpen(true)}>
                <View style={styles.menuIcon}>
                  <Bell size={18} color={colors.textMuted} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.menuTitle}>{t('profile.menuNotifications')}</Text>
                  <Text style={styles.menuDesc}>{t('profile.menuNotificationsDesc')}</Text>
                </View>
                <ChevronRight size={18} color={colors.textFaint} />
              </Pressable>
            </View>
          </>
        )}

        <Pressable style={styles.logoutBtn} onPress={handleLogout}>
          <LogOut size={16} color={colors.danger} />
          <Text style={styles.logoutBtnText}>{t('profile.logout')}</Text>
        </Pressable>
      </ScrollView>

      <NotificationsModal visible={notificationsOpen} onClose={() => setNotificationsOpen(false)} />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  content: { padding: 16, paddingBottom: 32, gap: 18 },
  emptyState: {
    backgroundColor: colors.white,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 28,
    alignItems: 'center',
    gap: 6,
  },
  emptyTitle: { fontSize: 14, fontWeight: '700', color: colors.text },
  emptyBody: { fontSize: 12, color: colors.textMuted, textAlign: 'center' },
  card: {
    backgroundColor: colors.white,
    borderRadius: 24,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 24,
    alignItems: 'center',
    position: 'relative',
  },
  editBtn: {
    position: 'absolute',
    top: 16,
    right: 16,
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colors.background,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarWrap: { marginBottom: 14 },
  avatarImg: {
    width: 108,
    height: 108,
    borderRadius: 54,
    borderWidth: 4,
    borderColor: colors.primaryLight,
  },
  avatarFallback: { backgroundColor: colors.secondaryContainer, alignItems: 'center', justifyContent: 'center' },
  avatarFallbackText: { fontSize: 32, fontWeight: '800', color: colors.secondaryDark },
  name: { fontSize: 22, fontWeight: '800', color: colors.text },
  roleTag: {
    marginTop: 10,
    backgroundColor: colors.surfaceMuted,
    borderRadius: 999,
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderWidth: 1,
    borderColor: colors.border,
  },
  roleTagText: { fontSize: 12, fontWeight: '700', color: colors.secondaryDark },
  identityMeta: { alignItems: 'center', marginTop: 10 },
  identityMetaText: { color: colors.textMuted, fontSize: 13, fontWeight: '700', textAlign: 'center' },
  section: { gap: 8 },
  sectionTitle: { fontSize: 15, fontWeight: '800', color: colors.text },
  thesisCard: { gap: 8, backgroundColor: colors.white, borderRadius: 16, borderWidth: 1, borderColor: colors.border, padding: 16 },
  thesisText: { color: colors.textMuted, fontSize: 13, lineHeight: 20 },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  neutralChip: {
    backgroundColor: colors.surfaceMuted,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.surfaceHigh,
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  neutralChipText: { fontSize: 13, fontWeight: '700', color: colors.secondaryDark },
  interestChip: {
    backgroundColor: 'rgba(204,226,248,0.4)',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.secondaryContainer,
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  interestChipText: { fontSize: 13, fontWeight: '700', color: colors.secondaryDark },
  goalChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: colors.primarySoft,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.primaryLight,
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  goalChipText: { fontSize: 13, fontWeight: '700', color: colors.primary },
  menuCard: {
    backgroundColor: colors.white,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: colors.border,
    overflow: 'hidden',
  },
  menuRow: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14 },
  menuIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.surfaceMuted,
    alignItems: 'center',
    justifyContent: 'center',
  },
  menuTitle: { fontSize: 14, fontWeight: '700', color: colors.text },
  menuDesc: { fontSize: 11, color: colors.textFaint, marginTop: 2 },
  menuDivider: { height: 1, backgroundColor: colors.border },
  logoutBtn: {
    flexDirection: 'row',
    gap: 8,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 15,
    borderRadius: 18,
    backgroundColor: 'rgba(255,218,214,0.4)',
    borderWidth: 1,
    borderColor: colors.dangerBorder,
  },
  logoutBtnText: { color: colors.danger, fontWeight: '800', fontSize: 14 },
});
