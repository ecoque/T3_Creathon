import {
  Activity,
  Building2,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  CircleAlert,
  Crosshair,
  Edit3,
  Layers3,
  MapPin,
  Plus,
  Radio,
  Search,
  Store,
  Trash2,
  Users,
  X,
  XCircle,
} from 'lucide-react-native';
import { useEffect, useMemo, useState, type ComponentType } from 'react';
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
import { isBoothPlaced } from '../../lib/boothGrid';
import type { AdminBooth, AdminSession, AdminStage, ZoneDensityInfo } from '../../types/admin';

export type VenueTab = 'booths' | 'stages' | 'zones';

type AdminVenuesAndStandsProps = {
  booths: AdminBooth[];
  stages: AdminStage[];
  zones: ZoneDensityInfo[];
  sessions: AdminSession[];
  initialTab?: VenueTab;
  onOpenCreateBooth: () => void;
  onOpenEditBooth: (booth: AdminBooth) => void;
  onDeleteBooth: (booth: AdminBooth) => void;
  onToggleBoothStatus: (booth: AdminBooth) => void;
  onOpenCreateStage: () => void;
  onOpenEditStage: (stage: AdminStage) => void;
  onDeleteStage: (stage: AdminStage) => void;
  onNavigateToMap: (booth?: AdminBooth) => void;
  onNavigateToStageMap: (stage: AdminStage) => void;
};

type FilterOption = { value: string; label: string };
type IconType = ComponentType<{ size?: number; color?: string }>;

const ALL = 'all';
const ZONES: FilterOption[] = [
  { value: ALL, label: 'Tüm Bölgeler' },
  { value: 'Zone A', label: 'Zone A · Ana Oditoryum' },
  { value: 'Zone B', label: 'Zone B · AI & Teknoloji' },
  { value: 'Zone C', label: 'Zone C · Girişim Stantları' },
  { value: 'Zone D', label: 'Zone D · Networking' },
];

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
            accessibilityRole="button"
            accessibilityState={{ selected: active }}
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

function SearchField({
  value,
  onChange,
  placeholder,
}: {
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
}) {
  return (
    <View style={styles.searchField}>
      <Search size={17} color={colors.textMuted} />
      <TextInput
        value={value}
        onChangeText={onChange}
        placeholder={placeholder}
        placeholderTextColor={colors.textFaint}
        returnKeyType="search"
        style={styles.searchInput}
      />
      {value ? (
        <Pressable accessibilityLabel="Aramayı temizle" onPress={() => onChange('')}>
          <X size={16} color={colors.textMuted} />
        </Pressable>
      ) : null}
    </View>
  );
}

function StatusPill({ status }: { status: AdminBooth['status'] | AdminStage['status'] }) {
  const palette =
    status === 'active'
      ? {
          label: 'AKTİF',
          color: colors.success,
          bg: colors.successBg,
          border: colors.successBorder,
        }
      : status === 'reserved'
        ? { label: 'REZERVE', color: '#965900', bg: '#fff3d6', border: '#f3d18a' }
        : status === 'maintenance'
          ? { label: 'BAKIMDA', color: '#965900', bg: '#fff3d6', border: '#f3d18a' }
          : status === 'closed'
            ? {
                label: 'KAPALI',
                color: colors.danger,
                bg: colors.dangerBg,
                border: colors.dangerBorder,
              }
            : {
                label: 'PASİF',
                color: colors.textMuted,
                bg: colors.surfaceMuted,
                border: colors.borderStrong,
              };
  return (
    <View style={[styles.statusPill, { backgroundColor: palette.bg, borderColor: palette.border }]}>
      {status === 'active' ? (
        <CheckCircle2 size={11} color={palette.color} />
      ) : (
        <XCircle size={11} color={palette.color} />
      )}
      <Text style={[styles.statusText, { color: palette.color }]}>{palette.label}</Text>
    </View>
  );
}

function ActionButton({
  icon: Icon,
  label,
  onPress,
  danger,
}: {
  icon: IconType;
  label: string;
  onPress: () => void;
  danger?: boolean;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      style={[styles.actionButton, danger && styles.actionButtonDanger]}
      onPress={onPress}
    >
      <Icon size={15} color={danger ? colors.danger : colors.textMuted} />
    </Pressable>
  );
}

function ProgressBar({ percent, color }: { percent: number; color?: string }) {
  const normalized = Math.max(0, Math.min(100, percent));
  const fillColor =
    color || (normalized > 90 ? colors.danger : normalized > 70 ? colors.primary : colors.success);
  return (
    <View style={styles.progressTrack}>
      <View
        style={[styles.progressFill, { width: `${normalized}%`, backgroundColor: fillColor }]}
      />
    </View>
  );
}

