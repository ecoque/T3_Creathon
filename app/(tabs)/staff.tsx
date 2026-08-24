// Görevli ("gorevli" rolü) sekmesi: sorumlu olduğu girişimcilerin listesi +
// su istasyonu talepleri işaretleme arayüzü (bkz. lib/useStaffAssignments.ts,
// lib/useWaterStations.ts). Görevliler normal katılımcı sekmelerini
// (ajanda/keşfet/toplantılar/harita/profil) de aynen kullanabilir — bu sekme
// SADECE ek bir görevli aracı, kısıtlama getirmez.
import { Building2, CircleAlert, Droplet, MapPin, Truck, Users } from 'lucide-react-native';
import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { AppHeader } from '../../components/AppHeader';
import { colors } from '../../constants/theme';
import { useCurrentProfile } from '../../lib/useCurrentProfile';
import { useMyStaffAssignments } from '../../lib/useStaffAssignments';
import {
  WATER_STATION_STATUS_LABEL_KEY,
  useAdvanceWaterStationStatus,
  useReportWaterStationEmpty,
  useWaterStations,
} from '../../lib/useWaterStations';
import type { WaterStation, WaterStationStatus } from '../../types';

const STATUS_COLOR: Record<WaterStationStatus, string> = {
  active: colors.success,
  reported_empty: colors.danger,
  dispatched: colors.primary,
  resolved: colors.textMuted,
};

function StatusPill({ status }: { status: WaterStationStatus }) {
  const { t } = useTranslation();
  return (
    <View style={[styles.statusPill, { borderColor: STATUS_COLOR[status] }]}>
      <View style={[styles.statusDot, { backgroundColor: STATUS_COLOR[status] }]} />
      <Text style={[styles.statusPillText, { color: STATUS_COLOR[status] }]}>{t(WATER_STATION_STATUS_LABEL_KEY[status])}</Text>
    </View>
  );
}

