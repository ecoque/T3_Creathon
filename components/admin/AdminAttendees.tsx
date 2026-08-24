import {
  Building2,
  CircleAlert,
  Edit3,
  Layers3,
  Mail,
  MapPin,
  Phone,
  Plus,
  Power,
  Search,
  Trash2,
  UserRoundCheck,
  UserRoundX,
  Users,
  X,
} from 'lucide-react-native';
import { useMemo, useState, type ComponentType } from 'react';
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
import type { AdminAttendee, AttendeeRole, AttendeeStatus } from '../../types/admin';

type IconType = ComponentType<{ size?: number; color?: string }>;
type RoleFilter = 'all' | AttendeeRole;
type StatusFilter = 'all' | AttendeeStatus;

type AdminAttendeesProps = {
  attendees: AdminAttendee[];
  onOpenCreateAttendee: () => void;
  onOpenEditAttendee: (attendee: AdminAttendee) => void;
  onToggleAttendeeStatus: (attendee: AdminAttendee) => void;
  onDeleteAttendee: (attendee: AdminAttendee) => void;
};

const ROLES: AttendeeRole[] = ['Girişimci', 'Yatırımcı', 'Kurum / Partner', 'Ziyaretçi', 'Görevli'];

const ROLE_PALETTE: Record<
  AttendeeRole,
  { color: string; backgroundColor: string; borderColor: string }
> = {
  Girişimci: { color: colors.primary, backgroundColor: colors.primarySoft, borderColor: '#ffd1ad' },
  Yatırımcı: {
    color: colors.success,
    backgroundColor: colors.successBg,
    borderColor: colors.successBorder,
  },
  'Kurum / Partner': { color: '#24549a', backgroundColor: '#e7f0ff', borderColor: '#c7daf5' },
  Ziyaretçi: { color: '#6d3bb8', backgroundColor: '#f2eaff', borderColor: '#decdf7' },
  Görevli: { color: '#0f766e', backgroundColor: '#e6f6f4', borderColor: '#bdeae4' },
};

function initials(name: string) {
  return name
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join('');
}

function MetricCard({
  icon: Icon,
  value,
  label,
  note,
  color,
  compact,
}: {
  icon: IconType;
  value: number;
  label: string;
  note: string;
  color: string;
  compact: boolean;
}) {
  return (
    <View style={[styles.metricCard, compact && styles.metricCardCompact]}>
      <View style={[styles.metricIcon, { backgroundColor: color + '16' }]}>
        <Icon size={19} color={color} />
      </View>
      <View style={styles.flex}>
        <Text style={styles.metricValue}>{value.toLocaleString('tr-TR')}</Text>
        <Text style={styles.metricLabel}>{label}</Text>
        <Text numberOfLines={1} style={styles.metricNote}>
          {note}
        </Text>
      </View>
    </View>
  );
}

function RolePill({ role }: { role: AttendeeRole }) {
  const palette = ROLE_PALETTE[role];
  return (
    <View
      style={[
        styles.rolePill,
        { backgroundColor: palette.backgroundColor, borderColor: palette.borderColor },
      ]}
    >
      <Text style={[styles.rolePillText, { color: palette.color }]}>{role}</Text>
    </View>
  );
}

function StatusPill({ status }: { status: AttendeeStatus }) {
  const active = status === 'active';
  return (
    <View style={[styles.statusPill, active ? styles.statusPillActive : styles.statusPillPassive]}>
      <View style={[styles.statusDot, active ? styles.statusDotActive : styles.statusDotPassive]} />
      <Text style={[styles.statusPillText, active && styles.statusPillTextActive]}>
        {active ? 'AKTİF' : 'PASİF'}
      </Text>
    </View>
  );
}

function Avatar({ attendee, large = false }: { attendee: AdminAttendee; large?: boolean }) {
  const avatarStyle = large ? styles.avatarLarge : styles.avatar;
  return attendee.avatar ? (
    <Image source={{ uri: attendee.avatar }} style={avatarStyle} />
  ) : (
    <View style={[avatarStyle, styles.avatarFallback]}>
      <Text style={[styles.avatarText, large && styles.avatarTextLarge]}>
        {initials(attendee.name)}
      </Text>
    </View>
  );
}