function EmptyState({ title, body }: { title: string; body: string }) {
  return (
    <View style={styles.emptyState}>
      <CircleAlert size={23} color={colors.textMuted} />
      <Text style={styles.emptyTitle}>{title}</Text>
      <Text style={styles.emptyBody}>{body}</Text>
    </View>
  );
}

function BoothLogo({ booth }: { booth: AdminBooth }) {
  const [failed, setFailed] = useState(false);
  if (!booth.logo || failed) {
    const initials = booth.companyName
      .split(' ')
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => part[0])
      .join('')
      .toLocaleUpperCase('tr');
    return (
      <View style={styles.logoFallback}>
        <Text style={styles.logoFallbackText}>{initials}</Text>
      </View>
    );
  }
  return <Image source={{ uri: booth.logo }} style={styles.logo} onError={() => setFailed(true)} />;
}

export function AdminVenuesAndStands({
  booths,
  stages,
  zones,
  sessions,
  initialTab = 'booths',
  onOpenCreateBooth,
  onOpenEditBooth,
  onDeleteBooth,
  onToggleBoothStatus,
  onOpenCreateStage,
  onOpenEditStage,
  onDeleteStage,
  onNavigateToMap,
  onNavigateToStageMap,
}: AdminVenuesAndStandsProps) {
  const { width } = useWindowDimensions();
  const compact = width < 720;
  const twoColumn = width >= 940;
  const [activeTab, setActiveTab] = useState<VenueTab>(initialTab);
  const [filtersOpen, setFiltersOpen] = useState(!compact);
  const [boothSearch, setBoothSearch] = useState('');
  const [boothZone, setBoothZone] = useState(ALL);
  const [boothCategory, setBoothCategory] = useState(ALL);
  const [boothTier, setBoothTier] = useState(ALL);
  const [stageSearch, setStageSearch] = useState('');
  const [stageZone, setStageZone] = useState(ALL);

  useEffect(() => setActiveTab(initialTab), [initialTab]);
  useEffect(() => setFiltersOpen(!compact), [compact]);

  const categoryOptions = useMemo<FilterOption[]>(
    () => [
      { value: ALL, label: 'Tüm Kategoriler' },
      ...Array.from(new Set(booths.map((booth) => booth.category))).map((value) => ({
        value,
        label: value,
      })),
    ],
    [booths],
  );
  const tierOptions = useMemo<FilterOption[]>(
    () => [
      { value: ALL, label: 'Tüm Sponsor Seviyeleri' },
      ...Array.from(new Set(booths.map((booth) => booth.sponsorTier))).map((value) => ({
        value,
        label: value,
      })),
    ],
    [booths],
  );

  const filteredBooths = useMemo(() => {
    const query = boothSearch.trim().toLocaleLowerCase('tr');
    return booths.filter(
      (booth) =>
        (boothZone === ALL || booth.zone === boothZone) &&
        (boothCategory === ALL || booth.category === boothCategory) &&
        (boothTier === ALL || booth.sponsorTier === boothTier) &&
        (!query ||
          [booth.companyName, booth.boothNo, booth.contactPerson, booth.contactEmail]
            .join(' ')
            .toLocaleLowerCase('tr')
            .includes(query)),
    );
  }, [boothCategory, boothSearch, boothTier, boothZone, booths]);

  const filteredStages = useMemo(() => {
    const query = stageSearch.trim().toLocaleLowerCase('tr');
    return stages.filter(
      (stage) =>
        (stageZone === ALL || stage.zone === stageZone) &&
        (!query ||
          [stage.name, stage.type, stage.description]
            .join(' ')
            .toLocaleLowerCase('tr')
            .includes(query)),
    );
  }, [stageSearch, stageZone, stages]);

  const boothFiltersActive = boothZone !== ALL || boothCategory !== ALL || boothTier !== ALL;
  const stageFiltersActive = stageZone !== ALL;

  function clearBoothFilters() {
    setBoothSearch('');
    setBoothZone(ALL);
    setBoothCategory(ALL);
    setBoothTier(ALL);
  }

  function clearStageFilters() {
    setStageSearch('');
    setStageZone(ALL);
  }

  return (
    <View style={styles.root}>
      <View style={[styles.header, compact && styles.headerCompact]}>
        <View style={styles.headerCopy}>
          <Text style={styles.title}>Alan & Stantlar Yönetimi</Text>
          <Text style={styles.subtitle}>
            Zirve stantları, sahneler, sunum alanları ve etkinlik bölgelerini tek merkezden yönetin.
          </Text>
        </View>
        <View style={[styles.headerActions, compact && styles.headerActionsCompact]}>
          <Pressable
            style={[styles.secondaryButton, compact && styles.headerButtonCompact]}
            onPress={() => onNavigateToMap()}
          >
            <MapPin size={16} color={colors.primary} />
            <Text style={styles.secondaryButtonText}>Haritada İncele</Text>
          </Pressable>
          {activeTab === 'booths' ? (
            <Pressable
              style={[styles.primaryButton, compact && styles.headerButtonCompact]}
              onPress={onOpenCreateBooth}
            >
              <Plus size={16} color={colors.white} />
              <Text style={styles.primaryButtonText}>Yeni Stant Ekle</Text>
            </Pressable>
          ) : activeTab === 'stages' ? (
            <Pressable
              style={[styles.primaryButton, compact && styles.headerButtonCompact]}
              onPress={onOpenCreateStage}
            >
              <Plus size={16} color={colors.white} />
              <Text style={styles.primaryButtonText}>Yeni Alan / Sahne</Text>
            </Pressable>
          ) : null}
        </View>
      </View>

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.tabs}
      >
        {(
          [
            ['booths', `Stantlar (${booths.length})`, Store],
            ['stages', `Sahneler & Alanlar (${stages.length})`, Layers3],
            ['zones', `Bölgeler (${zones.length})`, Building2],
          ] as const
        ).map(([tab, label, Icon]) => {
          const active = activeTab === tab;
          return (
            <Pressable
              key={tab}
              accessibilityRole="tab"
              accessibilityState={{ selected: active }}
              style={[styles.tab, active && styles.tabActive]}
              onPress={() => setActiveTab(tab)}
            >
              <Icon size={16} color={active ? colors.primary : colors.textMuted} />
              <Text style={[styles.tabText, active && styles.tabTextActive]}>{label}</Text>
            </Pressable>
          );
        })}
      </ScrollView>

      {activeTab === 'booths' ? (
        <View style={styles.section}>
          <View style={styles.filterPanel}>
            <View style={[styles.searchLine, compact && styles.searchLineCompact]}>
              <SearchField
                value={boothSearch}
                onChange={setBoothSearch}
                placeholder="Şirket, stant no veya yetkili ara…"
              />
              <Pressable
                style={[styles.filterToggle, filtersOpen && styles.filterToggleActive]}
                onPress={() => setFiltersOpen((open) => !open)}
              >
                {filtersOpen ? (
                  <ChevronUp size={16} color={colors.primary} />
                ) : (
                  <ChevronDown size={16} color={colors.primary} />
                )}
                <Text style={styles.filterToggleText}>
                  Filtreler{boothFiltersActive ? ' · Aktif' : ''}
                </Text>
              </Pressable>
            </View>
            {filtersOpen ? (
              <View style={styles.filterGroups}>
                <FilterGroup
                  label="Bölge"
                  options={ZONES}
                  value={boothZone}
                  onChange={setBoothZone}
                />
                <FilterGroup
                  label="Kategori"
                  options={categoryOptions}
                  value={boothCategory}
                  onChange={setBoothCategory}
                />
                <FilterGroup
                  label="Sponsorluk"
                  options={tierOptions}
                  value={boothTier}
                  onChange={setBoothTier}
                />
              </View>
            ) : null}
            <View style={styles.resultLine}>
              <Text style={styles.resultText}>{filteredBooths.length} stant gösteriliyor</Text>
              {boothSearch || boothFiltersActive ? (
                <Pressable onPress={clearBoothFilters}>
                  <Text style={styles.clearText}>Filtreleri Temizle</Text>
                </Pressable>
              ) : null}
            </View>
          </View>

          {filteredBooths.length ? (
            <View style={styles.grid}>
              {filteredBooths.map((booth) => (
                <View key={booth.id} style={[styles.boothCard, twoColumn && styles.halfCard]}>
                  <View style={styles.cardTop}>
                    <View style={styles.boothIdentity}>
                      <BoothLogo booth={booth} />
                      <View style={styles.flex}>
                        <Text style={styles.boothNo}>{booth.boothNo || 'Yerleştirilmedi'}</Text>
                        <Text style={styles.cardTitle} numberOfLines={2}>
                          {booth.companyName}
                        </Text>
                      </View>
                    </View>
                    <Pressable
                      accessibilityLabel="Stant durumunu değiştir"
                      onPress={() => onToggleBoothStatus(booth)}
                    >
                      <StatusPill status={booth.status} />
                    </Pressable>
                  </View>

                  <Text style={styles.description} numberOfLines={2}>
                    {booth.description}
                  </Text>
                  <View style={styles.metaWrap}>
                    <View style={styles.softBadge}>
                      <Text style={styles.softBadgeText}>{booth.category}</Text>
                    </View>
                    <View style={styles.metaItem}>
                      <MapPin size={13} color={colors.primary} />
                      <Text style={styles.metaText}>
                        {isBoothPlaced(booth) ? booth.zone : 'Krokide yok'}
                      </Text>
                    </View>
                    <View style={[styles.tierBadge, tierStyle(booth.sponsorTier)]}>
                      <Text style={styles.tierText}>{booth.sponsorTier}</Text>
                    </View>
                  </View>

                  <View style={styles.contactBlock}>
                    <View style={styles.contactLine}>
                      <Text style={styles.contactLabel}>Yetkili</Text>
                      <Text style={styles.contactValue} numberOfLines={1}>
                        {booth.contactPerson || 'Belirtilmedi'}
                      </Text>
                    </View>
                    <View style={styles.contactLine}>
                      <Text style={styles.contactLabel}>E-posta</Text>
                      <Text style={styles.contactValue} numberOfLines={1}>
                        {booth.contactEmail || 'Belirtilmedi'}
                      </Text>
                    </View>
                    <View style={styles.contactLine}>
                      <Text style={styles.contactLabel}>Ziyaret</Text>
                      <Text style={styles.contactValue}>
                        {booth.totalVisits.toLocaleString('tr-TR')}
                      </Text>
                    </View>
                  </View>

                  <View style={styles.cardFooter}>
                    <View>
                      <Text style={styles.coordinateLabel}>KROKİ KONUMU</Text>
                      <Text style={styles.coordinate}>
                        {isBoothPlaced(booth)
                          ? `${booth.zone} · X %${booth.mapX} · Y %${booth.mapY}`
                          : 'Henüz yerleştirilmedi'}
                      </Text>
                    </View>
                    <View style={styles.cardActions}>
                      <ActionButton
                        icon={Crosshair}
                        label="Krokide konumlandır"
                        onPress={() => onNavigateToMap(booth)}
                      />
                      <ActionButton
                        icon={Edit3}
                        label="Standı düzenle"
                        onPress={() => onOpenEditBooth(booth)}
                      />
                      <ActionButton
                        icon={Trash2}
                        label="Standı sil"
                        danger
                        onPress={() => onDeleteBooth(booth)}
                      />
                    </View>
                  </View>
                </View>
              ))}
            </View>
          ) : (
            <EmptyState
              title="Stant bulunamadı"
              body="Arama veya filtre seçimini değiştirerek tekrar deneyin."
            />
          )}
        </View>
      ) : null}

      {activeTab === 'stages' ? (
        <View style={styles.section}>
          <View style={styles.filterPanel}>
            <View style={[styles.searchLine, compact && styles.searchLineCompact]}>
              <SearchField
                value={stageSearch}
                onChange={setStageSearch}
                placeholder="Sahne adı, türü veya açıklaması ara…"
              />
              <Pressable
                style={[styles.filterToggle, filtersOpen && styles.filterToggleActive]}
                onPress={() => setFiltersOpen((open) => !open)}
              >
                {filtersOpen ? (
                  <ChevronUp size={16} color={colors.primary} />
                ) : (
                  <ChevronDown size={16} color={colors.primary} />
                )}
                <Text style={styles.filterToggleText}>
                  Bölge{stageFiltersActive ? ' · Aktif' : ''}
                </Text>
              </Pressable>
            </View>
            {filtersOpen ? (
              <FilterGroup
                label="Bölge"
                options={ZONES}
                value={stageZone}
                onChange={setStageZone}
              />
            ) : null}
            <View style={styles.resultLine}>
              <Text style={styles.resultText}>{filteredStages.length} alan gösteriliyor</Text>
              {stageSearch || stageFiltersActive ? (
                <Pressable onPress={clearStageFilters}>
                  <Text style={styles.clearText}>Filtreleri Temizle</Text>
                </Pressable>
              ) : null}
            </View>
          </View>

          {filteredStages.length ? (
            <View style={styles.grid}>
              {filteredStages.map((stage) => {
                const occupancy = Math.round(
                  (stage.currentOccupancy / Math.max(1, stage.capacity)) * 100,
                );
                const liveSession = sessions.find(
                  (session) => session.stageId === stage.id && session.status === 'live',
                );
                return (
                  <View key={stage.id} style={[styles.stageCard, twoColumn && styles.halfCard]}>
                    <View style={styles.cardTop}>
                      <View style={styles.flex}>
                        <View style={styles.stageLabelLine}>
                          <View style={styles.softBadge}>
                            <Text style={styles.softBadgeText}>{stage.type}</Text>
                          </View>
                          <View style={styles.zoneBadge}>
                            <Text style={styles.zoneBadgeText}>{stage.zone}</Text>
                          </View>
                        </View>
                        <Text style={styles.cardTitle}>{stage.name}</Text>
                      </View>
                      <StatusPill status={stage.status} />
                    </View>
                    <Text style={styles.description} numberOfLines={2}>
                      {stage.description}
                    </Text>

                    <View style={styles.capacityBlock}>
                      <View style={styles.capacityLine}>
                        <View style={styles.metaItem}>
                          <Users size={14} color={colors.textMuted} />
                          <Text style={styles.capacityLabel}>Kapasite & Doluluk</Text>
                        </View>
                        <Text style={styles.capacityValue}>
                          {stage.currentOccupancy}/{stage.capacity} · %{occupancy}
                        </Text>
                      </View>
                      <ProgressBar percent={occupancy} />
                    </View>

                    {liveSession ? (
                      <View style={styles.liveBlock}>
                        <View style={styles.liveTitleLine}>
                          <Radio size={13} color={colors.success} />
                          <Text style={styles.liveLabel}>ŞU AN CANLI</Text>
                        </View>
                        <Text style={styles.liveTitle} numberOfLines={1}>
                          {liveSession.title}
                        </Text>
                        <Text style={styles.liveTime}>
                          {liveSession.time} – {liveSession.endTime}
                        </Text>
                      </View>
                    ) : (
                      <View style={styles.noLiveBlock}>
                        <Text style={styles.noLiveText}>Şu an canlı oturum yok</Text>
                      </View>
                    )}

                    <View style={styles.cardFooter}>
                      <View>
                        <Text style={styles.coordinateLabel}>KROKİ KONUMU</Text>
                        <Text style={styles.coordinate}>
                          {stage.zone} · X %{stage.mapX} · Y %{stage.mapY}
                        </Text>
                      </View>
                      <View style={styles.cardActions}>
                        <ActionButton
                          icon={Crosshair}
                          label="Krokide konumlandır"
                          onPress={() => onNavigateToStageMap(stage)}
                        />
                        <ActionButton
                          icon={Edit3}
                          label="Alanı düzenle"
                          onPress={() => onOpenEditStage(stage)}
                        />
                        <ActionButton
                          icon={Trash2}
                          label="Alanı sil"
                          danger
                          onPress={() => onDeleteStage(stage)}
                        />
                      </View>
                    </View>
                  </View>
                );
              })}
            </View>
          ) : (
            <EmptyState
              title="Alan bulunamadı"
              body="Arama veya bölge filtresini değiştirerek tekrar deneyin."
            />
          )}
        </View>
      ) : null}

      {activeTab === 'zones' ? (
        <View style={styles.section}>
          <View style={styles.zoneIntro}>
            <View style={styles.zoneIntroIcon}>
              <Activity size={18} color={colors.primary} />
            </View>
            <View style={styles.flex}>
              <Text style={styles.zoneIntroTitle}>Canlı bölge yoğunluğu</Text>
              <Text style={styles.zoneIntroText}>
                Katılımcı dağılımını ve bölgedeki operasyon noktalarını anlık izleyin.
              </Text>
            </View>
          </View>
          <View style={styles.grid}>
            {zones.map((zone) => {
              const zoneStages = stages.filter((stage) => stage.zone === zone.code).length;
              const zoneBooths = booths.filter(
                (booth) => booth.zone === zone.code && isBoothPlaced(booth),
              ).length;
              const density = densityStyle(zone.densityLevel);
              return (
                <View key={zone.id} style={[styles.zoneCard, twoColumn && styles.halfCard]}>
                  <View style={styles.cardTop}>
                    <View style={styles.flex}>
                      <Text style={styles.zoneCode}>{zone.code}</Text>
                      <Text style={styles.cardTitle}>{zone.name}</Text>
                    </View>
                    <View
                      style={[
                        styles.densityPill,
                        { backgroundColor: density.bg, borderColor: density.border },
                      ]}
                    >
                      <Activity size={12} color={density.color} />
                      <Text style={[styles.densityText, { color: density.color }]}>
                        {zone.densityLevel} YOĞUNLUK
                      </Text>
                    </View>
                  </View>
                  <Text style={styles.description}>{zone.description}</Text>
                  <View style={styles.capacityBlock}>
                    <View style={styles.capacityLine}>
                      <Text style={styles.capacityLabel}>Anlık Katılımcı</Text>
                      <Text style={styles.capacityValue}>
                        {zone.activeAttendees}/{zone.capacity} · %{zone.densityPercent}
                      </Text>
                    </View>
                    <ProgressBar percent={zone.densityPercent} color={density.color} />
                  </View>
                  <View style={styles.zoneMetrics}>
                    <View style={styles.zoneMetric}>
                      <Text style={styles.zoneMetricValue}>{zone.avgAttendees}</Text>
                      <Text style={styles.zoneMetricLabel}>Ortalama</Text>
                    </View>
                    <View style={styles.zoneMetric}>
                      <Text style={styles.zoneMetricValue}>{zone.peakAttendees}</Text>
                      <Text style={styles.zoneMetricLabel}>Zirve</Text>
                    </View>
                    <View style={styles.zoneMetric}>
                      <Text style={styles.zoneMetricValue}>{zoneStages}</Text>
                      <Text style={styles.zoneMetricLabel}>Sahne</Text>
                    </View>
                    <View style={styles.zoneMetric}>
                      <Text style={styles.zoneMetricValue}>{zoneBooths}</Text>
                      <Text style={styles.zoneMetricLabel}>Stant</Text>
                    </View>
                  </View>
                  <Pressable style={styles.mapLink} onPress={() => onNavigateToMap()}>
                    <MapPin size={14} color={colors.primary} />
                    <Text style={styles.mapLinkText}>Haritada Göster</Text>
                  </Pressable>
                </View>
              );
            })}
          </View>
        </View>
      ) : null}
    </View>
  );
}

