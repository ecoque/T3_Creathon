import { router } from 'expo-router';
import { BookmarkMinus, CalendarHeart, Clock3, MapPin, Sparkles } from 'lucide-react-native';
import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Alert, Pressable, SectionList, StyleSheet, Text, View } from 'react-native';

import { AppHeader } from '../../components/AppHeader';
import { NotificationsModal } from '../../components/modals/NotificationsModal';
import { SessionDetailModal } from '../../components/modals/SessionDetailModal';
import { colors } from '../../constants/theme';
import { venuePoints } from '../../constants/venuePoints';
import { useEventSessions } from '../agenda/useEventSessions';
import { useCurrentProfile } from '../../lib/useCurrentProfile';
import { useSessionBookmarks, useToggleSessionBookmark } from '../../lib/useSessionBookmarks';
import type { Session } from '../../types';

const EMPTY_BOOKMARKS = new Set<string>();

function errorMessage(error: unknown) {
  if (error instanceof Error) return error.message;
  if (typeof error === 'object' && error !== null && 'message' in error && typeof error.message === 'string') {
    return error.message;
  }
  return '';
}

export function VisitorAgendaScreen() {
  const { t, i18n } = useTranslation();
  const locale = i18n.language?.startsWith('en') ? 'en-US' : 'tr-TR';
  const { data: meResult } = useCurrentProfile();
  const { data: sessions = [], isLoading: sessionsLoading } = useEventSessions();
  const bookmarkQuery = useSessionBookmarks();
  const bookmarks = bookmarkQuery.data ?? EMPTY_BOOKMARKS;
  const toggleBookmark = useToggleSessionBookmark();
  const [selectedSession, setSelectedSession] = useState<Session | null>(null);
  const [notificationsOpen, setNotificationsOpen] = useState(false);

  const savedSessions = useMemo(
    () => sessions.filter((session) => bookmarks.has(session.id)),
    [bookmarks, sessions],
  );

  const sections = useMemo(() => {
    const groups = new Map<string, Session[]>();
    savedSessions.forEach((session) => {
      const key = new Date(session.start_time).toDateString();
      groups.set(key, [...(groups.get(key) ?? []), session]);
    });
    return Array.from(groups.entries()).map(([key, data]) => ({
      key,
      title: new Date(data[0].start_time).toLocaleDateString(locale, {
        weekday: 'long',
        day: 'numeric',
        month: 'long',
      }),
      data,
    }));
  }, [locale, savedSessions]);

  function showBookmarkError(error: unknown) {
    const message = errorMessage(error).toLocaleLowerCase('tr-TR');
    const conflict = message.includes('overlap') || message.includes('çakış');
    Alert.alert(
      t('visitorProgram.agendaTitle'),
      t(conflict ? 'home.bookmarkConflictError' : 'home.bookmarkSyncError'),
    );
  }

  function toggleAgendaSession(sessionId: string) {
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

  const loading = sessionsLoading || bookmarkQuery.isLoading;

  return (
    <View style={styles.screen}>
      <AppHeader
        activeTab="ajanda"
        profile={meResult?.profile}
        onOpenNotifications={() => setNotificationsOpen(true)}
      />

      <SectionList
        sections={sections}
        keyExtractor={(session) => session.id}
        stickySectionHeadersEnabled={false}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.content}
        ListHeaderComponent={
          <View style={styles.headerBlock}>
            <View style={styles.hero}>
              <View style={styles.heroIcon}>
                <CalendarHeart size={24} color={colors.primary} />
              </View>
              <View style={styles.heroCopy}>
                <Text style={styles.eyebrow}>{t('visitorProgram.personalPlan')}</Text>
                <Text style={styles.title}>{t('visitorProgram.agendaTitle')}</Text>
                <Text style={styles.subtitle}>
                  {t('visitorProgram.savedCount', { count: savedSessions.length })}
                </Text>
              </View>
            </View>

            {savedSessions.length > 0 ? (
              <Pressable style={styles.exploreLink} onPress={() => router.push('/(tabs)/events')}>
                <Sparkles size={15} color={colors.primary} />
                <Text style={styles.exploreLinkText}>{t('visitorProgram.exploreMore')}</Text>
              </Pressable>
            ) : null}
          </View>
        }
        renderSectionHeader={({ section }) => (
          <View style={styles.dayHeader}>
            <View style={styles.dayRule} />
            <Text style={styles.dayTitle}>{section.title}</Text>
            <View style={styles.dayRule} />
          </View>
        )}
        renderItem={({ item: session, index, section }) => {
          const start = new Date(session.start_time);
          const end = new Date(session.end_time);
          const last = index === section.data.length - 1;
          return (
            <View style={styles.timelineRow}>
              <View style={styles.timeColumn}>
                <Text style={styles.time}>{start.toLocaleTimeString(locale, { hour: '2-digit', minute: '2-digit' })}</Text>
                <Text style={styles.endTime}>{end.toLocaleTimeString(locale, { hour: '2-digit', minute: '2-digit' })}</Text>
              </View>
              <View style={styles.timelineRail}>
                <View style={styles.timelineDot} />
                {!last ? <View style={styles.timelineLine} /> : null}
              </View>
              <Pressable style={styles.card} onPress={() => setSelectedSession(session)}>
                {session.category ? <Text style={styles.category}>{session.category}</Text> : null}
                <Text style={styles.sessionTitle}>{session.title}</Text>
                <View style={styles.metaRow}>
                  <Clock3 size={13} color={colors.textFaint} />
                  <Text style={styles.metaText}>
                    {Math.max(0, Math.round((end.getTime() - start.getTime()) / 60000))} dk
                  </Text>
                  {session.location ? (
                    <>
                      <View style={styles.metaDot} />
                      <MapPin size={13} color={colors.primary} />
                      <Text style={styles.location} numberOfLines={1}>{session.location}</Text>
                    </>
                  ) : null}
                </View>
                <View style={styles.cardFooter}>
                  <Text style={styles.details}>{t('home.details')}</Text>
                  <Pressable
                    accessibilityLabel={t('visitorProgram.removeFromAgenda')}
                    style={styles.removeButton}
                    onPress={(event) => {
                      event.stopPropagation();
                      toggleAgendaSession(session.id);
                    }}
                  >
                    <BookmarkMinus size={15} color={colors.primary} />
                    <Text style={styles.removeText}>{t('visitorProgram.remove')}</Text>
                  </Pressable>
                </View>
              </Pressable>
            </View>
          );
        }}
        ListEmptyComponent={
          <View style={styles.emptyCard}>
            <View style={styles.emptyIcon}>
              <CalendarHeart size={28} color={colors.primary} />
            </View>
            <Text style={styles.emptyTitle}>
              {loading ? t('visitorProgram.loading') : t('visitorProgram.emptyAgendaTitle')}
            </Text>
            {!loading ? (
              <>
                <Text style={styles.emptyBody}>{t('visitorProgram.emptyAgendaBody')}</Text>
                <Pressable style={styles.primaryButton} onPress={() => router.push('/(tabs)/events')}>
                  <Sparkles size={16} color={colors.white} />
                  <Text style={styles.primaryButtonText}>{t('visitorProgram.browseEvents')}</Text>
                </Pressable>
              </>
            ) : null}
          </View>
        }
      />

      <SessionDetailModal
        visible={!!selectedSession}
        onClose={() => setSelectedSession(null)}
        session={selectedSession}
        isBookmarked={!!selectedSession && bookmarks.has(selectedSession.id)}
        onToggleBookmark={() => selectedSession && toggleAgendaSession(selectedSession.id)}
        onShowOnMap={() => selectedSession && showOnMap(selectedSession)}
      />
      <NotificationsModal visible={notificationsOpen} onClose={() => setNotificationsOpen(false)} />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  content: { paddingHorizontal: 16, paddingTop: 18, paddingBottom: 120, flexGrow: 1 },
  headerBlock: { gap: 14, marginBottom: 24 },
  hero: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    backgroundColor: colors.primarySoft,
    borderWidth: 1,
    borderColor: colors.primaryLight,
    borderRadius: 22,
    padding: 18,
  },
  heroIcon: {
    width: 50,
    height: 50,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.white,
  },
  heroCopy: { flex: 1 },
  eyebrow: { color: colors.primary, fontSize: 11, fontWeight: '900', letterSpacing: 0.7, textTransform: 'uppercase' },
  title: { color: colors.text, fontSize: 25, fontWeight: '900', marginTop: 2 },
  subtitle: { color: colors.textMuted, fontSize: 13, fontWeight: '600', marginTop: 5 },
  exploreLink: { alignSelf: 'flex-end', flexDirection: 'row', alignItems: 'center', gap: 6, paddingVertical: 4 },
  exploreLinkText: { color: colors.primary, fontSize: 13, fontWeight: '800' },
  dayHeader: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 15, marginTop: 2 },
  dayRule: { flex: 1, height: 1, backgroundColor: colors.borderStrong },
  dayTitle: { color: colors.textMuted, fontSize: 12, fontWeight: '900', textTransform: 'capitalize' },
  timelineRow: { flexDirection: 'row', alignItems: 'stretch', marginBottom: 12 },
  timeColumn: { width: 48, alignItems: 'flex-end', paddingTop: 3 },
  time: { color: colors.text, fontSize: 13, fontWeight: '900' },
  endTime: { color: colors.textFaint, fontSize: 10, fontWeight: '600', marginTop: 2 },
  timelineRail: { width: 26, alignItems: 'center' },
  timelineDot: { width: 12, height: 12, borderRadius: 6, backgroundColor: colors.primary, borderWidth: 3, borderColor: colors.primaryLight, marginTop: 5, zIndex: 1 },
  timelineLine: { position: 'absolute', top: 16, bottom: -17, width: 2, backgroundColor: colors.primaryLight },
  card: { flex: 1, backgroundColor: colors.white, borderRadius: 18, borderWidth: 1, borderColor: colors.border, padding: 15 },
  category: { color: colors.primary, fontSize: 10, fontWeight: '900', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 6 },
  sessionTitle: { color: colors.text, fontSize: 15, lineHeight: 21, fontWeight: '800' },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: 10 },
  metaText: { color: colors.textFaint, fontSize: 11, fontWeight: '600' },
  metaDot: { width: 3, height: 3, borderRadius: 2, backgroundColor: colors.borderStrong, marginHorizontal: 2 },
  location: { flex: 1, color: colors.textMuted, fontSize: 11, fontWeight: '700' },
  cardFooter: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 13, paddingTop: 11, borderTopWidth: 1, borderTopColor: colors.border },
  details: { color: colors.textMuted, fontSize: 12, fontWeight: '700' },
  removeButton: { flexDirection: 'row', alignItems: 'center', gap: 5, paddingVertical: 5, paddingHorizontal: 8 },
  removeText: { color: colors.primary, fontSize: 11, fontWeight: '800' },
  emptyCard: { alignItems: 'center', justifyContent: 'center', backgroundColor: colors.white, borderRadius: 22, borderWidth: 1, borderColor: colors.border, padding: 28, marginTop: 8 },
  emptyIcon: { width: 60, height: 60, borderRadius: 22, backgroundColor: colors.primarySoft, alignItems: 'center', justifyContent: 'center', marginBottom: 15 },
  emptyTitle: { color: colors.text, fontSize: 18, fontWeight: '900', textAlign: 'center' },
  emptyBody: { color: colors.textMuted, fontSize: 13, lineHeight: 19, textAlign: 'center', marginTop: 7 },
  primaryButton: { flexDirection: 'row', alignItems: 'center', gap: 7, backgroundColor: colors.primary, borderRadius: 14, paddingHorizontal: 17, paddingVertical: 12, marginTop: 18 },
  primaryButtonText: { color: colors.white, fontSize: 13, fontWeight: '800' },
});
