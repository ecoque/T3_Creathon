import { useQueryClient } from '@tanstack/react-query';
import { ChevronRight, Handshake, Search, Sparkles, SlidersHorizontal } from 'lucide-react-native';
import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { FlatList, Image, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';

import { AppHeader } from '../../components/AppHeader';
import { FilterModal, type FilterOptions } from '../../components/modals/FilterModal';
import { NotificationsModal } from '../../components/modals/NotificationsModal';
import { ProfileDetailModal } from '../../components/modals/ProfileDetailModal';
import { ScheduleMeetingModal } from '../../components/modals/ScheduleMeetingModal';
import { WhyMatchModal } from '../../components/modals/WhyMatchModal';
import { ROLES, ROLE_LABEL_KEY } from '../../constants/roles';
import { colors } from '../../constants/theme';
import { computeMatchScore } from '../../features/matching/scoring';
import { useCurrentProfile } from '../../lib/useCurrentProfile';
import { useOtherProfiles } from '../../lib/useOtherProfiles';
import type { ParticipantRole, Profile } from '../../types';

function initialsFor(name?: string) {
  if (!name) return '?';
  return name.split(' ').filter(Boolean).slice(0, 2).map((p) => p[0]?.toUpperCase()).join('');
}

export default function DiscoverScreen() {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const { data: meResult } = useCurrentProfile();
  const myProfile = meResult?.profile ?? null;

  const { data: participants = [] } = useOtherProfiles();

  const [search, setSearch] = useState('');
  const [quickRole, setQuickRole] = useState<ParticipantRole | 'all'>('all');
  const [filter, setFilter] = useState<FilterOptions>({ roles: [], sector: '', interests: [] });
  const [filterOpen, setFilterOpen] = useState(false);
  const [connectedIds, setConnectedIds] = useState<Set<string>>(new Set());

  const [whyMatchProfile, setWhyMatchProfile] = useState<Profile | null>(null);
  const [detailProfile, setDetailProfile] = useState<Profile | null>(null);
  const [scheduleFor, setScheduleFor] = useState<Profile | null>(null);
  const [scheduleOpen, setScheduleOpen] = useState(false);
  const [notificationsOpen, setNotificationsOpen] = useState(false);

  const scored = useMemo(() => {
    if (!myProfile) return [];
    return participants.map((p) => ({ profile: p, ...computeMatchScore(myProfile, p) }));
  }, [participants, myProfile]);

  const sectorOptions = useMemo(
    () => Array.from(new Set(participants.map((p) => p.sector).filter(Boolean))) as string[],
    [participants],
  );
  const interestOptions = useMemo(
    () => Array.from(new Set(participants.flatMap((p) => p.interests))),
    [participants],
  );

  const filtered = scored.filter(({ profile }) => {
    if (quickRole !== 'all' && profile.role !== quickRole) return false;
    if (filter.roles.length > 0 && !filter.roles.includes(profile.role)) return false;
    if (filter.sector && profile.sector?.toLowerCase() !== filter.sector.toLowerCase()) return false;
    if (filter.interests.length > 0) {
      const hasInterest = filter.interests.some((i) =>
        profile.interests.some((pi) => pi.toLowerCase().includes(i.toLowerCase())),
      );
      if (!hasInterest) return false;
    }
    if (search.trim()) {
      const q = search.toLowerCase();
      const hay = `${profile.full_name} ${profile.sector ?? ''} ${profile.interests.join(' ')}`.toLowerCase();
      if (!hay.includes(q)) return false;
    }
    return true;
  });

  const featured = filtered.filter((f) => f.score >= 40).sort((a, b) => b.score - a.score);
  const others = filtered.filter((f) => f.score < 40);
  const isFilterActive = filter.roles.length > 0 || filter.sector !== '' || filter.interests.length > 0;

  function toggleConnect(userId: string) {
    setConnectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(userId)) next.delete(userId);
      else next.add(userId);
      return next;
    });
  }

  return (
    <View style={styles.screen}>
      <AppHeader
        activeTab="kesfet"
        profile={myProfile}
        onOpenFilter={() => setFilterOpen(true)}
        onOpenNotifications={() => setNotificationsOpen(true)}
      />

      <FlatList
        data={others}
        keyExtractor={(item) => item.profile.id}
        contentContainerStyle={styles.listContent}
        ListHeaderComponent={
          <View style={{ gap: 18 }}>
            <View style={styles.titleRow}>
              <View style={{ flex: 1 }}>
                <Text style={styles.title}>{t('matching.title')}</Text>
                <Text style={styles.subtitle}>{t('matching.subtitle')}</Text>
              </View>
              <Pressable
                style={[styles.filterBtn, isFilterActive && styles.filterBtnActive]}
                onPress={() => setFilterOpen(true)}
              >
                <SlidersHorizontal size={15} color={isFilterActive ? colors.primary : colors.textMuted} />
              </Pressable>
            </View>

            <View style={styles.searchBox}>
              <Search size={16} color={colors.textMuted} />
              <TextInput
                style={styles.searchInput}
                placeholder={t('matching.searchPlaceholder')}
                placeholderTextColor={colors.textFaint}
                value={search}
                onChangeText={setSearch}
              />
            </View>

            <FlatList
              horizontal
              showsHorizontalScrollIndicator={false}
              data={['all', ...ROLES] as (ParticipantRole | 'all')[]}
              keyExtractor={(r) => r}
              contentContainerStyle={{ gap: 8 }}
              renderItem={({ item }) => {
                const selected = quickRole === item;
                const label = item === 'all' ? t('matching.roleAll') : t(ROLE_LABEL_KEY[item]);
                return (
                  <Pressable
                    onPress={() => setQuickRole(item)}
                    style={[styles.roleChip, selected && styles.roleChipSelected]}
                  >
                    <Text style={[styles.roleChipText, selected && styles.roleChipTextSelected]}>{label}</Text>
                  </Pressable>
                );
              }}
            />

            <View style={{ gap: 12 }}>
              <View style={styles.sectionHeaderRow}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                  <Text style={styles.sectionTitle}>{t('matching.featured')}</Text>
                  <View style={styles.aiBadge}>
                    <Sparkles size={10} color={colors.primary} />
                    <Text style={styles.aiBadgeText}>AI</Text>
                  </View>
                </View>
                <Text style={styles.sectionCount}>{t('matching.matchesCount', { count: featured.length })}</Text>
              </View>

              {featured.length === 0 ? (
                <View style={styles.emptyBox}>
                  <Text style={styles.emptyTitle}>{t('matching.noFeatured')}</Text>
                  <Text style={styles.emptyBody}>{t('matching.noFeaturedBody')}</Text>
                </View>
              ) : (
                <FlatList
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  data={featured}
                  keyExtractor={(f) => f.profile.id}
                  contentContainerStyle={{ gap: 14 }}
                  renderItem={({ item }) => (
                    <View style={styles.featuredCard}>
                      <View style={styles.featuredImageWrap}>
                        {item.profile.photo_url ? (
                          <Image source={{ uri: item.profile.photo_url }} style={styles.featuredImage} />
                        ) : (
                          <View style={[styles.featuredImage, styles.featuredImageFallback]}>
                            <Text style={styles.featuredImageFallbackText}>
                              {initialsFor(item.profile.full_name)}
                            </Text>
                          </View>
                        )}
                        <View style={styles.scoreBadge}>
                          <Text style={styles.scoreBadgeText}>%{item.score}</Text>
                        </View>
                      </View>
                      <View style={styles.featuredBody}>
                        <Text style={styles.featuredName}>{item.profile.full_name}</Text>
                        <Text style={styles.featuredSub}>{t(ROLE_LABEL_KEY[item.profile.role])}</Text>
                        {item.profile.sector ? (
                          <View style={styles.sectorChip}>
                            <Text style={styles.sectorChipText}>{item.profile.sector}</Text>
                          </View>
                        ) : null}
                      </View>
                      <View style={styles.featuredFooter}>
                        <Pressable onPress={() => setDetailProfile(item.profile)}>
                          <Text style={styles.viewProfileLink}>{t('matching.viewProfile')}</Text>
                        </Pressable>
                        <Pressable style={styles.matchIconBtn} onPress={() => setWhyMatchProfile(item.profile)}>
                          <Handshake size={17} color={colors.white} />
                        </Pressable>
                      </View>
                    </View>
                  )}
                />
              )}
            </View>

            <Text style={styles.sectionTitle}>{t('matching.others')}</Text>
          </View>
        }
        ListEmptyComponent={
          <View style={styles.emptyBox}>
            <Text style={styles.emptyBody}>{t('matching.noOthers')}</Text>
          </View>
        }
        renderItem={({ item }) => (
          <Pressable style={styles.participantRow} onPress={() => setDetailProfile(item.profile)}>
            {item.profile.photo_url ? (
              <Image source={{ uri: item.profile.photo_url }} style={styles.participantAvatar} />
            ) : (
              <View style={[styles.participantAvatar, styles.participantAvatarFallback]}>
                <Text style={styles.participantAvatarText}>{initialsFor(item.profile.full_name)}</Text>
              </View>
            )}
            <View style={{ flex: 1 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                <Text style={styles.participantName} numberOfLines={1}>
                  {item.profile.full_name}
                </Text>
                <View style={styles.smallBadge}>
                  <Text style={styles.smallBadgeText}>{t('matching.matchScore', { score: item.score })}</Text>
                </View>
              </View>
              <View style={{ flexDirection: 'row', gap: 6, marginTop: 6 }}>
                {item.profile.sector ? (
                  <View style={styles.tagNeutral}>
                    <Text style={styles.tagNeutralText}>{item.profile.sector}</Text>
                  </View>
                ) : null}
                <View style={styles.tagPrimary}>
                  <Text style={styles.tagPrimaryText}>{t(ROLE_LABEL_KEY[item.profile.role])}</Text>
                </View>
              </View>
            </View>
            <Pressable style={styles.rowIconBtn} onPress={() => setWhyMatchProfile(item.profile)}>
              <Handshake size={16} color={colors.textMuted} />
            </Pressable>
            <ChevronRight size={18} color={colors.textFaint} />
          </Pressable>
        )}
      />

      <FilterModal
        visible={filterOpen}
        onClose={() => setFilterOpen(false)}
        initialFilter={filter}
        sectorOptions={sectorOptions}
        interestOptions={interestOptions}
        onApply={setFilter}
      />

      <WhyMatchModal
        visible={!!whyMatchProfile}
        onClose={() => setWhyMatchProfile(null)}
        profile={whyMatchProfile}
        score={whyMatchProfile ? scored.find((s) => s.profile.id === whyMatchProfile.id)?.score ?? 0 : 0}
        reasons={whyMatchProfile ? scored.find((s) => s.profile.id === whyMatchProfile.id)?.reasons ?? [] : []}
        isConnected={whyMatchProfile ? connectedIds.has(whyMatchProfile.user_id) : false}
        onConnect={() => whyMatchProfile && toggleConnect(whyMatchProfile.user_id)}
        onRequestMeeting={() => {
          setScheduleFor(whyMatchProfile);
          setScheduleOpen(true);
        }}
      />

      <ProfileDetailModal
        visible={!!detailProfile}
        onClose={() => setDetailProfile(null)}
        profile={detailProfile}
        score={detailProfile ? scored.find((s) => s.profile.id === detailProfile.id)?.score ?? 0 : 0}
        isConnected={detailProfile ? connectedIds.has(detailProfile.user_id) : false}
        onOpenWhyMatch={() => {
          setWhyMatchProfile(detailProfile);
          setDetailProfile(null);
        }}
        onConnect={() => detailProfile && toggleConnect(detailProfile.user_id)}
        onRequestMeeting={() => {
          setScheduleFor(detailProfile);
          setScheduleOpen(true);
        }}
      />

      <ScheduleMeetingModal
        visible={scheduleOpen}
        onClose={() => {
          setScheduleOpen(false);
          setScheduleFor(null);
        }}
        participants={participants}
        preSelectedUserId={scheduleFor?.user_id}
        onCreated={() => queryClient.invalidateQueries({ queryKey: ['meeting_requests'] })}
      />

      <NotificationsModal visible={notificationsOpen} onClose={() => setNotificationsOpen(false)} />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  listContent: { padding: 16, paddingBottom: 32, gap: 14 },
  titleRow: { flexDirection: 'row', alignItems: 'flex-start' },
  title: { fontSize: 24, fontWeight: '800', color: colors.text },
  subtitle: { fontSize: 13, color: colors.textMuted, marginTop: 2 },
  filterBtn: {
    width: 40,
    height: 40,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: colors.border,
  },
  filterBtnActive: { backgroundColor: colors.primarySoft, borderColor: colors.primary },
  searchBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 12,
    paddingHorizontal: 12,
  },
  searchInput: { flex: 1, paddingVertical: 10, fontSize: 13, color: colors.text },
  roleChip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 999,
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: colors.border,
  },
  roleChipSelected: { backgroundColor: colors.primary, borderColor: colors.primary },
  roleChipText: { fontSize: 12, fontWeight: '700', color: colors.textMuted },
  roleChipTextSelected: { color: colors.white },
  sectionHeaderRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  sectionTitle: { fontSize: 16, fontWeight: '800', color: colors.text },
  aiBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    backgroundColor: colors.primarySoft,
    borderRadius: 999,
    paddingHorizontal: 7,
    paddingVertical: 2,
  },
  aiBadgeText: { fontSize: 10, fontWeight: '800', color: colors.primary },
  sectionCount: { fontSize: 12, color: colors.textFaint, fontWeight: '600' },
  emptyBox: {
    backgroundColor: colors.white,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 20,
    alignItems: 'center',
    gap: 4,
  },
  emptyTitle: { fontSize: 13, fontWeight: '700', color: colors.text },
  emptyBody: { fontSize: 12, color: colors.textMuted, textAlign: 'center' },
  featuredCard: {
    width: 220,
    backgroundColor: colors.white,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: colors.border,
    overflow: 'hidden',
  },
  featuredImageWrap: { position: 'relative' },
  featuredImage: { width: '100%', height: 130, backgroundColor: colors.surfaceHigh },
  featuredImageFallback: { alignItems: 'center', justifyContent: 'center' },
  featuredImageFallbackText: { fontSize: 32, fontWeight: '800', color: colors.secondaryDark },
  scoreBadge: {
    position: 'absolute',
    top: 8,
    right: 8,
    backgroundColor: 'rgba(255,255,255,0.92)',
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  scoreBadgeText: { fontSize: 11, fontWeight: '800', color: colors.primary },
  featuredBody: { padding: 12, gap: 6 },
  featuredName: { fontSize: 15, fontWeight: '800', color: colors.text },
  featuredSub: { fontSize: 11, color: colors.textFaint, fontWeight: '600' },
  sectorChip: {
    alignSelf: 'flex-start',
    backgroundColor: colors.primarySoft,
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  sectorChipText: { fontSize: 10, fontWeight: '700', color: colors.primary },
  featuredFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 12,
    paddingBottom: 12,
  },
  viewProfileLink: { fontSize: 12, fontWeight: '800', color: colors.primary },
  matchIconBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  participantRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: colors.white,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 12,
    marginBottom: 10,
  },
  participantAvatar: { width: 46, height: 46, borderRadius: 23 },
  participantAvatarFallback: {
    backgroundColor: colors.secondaryContainer,
    alignItems: 'center',
    justifyContent: 'center',
  },
  participantAvatarText: { fontSize: 14, fontWeight: '800', color: colors.secondaryDark },
  participantName: { fontSize: 14, fontWeight: '700', color: colors.text, flexShrink: 1 },
  smallBadge: {
    backgroundColor: colors.background,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
  smallBadgeText: { fontSize: 10, fontWeight: '700', color: colors.textFaint },
  tagNeutral: { backgroundColor: colors.surfaceMuted, borderRadius: 6, paddingHorizontal: 7, paddingVertical: 2 },
  tagNeutralText: { fontSize: 10, fontWeight: '600', color: colors.textMuted },
  tagPrimary: { backgroundColor: colors.primarySoft, borderRadius: 6, paddingHorizontal: 7, paddingVertical: 2 },
  tagPrimaryText: { fontSize: 10, fontWeight: '700', color: colors.primary },
  rowIconBtn: { padding: 6 },
});
