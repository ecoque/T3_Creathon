import { useQuery } from '@tanstack/react-query';
import { router } from 'expo-router';
import { Bookmark, Calendar as CalendarIcon, Check, MapPin, Search, Sparkles } from 'lucide-react-native';
import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { FlatList, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';

import { AppHeader } from '../../components/AppHeader';
import { NotificationsModal } from '../../components/modals/NotificationsModal';
import { SessionDetailModal } from '../../components/modals/SessionDetailModal';
import { colors } from '../../constants/theme';
import { venuePoints } from '../../constants/venuePoints';
import { useCurrentProfile } from '../../lib/useCurrentProfile';
import { supabase } from '../../lib/supabase';
import type { Session } from '../../types';

async function fetchSessions(): Promise<Session[]> {
  const { data, error } = await supabase
    .from('sessions')
    .select('*')
    .in('status', ['published', 'live', 'delayed', 'completed'])
    .order('start_time', { ascending: true });
  if (error) throw error;
  return (data ?? []) as Session[];
}

function dayKey(iso: string) {
  return new Date(iso).toDateString();
}

export default function HomeScreen() {
  const { t } = useTranslation();
  const { data: meResult } = useCurrentProfile();
  const { data: sessions = [] } = useQuery({ queryKey: ['sessions'], queryFn: fetchSessions });

  const [selectedDay, setSelectedDay] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [onlyBookmarked, setOnlyBookmarked] = useState(false);
  const [bookmarks, setBookmarks] = useState<Set<string>>(new Set());
  const [selectedSession, setSelectedSession] = useState<Session | null>(null);
  const [notificationsOpen, setNotificationsOpen] = useState(false);

  const days = useMemo(() => {
    const map = new Map<string, Date>();
    sessions.forEach((s) => {
      const key = dayKey(s.start_time);
      if (!map.has(key)) map.set(key, new Date(s.start_time));
    });
    return Array.from(map.entries())
      .sort((a, b) => a[1].getTime() - b[1].getTime())
      .map(([key, date]) => ({
        key,
        num: date.getDate(),
        name: date.toLocaleDateString('tr-TR', { weekday: 'short' }),
      }));
  }, [sessions]);

  const activeDayKey = selectedDay ?? days[0]?.key ?? null;

  const visibleSessions = useMemo(() => {
    return sessions.filter((s) => {
      if (activeDayKey && dayKey(s.start_time) !== activeDayKey) return false;
      if (onlyBookmarked && !bookmarks.has(s.id)) return false;
      if (search.trim()) {
        const q = search.toLowerCase();
        const hay = `${s.title} ${s.location ?? ''} ${s.description ?? ''}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [sessions, activeDayKey, onlyBookmarked, bookmarks, search]);

  function toggleBookmark(id: string) {
    setBookmarks((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function goToMap(locationText?: string | null) {
    if (locationText) {
      const found = venuePoints.find(
        (p) =>
          p.name.toLowerCase().includes(locationText.toLowerCase()) ||
          locationText.toLowerCase().includes(p.name.toLowerCase()),
      );
      router.push({ pathname: '/(tabs)/map', params: found ? { locationId: found.id } : {} });
      return;
    }
    router.push('/(tabs)/map');
  }

  const firstName = meResult?.profile?.full_name?.split(' ')[0] ?? '';
  const bookmarkedToday = visibleSessions.filter((s) => bookmarks.has(s.id)).length;

  return (
    <View style={styles.screen}>
      <AppHeader
        activeTab="ajanda"
        profile={meResult?.profile}
        onOpenNotifications={() => setNotificationsOpen(true)}
      />
      <FlatList
        data={visibleSessions}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.listContent}
        ListHeaderComponent={
          <View style={{ gap: 20 }}>
            <View>
              <Text style={styles.greeting}>{t('home.greeting', { name: firstName || '👋' })}</Text>
              <Text style={styles.subtitle}>
                {t('home.sessionsToday', { count: bookmarkedToday || visibleSessions.length })}
              </Text>
            </View>

            {days.length > 0 ? (
              <View style={styles.dayRow}>
                {days.map((day) => {
                  const selected = activeDayKey === day.key;
                  return (
                    <Pressable
                      key={day.key}
                      onPress={() => setSelectedDay(day.key)}
                      style={[styles.dayTab, selected && styles.dayTabSelected]}
                    >
                      <Text style={[styles.dayName, selected && styles.dayNameSelected]}>{day.name}</Text>
                      <Text style={[styles.dayNum, selected && styles.dayNumSelected]}>{day.num}</Text>
                    </Pressable>
                  );
                })}
              </View>
            ) : null}

            <View style={styles.searchRow}>
              <View style={styles.searchBox}>
                <Search size={16} color={colors.textMuted} />
                <TextInput
                  style={styles.searchInput}
                  placeholder={t('home.searchPlaceholder')}
                  placeholderTextColor={colors.textFaint}
                  value={search}
                  onChangeText={setSearch}
                />
              </View>
              <Pressable
                style={[styles.bookmarkToggle, onlyBookmarked && styles.bookmarkToggleActive]}
                onPress={() => setOnlyBookmarked((v) => !v)}
              >
                <Bookmark size={14} color={onlyBookmarked ? colors.white : colors.textMuted} />
                <Text style={[styles.bookmarkToggleText, onlyBookmarked && { color: colors.white }]}>
                  {t('home.myAgenda')}
                </Text>
              </Pressable>
            </View>
          </View>
        }
        ListEmptyComponent={
          <View style={styles.emptyState}>
            <Sparkles size={22} color={colors.textMuted} />
            <Text style={styles.emptyTitle}>{t('home.emptyTitle')}</Text>
            <Text style={styles.emptyBody}>{t('home.emptyBody')}</Text>
            {onlyBookmarked ? (
              <Pressable onPress={() => setOnlyBookmarked(false)}>
                <Text style={styles.emptyAction}>{t('home.showAll')}</Text>
              </Pressable>
            ) : null}
          </View>
        }
        renderItem={({ item }) => {
          const bookmarked = bookmarks.has(item.id);
          const start = new Date(item.start_time);
          const end = new Date(item.end_time);
          const durationMin = Math.round((end.getTime() - start.getTime()) / 60000);

          return (
            <View style={styles.sessionRow}>
              <View style={styles.timeCol}>
                <Text style={styles.timeText}>
                  {start.toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' })}
                </Text>
                <Text style={styles.durationText}>{durationMin}dk</Text>
              </View>

              <View style={styles.sessionCard}>
                <View style={styles.sessionCardHeader}>
                  <View style={{ flex: 1 }} />
                  <Pressable
                    style={[styles.bookmarkBtn, bookmarked && styles.bookmarkBtnActive]}
                    onPress={() => toggleBookmark(item.id)}
                  >
                    {bookmarked ? (
                      <Check size={16} color={colors.primary} />
                    ) : (
                      <CalendarIcon size={16} color={colors.textFaint} />
                    )}
                  </Pressable>
                </View>

                <Pressable onPress={() => setSelectedSession(item)}>
                  <Text style={styles.sessionTitle}>{item.title}</Text>
                </Pressable>
                {item.description ? (
                  <Text style={styles.sessionDesc} numberOfLines={2}>
                    {item.description}
                  </Text>
                ) : null}

                <View style={styles.sessionFooter}>
                  {item.location ? (
                    <Pressable style={styles.locationBtn} onPress={() => goToMap(item.location)}>
                      <MapPin size={13} color={colors.primary} />
                      <Text style={styles.locationText}>{item.location}</Text>
                    </Pressable>
                  ) : (
                    <View />
                  )}
                  <Pressable onPress={() => setSelectedSession(item)}>
                    <Text style={styles.detailsLink}>{t('home.details')}</Text>
                  </Pressable>
                </View>
              </View>
            </View>
          );
        }}
      />

      <SessionDetailModal
        visible={!!selectedSession}
        onClose={() => setSelectedSession(null)}
        session={selectedSession}
        isBookmarked={selectedSession ? bookmarks.has(selectedSession.id) : false}
        onToggleBookmark={() => selectedSession && toggleBookmark(selectedSession.id)}
        onShowOnMap={() => {
          const location = selectedSession?.location;
          setSelectedSession(null);
          goToMap(location);
        }}
      />

      <NotificationsModal visible={notificationsOpen} onClose={() => setNotificationsOpen(false)} />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  listContent: { padding: 16, paddingBottom: 32, gap: 16 },
  greeting: { fontSize: 26, fontWeight: '800', color: colors.text, letterSpacing: -0.5 },
  subtitle: { fontSize: 14, color: colors.textMuted, marginTop: 4 },
  dayRow: { flexDirection: 'row', gap: 10 },
  dayTab: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 14,
    borderRadius: 14,
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: colors.border,
  },
  dayTabSelected: { backgroundColor: colors.primary, borderColor: colors.primary },
  dayName: { fontSize: 11, fontWeight: '700', color: colors.textFaint, textTransform: 'uppercase' },
  dayNameSelected: { color: 'rgba(255,255,255,0.85)' },
  dayNum: { fontSize: 18, fontWeight: '800', color: colors.text, marginTop: 2 },
  dayNumSelected: { color: colors.white },
  searchRow: { flexDirection: 'row', gap: 8 },
  searchBox: {
    flex: 1,
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
  bookmarkToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 14,
    borderRadius: 12,
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: colors.border,
  },
  bookmarkToggleActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  bookmarkToggleText: { fontSize: 12, fontWeight: '700', color: colors.textMuted },
  emptyState: {
    backgroundColor: colors.white,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 28,
    alignItems: 'center',
    gap: 8,
  },
  emptyTitle: { fontSize: 14, fontWeight: '700', color: colors.text },
  emptyBody: { fontSize: 12, color: colors.textMuted, textAlign: 'center' },
  emptyAction: { fontSize: 12, fontWeight: '700', color: colors.primary, marginTop: 4 },
  sessionRow: { flexDirection: 'row', gap: 12, marginBottom: 16 },
  timeCol: { width: 56, alignItems: 'flex-end', paddingTop: 4 },
  timeText: { fontSize: 14, fontWeight: '800', color: colors.text },
  durationText: { fontSize: 11, fontWeight: '600', color: colors.textFaint },
  sessionCard: {
    flex: 1,
    backgroundColor: colors.white,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 14,
  },
  sessionCardHeader: { flexDirection: 'row', alignItems: 'center' },
  bookmarkBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  bookmarkBtnActive: { backgroundColor: colors.primarySoft },
  sessionTitle: { fontSize: 15, fontWeight: '800', color: colors.text, lineHeight: 20 },
  sessionDesc: { fontSize: 12, color: colors.textFaint, marginTop: 6, lineHeight: 17 },
  sessionFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 10,
  },
  locationBtn: { flexDirection: 'row', alignItems: 'center', gap: 5, flexShrink: 1 },
  locationText: { fontSize: 12, fontWeight: '700', color: colors.textMuted, flexShrink: 1 },
  detailsLink: { fontSize: 12, fontWeight: '700', color: colors.primary },
});
