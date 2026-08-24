import { useQuery, useQueryClient } from '@tanstack/react-query';
import { router } from 'expo-router';
import {
  Bookmark,
  Calendar as CalendarIcon,
  Check,
  ChevronLeft,
  ChevronRight,
  MapPin,
  FolderKanban,
  Search,
  Sparkles,
  Users,
} from 'lucide-react-native';
import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Alert, FlatList, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';

import { AppHeader } from '../../components/AppHeader';
import { NotificationsModal } from '../../components/modals/NotificationsModal';
import { ScheduleMeetingModal } from '../../components/modals/ScheduleMeetingModal';
import { SessionDetailModal } from '../../components/modals/SessionDetailModal';
import { WhyMatchModal } from '../../components/modals/WhyMatchModal';
import { ROLE_LABEL_KEY } from '../../constants/roles';
import { colors } from '../../constants/theme';
import { venuePoints } from '../../constants/venuePoints';
import { rankSessionsForProfile } from '../../features/agenda/sessionRecommendations';
import { localizeMatchReasons, rankMatches } from '../../features/matching/scoring';
import { useCurrentProfile } from '../../lib/useCurrentProfile';
import { useCorporateOpportunities } from '../../lib/useCorporateOpportunities';
import { useMeetingRequests } from '../../lib/useMeetingRequests';
import type { MeetingRequestItem } from '../../lib/useMeetingRequests';
import { useOtherProfiles } from '../../lib/useOtherProfiles';
import { useSessionBookmarks, useToggleSessionBookmark } from '../../lib/useSessionBookmarks';
import { supabase } from '../../lib/supabase';
import type { Profile, Session } from '../../types';

// Ardışık iki ajanda öğesi arasında bu kadar (ms) boşluk varsa, o aralığa
// bir eşleştirme önerisi düşürülür.
const GAP_SUGGESTION_THRESHOLD_MS = 60 * 60 * 1000;
const EMPTY_SESSION_BOOKMARKS = new Set<string>();

async function fetchSessions(): Promise<Session[]> {
  const { data, error } = await supabase
    .from('sessions')
    .select('*')
    .in('status', ['published', 'live', 'delayed', 'completed'])
    .order('start_time', { ascending: true });
  if (error) throw error;
  return (data ?? []) as Session[];
}

function dayKey(date: Date) {
  return date.toDateString();
}

function startOfDay(date: Date) {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d;
}

function addDays(date: Date, amount: number) {
  const d = new Date(date);
  d.setDate(d.getDate() + amount);
  return d;
}

function addMonths(date: Date, amount: number) {
  return new Date(date.getFullYear(), date.getMonth() + amount, 1);
}

function isSameDay(a: Date, b: Date) {
  return dayKey(a) === dayKey(b);
}

// Pazartesi başlangıçlı hafta.
function startOfWeek(date: Date) {
  const d = startOfDay(date);
  const day = d.getDay();
  const diff = (day === 0 ? -6 : 1) - day;
  return addDays(d, diff);
}

type MonthCell = { date: Date; inMonth: boolean };

function buildMonthMatrix(anchor: Date): MonthCell[][] {
  const firstOfMonth = new Date(anchor.getFullYear(), anchor.getMonth(), 1);
  const gridStart = startOfWeek(firstOfMonth);
  const weeks: MonthCell[][] = [];
  let cursor = gridStart;
  for (let w = 0; w < 6; w++) {
    const week: MonthCell[] = [];
    for (let d = 0; d < 7; d++) {
      week.push({ date: cursor, inMonth: cursor.getMonth() === anchor.getMonth() });
      cursor = addDays(cursor, 1);
    }
    weeks.push(week);
  }
  return weeks;
}

type ViewMode = 'day' | 'week' | 'month';

// Ajanda; programdaki oturumlarla (sessions) kullanıcının girdiği/kabul ettiği
// toplantı taleplerini (meeting_requests) tek bir zaman çizelgesinde birleştirir.
// 'suggestion' ise gerçek bir ajanda öğesi değil; iki öğe arasındaki boş zamana
// eşleştirme motorundan düşürülen bir networking önerisidir.
type AgendaEntry =
  | { kind: 'session'; id: string; start: Date; end: Date; session: Session }
  | { kind: 'meeting'; id: string; start: Date; end: Date; meeting: MeetingRequestItem }
  | { kind: 'suggestion'; id: string; start: Date; end: Date; profile: Profile; score: number; reasons: string[] };

