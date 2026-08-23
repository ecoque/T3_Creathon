import {
  Activity,
  Check,
  Crosshair,
  Edit3,
  Layers3,
  Move,
  Radio,
  Store,
  Trash2,
  X,
} from 'lucide-react-native';
import { useEffect, useMemo, useState } from 'react';
import {
  Image,
  Pressable,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
  type DimensionValue,
  type GestureResponderEvent,
} from 'react-native';

import { colors } from '../../constants/theme';
import type { AdminBooth, AdminStage, ZoneDensityInfo } from '../../types/admin';

type LayerKey = 'booths' | 'stages' | 'zones' | 'density';

type Props = {
  stages: AdminStage[];
  booths: AdminBooth[];
  zones: ZoneDensityInfo[];
  selectedBoothIdFromNav?: string | null;
  onSelectBooth?: (boothId: string) => void;
  onOpenEditBooth: (booth: AdminBooth) => void;
  onDeleteBooth: (booth: AdminBooth) => void;
  onUpdateBoothCoordinates: (boothId: string, mapX: number, mapY: number) => Promise<boolean>;
  onNotify?: (message: string) => void;
};

const ZONE_VISUALS = [
  {
    code: 'Zone A',
    shortName: 'Ana Oditoryum & VIP',
    color: '#60a5fa',
    background: 'rgba(59,130,246,0.13)',
    border: 'rgba(96,165,250,0.34)',
    labelBackground: 'rgba(23,37,84,0.88)',
  },
  {
    code: 'Zone B',
    shortName: 'AI Sahnesi & Teknoloji',
    color: '#fb923c',
    background: 'rgba(249,115,22,0.16)',
    border: 'rgba(251,146,60,0.34)',
    labelBackground: 'rgba(67,20,7,0.88)',
  },
  {
    code: 'Zone C',
    shortName: 'Girişim Stantları',
    color: '#34d399',
    background: 'rgba(16,185,129,0.13)',
    border: 'rgba(52,211,153,0.34)',
    labelBackground: 'rgba(6,78,59,0.88)',
  },
  {
    code: 'Zone D',
    shortName: 'Networking & Kafe',
    color: '#c084fc',
    background: 'rgba(168,85,247,0.13)',
    border: 'rgba(192,132,252,0.34)',
    labelBackground: 'rgba(59,7,100,0.88)',
  },
] as const;

function clampCoordinate(value: number) {
  return Math.max(5, Math.min(95, value));
}

function zoneSubtitle(zone: ZoneDensityInfo) {
  const separator = zone.name.indexOf(' - ');
  return separator >= 0 ? zone.name.slice(separator + 3) : zone.name;
}

function LayerToggle({
  active,
  emphasized,
  label,
  onPress,
}: {
  active: boolean;
  emphasized?: boolean;
  label: string;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="checkbox"
      accessibilityState={{ checked: active }}
      onPress={onPress}
      style={[styles.layerToggle, emphasized && styles.layerToggleEmphasized]}
    >
      <View style={[styles.checkbox, active && styles.checkboxActive]}>
        {active ? <Check size={10} strokeWidth={3} color={colors.white} /> : null}
      </View>
      <Text style={[styles.layerToggleText, emphasized && styles.layerToggleTextEmphasized]}>
        {label}
      </Text>
    </Pressable>
  );
}

function InfoLine({
  label,
  value,
  valueColor,
}: {
  label: string;
  value: string;
  valueColor?: string;
}) {
  return (
    <View style={styles.infoLine}>
      <Text style={styles.infoLabel}>{label}</Text>
      <Text style={[styles.infoValue, valueColor ? { color: valueColor } : null]}>{value}</Text>
    </View>
  );
}