function StationRow({ station }: { station: WaterStation }) {
  const { t } = useTranslation();
  const reportEmpty = useReportWaterStationEmpty();
  const advance = useAdvanceWaterStationStatus();
  const busy = reportEmpty.isPending || advance.isPending;

  return (
    <View style={styles.stationRow}>
      <View style={styles.stationIcon}>
        <Droplet size={16} color={colors.primary} />
      </View>
      <View style={styles.flex}>
        <Text style={styles.stationName}>{station.name}</Text>
        <StatusPill status={station.status} />
      </View>
      {station.status === 'active' ? (
        <Pressable
          style={styles.dangerBtn}
          disabled={busy}
          onPress={() => reportEmpty.mutate(station.id)}
        >
          {reportEmpty.isPending ? (
            <ActivityIndicator size="small" color={colors.white} />
          ) : (
            <Text style={styles.dangerBtnText}>{t('waterStations.reportEmpty')}</Text>
          )}
        </Pressable>
      ) : station.status === 'reported_empty' ? (
        <Pressable
          style={styles.primaryBtn}
          disabled={busy}
          onPress={() => advance.mutate({ stationId: station.id, status: 'dispatched' })}
        >
          <Truck size={14} color={colors.white} />
          <Text style={styles.primaryBtnText}>{t('waterStations.markDispatched')}</Text>
        </Pressable>
      ) : station.status === 'dispatched' ? (
        <Pressable
          style={styles.successBtn}
          disabled={busy}
          onPress={() => advance.mutate({ stationId: station.id, status: 'resolved' })}
        >
          <Text style={styles.successBtnText}>{t('waterStations.markResolved')}</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

export default function StaffScreen() {
  const { t } = useTranslation();
  const { data: meResult } = useCurrentProfile();
  const assignmentsQuery = useMyStaffAssignments();
  const stationsQuery = useWaterStations();
  const [showResolved, setShowResolved] = useState(false);

  const assignments = assignmentsQuery.data ?? [];
  const stations = stationsQuery.data ?? [];
  const visibleStations = useMemo(
    () => (showResolved ? stations : stations.filter((s) => s.status !== 'resolved')),
    [stations, showResolved],
  );

  return (
    <View style={styles.screen}>
      <AppHeader activeTab="gorevli" profile={meResult?.profile} />
      <ScrollView contentContainerStyle={styles.content}>
        <View>
          <Text style={styles.title}>{t('staff.title')}</Text>
          <Text style={styles.subtitle}>{t('staff.subtitle')}</Text>
        </View>

        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Users size={16} color={colors.primary} />
            <Text style={styles.sectionTitle}>{t('staff.assignedEntrepreneurs')}</Text>
          </View>
          {assignmentsQuery.isLoading ? (
            <ActivityIndicator color={colors.primary} />
          ) : assignments.length === 0 ? (
            <View style={styles.emptyCard}>
              <CircleAlert size={18} color={colors.textMuted} />
              <Text style={styles.emptyText}>{t('staff.noAssignments')}</Text>
            </View>
          ) : (
            <View style={styles.list}>
              {assignments.map((assignment) => (
                <View key={assignment.id} style={styles.assignmentCard}>
                  <View style={styles.assignmentIcon}>
                    <Building2 size={16} color={colors.primary} />
                  </View>
                  <View style={styles.flex}>
                    <Text style={styles.assignmentName}>
                      {assignment.entrepreneurProfile?.full_name ?? t('staff.unknownProfile')}
                    </Text>
                    {assignment.entrepreneurProfile?.sector ? (
                      <Text style={styles.assignmentMeta}>{assignment.entrepreneurProfile.sector}</Text>
                    ) : null}
                    {assignment.zone ? (
                      <View style={styles.zoneRow}>
                        <MapPin size={12} color={colors.textMuted} />
                        <Text style={styles.assignmentMeta}>{assignment.zone.name}</Text>
                      </View>
                    ) : null}
                  </View>
                </View>
              ))}
            </View>
          )}
        </View>

        <View style={styles.section}>
          <View style={styles.sectionHeaderRow}>
            <View style={styles.sectionHeader}>
              <Droplet size={16} color={colors.primary} />
              <Text style={styles.sectionTitle}>{t('waterStations.title')}</Text>
            </View>
            <Pressable onPress={() => setShowResolved((v) => !v)}>
              <Text style={styles.toggleText}>
                {showResolved ? t('waterStations.hideResolved') : t('waterStations.showResolved')}
              </Text>
            </Pressable>
          </View>
          {stationsQuery.isLoading ? (
            <ActivityIndicator color={colors.primary} />
          ) : visibleStations.length === 0 ? (
            <View style={styles.emptyCard}>
              <CircleAlert size={18} color={colors.textMuted} />
              <Text style={styles.emptyText}>{t('waterStations.empty')}</Text>
            </View>
          ) : (
            <View style={styles.list}>
              {visibleStations.map((station) => (
                <StationRow key={station.id} station={station} />
              ))}
            </View>
          )}
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  content: { padding: 16, paddingBottom: 32, gap: 20 },
  title: { fontSize: 22, fontWeight: '800', color: colors.text },
  subtitle: { fontSize: 12, color: colors.textMuted, marginTop: 4 },
  section: { gap: 10 },
  sectionHeader: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  sectionHeaderRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  sectionTitle: { fontSize: 15, fontWeight: '800', color: colors.text },
  toggleText: { fontSize: 11, fontWeight: '700', color: colors.primary },
  flex: { flex: 1, minWidth: 0 },
  list: { gap: 10 },
  emptyCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    padding: 14,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.white,
  },
  emptyText: { flex: 1, color: colors.textMuted, fontSize: 12 },
  assignmentCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 14,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.white,
  },
  assignmentIcon: {
    width: 38,
    height: 38,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.primarySoft,
  },
  assignmentName: { fontSize: 14, fontWeight: '800', color: colors.text },
  assignmentMeta: { fontSize: 11, color: colors.textMuted, marginTop: 2 },
  zoneRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 3 },
  stationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 14,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.white,
  },
  stationIcon: {
    width: 36,
    height: 36,
    borderRadius: 11,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.primarySoft,
  },
  stationName: { fontSize: 13, fontWeight: '800', color: colors.text },
  statusPill: {
    marginTop: 5,
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 99,
    borderWidth: 1,
  },
  statusDot: { width: 6, height: 6, borderRadius: 3 },
  statusPillText: { fontSize: 9, fontWeight: '800' },
  dangerBtn: {
    minHeight: 36,
    paddingHorizontal: 10,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.danger,
  },
  dangerBtnText: { color: colors.white, fontSize: 10, fontWeight: '800' },
  primaryBtn: {
    minHeight: 36,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 10,
    borderRadius: 10,
    backgroundColor: colors.primary,
  },
  primaryBtnText: { color: colors.white, fontSize: 10, fontWeight: '800' },
  successBtn: {
    minHeight: 36,
    paddingHorizontal: 10,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.success,
  },
  successBtnText: { color: colors.white, fontSize: 10, fontWeight: '800' },
});
