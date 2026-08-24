import { router } from 'expo-router';
import { Bookmark, CalendarCheck2, Check, Clock3, MapPin, Search, Sparkles } from 'lucide-react-native';
import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Alert, FlatList, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';

import { AppHeader } from '../../components/AppHeader';
import { NotificationsModal } from '../../components/modals/NotificationsModal';
import { SessionDetailModal } from '../../components/modals/SessionDetailModal';
import { colors } from '../../constants/theme';
import { venuePoints } from '../../constants/venuePoints';
import { rankSessionsForProfile } from '../agenda/sessionRecommendations';
import { useEventSessions } from '../agenda/useEventSessions';
import { useCurrentProfile } from '../../lib/useCurrentProfile';
import { useSessionBookmarks, useToggleSessionBookmark } from '../../lib/useSessionBookmarks';
import type { Session } from '../../types';

const EMPTY_BOOKMARKS = new Set<string>();
const EMPTY_SESSIONS: Session[] = [];
const ALL = 'all';

function normalizedCategory(value?: string | null) {
  return value?.trim() ?? '';
}

function messageFromError(error: unknown) {
  if (error instanceof Error) return error.message;
  if (typeof error === 'object' && error !== null && 'message' in error && typeof error.message === 'string') {
    return error.message;
  }
  return '';
}