export function AdminMapManagement({
  stages,
  booths,
  zones,
  selectedBoothIdFromNav,
  onSelectBooth,
  onOpenEditBooth,
  onDeleteBooth,
  onUpdateBoothCoordinates,
  onNotify,
}: Props) {
  const { width } = useWindowDimensions();
  const wide = width >= 1120;
  const compact = width < 620;
  const [layers, setLayers] = useState<Record<LayerKey, boolean>>({
    booths: true,
    stages: true,
    zones: true,
    density: true,
  });
  const [selectedBoothId, setSelectedBoothId] = useState<string | null>(
    selectedBoothIdFromNav || booths[0]?.id || null,
  );
  const [selectedStageId, setSelectedStageId] = useState<string | null>(null);
  const [repositioning, setRepositioning] = useState(false);
  const [mapSize, setMapSize] = useState({ width: 1, height: 1 });

  const selectedBooth = booths.find((booth) => booth.id === selectedBoothId) || null;
  const selectedStage = stages.find((stage) => stage.id === selectedStageId) || null;

  useEffect(() => {
    if (selectedBoothIdFromNav && booths.some((booth) => booth.id === selectedBoothIdFromNav)) {
      setSelectedBoothId(selectedBoothIdFromNav);
      setSelectedStageId(null);
    }
  }, [booths, selectedBoothIdFromNav]);

  useEffect(() => {
    if (selectedBoothId && !booths.some((booth) => booth.id === selectedBoothId)) {
      const nextId = booths[0]?.id || null;
      setSelectedBoothId(nextId);
      setRepositioning(false);
      if (nextId) onSelectBooth?.(nextId);
    }
  }, [booths, onSelectBooth, selectedBoothId]);

  const zoneRows = useMemo(
    () =>
      ZONE_VISUALS.map((visual) => ({
        visual,
        data: zones.find((zone) => zone.code === visual.code),
      })),
    [zones],
  );

  function toggleLayer(key: LayerKey) {
    setLayers((current) => ({ ...current, [key]: !current[key] }));
  }

  function selectBooth(booth: AdminBooth) {
    setSelectedBoothId(booth.id);
    setSelectedStageId(null);
    setRepositioning(false);
    onSelectBooth?.(booth.id);
  }

  function selectStage(stage: AdminStage) {
    setSelectedStageId(stage.id);
    setSelectedBoothId(null);
    setRepositioning(false);
  }

  async function handleMapPress(event: GestureResponderEvent) {
    if (!repositioning || !selectedBooth) return;
    const mapX = clampCoordinate(Math.round((event.nativeEvent.locationX / mapSize.width) * 100));
    const mapY = clampCoordinate(Math.round((event.nativeEvent.locationY / mapSize.height) * 100));
    if (await onUpdateBoothCoordinates(selectedBooth.id, mapX, mapY)) {
      setRepositioning(false);
      onNotify?.(`${selectedBooth.boothNo} pin konumu güncellendi.`);
    }
  }

  return (
    <View style={styles.page}>
      <View style={styles.header}>
        <View style={styles.headerCopy}>
          <Text style={styles.title}>Etkinlik Haritası ve Alan Koordinat Yönetimi</Text>
          <Text style={styles.subtitle}>
            Stant pinlerinin konumlandırılması, sahnelerin yerleşimi ve zone yoğunluk katmanları.
          </Text>
        </View>

        <View style={styles.layerBar}>
          <View style={styles.layerLabel}>
            <Layers3 size={16} color={colors.primary} />
            <Text style={styles.layerLabelText}>Katmanlar:</Text>
          </View>
          <View style={styles.layerOptions}>
            <LayerToggle
              active={layers.booths}
              label={`Stantlar (${booths.length})`}
              onPress={() => toggleLayer('booths')}
            />
            <LayerToggle
              active={layers.stages}
              label={`Sahneler (${stages.length})`}
              onPress={() => toggleLayer('stages')}
            />
            <LayerToggle
              active={layers.zones}
              label={`Zonlar (${zones.length} Bölge)`}
              onPress={() => toggleLayer('zones')}
            />
            <LayerToggle
              active={layers.density}
              emphasized
              label="Katılımcı Yoğunluğu"
              onPress={() => toggleLayer('density')}
            />
          </View>
        </View>
      </View>

      <View style={[styles.mainGrid, wide && styles.mainGridWide]}>
        <View style={[styles.mapCard, wide && styles.mapCardWide]}>
          {repositioning && selectedBooth ? (
            <View style={styles.repositionAlert}>
              <View style={styles.repositionCopy}>
                <Crosshair size={17} color={colors.white} />
                <Text style={styles.repositionText}>
                  “{selectedBooth.companyName}” için haritada yeni pin konumuna dokunun.
                </Text>
              </View>
              <Pressable style={styles.cancelMove} onPress={() => setRepositioning(false)}>
                <X size={14} color={colors.primary} />
                <Text style={styles.cancelMoveText}>Vazgeç</Text>
              </Pressable>
            </View>
          ) : null}

          <Pressable
            accessibilityLabel="Etkinlik alan haritası"
            onLayout={(event) => setMapSize(event.nativeEvent.layout)}
            onPress={handleMapPress}
            style={[
              styles.mapCanvas,
              compact && styles.mapCanvasCompact,
              repositioning && styles.mapCanvasMoving,
            ]}
          >
            <View pointerEvents="none" style={StyleSheet.absoluteFill}>
              {Array.from({ length: 16 }).map((_, index) => (
                <View
                  key={`vertical-${index}`}
                  style={[styles.gridVertical, { left: `${(index + 1) * 6}%` as DimensionValue }]}
                />
              ))}
              {Array.from({ length: 12 }).map((_, index) => (
                <View
                  key={`horizontal-${index}`}
                  style={[styles.gridHorizontal, { top: `${(index + 1) * 8}%` as DimensionValue }]}
                />
              ))}
            </View>

            {layers.zones
              ? zoneRows.map(({ visual, data }, index) => {
                  const right = index % 2 === 1;
                  const bottom = index > 1;
                  return (
                    <View
                      pointerEvents="none"
                      key={visual.code}
                      style={[
                        styles.zoneQuadrant,
                        {
                          left: right ? '50%' : 0,
                          top: bottom ? '50%' : 0,
                          backgroundColor: layers.density ? visual.background : 'transparent',
                          borderColor: visual.border,
                        },
                      ]}
                    >
                      <View
                        style={[
                          styles.zoneLabel,
                          { backgroundColor: visual.labelBackground, borderColor: visual.border },
                        ]}
                      >
                        <Text
                          style={[styles.zoneLabelText, { color: visual.color }]}
                          numberOfLines={2}
                        >
                          {visual.code.toUpperCase()} • {visual.shortName}
                        </Text>
                      </View>
                      {layers.density && data ? (
                        <View
                          style={[
                            styles.densityBadge,
                            data.densityLevel === 'Yoğun' && styles.densityBadgeCritical,
                          ]}
                        >
                          <Text
                            style={[
                              styles.densityText,
                              data.densityLevel === 'Yoğun' && styles.densityTextCritical,
                            ]}
                            numberOfLines={2}
                          >
                            {data.activeAttendees.toLocaleString('tr-TR')} Katılımcı (%
                            {data.densityPercent}
                            {data.densityLevel === 'Yoğun' ? ' - YOĞUN' : ''})
                          </Text>
                        </View>
                      ) : null}
                    </View>
                  );
                })
              : null}

            {layers.stages
              ? stages.map((stage) => {
                  const active = selectedStage?.id === stage.id;
                  return (
                    <Pressable
                      key={stage.id}
                      onPress={(event) => {
                        event.stopPropagation();
                        selectStage(stage);
                      }}
                      style={[
                        styles.stagePin,
                        active && styles.stagePinSelected,
                        {
                          left: `${stage.mapX}%` as DimensionValue,
                          top: `${stage.mapY}%` as DimensionValue,
                        },
                      ]}
                    >
                      <View style={styles.stagePulse} />
                      <Text style={styles.stagePinText} numberOfLines={1}>
                        {stage.name}
                      </Text>
                    </Pressable>
                  );
                })
              : null}

            {layers.booths
              ? booths.map((booth) => {
                  const active = selectedBooth?.id === booth.id;
                  return (
                    <Pressable
                      key={booth.id}
                      onPress={(event) => {
                        event.stopPropagation();
                        selectBooth(booth);
                      }}
                      style={[
                        styles.boothPin,
                        active && styles.boothPinSelected,
                        {
                          left: `${booth.mapX}%` as DimensionValue,
                          top: `${booth.mapY}%` as DimensionValue,
                        },
                      ]}
                    >
                      <Store size={11} color={active ? colors.white : colors.text} />
                      <Text style={[styles.boothPinText, active && styles.boothPinTextSelected]}>
                        {booth.boothNo}
                      </Text>
                    </Pressable>
                  );
                })
              : null}
          </Pressable>
        </View>

        <View style={[styles.inspectorColumn, wide && styles.inspectorColumnWide]}>
          {selectedBooth ? (
            <View style={styles.inspectorCard}>
              <View style={styles.inspectorHeader}>
                <View style={styles.inspectorHeaderTitle}>
                  <Store size={17} color={colors.primary} />
                  <Text style={styles.eyebrow}>STANT BİLGİ PANELİ</Text>
                </View>
                <Text style={styles.boothNumber}>{selectedBooth.boothNo}</Text>
              </View>

              <View style={styles.companyRow}>
                <View style={styles.companyLogo}>
                  <Image source={{ uri: selectedBooth.logo }} style={styles.companyLogoImage} />
                </View>
                <View style={styles.companyCopy}>
                  <Text style={styles.companyName}>{selectedBooth.companyName}</Text>
                  <Text style={styles.companyCategory}>{selectedBooth.category}</Text>
                  <Text style={styles.sponsorBadge}>{selectedBooth.sponsorTier} Sponsor</Text>
                </View>
              </View>

              <Text style={styles.description}>{selectedBooth.description}</Text>
              <View style={styles.infoBox}>
                <InfoLine label="Mevcut Bölge:" value={selectedBooth.zone} />
                <InfoLine
                  label="Koordinat:"
                  value={`X: %${selectedBooth.mapX}  |  Y: %${selectedBooth.mapY}`}
                  valueColor={colors.primary}
                />
                <InfoLine
                  label="Ziyaret & Check-in:"
                  value={`${selectedBooth.totalVisits.toLocaleString('tr-TR')} kişi`}
                />
              </View>

              <Pressable
                style={[styles.moveButton, repositioning && styles.moveButtonActive]}
                onPress={() => setRepositioning((current) => !current)}
              >
                <Move size={16} color={colors.primary} />
                <Text style={styles.moveButtonText}>
                  {repositioning ? 'Yeni Konumu Seçin' : 'Pin Konumunu Haritada Taşı'}
                </Text>
              </Pressable>
              <View style={styles.actionRow}>
                <Pressable style={styles.editButton} onPress={() => onOpenEditBooth(selectedBooth)}>
                  <Edit3 size={15} color={colors.text} />
                  <Text style={styles.editButtonText}>Stant Düzenle</Text>
                </Pressable>
                <Pressable style={styles.deleteButton} onPress={() => onDeleteBooth(selectedBooth)}>
                  <Trash2 size={15} color={colors.danger} />
                  <Text style={styles.deleteButtonText}>Standı Sil</Text>
                </Pressable>
              </View>
            </View>
          ) : selectedStage ? (
            <View style={styles.inspectorCard}>
              <View style={styles.inspectorHeader}>
                <View style={styles.inspectorHeaderTitle}>
                  <Radio size={17} color={colors.primary} />
                  <Text style={styles.eyebrow}>SAHNE / SALON DETAYI</Text>
                </View>
                <Text style={styles.stageZone}>{selectedStage.zone}</Text>
              </View>
              <View>
                <Text style={styles.stageName}>{selectedStage.name}</Text>
                <Text style={styles.companyCategory}>{selectedStage.type}</Text>
              </View>
              <Text style={styles.description}>{selectedStage.description}</Text>
              <View style={styles.infoBox}>
                <InfoLine
                  label="Salon Kapasitesi:"
                  value={`${selectedStage.capacity.toLocaleString('tr-TR')} kişi`}
                />
                <InfoLine
                  label="Anlık Doluluk:"
                  value={`${selectedStage.currentOccupancy.toLocaleString('tr-TR')} kişi (%${Math.round(
                    (selectedStage.currentOccupancy / selectedStage.capacity) * 100,
                  )})`}
                  valueColor={colors.success}
                />
                <InfoLine
                  label="Durum:"
                  value={selectedStage.status === 'active' ? 'Aktif' : selectedStage.status}
                />
              </View>
            </View>
          ) : (
            <View style={styles.emptyCard}>
              <Crosshair size={25} color={colors.textMuted} />
              <Text style={styles.emptyText}>
                Detayları görmek veya konumunu değiştirmek için haritadan bir stant veya sahne
                seçin.
              </Text>
            </View>
          )}

          <View style={styles.zoneSummaryCard}>
            <View style={styles.summaryHeader}>
              <Text style={styles.summaryTitle}>BÖLGE (ZONE) ÖZETLERİ</Text>
              <Activity size={16} color={colors.primary} />
            </View>
            <View style={styles.summaryList}>
              {zones.map((zone) => {
                const visual = ZONE_VISUALS.find((item) => item.code === zone.code);
                const critical = zone.densityLevel === 'Yoğun';
                const medium = zone.densityLevel === 'Orta';
                return (
                  <View key={zone.id} style={styles.summaryRow}>
                    <View
                      style={[
                        styles.summaryAccent,
                        { backgroundColor: visual?.color || zone.color },
                      ]}
                    />
                    <View style={styles.summaryCopy}>
                      <Text style={styles.summaryCode}>{zone.code}</Text>
                      <Text style={styles.summaryName} numberOfLines={1}>
                        {zoneSubtitle(zone)}
                      </Text>
                    </View>
                    <View style={styles.summaryValue}>
                      <Text style={styles.summaryCount}>
                        {zone.activeAttendees.toLocaleString('tr-TR')} kişi
                      </Text>
                      <Text
                        style={[
                          styles.summaryDensity,
                          critical && styles.summaryDensityCritical,
                          medium && styles.summaryDensityMedium,
                        ]}
                      >
                        {zone.densityLevel} · %{zone.densityPercent}
                      </Text>
                    </View>
                  </View>
                );
              })}
            </View>
          </View>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  page: { gap: 20 },
  header: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 14 },
  headerCopy: { flex: 1, minWidth: 260 },
  title: { color: colors.text, fontSize: 25, fontWeight: '900', letterSpacing: -0.5 },
  subtitle: { color: colors.textMuted, fontSize: 13, lineHeight: 19, marginTop: 4 },
  layerBar: {
    gap: 8,
    padding: 8,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 16,
    backgroundColor: colors.surface,
  },
  layerOptions: { flexDirection: 'row', flexWrap: 'wrap', gap: 7 },
  layerLabel: { width: '100%', flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 7 },
  layerLabelText: { color: colors.textMuted, fontSize: 11, fontWeight: '800' },
  layerToggle: {
    width: '48%',
    flexGrow: 0,
    flexShrink: 0,
    minHeight: 34,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 10,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 9,
    backgroundColor: colors.surfaceMuted,
  },
  layerToggleEmphasized: { borderColor: colors.primaryLight, backgroundColor: colors.primarySoft },
  layerToggleText: { flexShrink: 1, color: colors.textMuted, fontSize: 10, fontWeight: '700' },
  layerToggleTextEmphasized: { color: colors.primary, fontWeight: '900' },
  checkbox: {
    width: 15,
    height: 15,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
    borderColor: colors.borderStrong,
    borderRadius: 4,
    backgroundColor: colors.surface,
  },
  checkboxActive: { borderColor: colors.primary, backgroundColor: colors.primary },
  mainGrid: { gap: 16 },
  mainGridWide: { flexDirection: 'row', alignItems: 'flex-start' },
  mapCard: {
    minWidth: 0,
    padding: 14,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 17,
    backgroundColor: colors.surface,
  },
  mapCardWide: { flex: 2 },
  repositionAlert: {
    minHeight: 46,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
    padding: 10,
    marginBottom: 10,
    borderRadius: 11,
    backgroundColor: colors.primary,
  },
  repositionCopy: { flex: 1, minWidth: 0, flexDirection: 'row', alignItems: 'center', gap: 8 },
  repositionText: { flex: 1, color: colors.white, fontSize: 11, lineHeight: 15, fontWeight: '800' },
  cancelMove: {
    minHeight: 28,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    borderRadius: 7,
    backgroundColor: colors.white,
  },
  cancelMoveText: { color: colors.primary, fontSize: 9, fontWeight: '900' },
  mapCanvas: {
    height: 540,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#374151',
    borderRadius: 16,
    backgroundColor: '#0f172a',
  },
  mapCanvasCompact: { height: 500 },
  mapCanvasMoving: { borderWidth: 3, borderColor: colors.primary },
  gridVertical: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    width: StyleSheet.hairlineWidth,
    backgroundColor: 'rgba(255,255,255,0.07)',
  },
  gridHorizontal: {
    position: 'absolute',
    left: 0,
    right: 0,
    height: StyleSheet.hairlineWidth,
    backgroundColor: 'rgba(255,255,255,0.07)',
  },
  zoneQuadrant: {
    position: 'absolute',
    width: '50%',
    height: '50%',
    gap: 6,
    padding: 10,
    borderWidth: StyleSheet.hairlineWidth,
  },
  zoneLabel: {
    alignSelf: 'flex-start',
    maxWidth: '100%',
    paddingHorizontal: 8,
    paddingVertical: 5,
    borderWidth: 1,
    borderRadius: 8,
  },
  zoneLabelText: { fontSize: 8, lineHeight: 11, fontWeight: '900', letterSpacing: 0.15 },
  densityBadge: {
    alignSelf: 'flex-start',
    maxWidth: '100%',
    paddingHorizontal: 7,
    paddingVertical: 4,
    borderRadius: 6,
    backgroundColor: 'rgba(30,41,59,0.88)',
  },
  densityBadgeCritical: {
    borderWidth: 1,
    borderColor: 'rgba(248,113,113,0.6)',
    backgroundColor: 'rgba(69,10,10,0.9)',
  },
  densityText: { color: '#cbd5e1', fontSize: 8, lineHeight: 10, fontWeight: '800' },
  densityTextCritical: { color: '#fca5a5' },
  stagePin: {
    position: 'absolute',
    zIndex: 4,
    maxWidth: 150,
    minHeight: 28,
    transform: [{ translateX: -12 }, { translateY: -14 }],
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 8,
    borderWidth: 1,
    borderColor: '#64748b',
    borderRadius: 9,
    backgroundColor: 'rgba(15,23,42,0.94)',
  },
  stagePinSelected: {
    borderColor: colors.primary,
    transform: [{ translateX: -12 }, { translateY: -14 }, { scale: 1.06 }],
  },
  stagePulse: { width: 7, height: 7, borderRadius: 4, backgroundColor: '#34d399' },
  stagePinText: { flexShrink: 1, color: colors.white, fontSize: 8, fontWeight: '800' },
  boothPin: {
    position: 'absolute',
    zIndex: 6,
    minHeight: 27,
    transform: [{ translateX: -18 }, { translateY: -13 }],
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 7,
    borderWidth: 1,
    borderColor: '#cbd5e1',
    borderRadius: 8,
    backgroundColor: colors.white,
  },
  boothPinSelected: {
    zIndex: 8,
    borderColor: colors.white,
    backgroundColor: colors.primary,
    transform: [{ translateX: -18 }, { translateY: -13 }, { scale: 1.18 }],
  },
  boothPinText: { color: colors.text, fontSize: 8, fontWeight: '900' },
  boothPinTextSelected: { color: colors.white },
  inspectorColumn: { gap: 14 },
  inspectorColumnWide: { flex: 1, minWidth: 315, maxWidth: 430 },
  inspectorCard: {
    gap: 14,
    padding: 17,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 17,
    backgroundColor: colors.surface,
  },
  inspectorHeader: {
    minHeight: 35,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
    paddingBottom: 10,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  inspectorHeaderTitle: { flexDirection: 'row', alignItems: 'center', gap: 7 },
  eyebrow: { color: colors.textMuted, fontSize: 9, fontWeight: '900', letterSpacing: 0.8 },
  boothNumber: {
    color: colors.text,
    fontSize: 10,
    fontWeight: '900',
    paddingHorizontal: 8,
    paddingVertical: 5,
    borderRadius: 6,
    backgroundColor: colors.surfaceMuted,
  },
  companyRow: { flexDirection: 'row', alignItems: 'center', gap: 11 },
  companyLogo: {
    width: 50,
    height: 50,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 12,
    backgroundColor: colors.surfaceMuted,
  },
  companyLogoImage: { width: '100%', height: '100%' },
  companyCopy: { flex: 1, minWidth: 0, alignItems: 'flex-start' },
  companyName: { color: colors.text, fontSize: 14, fontWeight: '900' },
  companyCategory: { color: colors.textMuted, fontSize: 10, marginTop: 2 },
  sponsorBadge: {
    overflow: 'hidden',
    color: '#6b21a8',
    fontSize: 8,
    fontWeight: '900',
    paddingHorizontal: 7,
    paddingVertical: 3,
    marginTop: 4,
    borderRadius: 99,
    backgroundColor: '#f3e8ff',
  },
  description: { color: colors.textMuted, fontSize: 11, lineHeight: 17 },
  infoBox: {
    gap: 8,
    padding: 11,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 11,
    backgroundColor: colors.surfaceMuted,
  },
  infoLine: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 10,
  },
  infoLabel: { color: colors.textMuted, fontSize: 10 },
  infoValue: {
    flexShrink: 1,
    color: colors.text,
    fontSize: 10,
    textAlign: 'right',
    fontWeight: '900',
  },
  moveButton: {
    minHeight: 40,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 7,
    paddingHorizontal: 10,
    borderRadius: 10,
    backgroundColor: '#111827',
  },
  moveButtonActive: { backgroundColor: '#263746' },
  moveButtonText: { color: colors.white, fontSize: 10, fontWeight: '900' },
  actionRow: { flexDirection: 'row', gap: 8 },
  editButton: {
    flex: 1,
    minHeight: 40,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    borderWidth: 1,
    borderColor: colors.borderStrong,
    borderRadius: 10,
  },
  editButtonText: { color: colors.text, fontSize: 9, fontWeight: '900' },
  deleteButton: {
    flex: 1,
    minHeight: 40,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    borderWidth: 1,
    borderColor: colors.dangerBorder,
    borderRadius: 10,
  },
  deleteButtonText: { color: colors.danger, fontSize: 9, fontWeight: '900' },
  stageZone: {
    color: colors.primary,
    fontSize: 9,
    fontWeight: '900',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 7,
    backgroundColor: colors.primarySoft,
  },
  stageName: { color: colors.text, fontSize: 16, fontWeight: '900' },
  emptyCard: {
    alignItems: 'center',
    gap: 10,
    padding: 30,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 17,
    backgroundColor: colors.surface,
  },
  emptyText: {
    maxWidth: 310,
    color: colors.textMuted,
    fontSize: 11,
    lineHeight: 17,
    textAlign: 'center',
  },
  zoneSummaryCard: {
    gap: 11,
    padding: 15,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 17,
    backgroundColor: colors.surface,
  },
  summaryHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  summaryTitle: { color: colors.text, fontSize: 10, fontWeight: '900', letterSpacing: 0.7 },
  summaryList: { gap: 7 },
  summaryRow: {
    minHeight: 54,
    overflow: 'hidden',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 9,
    padding: 9,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 10,
    backgroundColor: colors.surfaceMuted,
  },
  summaryAccent: { width: 4, alignSelf: 'stretch', borderRadius: 3 },
  summaryCopy: { flex: 1, minWidth: 0 },
  summaryCode: { color: colors.text, fontSize: 10, fontWeight: '900' },
  summaryName: { color: colors.textMuted, fontSize: 8, marginTop: 2 },
  summaryValue: { alignItems: 'flex-end' },
  summaryCount: { color: colors.text, fontSize: 10, fontWeight: '900' },
  summaryDensity: { color: colors.success, fontSize: 8, fontWeight: '900', marginTop: 2 },
  summaryDensityCritical: { color: colors.danger },
  summaryDensityMedium: { color: colors.primary },
});
