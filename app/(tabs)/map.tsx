import { useLocalSearchParams } from 'expo-router';
import { Check, Droplet, MapPin, Navigation, Radio, Search, Store, X } from 'lucide-react-native';
import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  ActivityIndicator,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { Circle, Defs, Line, Polyline, RadialGradient, Stop, Svg } from 'react-native-svg';

import { AppHeader } from '../../components/AppHeader';
import { NotificationsModal } from '../../components/modals/NotificationsModal';
import { ZoomPanCanvas } from '../../components/ZoomPanCanvas';
import { isStaffRole } from '../../constants/roles';
import { colors } from '../../constants/theme';
import { ZONE_COLORS, ZONE_LETTER, ZONE_ORDER, isBoothPlaced, isStagePlaced, zoneQuadrant } from '../../lib/boothGrid';
import { ENTRANCE_GATE_COLOR, ENTRANCE_GATE_LABEL, ENTRANCE_GATE_LINE, FLOOR_PLAN_ASPECT_RATIO } from '../../lib/floorPlanGrid';
import { useLiveDensityGrid } from '../../lib/useLiveDensity';
import { DEFAULT_WALL_THICKNESS, findRoute, type RouteObstacle, type RoutePoint } from '../../lib/routePlanner';
import { useCurrentProfile } from '../../lib/useCurrentProfile';
import { useIsAdmin } from '../../lib/useIsAdmin';
import { useVenueMap } from '../../lib/useVenueMap';
import { WATER_STATION_STATUS_LABEL_KEY, useReportWaterStationEmpty, useWaterStations } from '../../lib/useWaterStations';
import { densityColor, heatBlobsFromGrid } from '../../lib/zoneDensity';

// Stant ve sahnelerin krokideki yaklaşık "ayak izi" — rota hesaplanırken bu
// yarıçap kadar alan etraflarından dolanılıyor (bkz. lib/routePlanner.ts).
const BOOTH_OBSTACLE_RADIUS = 4;
const STAGE_OBSTACLE_RADIUS = 6;

type LocationEntry = {
  key: string;
  type: 'booth' | 'stage';
  label: string;
  sublabel: string;
  x: number;
  y: number;
};

function LayerToggle({
  active,
  label,
  onPress,
}: {
  active: boolean;
  label: string;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="checkbox"
      accessibilityState={{ checked: active }}
      onPress={onPress}
      style={styles.layerToggle}
    >
      <View style={[styles.checkbox, active && styles.checkboxActive]}>
        {active ? <Check size={10} strokeWidth={3} color={colors.white} /> : null}
      </View>
      <Text style={styles.layerToggleText}>{label}</Text>
    </Pressable>
  );
}