function ActionButton({
  icon: Icon,
  label,
  onPress,
  danger = false,
  primary = false,
  compact = false,
}: {
  icon: IconType;
  label: string;
  onPress: () => void;
  danger?: boolean;
  primary?: boolean;
  compact?: boolean;
}) {
  const foreground = danger ? colors.danger : primary ? colors.primary : colors.textMuted;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      style={[
        styles.actionButton,
        compact && styles.actionButtonCompact,
        danger && styles.actionButtonDanger,
        primary && styles.actionButtonPrimary,
      ]}
      onPress={onPress}
    >
      <Icon size={14} color={foreground} />
      {!compact ? (
        <Text
          style={[
            styles.actionButtonText,
            danger && styles.actionButtonTextDanger,
            primary && styles.actionButtonTextPrimary,
          ]}
        >
          {label}
        </Text>
      ) : null}
    </Pressable>
  );
}

function DesktopAttendeeRow({
  attendee,
  onEdit,
  onToggle,
  onDelete,
}: {
  attendee: AdminAttendee;
  onEdit: () => void;
  onToggle: () => void;
  onDelete: () => void;
}) {
  return (
    <View style={styles.tableRow}>
      <View style={[styles.tableCell, styles.personColumn]}>
        <Avatar attendee={attendee} />
        <View style={styles.personCopy}>
          <Text numberOfLines={1} style={styles.personName}>
            {attendee.name}
          </Text>
          <View style={styles.inlineDetail}>
            <Mail size={11} color={colors.textMuted} />
            <Text numberOfLines={1} style={styles.inlineDetailText}>
              {attendee.email}
            </Text>
          </View>
          {attendee.phone ? (
            <View style={styles.inlineDetail}>
              <Phone size={11} color={colors.textMuted} />
              <Text numberOfLines={1} style={styles.inlineDetailText}>
                {attendee.phone}
              </Text>
            </View>
          ) : null}
        </View>
      </View>

      <View style={[styles.tableCell, styles.roleColumn]}>
        <RolePill role={attendee.role} />
      </View>

      <View style={[styles.tableCell, styles.companyColumn]}>
        <Text numberOfLines={1} style={styles.cellTitle}>
          {attendee.company || 'Bağımsız'}
        </Text>
        <Text numberOfLines={1} style={styles.cellSubtitle}>
          {attendee.position || attendee.title || 'Katılımcı'}
        </Text>
      </View>

      <View style={[styles.tableCell, styles.sectorColumn]}>
        <Text numberOfLines={2} style={styles.cellTitleSmall}>
          {attendee.sector || 'Genel Teknoloji'}
        </Text>
        <View style={styles.inlineDetail}>
          <MapPin size={11} color={colors.textMuted} />
          <Text numberOfLines={1} style={styles.inlineDetailText}>
            {attendee.currentZone || 'Konum yok'}
          </Text>
        </View>
      </View>

      <View style={[styles.tableCell, styles.accessColumn]}>
        <StatusPill status={attendee.status} />
      </View>

      <View style={[styles.tableCell, styles.actionsColumn]}>
        <ActionButton
          compact
          icon={Edit3}
          label={`${attendee.name} profilini düzenle`}
          onPress={onEdit}
        />
        <ActionButton
          compact
          primary
          icon={Power}
          label={`${attendee.name} durumunu değiştir`}
          onPress={onToggle}
        />
        <ActionButton
          compact
          danger
          icon={Trash2}
          label={`${attendee.name} kaydını sil`}
          onPress={onDelete}
        />
      </View>
    </View>
  );
}