export default function HomeScreen() {
  const { t, i18n } = useTranslation();
  const queryClient = useQueryClient();
  const dateLocale = i18n.language?.toLowerCase().startsWith('en') ? 'en-US' : 'tr-TR';
  const { data: meResult } = useCurrentProfile();
  const myProfile = meResult?.profile ?? null;
  const isCorporate = myProfile?.role === 'kurum';
  const corporateOpportunities = useCorporateOpportunities(meResult?.userId, isCorporate);
  const { data: sessions = [] } = useQuery({ queryKey: ['sessions'], queryFn: fetchSessions });
  const { data: meetingResult } = useMeetingRequests();
  const meetingItems = useMemo(() => meetingResult?.items ?? [], [meetingResult?.items]);
  const { data: otherProfiles = [] } = useOtherProfiles();
  const bookmarkQuery = useSessionBookmarks();
  const bookmarks = bookmarkQuery.data ?? EMPTY_SESSION_BOOKMARKS;
  const toggleBookmarkMutation = useToggleSessionBookmark();

  const [viewMode, setViewMode] = useState<ViewMode>('day');
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [calendarCursor, setCalendarCursor] = useState<Date | null>(null);
  const [search, setSearch] = useState('');
  const [onlyBookmarked, setOnlyBookmarked] = useState(false);
  const [showAllSessions, setShowAllSessions] = useState(false);
  const [selectedSession, setSelectedSession] = useState<Session | null>(null);
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [connectedIds, setConnectedIds] = useState<Set<string>>(new Set());
  const [whyMatchProfile, setWhyMatchProfile] = useState<Profile | null>(null);
  const [scheduleFor, setScheduleFor] = useState<Profile | null>(null);
  const [scheduleOpen, setScheduleOpen] = useState(false);

  function toggleConnect(userId: string) {
    setConnectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(userId)) next.delete(userId);
      else next.add(userId);
      return next;
    });
  }

  const entries = useMemo<AgendaEntry[]>(() => {
    const sessionEntries: AgendaEntry[] = sessions.map((s) => ({
      kind: 'session',
      id: s.id,
      start: new Date(s.start_time),
      end: new Date(s.end_time),
      session: s,
    }));

    // Reddedilen talepler ajandaya girmez; bekleyen ve kabul edilen toplantılar
    // (girilen/katılınacak toplantılar) programla birlikte gösterilir.
    const meetingEntries: AgendaEntry[] = meetingItems
      .filter((m) => m.status !== 'rejected' && !!m.proposed_time)
      .map((m) => {
        const start = new Date(m.proposed_time as string);
        return {
          kind: 'meeting',
          id: m.id,
          start,
          end: new Date(start.getTime() + 30 * 60000),
          meeting: m,
        };
      });

    return [...sessionEntries, ...meetingEntries].sort((a, b) => a.start.getTime() - b.start.getTime());
  }, [sessions, meetingItems]);

  const recommendedSessions = useMemo(() => {
    if (!myProfile) return [];
    return rankSessionsForProfile(myProfile, sessions);
  }, [myProfile, sessions]);

  // Her etkinlik günü için profille en uyumlu ilk üç oturum akıllı ajandaya
  // girer. Puan üretmeyen günlerde ekranı boş bırakmamak için kronolojik ilk
  // üç oturum keşif önerisi olarak kullanılır.
  const recommendedSessionIds = useMemo(() => {
    const ids = new Set<string>();
    const byDay = new Map<string, typeof recommendedSessions>();
    recommendedSessions.forEach((recommendation) => {
      const key = dayKey(new Date(recommendation.session.start_time));
      byDay.set(key, [...(byDay.get(key) ?? []), recommendation]);
    });
    byDay.forEach((dayRecommendations) => {
      const positive = dayRecommendations.filter((item) => item.score > 0);
      (positive.length > 0 ? positive : dayRecommendations).slice(0, 3).forEach((item) => ids.add(item.session.id));
    });
    return ids;
  }, [recommendedSessions]);
  const profileMatchedSessionIds = useMemo(
    () => new Set(recommendedSessions.filter((item) => item.score > 0).map((item) => item.session.id)),
    [recommendedSessions],
  );

  const days = useMemo(() => {
    const map = new Map<string, Date>();
    entries.forEach((e) => {
      const key = dayKey(e.start);
      if (!map.has(key)) map.set(key, e.start);
    });
    return Array.from(map.entries())
      .sort((a, b) => a[1].getTime() - b[1].getTime())
      .map(([key, date]) => ({
        key,
        date,
        num: date.getDate(),
        name: date.toLocaleDateString(dateLocale, { weekday: 'short' }),
      }));
  }, [entries, dateLocale]);

  // Görünüm gün/hafta/ay arasında değişse de ajanda listesi her zaman
  // tek bir seçili günü gösterir; hafta/ay görünümü sadece o günü seçmek içindir.
  const activeDate = selectedDate ?? days[0]?.date ?? new Date();
  const activeDayKeyStr = dayKey(activeDate);
  const gridCursor = calendarCursor ?? activeDate;

  function selectDate(date: Date) {
    setSelectedDate(date);
    setCalendarCursor(null);
  }

  function hasEntriesOn(date: Date) {
    const key = dayKey(date);
    return entries.some((e) => dayKey(e.start) === key);
  }

  const weekDays = useMemo(() => {
    const start = startOfWeek(gridCursor);
    return Array.from({ length: 7 }, (_, i) => addDays(start, i));
  }, [gridCursor]);

  const weekRangeLabel = useMemo(() => {
    const fmt = (d: Date) => d.toLocaleDateString(dateLocale, { day: 'numeric', month: 'short' });
    return `${fmt(weekDays[0])} - ${fmt(weekDays[6])}`;
  }, [weekDays, dateLocale]);

  const monthMatrix = useMemo(() => buildMonthMatrix(gridCursor), [gridCursor]);

  const monthLabel = useMemo(
    () => gridCursor.toLocaleDateString(dateLocale, { month: 'long', year: 'numeric' }),
    [gridCursor, dateLocale],
  );

  const weekdayHeaderLabels = useMemo(() => {
    const start = startOfWeek(new Date());
    return Array.from({ length: 7 }, (_, i) => addDays(start, i).toLocaleDateString(dateLocale, { weekday: 'short' }));
  }, [dateLocale]);

  // "Bugüne Dön" sadece hafta/ay görünümünde, ekranda gösterilen aralık bugünü
  // içermiyorsa çıkar; gün görünümünde hiç gösterilmez.
  const isTodayVisible = useMemo(() => {
    const today = new Date();
    if (viewMode === 'week') return weekDays.some((d) => isSameDay(d, today));
    if (viewMode === 'month') return monthMatrix.some((week) => week.some((cell) => isSameDay(cell.date, today)));
    return true;
  }, [viewMode, weekDays, monthMatrix]);
  const showTodayShortcut = viewMode !== 'day' && !isTodayVisible;

  const visibleEntries = useMemo(() => {
    return entries.filter((e) => {
      if (dayKey(e.start) !== activeDayKeyStr) return false;
      if (e.kind === 'session') {
        if (onlyBookmarked && !bookmarks.has(e.session.id)) return false;
        const smartAgendaOnly = !onlyBookmarked && !showAllSessions && !search.trim();
        if (smartAgendaOnly && !bookmarks.has(e.session.id) && !recommendedSessionIds.has(e.session.id)) return false;
      }
      if (search.trim()) {
        const q = search.toLowerCase();
        const hay =
          e.kind === 'session'
            ? `${e.session.title} ${e.session.location ?? ''} ${e.session.description ?? ''}`
            : e.kind === 'meeting'
              ? `${e.meeting.otherProfile?.full_name ?? ''} ${e.meeting.otherProfile?.sector ?? ''} ${t('home.meetingBadge')}`
              : `${e.profile.full_name} ${e.profile.sector ?? ''} ${e.profile.interests.join(' ')}`;
        if (!hay.toLowerCase().includes(q)) return false;
      }
      return true;
    });
  }, [entries, activeDayKeyStr, onlyBookmarked, showAllSessions, bookmarks, recommendedSessionIds, search, t]);

  // Halihazırda kendisiyle toplantısı olan (bekleyen/kabul edilen/reddedilen fark etmez,
  // zaten temas kurulmuş) katılımcılar boşluk önerilerinde tekrar önerilmez.
  const engagedUserIds = useMemo(() => {
    return new Set(meetingItems.map((m) => (m.direction === 'outgoing' ? m.to_user_id : m.from_user_id)));
  }, [meetingItems]);

  const availableCandidates = useMemo(() => {
    if (!myProfile) return [];
    return rankMatches(myProfile, otherProfiles)
      .filter(
        (candidate) =>
          candidate.profile.status === 'active'
          && candidate.score > 0
          && !engagedUserIds.has(candidate.profile.user_id),
      )
      .map((candidate) => ({
        ...candidate,
        reasons: localizeMatchReasons(candidate, t),
      }));
  }, [myProfile, otherProfiles, engagedUserIds, t]);

  // Görüntülenen günde ardışık iki öğe arasında 1 saat veya daha uzun boşluk
  // varsa, aynı gün içinde daha önce önerilmemiş en uygun kişiyi o boşluğa düşürür.
  const displayItems = useMemo<AgendaEntry[]>(() => {
    if (visibleEntries.length === 0 || availableCandidates.length === 0) return visibleEntries;

    const result: AgendaEntry[] = [];
    const usedProfileIds = new Set<string>();

    visibleEntries.forEach((entry, index) => {
      result.push(entry);
      const next = visibleEntries[index + 1];
      if (!next) return;

      const gapMs = next.start.getTime() - entry.end.getTime();
      if (gapMs < GAP_SUGGESTION_THRESHOLD_MS) return;

      const candidate = availableCandidates.find((c) => !usedProfileIds.has(c.profile.user_id));
      if (!candidate) return;
      usedProfileIds.add(candidate.profile.user_id);

      result.push({
        kind: 'suggestion',
        id: `gap-${activeDayKeyStr}-${index}-${candidate.profile.id}`,
        start: entry.end,
        end: next.start,
        profile: candidate.profile,
        score: candidate.score,
        reasons: candidate.reasons,
      });
    });

    return result;
  }, [visibleEntries, availableCandidates, activeDayKeyStr]);

  function toggleBookmark(id: string) {
    toggleBookmarkMutation.mutate(
      { sessionId: id, bookmarked: bookmarks.has(id) },
      {
        onError: (mutationError) => {
          const conflict = mutationError instanceof Error && mutationError.message.includes('overlaps');
          Alert.alert(t('home.smartAgendaTitle'), t(conflict ? 'home.bookmarkConflictError' : 'home.bookmarkSyncError'));
        },
      },
    );
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
  const pendingIncomingCount = meetingItems.filter(
    (meeting) => meeting.direction === 'incoming' && meeting.status === 'pending',
  ).length;
  const activeCorporateOpportunities = corporateOpportunities.items.filter(
    (opportunity) => !['won', 'closed'].includes(opportunity.stage),
  );
  const nextCorporateAction = activeCorporateOpportunities
    .filter((opportunity) => opportunity.next_action && opportunity.next_action_at)
    .sort((a, b) => new Date(a.next_action_at!).getTime() - new Date(b.next_action_at!).getTime())[0];

  return (
    <View style={styles.screen}>
      <AppHeader
        activeTab="ajanda"
        profile={meResult?.profile}
        onOpenNotifications={() => setNotificationsOpen(true)}
      />
      <FlatList
        data={displayItems}
        keyExtractor={(item) => `${item.kind}-${item.id}`}
        contentContainerStyle={styles.listContent}
        ListHeaderComponent={
          <View style={{ gap: 20 }}>
            <View>
              <Text style={styles.greeting}>{t('home.greeting', { name: firstName || '👋' })}</Text>
              <Text style={styles.subtitle}>
                {t('home.itemsToday', { count: visibleEntries.length })}
              </Text>
            </View>

            <View style={styles.smartAgendaCard}>
              <View style={styles.smartAgendaTitleRow}>
                <Sparkles size={16} color={colors.primary} />
                <Text style={styles.smartAgendaTitle}>{t('home.smartAgendaTitle')}</Text>
              </View>
              <Text style={styles.smartAgendaHint}>
                {t('home.smartAgendaHint')}
              </Text>
              {pendingIncomingCount > 0 ? (
                <Pressable onPress={() => router.push('/(tabs)/meetings')}>
                  <Text style={styles.smartAgendaAction}>
                    {t('home.pendingMeetingAction', { count: pendingIncomingCount })}
                  </Text>
                </Pressable>
              ) : null}
              <Pressable onPress={() => setShowAllSessions((current) => !current)}>
                <Text style={styles.smartAgendaAction}>
                  {t(showAllSessions ? 'home.showSmartAgenda' : 'home.showAll')}
                </Text>
              </Pressable>
            </View>
            {isCorporate ? (
              <Pressable
                style={styles.corporateActionCard}
                onPress={() => router.push('/(tabs)/opportunities')}
              >
                <View style={styles.corporateActionIcon}>
                  <FolderKanban size={19} color={colors.primary} />
                </View>
                <View style={{ flex: 1, gap: 3 }}>
                  <Text style={styles.corporateActionTitle}>{t('corporate.homeOpportunityTitle')}</Text>
                  {corporateOpportunities.queryError ? (
                    <Text style={styles.corporateActionError}>{t('corporate.homeOpportunityLoadError')}</Text>
                  ) : nextCorporateAction ? (
                    <>
                      <Text style={styles.corporateActionText} numberOfLines={1}>{nextCorporateAction.next_action}</Text>
                      <Text style={styles.corporateActionMeta}>
                        {t('corporate.homeOpportunityNextAction', {
                          name: nextCorporateAction.targetProfile?.full_name ?? '',
                          date: new Date(nextCorporateAction.next_action_at!).toLocaleString(dateLocale, {
                            day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit',
                          }),
                        })}
                      </Text>
                    </>
                  ) : (
                    <Text style={styles.corporateActionText}>
                      {t('corporate.homeOpportunitySummary', { count: activeCorporateOpportunities.length })}
                    </Text>
                  )}
                </View>
                <ChevronRight size={18} color={colors.primary} />
              </Pressable>
            ) : null}
            {bookmarkQuery.error || toggleBookmarkMutation.error ? (
              <Text style={styles.bookmarkSyncError}>{t('home.bookmarkSyncError')}</Text>
            ) : null}

            <View style={styles.viewModeContainer}>
              <View style={styles.viewModeRow}>
                {(['day', 'week', 'month'] as ViewMode[]).map((mode) => {
                  const selected = viewMode === mode;
                  const label =
                    mode === 'day' ? t('home.viewDay') : mode === 'week' ? t('home.viewWeek') : t('home.viewMonth');
                  return (
                    <Pressable
                      key={mode}
                      onPress={() => setViewMode(mode)}
                      style={[styles.viewModeTab, selected && styles.viewModeTabSelected]}
                    >
                      <Text style={[styles.viewModeTabText, selected && styles.viewModeTabTextSelected]}>
                        {label}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
              {showTodayShortcut ? (
                <Pressable style={styles.todayChip} onPress={() => selectDate(new Date())}>
                  <CalendarIcon size={13} color={colors.primary} />
                  <Text style={styles.todayChipText}>{t('home.goToToday')}</Text>
                </Pressable>
              ) : null}
            </View>

            {viewMode === 'day' && days.length > 0 ? (
              <View style={styles.dayRow}>
                {days.map((day) => {
                  const selected = activeDayKeyStr === day.key;
                  return (
                    <Pressable
                      key={day.key}
                      onPress={() => selectDate(day.date)}
                      style={[styles.dayTab, selected && styles.dayTabSelected]}
                    >
                      <Text style={[styles.dayName, selected && styles.dayNameSelected]}>{day.name}</Text>
                      <Text style={[styles.dayNum, selected && styles.dayNumSelected]}>{day.num}</Text>
                    </Pressable>
                  );
                })}
              </View>
            ) : null}

            {viewMode === 'week' ? (
              <View style={styles.calendarBlock}>
                <View style={styles.calendarNavRow}>
                  <Pressable onPress={() => setCalendarCursor(addDays(gridCursor, -7))} hitSlop={8}>
                    <ChevronLeft size={18} color={colors.text} />
                  </Pressable>
                  <Text style={styles.calendarNavLabel}>{weekRangeLabel}</Text>
                  <Pressable onPress={() => setCalendarCursor(addDays(gridCursor, 7))} hitSlop={8}>
                    <ChevronRight size={18} color={colors.text} />
                  </Pressable>
                </View>
                <View style={styles.weekRow}>
                  {weekDays.map((d) => {
                    const selected = isSameDay(d, activeDate);
                    const marked = hasEntriesOn(d);
                    return (
                      <Pressable
                        key={dayKey(d)}
                        onPress={() => selectDate(d)}
                        style={[styles.weekCell, selected && styles.weekCellSelected]}
                      >
                        <Text style={[styles.weekCellName, selected && styles.weekCellNameSelected]}>
                          {d.toLocaleDateString(dateLocale, { weekday: 'short' })}
                        </Text>
                        <Text style={[styles.weekCellNum, selected && styles.weekCellNumSelected]}>
                          {d.getDate()}
                        </Text>
                        {marked ? (
                          <View style={[styles.weekDot, selected && styles.weekDotSelected]} />
                        ) : (
                          <View style={styles.weekDotPlaceholder} />
                        )}
                      </Pressable>
                    );
                  })}
                </View>
              </View>
            ) : null}

            {viewMode === 'month' ? (
              <View style={styles.calendarBlock}>
                <View style={styles.calendarNavRow}>
                  <Pressable onPress={() => setCalendarCursor(addMonths(gridCursor, -1))} hitSlop={8}>
                    <ChevronLeft size={18} color={colors.text} />
                  </Pressable>
                  <Text style={styles.calendarNavLabel}>{monthLabel}</Text>
                  <Pressable onPress={() => setCalendarCursor(addMonths(gridCursor, 1))} hitSlop={8}>
                    <ChevronRight size={18} color={colors.text} />
                  </Pressable>
                </View>
                <View style={styles.weekdayHeaderRow}>
                  {weekdayHeaderLabels.map((label, i) => (
                    <Text key={`${label}-${i}`} style={styles.weekdayHeaderText}>
                      {label}
                    </Text>
                  ))}
                </View>
                {monthMatrix.map((week, wi) => (
                  <View key={wi} style={styles.monthWeekRow}>
                    {week.map(({ date, inMonth }) => {
                      const selected = isSameDay(date, activeDate);
                      const marked = hasEntriesOn(date);
                      return (
                        <Pressable
                          key={dayKey(date)}
                          onPress={() => selectDate(date)}
                          style={[styles.monthCell, selected && styles.monthCellSelected]}
                        >
                          <Text
                            style={[
                              styles.monthCellText,
                              !inMonth && styles.monthCellTextDim,
                              selected && styles.monthCellTextSelected,
                            ]}
                          >
                            {date.getDate()}
                          </Text>
                          {marked ? <View style={[styles.monthDot, selected && styles.monthDotSelected]} /> : null}
                        </Pressable>
                      );
                    })}
                  </View>
                ))}
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
          const durationMin = Math.round((item.end.getTime() - item.start.getTime()) / 60000);
          const timeLabel = item.start.toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' });

          if (item.kind === 'session') {
            const s = item.session;
            const bookmarked = bookmarks.has(s.id);

            return (
              <View style={styles.sessionRow}>
                <View style={styles.timeCol}>
                  <Text style={styles.timeText}>{timeLabel}</Text>
                  <Text style={styles.durationText}>{durationMin}dk</Text>
                </View>

                <View style={styles.sessionCard}>
                  <View style={styles.sessionCardHeader}>
                    {profileMatchedSessionIds.has(s.id) && !bookmarked ? (
                      <View style={styles.recommendedBadge}>
                        <Sparkles size={11} color={colors.primary} />
                        <Text style={styles.recommendedBadgeText}>{t('home.recommendedForYou')}</Text>
                      </View>
                    ) : (
                      <View style={{ flex: 1 }} />
                    )}
                    <Pressable
                      style={[styles.bookmarkBtn, bookmarked && styles.bookmarkBtnActive]}
                      onPress={() => toggleBookmark(s.id)}
                    >
                      {bookmarked ? (
                        <Check size={16} color={colors.primary} />
                      ) : (
                        <CalendarIcon size={16} color={colors.textFaint} />
                      )}
                    </Pressable>
                  </View>

                  <Pressable onPress={() => setSelectedSession(s)}>
                    <Text style={styles.sessionTitle}>{s.title}</Text>
                  </Pressable>
                  {s.description ? (
                    <Text style={styles.sessionDesc} numberOfLines={2}>
                      {s.description}
                    </Text>
                  ) : null}

                  <View style={styles.sessionFooter}>
                    {s.location ? (
                      <Pressable style={styles.locationBtn} onPress={() => goToMap(s.location)}>
                        <MapPin size={13} color={colors.primary} />
                        <Text style={styles.locationText}>{s.location}</Text>
                      </Pressable>
                    ) : (
                      <View />
                    )}
                    <Pressable onPress={() => setSelectedSession(s)}>
                      <Text style={styles.detailsLink}>{t('home.details')}</Text>
                    </Pressable>
                  </View>
                </View>
              </View>
            );
          }

          if (item.kind === 'meeting') {
            const meeting = item.meeting;
            const otherName = meeting.otherProfile?.full_name || t('home.meetingNoParticipant');
            const isAccepted = meeting.status === 'accepted';
            const statusLabel = isAccepted ? t('meetings.statusAccepted') : t('meetings.statusPending');
            const directionLabel = meeting.direction === 'outgoing' ? t('meetings.outgoing') : t('meetings.incoming');

            return (
              <View style={styles.sessionRow}>
                <View style={styles.timeCol}>
                  <Text style={styles.timeText}>{timeLabel}</Text>
                  <Text style={styles.durationText}>{directionLabel}</Text>
                </View>

                <View style={[styles.sessionCard, styles.meetingCard]}>
                  <View style={[styles.sessionCardHeader, styles.meetingCardHeader]}>
                    <View style={styles.meetingBadge}>
                      <Users size={12} color={colors.primary} />
                      <Text style={styles.meetingBadgeText}>{t('home.meetingBadge')}</Text>
                    </View>
                    <View
                      style={[styles.statusPill, isAccepted ? styles.statusPillAccepted : styles.statusPillPending]}
                    >
                      <Text style={[styles.statusPillText, isAccepted && styles.statusPillTextAccepted]}>
                        {statusLabel}
                      </Text>
                    </View>
                  </View>

                  <Text style={styles.sessionTitle}>{t('home.meetingWith', { name: otherName })}</Text>
                  {meeting.otherProfile?.sector ? (
                    <Text style={styles.sessionDesc} numberOfLines={1}>
                      {meeting.otherProfile.sector}
                    </Text>
                  ) : null}

                  <View style={styles.sessionFooter}>
                    <View />
                    <Pressable onPress={() => router.push('/(tabs)/meetings')}>
                      <Text style={styles.detailsLink}>{t('home.goToMeetings')}</Text>
                    </Pressable>
                  </View>
                </View>
              </View>
            );
          }

          const suggestionMinutes = Math.round((item.end.getTime() - item.start.getTime()) / 60000);

          return (
            <View style={styles.sessionRow}>
              <View style={styles.timeCol}>
                <Text style={styles.timeText}>{timeLabel}</Text>
                <Text style={styles.durationText}>{t('home.suggestionGap', { count: suggestionMinutes })}</Text>
              </View>

              <View style={[styles.sessionCard, styles.suggestionCard]}>
                <View style={[styles.sessionCardHeader, styles.meetingCardHeader]}>
                  <View style={styles.suggestionBadge}>
                    <Sparkles size={12} color={colors.accent} />
                    <Text style={styles.suggestionBadgeText}>{t('home.suggestionBadge')}</Text>
                  </View>
                  <View style={styles.scorePill}>
                    <Text style={styles.scorePillText}>{t('matching.matchScore', { score: item.score })}</Text>
                  </View>
                </View>

                <Text style={styles.sessionTitle}>{t('home.suggestionWith', { name: item.profile.full_name })}</Text>
                <Text style={styles.sessionDesc} numberOfLines={2}>
                  {item.reasons[0] ?? t(ROLE_LABEL_KEY[item.profile.role])}
                </Text>

                <View style={styles.sessionFooter}>
                  <Pressable onPress={() => setWhyMatchProfile(item.profile)}>
                    <Text style={styles.detailsLink}>{t('matching.whyMatched')}</Text>
                  </Pressable>
                  <Pressable
                    style={styles.suggestionCta}
                    onPress={() => {
                      setScheduleFor(item.profile);
                      setScheduleOpen(true);
                    }}
                  >
                    <Text style={styles.suggestionCtaText}>{t('matching.requestMeeting')}</Text>
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

      <WhyMatchModal
        visible={!!whyMatchProfile}
        onClose={() => setWhyMatchProfile(null)}
        profile={whyMatchProfile}
        score={
          whyMatchProfile ? availableCandidates.find((c) => c.profile.id === whyMatchProfile.id)?.score ?? 0 : 0
        }
        reasons={
          whyMatchProfile ? availableCandidates.find((c) => c.profile.id === whyMatchProfile.id)?.reasons ?? [] : []
        }
        isConnected={whyMatchProfile ? connectedIds.has(whyMatchProfile.user_id) : false}
        onConnect={() => whyMatchProfile && toggleConnect(whyMatchProfile.user_id)}
        onRequestMeeting={() => {
          setScheduleFor(whyMatchProfile);
          setScheduleOpen(true);
        }}
      />

      <ScheduleMeetingModal
        visible={scheduleOpen}
        onClose={() => {
          setScheduleOpen(false);
          setScheduleFor(null);
        }}
        participants={otherProfiles}
        preSelectedUserId={scheduleFor?.user_id}
        onCreated={() => queryClient.invalidateQueries({ queryKey: ['meeting_requests'] })}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  listContent: { padding: 16, paddingBottom: 32, gap: 16 },
  greeting: { fontSize: 26, fontWeight: '800', color: colors.text, letterSpacing: -0.5 },
  subtitle: { fontSize: 14, color: colors.textMuted, marginTop: 4 },
  viewModeContainer: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  viewModeRow: {
    flex: 1,
    flexDirection: 'row',
    backgroundColor: colors.surfaceMuted,
    borderRadius: 12,
    padding: 4,
    gap: 4,
  },
  viewModeTab: { flex: 1, paddingVertical: 8, borderRadius: 9, alignItems: 'center' },
  viewModeTabSelected: { backgroundColor: colors.white },
  viewModeTabText: { fontSize: 12, fontWeight: '700', color: colors.textMuted },
  viewModeTabTextSelected: { color: colors.primary },
  todayChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 12,
    backgroundColor: colors.primarySoft,
    borderWidth: 1,
    borderColor: colors.primaryLight,
  },
  todayChipText: { fontSize: 12, fontWeight: '700', color: colors.primary },
  calendarBlock: {
    backgroundColor: colors.white,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 14,
    gap: 12,
  },
  calendarNavRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  calendarNavLabel: { fontSize: 13, fontWeight: '800', color: colors.text, textTransform: 'capitalize' },
  weekRow: { flexDirection: 'row', justifyContent: 'space-between' },
  weekCell: { alignItems: 'center', gap: 4, paddingVertical: 8, paddingHorizontal: 4, borderRadius: 12, flex: 1 },
  weekCellSelected: { backgroundColor: colors.primary },
  weekCellName: { fontSize: 10, fontWeight: '700', color: colors.textFaint, textTransform: 'uppercase' },
  weekCellNameSelected: { color: 'rgba(255,255,255,0.85)' },
  weekCellNum: { fontSize: 15, fontWeight: '800', color: colors.text },
  weekCellNumSelected: { color: colors.white },
  weekDot: { width: 5, height: 5, borderRadius: 3, backgroundColor: colors.primary },
  weekDotSelected: { backgroundColor: colors.white },
  weekDotPlaceholder: { width: 5, height: 5 },
  weekdayHeaderRow: { flexDirection: 'row', justifyContent: 'space-between' },
  weekdayHeaderText: {
    flex: 1,
    textAlign: 'center',
    fontSize: 10,
    fontWeight: '700',
    color: colors.textFaint,
    textTransform: 'uppercase',
  },
  monthWeekRow: { flexDirection: 'row', justifyContent: 'space-between' },
  monthCell: {
    flex: 1,
    aspectRatio: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 2,
    borderRadius: 10,
    marginHorizontal: 1,
  },
  monthCellSelected: { backgroundColor: colors.primary },
  monthCellText: { fontSize: 13, fontWeight: '700', color: colors.text },
  monthCellTextDim: { color: colors.textFaint, opacity: 0.5 },
  monthCellTextSelected: { color: colors.white },
  monthDot: { width: 4, height: 4, borderRadius: 2, backgroundColor: colors.primary },
  monthDotSelected: { backgroundColor: colors.white },
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
  smartAgendaCard: {
    backgroundColor: colors.primarySoft,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.primaryLight,
    padding: 14,
    gap: 7,
  },
  corporateActionCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 11,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.primaryLight,
    backgroundColor: colors.white,
    padding: 13,
  },
  corporateActionIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.primarySoft,
  },
  corporateActionTitle: { color: colors.text, fontSize: 13, fontWeight: '800' },
  corporateActionText: { color: colors.textMuted, fontSize: 11, lineHeight: 15 },
  corporateActionMeta: { color: colors.textFaint, fontSize: 9, lineHeight: 13 },
  corporateActionError: { color: colors.danger, fontSize: 10, lineHeight: 14 },
  smartAgendaTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 7 },
  smartAgendaTitle: { color: colors.text, fontSize: 14, fontWeight: '800' },
  smartAgendaHint: { color: colors.textMuted, fontSize: 11, lineHeight: 16 },
  smartAgendaAction: { color: colors.primary, fontSize: 12, fontWeight: '800', marginTop: 2 },
  bookmarkSyncError: { color: colors.danger, fontSize: 12, fontWeight: '600' },
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
  recommendedBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    marginRight: 'auto',
    paddingHorizontal: 9,
    paddingVertical: 4,
    borderRadius: 10,
    backgroundColor: colors.primarySoft,
  },
  recommendedBadgeText: { color: colors.primary, fontSize: 10, fontWeight: '800' },
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
  meetingCard: { borderColor: colors.primaryLight, backgroundColor: colors.primarySoft },
  meetingCardHeader: { justifyContent: 'space-between' },
  meetingBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 10,
    backgroundColor: colors.white,
  },
  meetingBadgeText: { fontSize: 11, fontWeight: '800', color: colors.primary },
  statusPill: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 10,
    borderWidth: 1,
  },
  statusPillPending: { backgroundColor: colors.surfaceMuted, borderColor: colors.border },
  statusPillAccepted: { backgroundColor: colors.successBg, borderColor: colors.successBorder },
  statusPillText: { fontSize: 11, fontWeight: '700', color: colors.textMuted },
  statusPillTextAccepted: { color: colors.success },
  suggestionCard: { borderColor: colors.accent, borderStyle: 'dashed', backgroundColor: colors.white },
  suggestionBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 10,
    backgroundColor: colors.surfaceMuted,
  },
  suggestionBadgeText: { fontSize: 11, fontWeight: '800', color: colors.accent },
  scorePill: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 10,
    backgroundColor: colors.primarySoft,
  },
  scorePillText: { fontSize: 11, fontWeight: '700', color: colors.primary },
  suggestionCta: {
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 10,
    backgroundColor: colors.primary,
  },
  suggestionCtaText: { fontSize: 12, fontWeight: '700', color: colors.white },
});