function tierStyle(tier: AdminBooth['sponsorTier']) {
  if (tier === 'Platinum') return { backgroundColor: '#f0e7ff' };
  if (tier === 'Gold') return { backgroundColor: '#fff3d6' };
  if (tier === 'Silver') return { backgroundColor: '#edf1f5' };
  if (tier === 'Partner') return { backgroundColor: '#e7ecff' };
  return { backgroundColor: colors.successBg };
}

function densityStyle(level: ZoneDensityInfo['densityLevel']) {
  if (level === 'Yoğun')
    return { color: colors.danger, bg: colors.dangerBg, border: colors.dangerBorder };
  if (level === 'Orta') return { color: '#965900', bg: '#fff3d6', border: '#f3d18a' };
  return { color: colors.success, bg: colors.successBg, border: colors.successBorder };
}

const styles = StyleSheet.create({
  root: { gap: 18 },
  flex: { flex: 1 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 18 },
  headerCompact: { alignItems: 'stretch', flexDirection: 'column' },
  headerCopy: { flex: 1, gap: 5 },
  title: { color: colors.text, fontSize: 23, lineHeight: 29, fontWeight: '900' },
  subtitle: { color: colors.textMuted, fontSize: 12, lineHeight: 18, fontWeight: '500' },
  headerActions: { flexDirection: 'row', alignItems: 'center', gap: 9 },
  headerActionsCompact: { alignItems: 'stretch' },
  headerButtonCompact: { flex: 1, paddingHorizontal: 8 },
  primaryButton: {
    minHeight: 43,
    borderRadius: 12,
    paddingHorizontal: 15,
    backgroundColor: colors.primary,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 7,
  },
  primaryButtonText: { color: colors.white, fontSize: 12, fontWeight: '900' },
  secondaryButton: {
    minHeight: 43,
    borderRadius: 12,
    paddingHorizontal: 14,
    borderWidth: 1,
    borderColor: colors.borderStrong,
    backgroundColor: colors.surface,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 7,
  },
  secondaryButtonText: { color: colors.text, fontSize: 12, fontWeight: '800' },
  tabs: { minWidth: '100%', borderBottomWidth: 1, borderBottomColor: colors.border, gap: 5 },
  tab: {
    minHeight: 45,
    paddingHorizontal: 14,
    borderBottomWidth: 3,
    borderBottomColor: 'transparent',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 7,
  },
  tabActive: { borderBottomColor: colors.primary },
  tabText: { color: colors.textMuted, fontSize: 11, fontWeight: '800' },
  tabTextActive: { color: colors.primary },
  section: { gap: 14 },
  filterPanel: {
    overflow: 'hidden',
    borderRadius: 18,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    paddingVertical: 13,
    gap: 13,
  },
  searchLine: { paddingHorizontal: 13, flexDirection: 'row', alignItems: 'center', gap: 9 },
  searchLineCompact: { alignItems: 'stretch' },
  searchField: {
    minHeight: 43,
    flex: 1,
    borderWidth: 1,
    borderColor: colors.borderStrong,
    borderRadius: 12,
    paddingHorizontal: 12,
    backgroundColor: colors.surface,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  searchInput: { flex: 1, color: colors.text, fontSize: 12, fontWeight: '600', paddingVertical: 0 },
  filterToggle: {
    minHeight: 43,
    borderRadius: 12,
    paddingHorizontal: 13,
    backgroundColor: colors.primarySoft,
    borderWidth: 1,
    borderColor: 'transparent',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 5,
  },
  filterToggleActive: { borderColor: '#f1c59f' },
  filterToggleText: { color: colors.primary, fontSize: 11, fontWeight: '900' },
  filterGroups: { gap: 12 },
  filterGroup: { gap: 7 },
  filterLabel: {
    paddingHorizontal: 14,
    color: colors.textMuted,
    fontSize: 9,
    fontWeight: '900',
    letterSpacing: 0.6,
    textTransform: 'uppercase',
  },
  chipTrack: { paddingHorizontal: 13, gap: 7 },
  chip: {
    minHeight: 32,
    borderRadius: 999,
    paddingHorizontal: 11,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surfaceMuted,
    alignItems: 'center',
    justifyContent: 'center',
  },
  chipActive: { backgroundColor: colors.text, borderColor: colors.text },
  chipText: { color: colors.textMuted, fontSize: 10, fontWeight: '700' },
  chipTextActive: { color: colors.white },
  resultLine: {
    minHeight: 35,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    paddingTop: 11,
    paddingHorizontal: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
  },
  resultText: { color: colors.textMuted, fontSize: 11, fontWeight: '800' },
  clearText: { color: colors.primary, fontSize: 10, fontWeight: '900' },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 13 },
  halfCard: { width: '49%' },
  boothCard: {
    width: '100%',
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 18,
    backgroundColor: colors.surface,
    padding: 15,
    gap: 12,
  },
  stageCard: {
    width: '100%',
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 18,
    backgroundColor: colors.surface,
    padding: 15,
    gap: 12,
  },
  zoneCard: {
    width: '100%',
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 18,
    backgroundColor: colors.surface,
    padding: 15,
    gap: 13,
  },
  cardTop: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 10,
  },
  boothIdentity: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 10 },
  logo: { width: 44, height: 44, borderRadius: 11, borderWidth: 1, borderColor: colors.border },
  logoFallback: {
    width: 44,
    height: 44,
    borderRadius: 11,
    backgroundColor: colors.secondaryContainer,
    alignItems: 'center',
    justifyContent: 'center',
  },
  logoFallbackText: { color: colors.secondaryDark, fontSize: 12, fontWeight: '900' },
  boothNo: {
    alignSelf: 'flex-start',
    borderRadius: 6,
    paddingHorizontal: 7,
    paddingVertical: 3,
    backgroundColor: colors.surfaceMuted,
    color: colors.text,
    fontSize: 9,
    fontWeight: '900',
    letterSpacing: 0.5,
  },
  cardTitle: { marginTop: 3, color: colors.text, fontSize: 15, lineHeight: 20, fontWeight: '900' },
  statusPill: {
    minHeight: 25,
    borderRadius: 999,
    borderWidth: 1,
    paddingHorizontal: 8,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  statusText: { fontSize: 8, fontWeight: '900', letterSpacing: 0.35 },
  description: { color: colors.textMuted, fontSize: 11, lineHeight: 17, fontWeight: '500' },
  metaWrap: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 7 },
  softBadge: {
    alignSelf: 'flex-start',
    borderRadius: 7,
    backgroundColor: colors.surfaceMuted,
    paddingHorizontal: 8,
    paddingVertical: 5,
  },
  softBadgeText: { color: colors.text, fontSize: 9, fontWeight: '800' },
  zoneBadge: {
    alignSelf: 'flex-start',
    borderRadius: 7,
    borderWidth: 1,
    borderColor: '#f1c59f',
    backgroundColor: colors.primarySoft,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  zoneBadgeText: { color: colors.primary, fontSize: 9, fontWeight: '900' },
  stageLabelLine: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 6 },
  metaItem: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  metaText: { color: colors.textMuted, fontSize: 10, fontWeight: '700' },
  tierBadge: { borderRadius: 999, paddingHorizontal: 8, paddingVertical: 5 },
  tierText: { color: colors.text, fontSize: 8, fontWeight: '900', textTransform: 'uppercase' },
  contactBlock: {
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surfaceMuted,
    padding: 10,
    gap: 6,
  },
  contactLine: { flexDirection: 'row', justifyContent: 'space-between', gap: 10 },
  contactLabel: { color: colors.textMuted, fontSize: 9, fontWeight: '700' },
  contactValue: {
    maxWidth: '70%',
    color: colors.text,
    fontSize: 9,
    fontWeight: '800',
    textAlign: 'right',
  },
  cardFooter: {
    borderTopWidth: 1,
    borderTopColor: colors.border,
    paddingTop: 11,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 9,
  },
  coordinateLabel: { color: colors.textMuted, fontSize: 8, fontWeight: '900', letterSpacing: 0.5 },
  coordinate: { color: colors.text, fontSize: 9, fontWeight: '800', marginTop: 2 },
  cardActions: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  actionButton: {
    width: 34,
    height: 34,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surfaceMuted,
    alignItems: 'center',
    justifyContent: 'center',
  },
  actionButtonDanger: { borderColor: colors.dangerBorder, backgroundColor: colors.dangerBg },
  capacityBlock: {
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surfaceMuted,
    padding: 11,
    gap: 8,
  },
  capacityLine: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  capacityLabel: { color: colors.textMuted, fontSize: 9, fontWeight: '700' },
  capacityValue: { color: colors.text, fontSize: 9, fontWeight: '900' },
  progressTrack: {
    height: 7,
    borderRadius: 99,
    backgroundColor: colors.surfaceHigh,
    overflow: 'hidden',
  },
  progressFill: { height: '100%', borderRadius: 99 },
  liveBlock: {
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.successBorder,
    backgroundColor: colors.successBg,
    padding: 10,
    gap: 3,
  },
  liveTitleLine: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  liveLabel: { color: colors.success, fontSize: 8, fontWeight: '900', letterSpacing: 0.5 },
  liveTitle: { color: colors.text, fontSize: 10, fontWeight: '900' },
  liveTime: { color: colors.textMuted, fontSize: 9, fontWeight: '700' },
  noLiveBlock: {
    minHeight: 43,
    borderRadius: 12,
    backgroundColor: colors.surfaceMuted,
    paddingHorizontal: 10,
    justifyContent: 'center',
  },
  noLiveText: { color: colors.textFaint, fontSize: 10, fontStyle: 'italic', fontWeight: '500' },
  emptyState: {
    minHeight: 180,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    padding: 24,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 7,
  },
  emptyTitle: { color: colors.text, fontSize: 14, fontWeight: '900' },
  emptyBody: { color: colors.textMuted, fontSize: 11, lineHeight: 17, textAlign: 'center' },
  zoneIntro: {
    borderRadius: 15,
    borderWidth: 1,
    borderColor: '#f1c59f',
    backgroundColor: colors.primarySoft,
    padding: 13,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  zoneIntroIcon: {
    width: 37,
    height: 37,
    borderRadius: 11,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  zoneIntroTitle: { color: colors.text, fontSize: 12, fontWeight: '900' },
  zoneIntroText: { color: colors.textMuted, fontSize: 10, lineHeight: 15, marginTop: 2 },
  zoneCode: {
    alignSelf: 'flex-start',
    borderRadius: 7,
    paddingHorizontal: 8,
    paddingVertical: 4,
    backgroundColor: colors.surfaceMuted,
    color: colors.primary,
    fontSize: 9,
    fontWeight: '900',
    letterSpacing: 0.55,
  },
  densityPill: {
    maxWidth: 132,
    minHeight: 29,
    borderRadius: 10,
    borderWidth: 1,
    paddingHorizontal: 8,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
  },
  densityText: { flexShrink: 1, fontSize: 7, fontWeight: '900', letterSpacing: 0.2 },
  zoneMetrics: {
    flexDirection: 'row',
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 12,
    overflow: 'hidden',
  },
  zoneMetric: {
    flex: 1,
    minHeight: 58,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 2,
    borderRightWidth: 1,
    borderRightColor: colors.border,
  },
  zoneMetricValue: { color: colors.text, fontSize: 13, fontWeight: '900' },
  zoneMetricLabel: { color: colors.textMuted, fontSize: 8, fontWeight: '700' },
  mapLink: {
    minHeight: 38,
    borderRadius: 11,
    backgroundColor: colors.primarySoft,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  mapLinkText: { color: colors.primary, fontSize: 10, fontWeight: '900' },
});