function MobileAttendeeCard({
  attendee,
  onEdit,
  onToggle,
  onDelete,
}: {
  attendee: AdminAttendee;
  onEdit: () => void;
  onToggle: () => void;
  onDelete: () => void;
}) {
  return (
    <View style={styles.attendeeCard}>
      <View style={styles.cardHeader}>
        <Avatar attendee={attendee} large />
        <View style={styles.cardIdentity}>
          <Text style={styles.cardName}>{attendee.name}</Text>
          <Text style={styles.cardPosition}>
            {attendee.position || attendee.title || 'Katılımcı'}
          </Text>
          <View style={styles.cardPills}>
            <RolePill role={attendee.role} />
            <StatusPill status={attendee.status} />
          </View>
        </View>
      </View>

      <View style={styles.cardDetails}>
        <View style={styles.detailRow}>
          <Building2 size={14} color={colors.textMuted} />
          <Text numberOfLines={1} style={styles.detailText}>
            {attendee.company || 'Bağımsız'}
          </Text>
        </View>
        <View style={styles.detailRow}>
          <Layers3 size={14} color={colors.textMuted} />
          <Text numberOfLines={1} style={styles.detailText}>
            {attendee.sector || 'Genel Teknoloji'}
          </Text>
        </View>
        <View style={styles.detailRow}>
          <Mail size={14} color={colors.textMuted} />
          <Text numberOfLines={1} style={styles.detailText}>
            {attendee.email}
          </Text>
        </View>
        {attendee.phone ? (
          <View style={styles.detailRow}>
            <Phone size={14} color={colors.textMuted} />
            <Text numberOfLines={1} style={styles.detailText}>
              {attendee.phone}
            </Text>
          </View>
        ) : null}
      </View>

      <View style={styles.cardActions}>
        <ActionButton icon={Edit3} label="Düzenle" onPress={onEdit} />
        <ActionButton
          primary
          icon={Power}
          label={attendee.status === 'active' ? 'Pasif Yap' : 'Aktif Yap'}
          onPress={onToggle}
        />
        <ActionButton danger icon={Trash2} label="Sil" onPress={onDelete} />
      </View>
    </View>
  );
}

function FilterChip({
  label,
  active,
  onPress,
}: {
  label: string;
  active: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected: active }}
      style={[styles.filterChip, active && styles.filterChipActive]}
      onPress={onPress}
    >
      <Text style={[styles.filterChipText, active && styles.filterChipTextActive]}>{label}</Text>
    </Pressable>
  );
}