export function VisitorEventsScreen() {
  const { t, i18n } = useTranslation();
  const locale = i18n.language?.startsWith('en') ? 'en-US' : 'tr-TR';
  const { data: meResult } = useCurrentProfile();
  const profile = meResult?.profile ?? null;
  const sessionsQuery = useEventSessions();
  const sessions = sessionsQuery.data ?? EMPTY_SESSIONS;
  const bookmarkQuery = useSessionBookmarks();
  const bookmarks = bookmarkQuery.data ?? EMPTY_BOOKMARKS;
  const toggleBookmark = useToggleSessionBookmark();
  const [search, setSearch] = useState('');
  const [selectedDay, setSelectedDay] = useState(ALL);
  const [selectedCategory, setSelectedCategory] = useState(ALL);
  const [selectedSession, setSelectedSession] = useState<Session | null>(null);
  const [notificationsOpen, setNotificationsOpen] = useState(false);

  const days = useMemo(() => {
    const unique = new Map<string, Date>();
    sessions.forEach((session) => {
      const date = new Date(session.start_time);
      const key = date.toDateString();
      if (!unique.has(key)) unique.set(key, date);
    });
    return Array.from(unique.entries()).map(([key, date]) => ({ key, date }));
  }, [sessions]);

  const categories = useMemo(
    () => Array.from(new Set(sessions.map((session) => normalizedCategory(session.category)).filter(Boolean))),
    [sessions],
  );

  const recommendedIds = useMemo(() => {
    if (!profile) return new Set<string>();
    return new Set(
      rankSessionsForProfile(profile, sessions)
        .filter((recommendation) => recommendation.score > 0)
        .slice(0, 8)
        .map((recommendation) => recommendation.session.id),
    );
  }, [profile, sessions]);

  const visibleSessions = useMemo(() => {
    const query = search.trim().toLocaleLowerCase(locale);
    return sessions.filter((session) => {
      if (selectedDay !== ALL && new Date(session.start_time).toDateString() !== selectedDay) return false;
      if (selectedCategory !== ALL && normalizedCategory(session.category) !== selectedCategory) return false;
      if (!query) return true;
      const haystack = [session.title, session.description, session.location, session.category, ...(session.tags ?? [])]
        .filter(Boolean)
        .join(' ')
        .toLocaleLowerCase(locale);
      return haystack.includes(query);
    });
  }, [locale, search, selectedCategory, selectedDay, sessions]);

  function showBookmarkError(error: unknown) {
    const message = messageFromError(error).toLocaleLowerCase('tr-TR');
    const conflict = message.includes('overlap') || message.includes('çakış');
    Alert.alert(
      t('visitorProgram.eventsTitle'),
      t(conflict ? 'home.bookmarkConflictError' : 'home.bookmarkSyncError'),
    );
  }

  function toggleSession(sessionId: string) {
    toggleBookmark.mutate(
      { sessionId, bookmarked: bookmarks.has(sessionId) },
      { onError: showBookmarkError },
    );
  }

  function showOnMap(session: Session) {
    const location = session.location;
    const found = location
      ? venuePoints.find(
          (point) =>
            point.name.toLocaleLowerCase('tr-TR').includes(location.toLocaleLowerCase('tr-TR'))
            || location.toLocaleLowerCase('tr-TR').includes(point.name.toLocaleLowerCase('tr-TR')),
        )
      : null;
    setSelectedSession(null);
    router.push({ pathname: '/(tabs)/map', params: found ? { locationId: found.id } : {} });
  }

  return (
    <View style={styles.screen}>
      <AppHeader
        activeTab="ajanda"
        profile={profile}
        onOpenNotifications={() => setNotificationsOpen(true)}
      />

      <FlatList
        data={visibleSessions}
        keyExtractor={(session) => session.id}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.content}
        ListHeaderComponent={
          <View style={styles.headerContent}>
            <View style={styles.titleRow}>
              <View style={{ flex: 1 }}>
                <Text style={styles.eyebrow}>{t('visitorProgram.fullProgram')}</Text>
                <Text style={styles.title}>{t('visitorProgram.eventsTitle')}</Text>
                <Text style={styles.subtitle}>{t('visitorProgram.eventsSubtitle')}</Text>
              </View>
              <View style={styles.countBadge}>
                <Text style={styles.count}>{visibleSessions.length}</Text>
                <Text style={styles.countLabel}>{t('visitorProgram.session')}</Text>
              </View>
            </View>

            <View style={styles.searchBox}>
              <Search size={18} color={colors.textMuted} />
              <TextInput
                accessibilityLabel={t('visitorProgram.searchEvents')}
                value={search}
                onChangeText={setSearch}
                placeholder={t('visitorProgram.searchEvents')}
                placeholderTextColor={colors.textFaint}
                style={styles.searchInput}
              />
            </View>

            <View style={styles.filterGroup}>
              <Text style={styles.filterLabel}>{t('visitorProgram.dayFilter')}</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipRow}>
                <FilterChip
                  label={t('visitorProgram.allDays')}
                  selected={selectedDay === ALL}
                  onPress={() => setSelectedDay(ALL)}
                />
                {days.map(({ key, date }) => (
                  <FilterChip
                    key={key}
                    label={date.toLocaleDateString(locale, { weekday: 'short', day: 'numeric', month: 'short' })}
                    selected={selectedDay === key}
                    onPress={() => setSelectedDay(key)}
                  />
                ))}
              </ScrollView>
            </View>

            {categories.length > 0 ? (
              <View style={styles.filterGroup}>
                <Text style={styles.filterLabel}>{t('visitorProgram.categoryFilter')}</Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipRow}>
                  <FilterChip
                    label={t('visitorProgram.allCategories')}
                    selected={selectedCategory === ALL}
                    onPress={() => setSelectedCategory(ALL)}
                  />
                  {categories.map((category) => (
                    <FilterChip
                      key={category}
                      label={category}
                      selected={selectedCategory === category}
                      onPress={() => setSelectedCategory(category)}
                    />
                  ))}
                </ScrollView>
              </View>
            ) : null}

            <View style={styles.sectionHeading}>
              <Text style={styles.sectionTitle}>{t('visitorProgram.programList')}</Text>
              {bookmarks.size > 0 ? (
                <Pressable style={styles.agendaShortcut} onPress={() => router.push('/(tabs)/discover')}>
                  <CalendarCheck2 size={14} color={colors.primary} />
                  <Text style={styles.agendaShortcutText}>
                    {t('visitorProgram.savedShort', { count: bookmarks.size })}
                  </Text>
                </Pressable>
              ) : null}
            </View>
          </View>
        }
        ListEmptyComponent={
          <View style={styles.emptyCard}>
            <Search size={26} color={colors.textMuted} />
            <Text style={styles.emptyTitle}>
              {sessionsQuery.isLoading ? t('visitorProgram.loading') : t('visitorProgram.noEventsTitle')}
            </Text>
            {!sessionsQuery.isLoading ? <Text style={styles.emptyBody}>{t('visitorProgram.noEventsBody')}</Text> : null}
          </View>
        }
        renderItem={({ item: session }) => {
          const start = new Date(session.start_time);
          const end = new Date(session.end_time);
          const bookmarked = bookmarks.has(session.id);
          const recommended = recommendedIds.has(session.id);
          return (
            <Pressable style={styles.card} onPress={() => setSelectedSession(session)}>
              <View style={styles.dateTile}>
                <Text style={styles.dateDay}>{start.getDate()}</Text>
                <Text style={styles.dateMonth}>{start.toLocaleDateString(locale, { month: 'short' })}</Text>
              </View>
              <View style={styles.cardBody}>
                <View style={styles.cardTopRow}>
                  {recommended ? (
                    <View style={styles.recommendedBadge}>
                      <Sparkles size={11} color={colors.primary} />
                      <Text style={styles.recommendedText}>{t('home.recommendedForYou')}</Text>
                    </View>
                  ) : session.category ? (
                    <Text style={styles.category}>{session.category}</Text>
                  ) : (
                    <View />
                  )}
                  <Pressable
                    accessibilityLabel={bookmarked ? t('visitorProgram.removeFromAgenda') : t('home.addToAgenda')}
                    style={[styles.bookmarkButton, bookmarked && styles.bookmarkButtonActive]}
                    onPress={(event) => {
                      event.stopPropagation();
                      toggleSession(session.id);
                    }}
                  >
                    {bookmarked ? <Check size={16} color={colors.primary} /> : <Bookmark size={16} color={colors.textMuted} />}
                  </Pressable>
                </View>
                <Text style={styles.sessionTitle}>{session.title}</Text>
                <View style={styles.metaRow}>
                  <Clock3 size={13} color={colors.textFaint} />
                  <Text style={styles.metaText}>
                    {start.toLocaleTimeString(locale, { hour: '2-digit', minute: '2-digit' })}–{end.toLocaleTimeString(locale, { hour: '2-digit', minute: '2-digit' })}
                  </Text>
                </View>
                {session.location ? (
                  <View style={styles.metaRow}>
                    <MapPin size={13} color={colors.primary} />
                    <Text style={styles.location} numberOfLines={1}>{session.location}</Text>
                  </View>
                ) : null}
                <Text style={styles.details}>{t('home.details')}</Text>
              </View>
            </Pressable>
          );
        }}
      />

      <SessionDetailModal
        visible={!!selectedSession}
        onClose={() => setSelectedSession(null)}
        session={selectedSession}
        isBookmarked={!!selectedSession && bookmarks.has(selectedSession.id)}
        onToggleBookmark={() => selectedSession && toggleSession(selectedSession.id)}
        onShowOnMap={() => selectedSession && showOnMap(selectedSession)}
      />
      <NotificationsModal visible={notificationsOpen} onClose={() => setNotificationsOpen(false)} />
    </View>
  );
}