// Rota bul panelindeki "Başlangıç"/"Bitiş" seçicilerinin ikisi de bu modalı
// açıyor — arama kutusuyla filtrelenen tek bir stant + sahne listesi.
function LocationPickerModal({
  visible,
  locations,
  onSelect,
  onClose,
  t,
}: {
  visible: boolean;
  locations: LocationEntry[];
  onSelect: (location: LocationEntry) => void;
  onClose: () => void;
  t: (key: string) => string;
}) {
  const [search, setSearch] = useState('');

  useEffect(() => {
    if (visible) setSearch('');
  }, [visible]);

  const needle = search.trim().toLocaleLowerCase('tr');
  const filtered = needle
    ? locations.filter(
        (item) =>
          item.label.toLocaleLowerCase('tr').includes(needle) ||
          item.sublabel.toLocaleLowerCase('tr').includes(needle),
      )
    : locations;
  const booths = filtered.filter((item) => item.type === 'booth');
  const stages = filtered.filter((item) => item.type === 'stage');

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={pickerStyles.overlay}>
        <View style={pickerStyles.card}>
          <View style={pickerStyles.header}>
            <View style={pickerStyles.searchBox}>
              <Search size={15} color={colors.textMuted} />
              <TextInput
                style={pickerStyles.searchInput}
                value={search}
                onChangeText={setSearch}
                placeholder={t('map.pickerSearchPlaceholder')}
                placeholderTextColor={colors.textFaint}
                autoFocus
              />
            </View>
            <Pressable onPress={onClose} hitSlop={8} style={pickerStyles.closeBtn}>
              <X size={19} color={colors.textMuted} />
            </Pressable>
          </View>

          <ScrollView contentContainerStyle={pickerStyles.list}>
            {!filtered.length ? <Text style={pickerStyles.empty}>{t('map.pickerEmpty')}</Text> : null}

            {booths.length ? (
              <>
                <Text style={pickerStyles.sectionHeader}>{t('map.pickerBoothsHeader')}</Text>
                {booths.map((item) => (
                  <Pressable key={item.key} style={pickerStyles.row} onPress={() => onSelect(item)}>
                    <Store size={15} color={colors.primary} />
                    <View style={pickerStyles.rowCopy}>
                      <Text style={pickerStyles.rowLabel}>{item.label}</Text>
                      <Text style={pickerStyles.rowSublabel} numberOfLines={1}>
                        {item.sublabel}
                      </Text>
                    </View>
                  </Pressable>
                ))}
              </>
            ) : null}

            {stages.length ? (
              <>
                <Text style={pickerStyles.sectionHeader}>{t('map.pickerStagesHeader')}</Text>
                {stages.map((item) => (
                  <Pressable key={item.key} style={pickerStyles.row} onPress={() => onSelect(item)}>
                    <Radio size={15} color={colors.primary} />
                    <View style={pickerStyles.rowCopy}>
                      <Text style={pickerStyles.rowLabel}>{item.label}</Text>
                      <Text style={pickerStyles.rowSublabel} numberOfLines={1}>
                        {item.sublabel}
                      </Text>
                    </View>
                  </Pressable>
                ))}
              </>
            ) : null}
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

export default function MapScreen() {
  const { t } = useTranslation();
  const params = useLocalSearchParams<{ locationName?: string }>();
  const { data: meResult } = useCurrentProfile();
  const { data, isLoading } = useVenueMap();
  const { data: waterStations = [] } = useWaterStations();
  // Yoğunluk ısı haritası — admin bir "Harita Merkezi" ayarladıysa (bkz.
  // data.venueCenterLat), krokide kırmızı(yoğun)-yeşil(az yoğun) bir katman
  // olarak gösteriliyor. Ham konum/kimlik bilgisi hiçbir zaman istemciye
  // gelmiyor, sadece özetlenmiş ızgara hücreleri (bkz. lib/useLiveDensity.ts).
  const { data: densityCells = [] } = useLiveDensityGrid();
  const heatBlobs = useMemo(() => heatBlobsFromGrid(densityCells), [densityCells]);
  const { data: isAdmin } = useIsAdmin();
  const isStaff = isStaffRole(meResult?.profile?.role);
  const canManageWater = isStaff || !!isAdmin;
  const reportWaterEmpty = useReportWaterStationEmpty();

  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [layers, setLayers] = useState({ booths: true, stages: true, water: true });
  const [selectedKey, setSelectedKey] = useState<string | null>(null);
  const [routeStartKey, setRouteStartKey] = useState<string | null>(null);
  const [routeEndKey, setRouteEndKey] = useState<string | null>(null);
  const [routePoints, setRoutePoints] = useState<RoutePoint[] | null>(null);
  const [routeError, setRouteError] = useState<string | null>(null);
  const [pickerFor, setPickerFor] = useState<'start' | 'end' | null>(null);

  const locations = useMemo<LocationEntry[]>(() => {
    if (!data) return [];
    const boothEntries: LocationEntry[] = data.booths.filter(isBoothPlaced).map((booth) => ({
      key: `booth:${booth.id}`,
      type: 'booth' as const,
      label: booth.boothNo,
      sublabel: booth.companyName,
      x: booth.mapX,
      y: booth.mapY,
    }));
    const stageEntries: LocationEntry[] = data.stages.filter(isStagePlaced).map((stage) => ({
      key: `stage:${stage.id}`,
      type: 'stage' as const,
      label: stage.name,
      sublabel: stage.type,
      x: stage.mapX,
      y: stage.mapY,
    }));
    return [...boothEntries, ...stageEntries];
  }, [data]);

  const locationByKey = useMemo(() => new Map(locations.map((item) => [item.key, item])), [locations]);
  const selected = selectedKey ? locationByKey.get(selectedKey) || null : null;
  const selectedBooth =
    selected?.type === 'booth' ? data?.booths.find((booth) => `booth:${booth.id}` === selected.key) : undefined;
  const selectedStage =
    selected?.type === 'stage' ? data?.stages.find((stage) => `stage:${stage.id}` === selected.key) : undefined;
  const selectedWaterStation = selectedKey?.startsWith('water:')
    ? waterStations.find((station) => `water:${station.id}` === selectedKey)
    : undefined;

  // Bir oturumun konumuna ("location" metnine) en yakın gerçek sahneyi
  // bulup otomatik seçiyor — bkz. app/(tabs)/home.tsx > goToMap.
  useEffect(() => {
    if (!params.locationName || !data) return;
    const needle = params.locationName.toLocaleLowerCase('tr');
    const stage = data.stages.filter(isStagePlaced).find(
      (item) =>
        item.name.toLocaleLowerCase('tr').includes(needle) ||
        needle.includes(item.name.toLocaleLowerCase('tr')),
    );
    if (stage) setSelectedKey(`stage:${stage.id}`);
  }, [params.locationName, data]);

  function toggleLayer(key: 'booths' | 'stages' | 'water') {
    setLayers((current) => ({ ...current, [key]: !current[key] }));
  }

  function selectLocation(key: string) {
    setSelectedKey(key);
  }

  function handlePickerSelect(location: LocationEntry) {
    if (pickerFor === 'start') setRouteStartKey(location.key);
    else if (pickerFor === 'end') setRouteEndKey(location.key);
    setPickerFor(null);
    setRouteError(null);
  }

  function buildRoute() {
    const start = routeStartKey ? locationByKey.get(routeStartKey) : null;
    const end = routeEndKey ? locationByKey.get(routeEndKey) : null;
    if (!start || !end) {
      setRouteError(t('map.routeMissingError'));
      return;
    }
    if (start.key === end.key) {
      setRouteError(t('map.routeSameError'));
      return;
    }
    const boothStageObstacles: RouteObstacle[] = locations
      .filter((item) => item.key !== start.key && item.key !== end.key)
      .map((item) => ({
        kind: 'circle',
        id: item.key,
        x: item.x,
        y: item.y,
        radius: item.type === 'stage' ? STAGE_OBSTACLE_RADIUS : BOOTH_OBSTACLE_RADIUS,
      }));
    // Admin'in krokiye elle çizdiği duvarlar — her kroki fotoğrafı farklı
    // olduğu için otomatik tespit edilmiyor, admin'in kendi işaretlediği
    // çizgiler kullanılıyor (bkz. AdminMapManagement.tsx > duvar çizme modu).
    const wallObstacles: RouteObstacle[] = (data?.floorPlanWalls || []).map((wall) => ({
      kind: 'wall',
      id: wall.id,
      x1: wall.x1,
      y1: wall.y1,
      x2: wall.x2,
      y2: wall.y2,
      thickness: DEFAULT_WALL_THICKNESS,
    }));
    const path = findRoute(
      { x: start.x, y: start.y },
      { x: end.x, y: end.y },
      [...boothStageObstacles, ...wallObstacles],
    );
    if (!path) {
      setRoutePoints(null);
      setRouteError(t('map.routeNotFound'));
      return;
    }
    setRoutePoints(path);
    setRouteError(null);
  }

  function clearRoute() {
    setRoutePoints(null);
    setRouteError(null);
    setRouteStartKey(null);
    setRouteEndKey(null);
  }

  return (
    <View style={styles.screen}>
      <AppHeader
        activeTab="harita"
        profile={meResult?.profile}
        onOpenNotifications={() => setNotificationsOpen(true)}
      />
      <ScrollView contentContainerStyle={styles.content}>
        <View>
          <Text style={styles.title}>{t('map.title')}</Text>
          <Text style={styles.subtitle}>{t('map.subtitle')}</Text>
        </View>

        <View style={styles.layerBar}>
          <LayerToggle
            active={layers.booths}
            label={`${t('map.layerBooths')} (${data?.booths.filter(isBoothPlaced).length || 0})`}
            onPress={() => toggleLayer('booths')}
          />
          <LayerToggle
            active={layers.stages}
            label={`${t('map.layerStages')} (${data?.stages.filter(isStagePlaced).length || 0})`}
            onPress={() => toggleLayer('stages')}
          />
          <LayerToggle
            active={layers.water}
            label={`${t('map.layerWaterStations')} (${waterStations.length})`}
            onPress={() => toggleLayer('water')}
          />
        </View>

        <View style={styles.mapCard}>
          {isLoading ? (
            <View style={styles.mapLoading}>
              <ActivityIndicator color={colors.primary} />
            </View>
          ) : (
            <ZoomPanCanvas aspectRatio={FLOOR_PLAN_ASPECT_RATIO}>
              <View style={styles.mapCanvas}>
                <View pointerEvents="none" style={styles.centerDividerV} />
                <View pointerEvents="none" style={styles.centerDividerH} />

                {/* Yoğunluk ısı haritası — bkz. lib/zoneDensity.ts. Admin
                    tarafındaki (AdminMapManagement.tsx) katmanla birebir
                    aynı render mantığı: üst üste binen yarı saydam radyal
                    gradyan daireler tek bir yumuşak leke gibi görünüyor. */}
                {data?.venueCenterLat != null && heatBlobs.length ? (
                  <Svg pointerEvents="none" style={StyleSheet.absoluteFill} viewBox="0 0 100 100" preserveAspectRatio="none">
                    <Defs>
                      {heatBlobs.map((blob, index) => {
                        const color = densityColor(blob.intensity);
                        return (
                          <RadialGradient key={`heat-grad-${index}`} id={`heatGrad-${index}`} cx="50%" cy="50%" r="50%">
                            <Stop offset="0%" stopColor={color} stopOpacity={0.55} />
                            <Stop offset="100%" stopColor={color} stopOpacity={0} />
                          </RadialGradient>
                        );
                      })}
                    </Defs>
                    {heatBlobs.map((blob, index) => (
                      <Circle key={`heat-${index}`} cx={blob.x} cy={blob.y} r={11} fill={`url(#heatGrad-${index})`} />
                    ))}
                  </Svg>
                ) : null}

                {ZONE_ORDER.map((code) => {
                  const { right, bottom } = zoneQuadrant(code);
                  return (
                    <View
                      key={code}
                      pointerEvents="none"
                      style={[
                        styles.zoneCornerTag,
                        { backgroundColor: ZONE_COLORS[code] },
                        right ? { right: 8 } : { left: 8 },
                        bottom ? { bottom: 8 } : { top: 8 },
                      ]}
                    >
                      <Text style={styles.zoneCornerTagText}>{ZONE_LETTER[code]}</Text>
                    </View>
                  );
                })}

                {data?.floorPlanWalls?.length ? (
                  <Svg pointerEvents="none" style={StyleSheet.absoluteFill} viewBox="0 0 100 100" preserveAspectRatio="none">
                    {data.floorPlanWalls.map((wall) => (
                      <Line
                        key={wall.id}
                        x1={wall.x1}
                        y1={wall.y1}
                        x2={wall.x2}
                        y2={wall.y2}
                        stroke="rgba(15,23,42,0.55)"
                        strokeWidth={DEFAULT_WALL_THICKNESS}
                        strokeLinecap="round"
                      />
                    ))}
                  </Svg>
                ) : null}

                {/* Sabit "giriş kapısı" işareti — admin tarafından taşınamaz/silinemez,
                    krokinin her zaman aynı yerinde duran görsel bir referans (bkz.
                    lib/floorPlanGrid.ts > ENTRANCE_GATE_LINE). Rota bulmaya dahil değil. */}
                <Svg pointerEvents="none" style={StyleSheet.absoluteFill} viewBox="0 0 100 100" preserveAspectRatio="none">
                  <Line
                    x1={ENTRANCE_GATE_LINE.x1}
                    y1={ENTRANCE_GATE_LINE.y1}
                    x2={ENTRANCE_GATE_LINE.x2}
                    y2={ENTRANCE_GATE_LINE.y2}
                    stroke={ENTRANCE_GATE_COLOR}
                    strokeWidth={2.2}
                    strokeLinecap="round"
                  />
                </Svg>
                <View pointerEvents="none" style={styles.entranceLabel}>
                  <Text style={styles.entranceLabelText}>{ENTRANCE_GATE_LABEL}</Text>
                </View>

                {routePoints && routePoints.length > 1 ? (
                  <Svg pointerEvents="none" style={StyleSheet.absoluteFill} viewBox="0 0 100 100" preserveAspectRatio="none">
                    <Polyline
                      points={routePoints.map((point) => `${point.x},${point.y}`).join(' ')}
                      fill="none"
                      stroke={colors.primary}
                      strokeWidth={1.4}
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeDasharray="4,3"
                    />
                    <Circle
                      cx={routePoints[0].x}
                      cy={routePoints[0].y}
                      r={2.4}
                      fill={colors.success}
                      stroke={colors.white}
                      strokeWidth={0.7}
                    />
                    <Circle
                      cx={routePoints[routePoints.length - 1].x}
                      cy={routePoints[routePoints.length - 1].y}
                      r={2.4}
                      fill={colors.danger}
                      stroke={colors.white}
                      strokeWidth={0.7}
                    />
                  </Svg>
                ) : null}

                {layers.booths
                  ? data?.booths
                      .filter(isBoothPlaced)
                      .map((booth) => {
                        const key = `booth:${booth.id}`;
                        const active = selectedKey === key;
                        const isRouteStart = routeStartKey === key;
                        const isRouteEnd = routeEndKey === key;
                        return (
                          <Pressable
                            key={key}
                            onPress={() => selectLocation(key)}
                            style={[
                              styles.boothPin,
                              { left: `${booth.mapX}%`, top: `${booth.mapY}%` },
                              active && styles.boothPinSelected,
                              isRouteStart && styles.pinRouteStart,
                              isRouteEnd && styles.pinRouteEnd,
                            ]}
                          >
                            <View style={[styles.boothPulse, { backgroundColor: ZONE_COLORS[booth.zone!] }]} />
                            <Text style={styles.boothPinText} numberOfLines={1}>
                              {booth.boothNo}
                            </Text>
                          </Pressable>
                        );
                      })
                  : null}

                {layers.stages
                  ? data?.stages.filter(isStagePlaced).map((stage) => {
                      const key = `stage:${stage.id}`;
                      const active = selectedKey === key;
                      const isRouteStart = routeStartKey === key;
                      const isRouteEnd = routeEndKey === key;
                      return (
                        <Pressable
                          key={key}
                          onPress={() => selectLocation(key)}
                          style={[
                            styles.stagePin,
                            { left: `${stage.mapX}%`, top: `${stage.mapY}%` },
                            active && styles.stagePinSelected,
                            isRouteStart && styles.pinRouteStart,
                            isRouteEnd && styles.pinRouteEnd,
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

                {layers.water
                  ? waterStations.map((station) => {
                      const key = `water:${station.id}`;
                      const active = selectedKey === key;
                      return (
                        <Pressable
                          key={key}
                          onPress={() => selectLocation(key)}
                          style={[
                            styles.waterPin,
                            { left: `${station.map_x}%`, top: `${station.map_y}%` },
                            active && styles.waterPinSelected,
                            station.status !== 'active' && styles.waterPinAlert,
                          ]}
                        >
                          <Droplet size={12} color={colors.white} />
                        </Pressable>
                      );
                    })
                  : null}
              </View>
            </ZoomPanCanvas>
          )}
        </View>

        {selectedBooth ? (
          <View style={styles.detailCard}>
            <View style={styles.detailHeaderRow}>
              <Text style={styles.detailTag}>{t('map.boothTag')}</Text>
              <Text style={styles.detailBoothNo}>{selectedBooth.boothNo}</Text>
            </View>
            <Text style={styles.detailTitle}>{selectedBooth.companyName}</Text>
            <Text style={styles.detailCategory}>{selectedBooth.category}</Text>
            {selectedBooth.description ? (
              <Text style={styles.detailDesc}>{selectedBooth.description}</Text>
            ) : null}
            <View style={styles.detailActions}>
              <Pressable
                style={styles.detailActionBtn}
                onPress={() => {
                  setRouteStartKey(`booth:${selectedBooth.id}`);
                  setRouteError(null);
                }}
              >
                <Navigation size={14} color={colors.primary} />
                <Text style={styles.detailActionText}>{t('map.routeSetStart')}</Text>
              </Pressable>
              <Pressable
                style={styles.detailActionBtn}
                onPress={() => {
                  setRouteEndKey(`booth:${selectedBooth.id}`);
                  setRouteError(null);
                }}
              >
                <MapPin size={14} color={colors.primary} />
                <Text style={styles.detailActionText}>{t('map.routeSetEnd')}</Text>
              </Pressable>
            </View>
          </View>
        ) : selectedStage ? (
          <View style={styles.detailCard}>
            <View style={styles.detailHeaderRow}>
              <Text style={styles.detailTag}>{t('map.stageTag')}</Text>
            </View>
            <Text style={styles.detailTitle}>{selectedStage.name}</Text>
            <Text style={styles.detailCategory}>{selectedStage.type}</Text>
            {selectedStage.description ? (
              <Text style={styles.detailDesc}>{selectedStage.description}</Text>
            ) : null}
            <View style={styles.detailActions}>
              <Pressable
                style={styles.detailActionBtn}
                onPress={() => {
                  setRouteStartKey(`stage:${selectedStage.id}`);
                  setRouteError(null);
                }}
              >
                <Navigation size={14} color={colors.primary} />
                <Text style={styles.detailActionText}>{t('map.routeSetStart')}</Text>
              </Pressable>
              <Pressable
                style={styles.detailActionBtn}
                onPress={() => {
                  setRouteEndKey(`stage:${selectedStage.id}`);
                  setRouteError(null);
                }}
              >
                <MapPin size={14} color={colors.primary} />
                <Text style={styles.detailActionText}>{t('map.routeSetEnd')}</Text>
              </Pressable>
            </View>
          </View>
        ) : selectedWaterStation ? (
          <View style={styles.detailCard}>
            <View style={styles.detailHeaderRow}>
              <Text style={styles.detailTag}>{t('map.waterStationTag')}</Text>
              <Text
                style={[
                  styles.detailBoothNo,
                  selectedWaterStation.status !== 'active' && styles.waterStatusAlertText,
                ]}
              >
                {t(WATER_STATION_STATUS_LABEL_KEY[selectedWaterStation.status])}
              </Text>
            </View>
            <Text style={styles.detailTitle}>{selectedWaterStation.name}</Text>
            {canManageWater && selectedWaterStation.status === 'active' ? (
              <Pressable
                style={styles.waterReportBtn}
                disabled={reportWaterEmpty.isPending}
                onPress={() => reportWaterEmpty.mutate(selectedWaterStation.id)}
              >
                {reportWaterEmpty.isPending ? (
                  <ActivityIndicator size="small" color={colors.white} />
                ) : (
                  <Text style={styles.waterReportBtnText}>{t('waterStations.reportEmpty')}</Text>
                )}
              </Pressable>
            ) : canManageWater ? (
              <Text style={styles.detailDesc}>{t('waterStations.alreadyReported')}</Text>
            ) : null}
          </View>
        ) : (
          <View style={styles.emptyCard}>
            <MapPin size={20} color={colors.textMuted} />
            <Text style={styles.emptyText}>{t('map.selectPin')}</Text>
          </View>
        )}

        <View style={styles.routeCard}>
          <Text style={styles.routeTitle}>{t('map.routeFinderTitle')}</Text>

          <Pressable style={styles.routeSelector} onPress={() => setPickerFor('start')}>
            <View style={[styles.routeDot, { backgroundColor: colors.success }]} />
            <View style={styles.routeSelectorCopy}>
              <Text style={styles.routeSelectorLabel}>{t('map.routeStart')}</Text>
              <Text style={styles.routeSelectorValue} numberOfLines={1}>
                {routeStartKey
                  ? locationByKey.get(routeStartKey)?.label
                  : t('map.routeStartPlaceholder')}
              </Text>
            </View>
          </Pressable>

          <Pressable style={styles.routeSelector} onPress={() => setPickerFor('end')}>
            <View style={[styles.routeDot, { backgroundColor: colors.danger }]} />
            <View style={styles.routeSelectorCopy}>
              <Text style={styles.routeSelectorLabel}>{t('map.routeEnd')}</Text>
              <Text style={styles.routeSelectorValue} numberOfLines={1}>
                {routeEndKey ? locationByKey.get(routeEndKey)?.label : t('map.routeEndPlaceholder')}
              </Text>
            </View>
          </Pressable>

          {routeError ? <Text style={styles.routeErrorText}>{routeError}</Text> : null}
          {!routeError && routePoints ? <Text style={styles.routeSuccessText}>{t('map.routeFound')}</Text> : null}

          <View style={styles.routeButtonsRow}>
            <Pressable style={styles.routeBuildBtn} onPress={buildRoute}>
              <Navigation size={15} color={colors.white} />
              <Text style={styles.routeBuildBtnText}>{t('map.routeBuild')}</Text>
            </Pressable>
            {routePoints || routeStartKey || routeEndKey ? (
              <Pressable style={styles.routeClearBtn} onPress={clearRoute}>
                <X size={14} color={colors.textMuted} />
                <Text style={styles.routeClearBtnText}>{t('map.routeClear')}</Text>
              </Pressable>
            ) : null}
          </View>
        </View>
      </ScrollView>

      <LocationPickerModal
        visible={pickerFor != null}
        locations={locations}
        onSelect={handlePickerSelect}
        onClose={() => setPickerFor(null)}
        t={t}
      />

      <NotificationsModal visible={notificationsOpen} onClose={() => setNotificationsOpen(false)} />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  content: { padding: 16, paddingBottom: 32, gap: 14 },
  title: { fontSize: 22, fontWeight: '800', color: colors.text },
  subtitle: { fontSize: 12, color: colors.textMuted, marginTop: 2 },
  layerBar: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  layerToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 10,
    backgroundColor: colors.surface,
  },
  layerToggleText: { color: colors.textMuted, fontSize: 11, fontWeight: '700' },
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
  mapCard: {
    borderRadius: 18,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  mapLoading: {
    height: 300,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.surfaceMuted,
  },
  mapCanvas: {
    // Konumlandırması artık ZoomPanCanvas'ın (bkz. components/ZoomPanCanvas.tsx)
    // içindeki dönüştürülebilir katmanı tam olarak dolduruyor — en-boy oranı
    // (bkz. lib/floorPlanGrid.ts > FLOOR_PLAN_ASPECT_RATIO) o sarmalayıcıda
    // tanımlı, admin ekranıyla (AdminMapManagement.tsx) birebir aynı oran
    // kullanılıyor ki admin'in çizdiği duvarlar burada kaymış görünmesin.
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    // Kroki artık bir fotoğraf değil, admin'in çizdiği bir plan — beyaz/açık
    // "kağıt" zemin, admin ekranındaki görünümle tutarlı.
    backgroundColor: '#ffffff',
  },
  centerDividerV: {
    position: 'absolute',
    left: '50%',
    top: 0,
    bottom: 0,
    width: StyleSheet.hairlineWidth,
    backgroundColor: 'rgba(0,0,0,0.12)',
  },
  centerDividerH: {
    position: 'absolute',
    top: '50%',
    left: 0,
    right: 0,
    height: StyleSheet.hairlineWidth,
    backgroundColor: 'rgba(0,0,0,0.12)',
  },
  zoneCornerTag: {
    position: 'absolute',
    width: 24,
    height: 24,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
    borderColor: colors.white,
  },
  zoneCornerTagText: { color: colors.white, fontSize: 11, fontWeight: '900' },
  entranceLabel: {
    position: 'absolute',
    left: '50%',
    top: '99%',
    transform: [{ translateX: -22 }, { translateY: -16 }],
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 5,
    backgroundColor: '#16a34a',
  },
  entranceLabelText: { color: colors.white, fontSize: 8, fontWeight: '900', letterSpacing: 0.4 },
  boothPin: {
    position: 'absolute',
    zIndex: 4,
    maxWidth: 120,
    minHeight: 24,
    transform: [{ translateX: -10 }, { translateY: -12 }],
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderWidth: 1,
    borderColor: '#64748b',
    borderRadius: 8,
    backgroundColor: 'rgba(15,23,42,0.92)',
  },
  boothPinSelected: {
    borderColor: colors.white,
    transform: [{ translateX: -10 }, { translateY: -12 }, { scale: 1.08 }],
  },
  boothPulse: { width: 7, height: 7, borderRadius: 4 },
  boothPinText: { flexShrink: 1, color: colors.white, fontSize: 8, fontWeight: '900' },
  stagePin: {
    position: 'absolute',
    zIndex: 4,
    maxWidth: 140,
    minHeight: 26,
    transform: [{ translateX: -12 }, { translateY: -13 }],
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderWidth: 1,
    borderColor: '#64748b',
    borderRadius: 9,
    backgroundColor: 'rgba(15,23,42,0.92)',
  },
  stagePinSelected: {
    borderColor: colors.primary,
    transform: [{ translateX: -12 }, { translateY: -13 }, { scale: 1.08 }],
  },
  stagePulse: { width: 7, height: 7, borderRadius: 4, backgroundColor: '#34d399' },
  stagePinText: { flexShrink: 1, color: colors.white, fontSize: 8, fontWeight: '800' },
  pinRouteStart: { borderColor: colors.success, borderWidth: 2 },
  pinRouteEnd: { borderColor: colors.danger, borderWidth: 2 },
  waterPin: {
    position: 'absolute',
    zIndex: 5,
    width: 22,
    height: 22,
    transform: [{ translateX: -11 }, { translateY: -11 }],
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 11,
    borderWidth: 1.5,
    borderColor: colors.white,
    backgroundColor: '#0ea5e9',
  },
  waterPinSelected: { transform: [{ translateX: -11 }, { translateY: -11 }, { scale: 1.15 }] },
  waterPinAlert: { backgroundColor: colors.danger },
  waterReportBtn: {
    marginTop: 8,
    minHeight: 40,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 10,
    backgroundColor: colors.danger,
  },
  waterReportBtnText: { color: colors.white, fontSize: 12, fontWeight: '800' },
  waterStatusAlertText: { color: colors.danger },
  detailCard: {
    backgroundColor: colors.surface,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 14,
    gap: 6,
  },
  detailHeaderRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  detailTag: {
    color: colors.primary,
    fontSize: 9,
    fontWeight: '900',
    letterSpacing: 0.6,
    textTransform: 'uppercase',
  },
  detailBoothNo: {
    color: colors.text,
    fontSize: 10,
    fontWeight: '900',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    backgroundColor: colors.surfaceMuted,
  },
  detailTitle: { fontSize: 15, fontWeight: '800', color: colors.text },
  detailCategory: { fontSize: 11, color: colors.textMuted },
  detailDesc: { fontSize: 12, color: colors.textMuted, lineHeight: 17, marginTop: 2 },
  detailActions: { flexDirection: 'row', gap: 8, marginTop: 6 },
  detailActionBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    minHeight: 38,
    borderWidth: 1,
    borderColor: colors.primary,
    borderRadius: 10,
    backgroundColor: colors.primarySoft,
  },
  detailActionText: { color: colors.primary, fontSize: 11, fontWeight: '800' },
  emptyCard: {
    alignItems: 'center',
    gap: 8,
    padding: 22,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 16,
    backgroundColor: colors.surface,
  },
  emptyText: { maxWidth: 280, color: colors.textMuted, fontSize: 12, lineHeight: 17, textAlign: 'center' },
  routeCard: {
    gap: 10,
    padding: 14,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 16,
    backgroundColor: colors.surface,
  },
  routeTitle: { fontSize: 13, fontWeight: '900', color: colors.text },
  routeSelector: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    minHeight: 48,
    paddingHorizontal: 12,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 12,
    backgroundColor: colors.background,
  },
  routeDot: { width: 10, height: 10, borderRadius: 5 },
  routeSelectorCopy: { flex: 1, minWidth: 0 },
  routeSelectorLabel: { color: colors.textFaint, fontSize: 9, fontWeight: '800', textTransform: 'uppercase' },
  routeSelectorValue: { color: colors.text, fontSize: 13, fontWeight: '700', marginTop: 1 },
  routeErrorText: {
    color: colors.danger,
    backgroundColor: colors.dangerBg,
    borderWidth: 1,
    borderColor: colors.dangerBorder,
    borderRadius: 10,
    padding: 9,
    fontSize: 11,
  },
  routeSuccessText: {
    color: colors.success,
    backgroundColor: colors.successBg,
    borderWidth: 1,
    borderColor: colors.successBorder,
    borderRadius: 10,
    padding: 9,
    fontSize: 11,
  },
  routeButtonsRow: { flexDirection: 'row', gap: 8 },
  routeBuildBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    minHeight: 44,
    borderRadius: 12,
    backgroundColor: colors.primary,
  },
  routeBuildBtnText: { color: colors.white, fontSize: 12, fontWeight: '900' },
  routeClearBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    minHeight: 44,
    paddingHorizontal: 14,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
  },
  routeClearBtnText: { color: colors.textMuted, fontSize: 11, fontWeight: '800' },
});

const pickerStyles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(15,23,42,0.5)',
    justifyContent: 'flex-end',
  },
  card: {
    maxHeight: '80%',
    backgroundColor: colors.white,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    overflow: 'hidden',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    padding: 14,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  searchBox: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    height: 42,
    paddingHorizontal: 12,
    borderRadius: 11,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.background,
  },
  searchInput: { flex: 1, fontSize: 13, color: colors.text },
  closeBtn: {
    width: 34,
    height: 34,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 17,
    backgroundColor: colors.surfaceMuted,
  },
  list: { padding: 14, gap: 4, paddingBottom: 28 },
  empty: { textAlign: 'center', color: colors.textFaint, fontSize: 12, paddingVertical: 20 },
  sectionHeader: {
    color: colors.textFaint,
    fontSize: 10,
    fontWeight: '900',
    letterSpacing: 0.6,
    textTransform: 'uppercase',
    marginTop: 10,
    marginBottom: 4,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    minHeight: 48,
    paddingHorizontal: 8,
    borderRadius: 10,
  },
  rowCopy: { flex: 1, minWidth: 0 },
  rowLabel: { color: colors.text, fontSize: 13, fontWeight: '800' },
  rowSublabel: { color: colors.textMuted, fontSize: 11, marginTop: 1 },
});