export function AdminAttendees({
  attendees,
  onOpenCreateAttendee,
  onOpenEditAttendee,
  onToggleAttendeeStatus,
  onDeleteAttendee,
}: AdminAttendeesProps) {
  const { width } = useWindowDimensions();
  const compact = width < 700;
  const desktopTable = width >= 1120;
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedRole, setSelectedRole] = useState<RoleFilter>('all');
  const [selectedStatus, setSelectedStatus] = useState<StatusFilter>('all');

  const counts = useMemo(
    () => ({
      total: attendees.length,
      active: attendees.filter((attendee) => attendee.status === 'active').length,
      passive: attendees.filter((attendee) => attendee.status === 'passive').length,
    }),
    [attendees],
  );

  const roleCounts = useMemo(
    () =>
      ROLES.reduce<Record<AttendeeRole, number>>(
        (result, role) => ({
          ...result,
          [role]: attendees.filter((attendee) => attendee.role === role).length,
        }),
        { Girişimci: 0, Yatırımcı: 0, 'Kurum / Partner': 0, Ziyaretçi: 0, Görevli: 0 },
      ),
    [attendees],
  );

  const filteredAttendees = useMemo(() => {
    const query = searchTerm.trim().toLocaleLowerCase('tr-TR');
    return attendees.filter((attendee) => {
      const matchesQuery =
        !query ||
        [
          attendee.name,
          attendee.email,
          attendee.phone,
          attendee.company,
          attendee.position,
          attendee.title,
          attendee.sector,
          attendee.currentZone,
          attendee.interests.join(' '),
        ]
          .filter(Boolean)
          .join(' ')
          .toLocaleLowerCase('tr-TR')
          .includes(query);
      const matchesRole = selectedRole === 'all' || attendee.role === selectedRole;
      const matchesStatus = selectedStatus === 'all' || attendee.status === selectedStatus;
      return matchesQuery && matchesRole && matchesStatus;
    });
  }, [attendees, searchTerm, selectedRole, selectedStatus]);

  const hasFilters = searchTerm.length > 0 || selectedRole !== 'all' || selectedStatus !== 'all';
  const clearFilters = () => {
    setSearchTerm('');
    setSelectedRole('all');
    setSelectedStatus('all');
  };

  return (
    <View style={styles.root}>
      <View style={[styles.header, compact && styles.headerCompact]}>
        <View style={styles.headerCopy}>
          <View style={styles.titleLine}>
            <Text style={styles.title}>Katılımcı Yönetimi</Text>
            <View style={styles.resultBadge}>
              <Text style={styles.resultBadgeText}>
                {filteredAttendees.length} / {counts.total}
              </Text>
            </View>
          </View>
          <Text style={styles.subtitle}>
            Etkinlik kayıtlarını, katılımcı profillerini ve uygulama erişim durumlarını yönetin.
          </Text>
        </View>
        <Pressable
          accessibilityRole="button"
          style={[styles.createButton, compact && styles.createButtonCompact]}
          onPress={onOpenCreateAttendee}
        >
          <Plus size={17} color={colors.white} />
          <Text style={styles.createButtonText}>Yeni Katılımcı</Text>
        </Pressable>
      </View>

      <View style={styles.metricGrid}>
        <MetricCard
          icon={Users}
          value={counts.total}
          label="Toplam Kayıt"
          note="Etkinlik veritabanı"
          color={colors.primary}
          compact={compact}
        />
        <MetricCard
          icon={UserRoundCheck}
          value={counts.active}
          label="Aktif Profil"
          note="Uygulamaya erişebilir"
          color={colors.success}
          compact={compact}
        />
        <MetricCard
          icon={UserRoundX}
          value={counts.passive}
          label="Pasif Profil"
          note="Erişimi kapalı"
          color={colors.textMuted}
          compact={compact}
        />
      </View>

      <View style={styles.filtersPanel}>
        <View style={[styles.searchRow, compact && styles.searchRowCompact]}>
          <View style={styles.searchField}>
            <Search size={16} color={colors.textMuted} />
            <TextInput
              accessibilityLabel="Katılımcılarda ara"
              style={styles.searchInput}
              value={searchTerm}
              onChangeText={setSearchTerm}
              placeholder="İsim, e-posta, şirket, sektör veya ilgi alanı ara…"
              placeholderTextColor={colors.textFaint}
            />
            {searchTerm ? (
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Arama metnini temizle"
                hitSlop={8}
                onPress={() => setSearchTerm('')}
              >
                <X size={16} color={colors.textMuted} />
              </Pressable>
            ) : null}
          </View>
          {hasFilters ? (
            <Pressable accessibilityRole="button" style={styles.clearButton} onPress={clearFilters}>
              <X size={14} color={colors.primary} />
              <Text style={styles.clearButtonText}>Filtreleri Temizle</Text>
            </Pressable>
          ) : null}
        </View>

        <View style={styles.filterGroup}>
          <Text style={styles.filterLabel}>Rol</Text>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.filterChips}
          >
            <FilterChip
              label={`Tüm Roller (${counts.total})`}
              active={selectedRole === 'all'}
              onPress={() => setSelectedRole('all')}
            />
            {ROLES.map((role) => (
              <FilterChip
                key={role}
                label={`${role} (${roleCounts[role]})`}
                active={selectedRole === role}
                onPress={() => setSelectedRole(role)}
              />
            ))}
          </ScrollView>
        </View>

        <View style={styles.filterGroup}>
          <Text style={styles.filterLabel}>Durum</Text>
          <View style={styles.filterChips}>
            <FilterChip
              label="Tüm Durumlar"
              active={selectedStatus === 'all'}
              onPress={() => setSelectedStatus('all')}
            />
            <FilterChip
              label={`Aktif (${counts.active})`}
              active={selectedStatus === 'active'}
              onPress={() => setSelectedStatus('active')}
            />
            <FilterChip
              label={`Pasif (${counts.passive})`}
              active={selectedStatus === 'passive'}
              onPress={() => setSelectedStatus('passive')}
            />
          </View>
        </View>
      </View>

      {desktopTable ? (
        <View style={styles.table}>
          <View style={styles.tableHeader}>
            <Text style={[styles.tableHeaderText, styles.personColumn]}>KATILIMCI</Text>
            <Text style={[styles.tableHeaderText, styles.roleColumn]}>ROL</Text>
            <Text style={[styles.tableHeaderText, styles.companyColumn]}>ŞİRKET / KURUM</Text>
            <Text style={[styles.tableHeaderText, styles.sectorColumn]}>SEKTÖR / KONUM</Text>
            <Text style={[styles.tableHeaderText, styles.accessColumn]}>DURUM</Text>
            <Text style={[styles.tableHeaderText, styles.actionsColumn, styles.tableHeaderRight]}>
              İŞLEM
            </Text>
          </View>
          {filteredAttendees.map((attendee) => (
            <DesktopAttendeeRow
              key={attendee.id}
              attendee={attendee}
              onEdit={() => onOpenEditAttendee(attendee)}
              onToggle={() => onToggleAttendeeStatus(attendee)}
              onDelete={() => onDeleteAttendee(attendee)}
            />
          ))}
          {!filteredAttendees.length ? (
            <View style={styles.emptyState}>
              <CircleAlert size={25} color={colors.textMuted} />
              <Text style={styles.emptyTitle}>Katılımcı bulunamadı</Text>
              <Text style={styles.emptyBody}>
                Arama kriterlerinizi değiştirin, filtreleri temizleyin veya yeni bir katılımcı
                ekleyin.
              </Text>
              {hasFilters ? (
                <Pressable style={styles.emptyAction} onPress={clearFilters}>
                  <Text style={styles.emptyActionText}>Filtreleri Temizle</Text>
                </Pressable>
              ) : null}
            </View>
          ) : null}
          <View style={styles.tableFooter}>
            <Text style={styles.tableFooterText}>
              {filteredAttendees.length} kayıt gösteriliyor · {counts.active} aktif,{' '}
              {counts.passive} pasif
            </Text>
            <Text style={styles.tableFooterText}>Profil verileri admin mağazasıyla eşitlendi</Text>
          </View>
        </View>
      ) : (
        <View style={styles.cardList}>
          {filteredAttendees.map((attendee) => (
            <MobileAttendeeCard
              key={attendee.id}
              attendee={attendee}
              onEdit={() => onOpenEditAttendee(attendee)}
              onToggle={() => onToggleAttendeeStatus(attendee)}
              onDelete={() => onDeleteAttendee(attendee)}
            />
          ))}
          {!filteredAttendees.length ? (
            <View style={styles.emptyState}>
              <CircleAlert size={25} color={colors.textMuted} />
              <Text style={styles.emptyTitle}>Katılımcı bulunamadı</Text>
              <Text style={styles.emptyBody}>
                Arama kriterlerinizi değiştirin, filtreleri temizleyin veya yeni bir katılımcı
                ekleyin.
              </Text>
              {hasFilters ? (
                <Pressable style={styles.emptyAction} onPress={clearFilters}>
                  <Text style={styles.emptyActionText}>Filtreleri Temizle</Text>
                </Pressable>
              ) : null}
            </View>
          ) : null}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { gap: 15 },
  flex: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 18,
  },
  headerCompact: { flexDirection: 'column' },
  headerCopy: { flex: 1, gap: 5 },
  titleLine: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 9 },
  title: { color: colors.text, fontSize: 22, lineHeight: 28, fontWeight: '900' },
  resultBadge: {
    minHeight: 25,
    paddingHorizontal: 9,
    borderRadius: 9,
    backgroundColor: colors.surfaceContainer,
    alignItems: 'center',
    justifyContent: 'center',
  },
  resultBadgeText: { color: colors.textMuted, fontSize: 10, fontWeight: '900' },
  subtitle: {
    color: colors.textMuted,
    fontSize: 13,
    lineHeight: 19,
    fontWeight: '500',
    maxWidth: 760,
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
  createButtonCompact: { alignSelf: 'stretch' },
  createButtonText: { color: colors.white, fontSize: 13, fontWeight: '800' },
  metricGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  metricCard: {
    minWidth: 185,
    flex: 1,
    minHeight: 91,
    padding: 13,
    borderRadius: 15,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  metricCardCompact: { minWidth: '47%' },
  metricIcon: {
    width: 37,
    height: 37,
    borderRadius: 11,
    alignItems: 'center',
    justifyContent: 'center',
  },
  metricValue: { color: colors.text, fontSize: 18, fontWeight: '900' },
  metricLabel: { color: colors.text, fontSize: 11, fontWeight: '800' },
  metricNote: { color: colors.textMuted, fontSize: 9, fontWeight: '600' },
  filtersPanel: {
    padding: 14,
    borderRadius: 17,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    gap: 12,
  },
  searchRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  searchRowCompact: { flexDirection: 'column', alignItems: 'stretch' },
  searchField: {
    flex: 1,
    minHeight: 43,
    paddingHorizontal: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.borderStrong,
    backgroundColor: colors.surfaceMuted,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  searchInput: { flex: 1, color: colors.text, fontSize: 12, paddingVertical: 0 },
  clearButton: {
    minHeight: 38,
    paddingHorizontal: 10,
    borderRadius: 10,
    backgroundColor: colors.primarySoft,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 5,
  },
  clearButtonText: { color: colors.primary, fontSize: 10, fontWeight: '900' },
  filterGroup: { gap: 6 },
  filterLabel: { color: colors.text, fontSize: 10, fontWeight: '900' },
  filterChips: { flexDirection: 'row', flexWrap: 'wrap', gap: 7 },
  filterChip: {
    minHeight: 34,
    paddingHorizontal: 11,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.borderStrong,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  filterChipActive: { borderColor: colors.text, backgroundColor: colors.text },
  filterChipText: { color: colors.textMuted, fontSize: 10, fontWeight: '800' },
  filterChipTextActive: { color: colors.white },
  table: {
    borderRadius: 17,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    overflow: 'hidden',
  },
  tableHeader: {
    minHeight: 43,
    paddingHorizontal: 14,
    backgroundColor: colors.surfaceMuted,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  tableHeaderText: { color: colors.textMuted, fontSize: 9, fontWeight: '900', letterSpacing: 0.45 },
  tableHeaderRight: { textAlign: 'right' },
  tableRow: {
    minHeight: 90,
    paddingHorizontal: 14,
    paddingVertical: 11,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  tableCell: { justifyContent: 'center' },
  personColumn: { flex: 2.1, minWidth: 205 },
  roleColumn: { flex: 1.05, minWidth: 105 },
  companyColumn: { flex: 1.35, minWidth: 125 },
  sectorColumn: { flex: 1.25, minWidth: 120 },
  accessColumn: { flex: 1.2, minWidth: 118, alignItems: 'flex-start' },
  actionsColumn: {
    width: 116,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    gap: 5,
  },
  personCopy: { flex: 1, gap: 3 },
  personName: { color: colors.text, fontSize: 12, fontWeight: '900' },
  personColumnRow: { flexDirection: 'row', alignItems: 'center', gap: 9 },
  avatar: { width: 39, height: 39, borderRadius: 12 },
  avatarLarge: { width: 53, height: 53, borderRadius: 16 },
  avatarFallback: {
    backgroundColor: colors.primarySoft,
    borderWidth: 1,
    borderColor: '#ffd1ad',
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: { color: colors.primary, fontSize: 11, fontWeight: '900' },
  avatarTextLarge: { fontSize: 14 },
  inlineDetail: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  inlineDetailText: { flex: 1, color: colors.textMuted, fontSize: 9, fontWeight: '600' },
  cellTitle: { color: colors.text, fontSize: 11, fontWeight: '800' },
  cellTitleSmall: { color: colors.text, fontSize: 10, lineHeight: 14, fontWeight: '800' },
  cellSubtitle: { color: colors.textMuted, fontSize: 9, marginTop: 3 },
  rolePill: {
    alignSelf: 'flex-start',
    minHeight: 25,
    paddingHorizontal: 8,
    borderRadius: 8,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rolePillText: { fontSize: 9, fontWeight: '900' },
  statusPill: {
    minHeight: 24,
    paddingHorizontal: 8,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.borderStrong,
    backgroundColor: colors.surfaceMuted,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  statusPillActive: { borderColor: colors.successBorder, backgroundColor: colors.successBg },
  statusPillPassive: { borderColor: colors.borderStrong, backgroundColor: colors.surfaceMuted },
  statusDot: { width: 6, height: 6, borderRadius: 3 },
  statusDotActive: { backgroundColor: colors.success },
  statusDotPassive: { backgroundColor: colors.textMuted },
  statusPillText: { color: colors.textMuted, fontSize: 8, fontWeight: '900', letterSpacing: 0.3 },
  statusPillTextActive: { color: colors.success },
  actionButton: {
    minHeight: 36,
    paddingHorizontal: 10,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.borderStrong,
    backgroundColor: colors.surface,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 5,
  },
  actionButtonCompact: { width: 34, height: 34, minHeight: 34, paddingHorizontal: 0 },
  actionButtonDanger: { borderColor: colors.dangerBorder, backgroundColor: colors.dangerBg },
  actionButtonPrimary: { borderColor: '#ffd1ad', backgroundColor: colors.primarySoft },
  actionButtonText: { color: colors.textMuted, fontSize: 10, fontWeight: '900' },
  actionButtonTextDanger: { color: colors.danger },
  actionButtonTextPrimary: { color: colors.primary },
  tableFooter: {
    minHeight: 42,
    paddingHorizontal: 14,
    paddingVertical: 9,
    backgroundColor: colors.surfaceMuted,
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 7,
  },
  tableFooterText: { color: colors.textMuted, fontSize: 9, fontWeight: '600' },
  cardList: { gap: 11 },
  attendeeCard: {
    padding: 14,
    borderRadius: 17,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    gap: 12,
  },
  cardHeader: { flexDirection: 'row', alignItems: 'flex-start', gap: 11 },
  cardIdentity: { flex: 1, gap: 3 },
  cardName: { color: colors.text, fontSize: 14, fontWeight: '900' },
  cardPosition: { color: colors.textMuted, fontSize: 10, fontWeight: '600' },
  cardPills: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 4 },
  cardDetails: {
    paddingVertical: 10,
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: colors.border,
    gap: 7,
  },
  detailRow: { flexDirection: 'row', alignItems: 'center', gap: 7 },
  detailText: { flex: 1, color: colors.textMuted, fontSize: 10, fontWeight: '600' },
  cardActions: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'flex-end', gap: 7 },
  emptyState: {
    minHeight: 190,
    padding: 24,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 7,
  },
  emptyTitle: { color: colors.text, fontSize: 14, fontWeight: '900' },
  emptyBody: {
    maxWidth: 440,
    color: colors.textMuted,
    fontSize: 11,
    lineHeight: 17,
    textAlign: 'center',
  },
  emptyAction: {
    minHeight: 36,
    marginTop: 5,
    paddingHorizontal: 12,
    borderRadius: 10,
    backgroundColor: colors.primarySoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyActionText: { color: colors.primary, fontSize: 10, fontWeight: '900' },
});