function FilterChip({ label, selected, onPress }: { label: string; selected: boolean; onPress: () => void }) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected }}
      style={[styles.chip, selected && styles.chipSelected]}
      onPress={onPress}
    >
      <Text style={[styles.chipText, selected && styles.chipTextSelected]}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  content: { paddingHorizontal: 16, paddingTop: 20, paddingBottom: 120, flexGrow: 1 },
  headerContent: { gap: 18, marginBottom: 14 },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  eyebrow: { color: colors.primary, fontSize: 11, fontWeight: '900', letterSpacing: 0.7, textTransform: 'uppercase' },
  title: { color: colors.text, fontSize: 28, fontWeight: '900', marginTop: 2 },
  subtitle: { color: colors.textMuted, fontSize: 13, lineHeight: 19, marginTop: 5 },
  countBadge: { width: 66, height: 66, borderRadius: 22, backgroundColor: colors.primarySoft, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: colors.primaryLight },
  count: { color: colors.primary, fontSize: 21, fontWeight: '900' },
  countLabel: { color: colors.textMuted, fontSize: 10, fontWeight: '800' },
  searchBox: { flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: colors.white, borderWidth: 1, borderColor: colors.borderStrong, borderRadius: 16, paddingHorizontal: 14, minHeight: 50 },
  searchInput: { flex: 1, color: colors.text, fontSize: 14, paddingVertical: 12 },
  filterGroup: { gap: 9 },
  filterLabel: { color: colors.text, fontSize: 12, fontWeight: '800' },
  chipRow: { gap: 8, paddingRight: 12 },
  chip: { paddingHorizontal: 13, paddingVertical: 9, borderRadius: 12, backgroundColor: colors.white, borderWidth: 1, borderColor: colors.borderStrong },
  chipSelected: { backgroundColor: colors.primary, borderColor: colors.primary },
  chipText: { color: colors.textMuted, fontSize: 12, fontWeight: '700', textTransform: 'capitalize' },
  chipTextSelected: { color: colors.white },
  sectionHeading: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 2 },
  sectionTitle: { color: colors.text, fontSize: 17, fontWeight: '900' },
  agendaShortcut: { flexDirection: 'row', alignItems: 'center', gap: 5, backgroundColor: colors.primarySoft, borderRadius: 11, paddingHorizontal: 10, paddingVertical: 7 },
  agendaShortcutText: { color: colors.primary, fontSize: 11, fontWeight: '800' },
  card: { flexDirection: 'row', gap: 12, backgroundColor: colors.white, borderWidth: 1, borderColor: colors.border, borderRadius: 19, padding: 14, marginBottom: 12 },
  dateTile: { width: 48, height: 56, borderRadius: 15, backgroundColor: colors.primarySoft, alignItems: 'center', justifyContent: 'center' },
  dateDay: { color: colors.primary, fontSize: 20, fontWeight: '900', lineHeight: 22 },
  dateMonth: { color: colors.textMuted, fontSize: 10, fontWeight: '800', textTransform: 'uppercase' },
  cardBody: { flex: 1 },
  cardTopRow: { minHeight: 30, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  category: { flex: 1, color: colors.textFaint, fontSize: 10, fontWeight: '800', textTransform: 'uppercase', letterSpacing: 0.4 },
  recommendedBadge: { flexDirection: 'row', alignItems: 'center', gap: 5, backgroundColor: colors.primarySoft, borderRadius: 10, paddingHorizontal: 8, paddingVertical: 4 },
  recommendedText: { color: colors.primary, fontSize: 9, fontWeight: '900' },
  bookmarkButton: { width: 30, height: 30, borderRadius: 11, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.surfaceMuted },
  bookmarkButtonActive: { backgroundColor: colors.primarySoft },
  sessionTitle: { color: colors.text, fontSize: 15, lineHeight: 21, fontWeight: '800', marginTop: 3 },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 8 },
  metaText: { color: colors.textFaint, fontSize: 11, fontWeight: '600' },
  location: { flex: 1, color: colors.textMuted, fontSize: 11, fontWeight: '700' },
  details: { alignSelf: 'flex-end', color: colors.primary, fontSize: 11, fontWeight: '800', marginTop: 10 },
  emptyCard: { alignItems: 'center', backgroundColor: colors.white, borderRadius: 20, borderWidth: 1, borderColor: colors.border, padding: 28, marginTop: 8 },
  emptyTitle: { color: colors.text, fontSize: 17, fontWeight: '900', textAlign: 'center', marginTop: 12 },
  emptyBody: { color: colors.textMuted, fontSize: 13, textAlign: 'center', lineHeight: 19, marginTop: 6 },
});
