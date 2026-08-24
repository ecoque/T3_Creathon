import {
  AlertTriangle,
  CalendarDays,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Clock3,
  Edit3,
  List,
  MapPin,
  MoreHorizontal,
  Plus,
  Radio,
  Search,
  Trash2,
  Users,
  X,
} from 'lucide-react-native';
import { useMemo, useState } from 'react';
import {
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  useWindowDimensions,
  View,
} from 'react-native';

import { colors } from '../../constants/theme';
import type { AdminSession, AdminStage, ProgramViewMode, SessionStatus } from '../../types/admin';

type AdminProgramProps = {
  sessions: AdminSession[];
  stages: AdminStage[];
  onOpenCreateSession: () => void;
  onOpenEditSession: (session: AdminSession) => void;
  onOpenQuickSessionAction: (session: AdminSession) => void;
  onDeleteSession: (session: AdminSession) => void;
};

type FilterOption = { value: string; label: string };

const DAYS: FilterOption[] = [
  { value: 'all', label: 'Tüm Günler · 24–27 Ekim' },
  { value: '24', label: '24 Ekim · Cum · Gün 1' },
  { value: '25', label: '25 Ekim · Cmt · Gün 2' },
  { value: '26', label: '26 Ekim · Paz · Gün 3' },
  { value: '27', label: '27 Ekim · Pzt · Gün 4' },
];

const STATUS_OPTIONS: FilterOption[] = [
  { value: 'all', label: 'Tüm durumlar' },
  { value: 'live', label: 'Canlı' },
  { value: 'delayed', label: 'Geciken' },
  { value: 'published', label: 'Yayında' },
  { value: 'draft', label: 'Taslak' },
  { value: 'completed', label: 'Tamamlandı' },
  { value: 'cancelled', label: 'İptal' },
];

const STATUS_STYLE: Record<
  SessionStatus,
  { label: string; color: string; backgroundColor: string; borderColor: string }
> = {
  draft: {
    label: 'TASLAK',
    color: colors.textMuted,
    backgroundColor: colors.surfaceMuted,
    borderColor: colors.borderStrong,
  },
  published: {
    label: 'YAYINDA',
    color: '#24549a',
    backgroundColor: '#e7f0ff',
    borderColor: '#c7daf5',
  },
  live: {
    label: 'CANLI',
    color: colors.success,
    backgroundColor: colors.successBg,
    borderColor: colors.successBorder,
  },
  completed: {
    label: 'TAMAMLANDI',
    color: colors.secondaryDark,
    backgroundColor: colors.secondaryContainer,
    borderColor: colors.borderStrong,
  },
  cancelled: {
    label: 'İPTAL',
    color: colors.danger,
    backgroundColor: colors.dangerBg,
    borderColor: colors.dangerBorder,
  },
  delayed: {
    label: 'GECİKMELİ',
    color: '#965900',
    backgroundColor: '#fff3d6',
    borderColor: '#f3d18a',
  },
};

function StatusPill({ session }: { session: AdminSession }) {
  const palette = STATUS_STYLE[session.status];
  const label =
    session.status === 'delayed' && session.delayMinutes
      ? `+${session.delayMinutes} DK`
      : palette.label;
  return (
    <View
      style={[
        styles.statusPill,
        { backgroundColor: palette.backgroundColor, borderColor: palette.borderColor },
      ]}
    >
      {session.status === 'live' ? <Radio size={11} color={palette.color} /> : null}
      {session.status === 'delayed' ? <AlertTriangle size={11} color={palette.color} /> : null}
      {session.status === 'completed' ? <CheckCircle2 size={11} color={palette.color} /> : null}
      <Text style={[styles.statusText, { color: palette.color }]}>{label}</Text>
    </View>
  );
}

