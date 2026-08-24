import { useQueryClient } from '@tanstack/react-query';
import { Bookmark, BookmarkCheck, Calendar, ChevronRight, Handshake, Search, Sparkles, SlidersHorizontal } from 'lucide-react-native';
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
import { isInvestorSchemaMissing } from '../../features/investor/schema';
import { computeMatchScore, localizeMatchReasons } from '../../features/matching/scoring';
import { useCurrentProfile } from '../../lib/useCurrentProfile';
import { useInvestorCoreFlow } from '../../lib/useInvestorCoreFlow';
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

  const { data: participants = [], isLoading: participantsLoading, error: participantsError } = useOtherProfiles();

  const [search, setSearch] = useState('');
  const [quickRole, setQuickRole] = useState<ParticipantRole | 'all'>('all');
  const [filter, setFilter] = useState<FilterOptions>({ roles: [], sector: '', interests: [] });
  const [filterOpen, setFilterOpen] = useState(false);
  const [connectedIds, setConnectedIds] = useState<Set<string>>(new Set());
  const [shortlistOnly, setShortlistOnly] = useState(false);

  const [whyMatchProfile, setWhyMatchProfile] = useState<Profile | null>(null);
  const [detailProfile, setDetailProfile] = useState<Profile | null>(null);
  const [scheduleFor, setScheduleFor] = useState<Profile | null>(null);
  const [scheduleOpen, setScheduleOpen] = useState(false);
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const isInvestor = myProfile?.role === 'yatirimci';
  const isEntrepreneur = myProfile?.role === 'girisimci';
  const shortlist = useInvestorCoreFlow(meResult?.userId, isInvestor);

  const visibleParticipants = useMemo(
    () => isInvestor
      ? participants.filter((profile) => ['girisimci', 'kurum'].includes(profile.role) && profile.status === 'active')
      : isEntrepreneur
        ? participants.filter((profile) => ['girisimci', 'kurum', 'yatirimci'].includes(profile.role) && profile.status !== 'passive')
        : participants,
    [isEntrepreneur, isInvestor, participants],
  );

  const scored = useMemo(() => {
    if (!myProfile) return [];
    return visibleParticipants.map((profile) => {
      const result = computeMatchScore(myProfile, profile);
      return { profile, ...result, reasons: localizeMatchReasons(result, t) };
    });
  }, [visibleParticipants, myProfile, t]);

  const sectorOptions = useMemo(
    () => Array.from(new Set(visibleParticipants.map((p) => p.sector).filter(Boolean))) as string[],
    [visibleParticipants],
  );
  const interestOptions = useMemo(
    () => Array.from(new Set(visibleParticipants.flatMap((p) => p.interests))),
    [visibleParticipants],
  );

  const filtered = scored.filter(({ profile }) => {
    if (isInvestor && shortlistOnly && !shortlist.profileIds.has(profile.id)) return false;
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

  // Keep both sections score-ordered. Founder matches can be useful before
  // they reach the high-confidence threshold, so surface the best available
  // candidates instead of leaving the recommendation area empty.
  const rankedMatches = [...filtered].sort((a, b) => b.score - a.score);
  const highConfidenceMatches = rankedMatches.filter((match) => match.score >= 40);
  const featured = highConfidenceMatches.length > 0
    ? highConfidenceMatches
    : rankedMatches.slice(0, 3);
  const featuredIds = new Set(featured.map((match) => match.profile.id));
  const others = rankedMatches.filter((match) => !featuredIds.has(match.profile.id));
  const isFilterActive = filter.roles.length > 0 || filter.sector !== '' || filter.interests.length > 0;

  function toggleConnect(userId: string) {
    setConnectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(userId)) next.delete(userId);
      else next.add(userId);
      return next;
    });
  }

  async function toggleShortlist(profileId: string) {
    try {
      if (shortlist.profileIds.has(profileId)) await shortlist.remove(profileId);
      else await shortlist.add(profileId);
    } catch {
      // Mutation errors are exposed by the hook and rendered below.
    }
  }

  const shortlistErrorMessage = shortlist.error
    ? isInvestorSchemaMissing(shortlist.error)
      ? t('investor.migrationRequired')
      : t('investor.shortlistError', { message: shortlist.error instanceof Error ? shortlist.error.message : String(shortlist.error) })
    : null;

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
                <Text style={styles.subtitle}>{t(isInvestor ? 'investor.discoverySubtitle' : isEntrepreneur ? 'entrepreneur.discoverySubtitle' : 'matching.subtitle')}</Text>
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

            {isInvestor ? (
              <View style={styles.investorFilterRow}>
                <Pressable onPress={() => setShortlistOnly(false)} style={[styles.roleChip, !shortlistOnly && styles.roleChipSelected]}>
                  <Text style={[styles.roleChipText, !shortlistOnly && styles.roleChipTextSelected]}>{t('investor.allCandidates')}</Text>
                </Pressable>
                <Pressable onPress={() => setShortlistOnly(true)} style={[styles.roleChip, shortlistOnly && styles.roleChipSelected]}>
                  <Text style={[styles.roleChipText, shortlistOnly && styles.roleChipTextSelected]}>{t('investor.shortlistOnly')}</Text>
                </Pressable>
              </View>
            ) : (
              <FlatList
                horizontal
                showsHorizontalScrollIndicator={false}
                data={(isEntrepreneur ? ['all', 'girisimci', 'kurum', 'yatirimci'] : ['all', ...ROLES]) as (ParticipantRole | 'all')[]}
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
            )}

            {participantsLoading ? <Text style={styles.flowStatus}>{t('common.loading')}</Text> : null}
            {participantsError ? <Text style={styles.flowError}>{t(isEntrepreneur ? 'entrepreneur.discoveryLoadError' : 'investor.discoveryLoadError')}</Text> : null}
            {isInvestor && shortlist.isLoading ? <Text style={styles.flowStatus}>{t('investor.shortlistLoading')}</Text> : null}
            {isInvestor && shortlistErrorMessage ? <Text style={styles.flowError}>{shortlistErrorMessage}</Text> : null}

            <View style={{ gap: 12 }}>
              <View style={styles.sectionHeaderRow}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                  <Text style={styles.sectionTitle}>{t(isInvestor ? 'investor.priorityCandidates' : isEntrepreneur ? 'entrepreneur.recommendedMatches' : 'matching.featured')}</Text>
                  <View style={styles.aiBadge}>
                    <Sparkles size={10} color={colors.primary} />
                    <Text style={styles.aiBadgeText}>AI</Text>
                  </View>
                </View>
                <Text style={styles.sectionCount}>{t('matching.matchesCount', { count: featured.length })}</Text>
              </View>

              {featured.length === 0 && !participantsLoading ? (
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
                          <Text style={styles.scoreBadgeText}>{isInvestor ? `${t('investor.priority')} %${item.score}` : `%${item.score}`}</Text>
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
                        {isInvestor && item.reasons.length > 0 ? (
                          <Text style={styles.priorityReason} numberOfLines={2}>{item.reasons[1] ?? item.reasons[0]}</Text>
                        ) : null}
                      </View>
                      <View style={styles.featuredFooter}>
                        <Pressable onPress={() => setDetailProfile(item.profile)}>
                          <Text style={styles.viewProfileLink}>{t('matching.viewProfile')}</Text>
                        </Pressable>
                        <View style={styles.actionRow}>
                          {isInvestor ? (
                            <Pressable
                              style={styles.shortlistActionBtn}
                              onPress={() => void toggleShortlist(item.profile.id)}
                              disabled={shortlist.isMutating || shortlist.isUnavailable}
                              accessibilityLabel={t(shortlist.profileIds.has(item.profile.id) ? 'investor.removeShortlist' : 'investor.addShortlist')}
                            >
                              {shortlist.profileIds.has(item.profile.id)
                                ? <BookmarkCheck size={17} color={colors.primary} />
                                : <Bookmark size={17} color={colors.textMuted} />}
                              <Text style={styles.shortlistActionText} numberOfLines={1}>
                                {t(shortlist.profileIds.has(item.profile.id) ? 'investor.removeShortlist' : 'investor.addShortlist')}
                              </Text>
                            </Pressable>
                          ) : null}
                          <Pressable style={styles.matchIconBtn} onPress={() => setWhyMatchProfile(item.profile)}>
                            <Handshake size={17} color={colors.white} />
                          </Pressable>
                          {isInvestor || isEntrepreneur ? (
                            <Pressable style={styles.secondaryIconBtn} onPress={() => { setScheduleFor(item.profile); setScheduleOpen(true); }} accessibilityLabel={t('matching.requestMeeting')}>
                              <Calendar size={17} color={colors.primary} />
                            </Pressable>
                          ) : null}
                        </View>
                      </View>
                    </View>
                  )}
                />
              )}
            </View>

            <Text style={styles.sectionTitle}>{t(isInvestor ? 'investor.otherCandidates' : isEntrepreneur ? 'entrepreneur.otherMatches' : 'matching.others')}</Text>
          </View>
        }
        ListEmptyComponent={
          <View style={styles.emptyBox}>
            <Text style={styles.emptyBody}>{participantsLoading ? t('common.loading') : isInvestor && shortlistOnly && shortlistErrorMessage ? t('investor.shortlistUnavailable') : isInvestor && shortlistOnly && !shortlist.isLoading ? t('investor.shortlistEmpty') : t('matching.noOthers')}</Text>
          </View>
        }
        renderItem={({ item }) => (
          <Pressable style={styles.participantRow} onPress={() => setDetailProfile(item.profile)}>
            <View style={styles.participantTopRow}>
              {item.profile.photo_url ? (
                <Image source={{ uri: item.profile.photo_url }} style={styles.participantAvatar} />
              ) : (
                <View style={[styles.participantAvatar, styles.participantAvatarFallback]}>
                  <Text style={styles.participantAvatarText}>{initialsFor(item.profile.full_name)}</Text>
                </View>
              )}
              <View style={styles.participantInfo}>
                <View style={styles.participantNameRow}>
                  <Text style={styles.participantName} numberOfLines={1}>
                    {item.profile.full_name}
                  </Text>
                  <View style={styles.smallBadge}>
                    <Text style={styles.smallBadgeText}>{t('matching.matchScore', { score: item.score })}</Text>
                  </View>
                </View>
                <View style={styles.participantTags}>
                  {item.profile.sector ? (
                    <View style={styles.tagNeutral}>
                      <Text style={styles.tagNeutralText} numberOfLines={1}>{item.profile.sector}</Text>
                    </View>
                  ) : null}
                  <View style={styles.tagPrimary}>
                    <Text style={styles.tagPrimaryText} numberOfLines={1}>{t(ROLE_LABEL_KEY[item.profile.role])}</Text>
                  </View>
                </View>
                {isInvestor && item.reasons.length > 0 ? (
                  <Text style={styles.priorityReason} numberOfLines={1}>{item.reasons[1] ?? item.reasons[0]}</Text>
                ) : null}
              </View>
            </View>
            <View style={styles.participantActions}>
              <Pressable style={styles.rowActionButton} onPress={(event) => { event.stopPropagation(); setDetailProfile(item.profile); }}>
                <Text style={styles.rowActionText}>{t('matching.viewProfile')}</Text>
              </Pressable>
              {isInvestor ? (
                <Pressable style={styles.rowShortlistBtn} onPress={(event) => { event.stopPropagation(); void toggleShortlist(item.profile.id); }} disabled={shortlist.isMutating || shortlist.isUnavailable} accessibilityLabel={t(shortlist.profileIds.has(item.profile.id) ? 'investor.removeShortlist' : 'investor.addShortlist')}>
                  {shortlist.profileIds.has(item.profile.id) ? <BookmarkCheck size={16} color={colors.primary} /> : <Bookmark size={16} color={colors.textMuted} />}
                  <Text style={styles.rowShortlistText} numberOfLines={1}>
                    {t(shortlist.profileIds.has(item.profile.id) ? 'investor.removeShortlist' : 'investor.addShortlist')}
                  </Text>
                </Pressable>
              ) : null}
              <Pressable style={styles.rowIconBtn} onPress={(event) => { event.stopPropagation(); setWhyMatchProfile(item.profile); }} accessibilityLabel={t('matching.whyMatch')}>
                <Handshake size={16} color={colors.textMuted} />
              </Pressable>
              {isInvestor || isEntrepreneur ? (
                <Pressable style={styles.rowIconBtn} onPress={(event) => { event.stopPropagation(); setScheduleFor(item.profile); setScheduleOpen(true); }} accessibilityLabel={t('matching.requestMeeting')}>
                  <Calendar size={16} color={colors.primary} />
                </Pressable>
              ) : null}
              <ChevronRight size={18} color={colors.textFaint} />
            </View>
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
          const selectedProfile = whyMatchProfile;
          setWhyMatchProfile(null);
          setTimeout(() => {
            setScheduleFor(selectedProfile);
            setScheduleOpen(true);
          }, 0);
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
          const selectedProfile = detailProfile;
          setDetailProfile(null);
          setTimeout(() => {
            setScheduleFor(selectedProfile);
            setScheduleOpen(true);
          }, 0);
        }}
      />

      <ScheduleMeetingModal
        visible={scheduleOpen}
        onClose={() => {
          setScheduleOpen(false);
          setScheduleFor(null);
        }}
        participants={visibleParticipants}
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
  investorFilterRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  flowStatus: { color: colors.textMuted, fontSize: 12, fontWeight: '600' },
  flowError: { color: colors.danger, backgroundColor: colors.dangerBg, borderColor: colors.dangerBorder, borderWidth: 1, borderRadius: 10, padding: 10, fontSize: 11, lineHeight: 16 },
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
  priorityReason: { color: colors.textMuted, fontSize: 10, lineHeight: 14, marginTop: 3 },
  sectorChip: {
    alignSelf: 'flex-start',
    backgroundColor: colors.primarySoft,
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  sectorChipText: { fontSize: 10, fontWeight: '700', color: colors.primary },
  featuredFooter: {
    flexDirection: 'column',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 12,
    paddingBottom: 12,
  },
  actionRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-end', gap: 6, width: '100%' },
  secondaryIconBtn: { width: 34, height: 34, borderRadius: 17, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.background, borderWidth: 1, borderColor: colors.border },
  shortlistActionBtn: { minWidth: 34, maxWidth: 148, height: 34, borderRadius: 17, paddingHorizontal: 9, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 5, backgroundColor: colors.background, borderWidth: 1, borderColor: colors.border },
  shortlistActionText: { flexShrink: 1, fontSize: 10, fontWeight: '800', color: colors.textMuted },
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
    gap: 10,
    backgroundColor: colors.white,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 12,
    marginBottom: 10,
  },
  participantTopRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
  participantInfo: { flex: 1, minWidth: 0, gap: 4 },
  participantNameRow: { flexDirection: 'row', alignItems: 'center', gap: 8, minWidth: 0 },
  participantTags: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
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
  participantActions: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    gap: 4,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    paddingTop: 8,
  },
  rowActionButton: { marginRight: 'auto', paddingVertical: 6, paddingHorizontal: 2 },
  rowActionText: { fontSize: 12, fontWeight: '800', color: colors.primary },
  rowIconBtn: { padding: 6 },
  rowShortlistBtn: { minHeight: 30, maxWidth: 132, borderRadius: 15, paddingHorizontal: 8, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 4, backgroundColor: colors.background, borderWidth: 1, borderColor: colors.border },
  rowShortlistText: { flexShrink: 1, fontSize: 10, fontWeight: '800', color: colors.textMuted },
});