function Segmented({
  value,
  onChange,
  compact,
}: {
  value: ProgramViewMode;
  onChange: (mode: ProgramViewMode) => void;
  compact?: boolean;
}) {
  return (
    <View style={[styles.segmented, compact && styles.segmentedCompact]}>
      {(
        [
          ['list', 'Liste Görünümü', List],
          ['calendar', 'Zaman Çizelgesi', CalendarDays],
        ] as const
      ).map(([mode, label, Icon]) => {
        const active = value === mode;
        return (
          <Pressable
            key={mode}
            accessibilityRole="button"
            accessibilityState={{ selected: active }}
            style={[styles.segment, compact && styles.segmentCompact, active && styles.segmentActive]}
            onPress={() => onChange(mode)}
          >
            <Icon size={15} color={active ? colors.text : colors.textMuted} />
            <Text style={[styles.segmentText, active && styles.segmentTextActive]}>{label}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

function FilterChips({
  options,
  value,
  onChange,
}: {
  options: FilterOption[];
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={styles.chipTrack}
      keyboardShouldPersistTaps="handled"
    >
      {options.map((option) => {
        const active = option.value === value;
        return (
          <Pressable
            key={option.value}
            style={[styles.chip, active && styles.chipActive]}
            onPress={() => onChange(option.value)}
          >
            <Text style={[styles.chipText, active && styles.chipTextActive]}>{option.label}</Text>
          </Pressable>
        );
      })}
    </ScrollView>
  );
}

function FilterGroup({
  label,
  options,
  value,
  onChange,
}: {
  label: string;
  options: FilterOption[];
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <View style={styles.filterGroup}>
      <Text style={styles.filterLabel}>{label}</Text>
      <FilterChips options={options} value={value} onChange={onChange} />
    </View>
  );
}

function SpeakerStack({ session }: { session: AdminSession }) {
  if (!session.speakers.length) {
    return <Text style={styles.emptySpeaker}>Genel katılım</Text>;
  }
  return (
    <View style={styles.speakerRow}>
      <View style={styles.avatarStack}>
        {session.speakers.slice(0, 3).map((speaker, index) =>
          speaker.avatar ? (
            <Image
              key={speaker.id}
              source={{ uri: speaker.avatar }}
              style={[styles.avatar, index > 0 && styles.avatarOverlap]}
            />
          ) : (
            <View
              key={speaker.id}
              style={[styles.avatar, styles.avatarFallback, index > 0 && styles.avatarOverlap]}
            >
              <Text style={styles.avatarText}>
                {speaker.name
                  .split(' ')
                  .filter(Boolean)
                  .slice(0, 2)
                  .map((part) => part[0])
                  .join('')
                  .toLocaleUpperCase('tr')}
              </Text>
            </View>
          ),
        )}
      </View>
      <Text numberOfLines={1} style={styles.speakerNames}>
        {session.speakers.map((speaker) => speaker.name).join(', ')}
      </Text>
    </View>
  );
}

function CapacityBar({ session }: { session: AdminSession }) {
  const percent = Math.min(100, (session.checkedInCount / Math.max(1, session.capacity)) * 100);
  return (
    <View style={styles.capacityBlock}>
      <View style={styles.capacityCopy}>
        <Text style={styles.capacityLabel}>Salon doluluğu</Text>
        <Text style={styles.capacityValue}>
          {session.checkedInCount}/{session.capacity} · %{Math.round(percent)}
        </Text>
      </View>
      <View style={styles.progressTrack}>
        <View style={[styles.progressFill, { width: `${percent}%` }]} />
      </View>
    </View>
  );
}

function SessionActions({
  session,
  onQuick,
  onEdit,
  onDelete,
}: {
  session: AdminSession;
  onQuick: () => void;
  onEdit: () => void;
  onDelete: () => void;
}) {
  return (
    <View style={styles.actions}>
      <Pressable style={styles.quickAction} onPress={onQuick}>
        <MoreHorizontal size={16} color={colors.primary} />
        <Text style={styles.quickActionText}>Hızlı işlem</Text>
      </Pressable>
      <Pressable
        accessibilityLabel={`${session.title} oturumunu düzenle`}
        style={styles.iconAction}
        onPress={onEdit}
      >
        <Edit3 size={16} color={colors.textMuted} />
      </Pressable>
      <Pressable
        accessibilityLabel={`${session.title} oturumunu sil`}
        style={styles.iconAction}
        onPress={onDelete}
      >
        <Trash2 size={16} color={colors.danger} />
      </Pressable>
    </View>
  );
}

function SessionCard({
  session,
  onQuick,
  onEdit,
  onDelete,
}: {
  session: AdminSession;
  onQuick: () => void;
  onEdit: () => void;
  onDelete: () => void;
}) {
  return (
    <View style={[styles.sessionCard, session.status === 'live' && styles.liveCard]}>
      <View style={styles.sessionTop}>
        <View style={styles.dateTile}>
          <Text style={styles.dateDay}>{session.day}</Text>
          <Text style={styles.dateMonth}>EKİ</Text>
        </View>
        <View style={styles.timeBlock}>
          <Text style={styles.timeText}>
            {session.time} – {session.endTime}
          </Text>
          <Text style={styles.durationText}>
            {session.dayName} · {session.duration}
          </Text>
        </View>
        <StatusPill session={session} />
      </View>

      <Text style={styles.sessionTitle}>{session.title}</Text>
      {session.description ? (
        <Text numberOfLines={2} style={styles.sessionDescription}>
          {session.description}
        </Text>
      ) : null}

      <View style={styles.metaWrap}>
        <View style={styles.categoryBadge}>
          <Text style={styles.categoryText}>{session.category}</Text>
        </View>
        <View style={styles.metaItem}>
          <MapPin size={14} color={colors.primary} />
          <Text style={styles.metaText}>{session.stageName}</Text>
        </View>
      </View>

      <SpeakerStack session={session} />

      <View style={styles.metricsRow}>
        <View style={styles.bookmarkMetric}>
          <Users size={15} color={colors.primary} />
          <View>
            <Text style={styles.metricValue}>{session.bookmarkedCount}</Text>
            <Text style={styles.metricLabel}>Ajandaya ekleyen</Text>
          </View>
        </View>
        <CapacityBar session={session} />
      </View>

      <SessionActions session={session} onQuick={onQuick} onEdit={onEdit} onDelete={onDelete} />
    </View>
  );
}

export function AdminProgram({
  sessions,
  stages,
  onOpenCreateSession,
  onOpenEditSession,
  onOpenQuickSessionAction,
  onDeleteSession,
}: AdminProgramProps) {
  const { width } = useWindowDimensions();
  const compact = width < 700;
  const [viewMode, setViewMode] = useState<ProgramViewMode>('list');
  const [selectedDay, setSelectedDay] = useState('all');
  const [selectedStageId, setSelectedStageId] = useState('all');
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [selectedStatus, setSelectedStatus] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [filtersOpen, setFiltersOpen] = useState(false);

  const categoryOptions = useMemo<FilterOption[]>(() => {
    const categories = Array.from(new Set(sessions.map((session) => session.category)));
    return [
      { value: 'all', label: 'Tüm türler' },
      ...categories.map((value) => ({ value, label: value })),
    ];
  }, [sessions]);
  const stageOptions = useMemo<FilterOption[]>(
    () => [
      { value: 'all', label: `Tüm sahneler · ${stages.length}` },
      ...stages.map((stage) => ({ value: stage.id, label: `${stage.name} · ${stage.zone}` })),
    ],
    [stages],
  );

  const filteredSessions = useMemo(() => {
    const query = searchQuery.trim().toLocaleLowerCase('tr');
    return sessions
      .filter((session) => {
        if (selectedDay !== 'all' && session.day !== selectedDay) return false;
        if (selectedStageId !== 'all' && session.stageId !== selectedStageId) return false;
        if (selectedCategory !== 'all' && session.category !== selectedCategory) return false;
        if (selectedStatus !== 'all' && session.status !== selectedStatus) return false;
        if (!query) return true;
        return [
          session.title,
          session.description,
          session.stageName,
          session.category,
          session.tags.join(' '),
          session.speakers.map((speaker) => speaker.name).join(' '),
        ]
          .join(' ')
          .toLocaleLowerCase('tr')
          .includes(query);
      })
      .sort((a, b) => `${a.day}-${a.time}`.localeCompare(`${b.day}-${b.time}`));
  }, [searchQuery, selectedCategory, selectedDay, selectedStageId, selectedStatus, sessions]);

  const activeAdvancedFilters = [selectedStageId, selectedCategory, selectedStatus].filter(
    (value) => value !== 'all',
  ).length;
  const visibleStages =
    selectedStageId === 'all' ? stages : stages.filter((stage) => stage.id === selectedStageId);

  function clearFilters() {
    setSelectedDay('all');
    setSelectedStageId('all');
    setSelectedCategory('all');
    setSelectedStatus('all');
    setSearchQuery('');
  }

  return (
    <View style={styles.root}>
      <View style={[styles.header, compact && styles.headerCompact]}>
        <View style={styles.headerCopy}>
          <Text style={styles.title}>Etkinlik Program & Ajanda Yönetimi</Text>
          <Text style={styles.subtitle}>
            Oturumları, konuşmacıları, sahne atamalarını ve canlı akış gecikmelerini yönetin.
          </Text>
        </View>
        <Pressable
          style={[styles.createButton, compact && styles.fullWidthButton]}
          onPress={onOpenCreateSession}
        >
          <Plus size={17} color={colors.white} />
          <Text style={styles.createButtonText}>Yeni Oturum Ekle</Text>
        </Pressable>
      </View>

      <Segmented value={viewMode} onChange={setViewMode} compact={compact} />

      <View style={styles.filterPanel}>
        <FilterChips options={DAYS} value={selectedDay} onChange={setSelectedDay} />

        <View style={[styles.searchLine, compact && styles.searchLineCompact]}>
          <View style={styles.searchField}>
            <Search size={17} color={colors.textMuted} />
            <TextInput
              value={searchQuery}
              onChangeText={setSearchQuery}
              placeholder="Oturum veya konuşmacı ara…"
              placeholderTextColor={colors.textFaint}
              style={styles.searchInput}
              returnKeyType="search"
            />
            {searchQuery ? (
              <Pressable onPress={() => setSearchQuery('')}>
                <X size={16} color={colors.textMuted} />
              </Pressable>
            ) : null}
          </View>
          <Pressable
            style={styles.filterToggle}
            onPress={() => setFiltersOpen((current) => !current)}
          >
            <Text style={styles.filterToggleText}>
              Filtreler{activeAdvancedFilters ? ` (${activeAdvancedFilters})` : ''}
            </Text>
            {filtersOpen ? (
              <ChevronUp size={16} color={colors.primary} />
            ) : (
              <ChevronDown size={16} color={colors.primary} />
            )}
          </Pressable>
        </View>

        {filtersOpen ? (
          <View style={styles.advancedFilters}>
            <FilterGroup
              label="Salon & Sahne"
              options={stageOptions}
              value={selectedStageId}
              onChange={setSelectedStageId}
            />
            <FilterGroup
              label="Oturum Türü"
              options={categoryOptions}
              value={selectedCategory}
              onChange={setSelectedCategory}
            />
            <FilterGroup
              label="Durum"
              options={STATUS_OPTIONS}
              value={selectedStatus}
              onChange={setSelectedStatus}
            />
          </View>
        ) : null}

        <View style={styles.resultLine}>
          <Text style={styles.resultText}>{filteredSessions.length} oturum gösteriliyor</Text>
          {activeAdvancedFilters || selectedDay !== 'all' || searchQuery ? (
            <Pressable onPress={clearFilters}>
              <Text style={styles.clearText}>Filtreleri temizle</Text>
            </Pressable>
          ) : null}
        </View>
      </View>

      {viewMode === 'list' ? (
        <View style={styles.list}>
          {filteredSessions.map((session) => (
            <SessionCard
              key={session.id}
              session={session}
              onQuick={() => onOpenQuickSessionAction(session)}
              onEdit={() => onOpenEditSession(session)}
              onDelete={() => onDeleteSession(session)}
            />
          ))}
          {!filteredSessions.length ? (
            <View style={styles.emptyState}>
              <CalendarDays size={28} color={colors.textMuted} />
              <Text style={styles.emptyTitle}>Oturum bulunamadı</Text>
              <Text style={styles.emptyBody}>
                Filtreleri temizleyebilir veya yeni bir oturum ekleyebilirsiniz.
              </Text>
            </View>
          ) : null}
        </View>
      ) : (
        <View style={styles.timelinePanel}>
          <View style={styles.timelineHeader}>
            <View>
              <Text style={styles.timelineTitle}>
                {selectedDay === 'all'
                  ? 'Tüm Günler Zaman Çizelgesi'
                  : `${selectedDay} Ekim Program Akışı`}
              </Text>
              <Text style={styles.timelineHint}>
                Kartlara dokunarak gecikme, durum ve sahne işlemlerini açın.
              </Text>
            </View>
          </View>
          {visibleStages.map((stage) => {
            const stageSessions = filteredSessions.filter(
              (session) => session.stageId === stage.id,
            );
            return (
              <View key={stage.id} style={styles.stageSection}>
                <View style={styles.stageHeader}>
                  <View style={styles.stageTitleLine}>
                    <View style={styles.stageDot} />
                    <View style={styles.stageCopy}>
                      <Text style={styles.stageName}>{stage.name}</Text>
                      <Text style={styles.stageMeta}>
                        {stage.zone} · Kapasite {stage.capacity}
                      </Text>
                    </View>
                  </View>
                  <Text style={styles.stageCount}>{stageSessions.length} oturum</Text>
                </View>
                {stageSessions.length ? (
                  <View style={styles.timelineCards}>
                    {stageSessions.map((session) => (
                      <Pressable
                        key={session.id}
                        style={[
                          styles.timelineCard,
                          session.status === 'live' && styles.timelineLive,
                          session.status === 'delayed' && styles.timelineDelayed,
                        ]}
                        onPress={() => onOpenQuickSessionAction(session)}
                      >
                        <View style={styles.timelineCardTop}>
                          <View style={styles.timelineTimeLine}>
                            <Clock3 size={14} color={colors.primary} />
                            <Text style={styles.timelineTime}>
                              {session.day} Eki · {session.time}–{session.endTime}
                            </Text>
                          </View>
                          <StatusPill session={session} />
                        </View>
                        <Text style={styles.timelineCardTitle}>{session.title}</Text>
                        <SpeakerStack session={session} />
                        <View style={styles.timelineFooter}>
                          <Text style={styles.timelinePeople}>
                            {session.bookmarkedCount} kişi ajandasında
                          </Text>
                          <Pressable
                            style={styles.timelineEdit}
                            onPress={(event) => {
                              event.stopPropagation();
                              onOpenEditSession(session);
                            }}
                          >
                            <Edit3 size={14} color={colors.textMuted} />
                          </Pressable>
                        </View>
                      </Pressable>
                    ))}
                  </View>
                ) : (
                  <View style={styles.stageEmpty}>
                    <Text style={styles.stageEmptyText}>
                      Bu sahne için filtrelere uygun oturum yok.
                    </Text>
                  </View>
                )}
              </View>
            );
          })}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { gap: 14 },
  header: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 18,
  },
  headerCompact: { flexDirection: 'column' },
  headerCopy: { flex: 1, gap: 5 },
  title: { color: colors.text, fontSize: 22, lineHeight: 28, fontWeight: '900' },
  subtitle: {
    color: colors.textMuted,
    fontSize: 13,
    lineHeight: 19,
    fontWeight: '500',
    maxWidth: 720,
  },
  createButton: {
    minHeight: 44,
    paddingHorizontal: 17,
    borderRadius: 13,
    backgroundColor: colors.primary,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  fullWidthButton: { alignSelf: 'stretch' },
  createButtonText: { color: colors.white, fontSize: 13, fontWeight: '800' },
  segmented: {
    flexDirection: 'row',
    backgroundColor: colors.surfaceContainer,
    padding: 4,
    borderRadius: 13,
    borderWidth: 1,
    borderColor: colors.border,
    alignSelf: 'flex-start',
  },
  segmentedCompact: { alignSelf: 'stretch' },
  segment: {
    minHeight: 37,
    paddingHorizontal: 13,
    borderRadius: 10,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  segmentCompact: { flex: 1 },
  segmentActive: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.borderStrong,
  },
  segmentText: { color: colors.textMuted, fontSize: 12, fontWeight: '700' },
  segmentTextActive: { color: colors.text, fontWeight: '800' },
  filterPanel: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 18,
    paddingVertical: 14,
    gap: 13,
    overflow: 'hidden',
  },
  chipTrack: { paddingHorizontal: 14, gap: 8 },
  chip: {
    minHeight: 34,
    paddingHorizontal: 12,
    borderRadius: 11,
    backgroundColor: colors.surfaceMuted,
    borderWidth: 1,
    borderColor: colors.border,
    justifyContent: 'center',
  },
  chipActive: { backgroundColor: colors.text, borderColor: colors.text },
  chipText: { color: colors.textMuted, fontSize: 11, fontWeight: '700' },
  chipTextActive: { color: colors.white },
  searchLine: { paddingHorizontal: 14, flexDirection: 'row', alignItems: 'center', gap: 9 },
  searchLineCompact: { alignItems: 'stretch' },
  searchField: {
    flex: 1,
    minHeight: 43,
    paddingHorizontal: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    borderWidth: 1,
    borderColor: colors.borderStrong,
    borderRadius: 12,
    backgroundColor: colors.surface,
  },
  searchInput: { flex: 1, paddingVertical: 0, color: colors.text, fontSize: 13, fontWeight: '600' },
  filterToggle: {
    minHeight: 43,
    paddingHorizontal: 12,
    borderRadius: 12,
    backgroundColor: colors.primarySoft,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 5,
  },
  filterToggleText: { color: colors.primary, fontSize: 12, fontWeight: '800' },
  advancedFilters: { paddingTop: 2, gap: 12, borderTopWidth: 1, borderTopColor: colors.border },
  filterGroup: { gap: 7 },
  filterLabel: {
    paddingHorizontal: 14,
    color: colors.text,
    fontSize: 11,
    fontWeight: '800',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  resultLine: {
    paddingHorizontal: 14,
    paddingTop: 11,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 10,
  },
  resultText: { color: colors.textMuted, fontSize: 11, fontWeight: '700' },
  clearText: { color: colors.primary, fontSize: 11, fontWeight: '800' },
  list: { gap: 11 },
  sessionCard: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 18,
    padding: 15,
    gap: 11,
  },
  liveCard: { borderColor: colors.successBorder, borderLeftWidth: 4 },
  sessionTop: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  dateTile: {
    width: 43,
    height: 48,
    borderRadius: 11,
    backgroundColor: colors.primarySoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dateDay: { color: colors.primary, fontSize: 18, lineHeight: 20, fontWeight: '900' },
  dateMonth: { color: colors.primaryDark, fontSize: 9, fontWeight: '900', letterSpacing: 0.7 },
  timeBlock: { flex: 1, gap: 3 },
  timeText: { color: colors.text, fontSize: 14, fontWeight: '900' },
  durationText: { color: colors.textMuted, fontSize: 11, fontWeight: '600' },
  statusPill: {
    minHeight: 25,
    paddingHorizontal: 8,
    borderRadius: 999,
    borderWidth: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  statusText: { fontSize: 9, fontWeight: '900', letterSpacing: 0.35 },
  sessionTitle: { color: colors.text, fontSize: 16, lineHeight: 21, fontWeight: '900' },
  sessionDescription: { color: colors.textMuted, fontSize: 12, lineHeight: 18, fontWeight: '500' },
  metaWrap: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 8 },
  categoryBadge: {
    backgroundColor: colors.surfaceMuted,
    borderRadius: 7,
    paddingHorizontal: 8,
    paddingVertical: 5,
  },
  categoryText: { color: colors.text, fontSize: 10, fontWeight: '800' },
  metaItem: { flexDirection: 'row', alignItems: 'center', gap: 4, flexShrink: 1 },
  metaText: { color: colors.textMuted, fontSize: 11, fontWeight: '700', flexShrink: 1 },
  speakerRow: { minHeight: 28, flexDirection: 'row', alignItems: 'center', gap: 8 },
  avatarStack: { flexDirection: 'row', alignItems: 'center' },
  avatar: { width: 27, height: 27, borderRadius: 14, borderWidth: 2, borderColor: colors.surface },
  avatarOverlap: { marginLeft: -8 },
  avatarFallback: {
    backgroundColor: colors.secondaryContainer,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: { color: colors.secondaryDark, fontSize: 8, fontWeight: '900' },
  speakerNames: { flex: 1, color: colors.textMuted, fontSize: 11, fontWeight: '600' },
  emptySpeaker: { color: colors.textFaint, fontSize: 11, fontStyle: 'italic', fontWeight: '500' },
  metricsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    paddingVertical: 10,
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: colors.border,
  },
  bookmarkMetric: { minWidth: 96, flexDirection: 'row', alignItems: 'center', gap: 7 },
  metricValue: { color: colors.text, fontSize: 13, fontWeight: '900' },
  metricLabel: { color: colors.textMuted, fontSize: 9, fontWeight: '600' },
  capacityBlock: { flex: 1, gap: 5 },
  capacityCopy: { flexDirection: 'row', justifyContent: 'space-between', gap: 6 },
  capacityLabel: { color: colors.textMuted, fontSize: 9, fontWeight: '600' },
  capacityValue: { color: colors.text, fontSize: 9, fontWeight: '800' },
  progressTrack: {
    height: 5,
    borderRadius: 99,
    overflow: 'hidden',
    backgroundColor: colors.surfaceHigh,
  },
  progressFill: { height: '100%', borderRadius: 99, backgroundColor: colors.primary },
  actions: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  quickAction: {
    flex: 1,
    minHeight: 39,
    borderRadius: 11,
    borderWidth: 1,
    borderColor: '#f1c59f',
    backgroundColor: colors.primarySoft,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  quickActionText: { color: colors.primary, fontSize: 11, fontWeight: '900' },
  iconAction: {
    width: 39,
    height: 39,
    borderRadius: 11,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surfaceMuted,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyState: {
    minHeight: 190,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 18,
    padding: 24,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 7,
  },
  emptyTitle: { color: colors.text, fontSize: 15, fontWeight: '900' },
  emptyBody: { color: colors.textMuted, fontSize: 12, lineHeight: 18, textAlign: 'center' },
  timelinePanel: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 18,
    padding: 14,
    gap: 19,
  },
  timelineHeader: { paddingBottom: 12, borderBottomWidth: 1, borderBottomColor: colors.border },
  timelineTitle: { color: colors.text, fontSize: 14, fontWeight: '900' },
  timelineHint: { color: colors.textMuted, fontSize: 10, lineHeight: 15, marginTop: 3 },
  stageSection: { gap: 9 },
  stageHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 8,
  },
  stageTitleLine: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 8 },
  stageDot: { width: 9, height: 9, borderRadius: 5, backgroundColor: colors.primary },
  stageCopy: { flex: 1 },
  stageName: { color: colors.text, fontSize: 13, fontWeight: '900' },
  stageMeta: { color: colors.textMuted, fontSize: 10, fontWeight: '600', marginTop: 2 },
  stageCount: { color: colors.textMuted, fontSize: 10, fontWeight: '700' },
  timelineCards: { gap: 8 },
  timelineCard: {
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surfaceMuted,
    padding: 12,
    gap: 8,
  },
  timelineLive: { backgroundColor: colors.successBg, borderColor: colors.successBorder },
  timelineDelayed: { backgroundColor: '#fff9ea', borderColor: '#f3d18a' },
  timelineCardTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 7,
  },
  timelineTimeLine: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 5 },
  timelineTime: { color: colors.text, fontSize: 11, fontWeight: '900' },
  timelineCardTitle: { color: colors.text, fontSize: 13, lineHeight: 18, fontWeight: '900' },
  timelineFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  timelinePeople: { color: colors.primary, fontSize: 10, fontWeight: '800' },
  timelineEdit: {
    width: 30,
    height: 30,
    borderRadius: 9,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stageEmpty: {
    minHeight: 55,
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: colors.borderStrong,
    borderRadius: 12,
    justifyContent: 'center',
    paddingHorizontal: 13,
  },
  stageEmptyText: { color: colors.textMuted, fontSize: 11, fontStyle: 'italic' },
});
