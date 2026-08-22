import { useLocalSearchParams } from 'expo-router';
import { Building2, Coffee, MapPin, Navigation, Presentation } from 'lucide-react-native';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import Svg, { Polygon, Rect } from 'react-native-svg';

import { AppHeader } from '../../components/AppHeader';
import { NotificationsModal } from '../../components/modals/NotificationsModal';
import { colors } from '../../constants/theme';
import { venuePoints } from '../../constants/venuePoints';
import { useCurrentProfile } from '../../lib/useCurrentProfile';
import type { VenuePoint } from '../../types';

const MAP_WIDTH = 340;
const MAP_HEIGHT = 300;

const DENSITY_COLORS: Record<VenuePoint['density'], string> = {
  Sakin: colors.success,
  Normal: '#b06000',
  Yoğun: colors.danger,
};

function pinIcon(type: VenuePoint['type']) {
  if (type === 'stage') return Presentation;
  if (type === 'food') return Coffee;
  return Building2;
}

function pinColor(type: VenuePoint['type']) {
  if (type === 'stage') return colors.primary;
  if (type === 'food') return colors.accent;
  return colors.secondary;
}

export default function MapScreen() {
  const { t } = useTranslation();
  const params = useLocalSearchParams<{ locationId?: string }>();
  const { data: meResult } = useCurrentProfile();

  const [floor, setFloor] = useState<1 | 2>(1);
  const [filter, setFilter] = useState<'all' | 'stage' | 'food' | 'service'>('all');
  const [selected, setSelected] = useState<VenuePoint | null>(venuePoints[0] ?? null);
  const [notificationsOpen, setNotificationsOpen] = useState(false);

  useEffect(() => {
    if (params.locationId) {
      const found = venuePoints.find((p) => p.id === params.locationId);
      if (found) {
        setSelected(found);
        setFloor(found.floor);
      }
    }
  }, [params.locationId]);

  const visiblePoints = venuePoints.filter((p) => {
    if (p.floor !== floor) return false;
    if (filter === 'all') return true;
    if (filter === 'stage') return p.type === 'stage';
    if (filter === 'food') return p.type === 'food';
    return p.type === 'service' || p.type === 'networking';
  });

  const filters: { id: typeof filter; label: string }[] = [
    { id: 'all', label: t('map.filterAll') },
    { id: 'stage', label: t('map.filterStage') },
    { id: 'food', label: t('map.filterFood') },
    { id: 'service', label: t('map.filterService') },
  ];

  const densityPosition = selected
    ? selected.density === 'Sakin'
      ? '15%'
      : selected.density === 'Normal'
        ? '50%'
        : '85%'
    : '50%';

  return (
    <View style={styles.screen}>
      <AppHeader
        activeTab="harita"
        profile={meResult?.profile}
        onOpenNotifications={() => setNotificationsOpen(true)}
      />
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.titleRow}>
          <View style={{ flex: 1 }}>
            <Text style={styles.title}>{t('map.title')}</Text>
            <Text style={styles.subtitle}>{t('map.subtitle')}</Text>
          </View>
          <View style={styles.floorSwitch}>
            <Pressable
              style={[styles.floorBtn, floor === 1 && styles.floorBtnActive]}
              onPress={() => setFloor(1)}
            >
              <Text style={[styles.floorBtnText, floor === 1 && styles.floorBtnTextActive]}>1</Text>
            </Pressable>
            <Pressable
              style={[styles.floorBtn, floor === 2 && styles.floorBtnActive]}
              onPress={() => setFloor(2)}
            >
              <Text style={[styles.floorBtnText, floor === 2 && styles.floorBtnTextActive]}>2</Text>
            </Pressable>
          </View>
        </View>

        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
          {filters.map((f) => {
            const selectedFilter = filter === f.id;
            return (
              <Pressable
                key={f.id}
                onPress={() => setFilter(f.id)}
                style={[styles.filterChip, selectedFilter && styles.filterChipSelected]}
              >
                <Text style={[styles.filterChipText, selectedFilter && styles.filterChipTextSelected]}>
                  {f.label}
                </Text>
              </Pressable>
            );
          })}
        </ScrollView>

        <View style={styles.mapStage}>
          <Svg width="100%" height="100%" viewBox={`0 0 ${MAP_WIDTH} ${MAP_HEIGHT}`}>
            <Rect x={0} y={0} width={MAP_WIDTH} height={MAP_HEIGHT} fill="#eef3f8" />
            {floor === 1 ? (
              <>
                <Polygon points="120,80 250,30 300,75 165,125" fill="#ffffff" stroke="#9ab6cf" strokeWidth={1.5} />
                <Polygon points="140,150 260,105 310,155 190,200" fill="#f8fafc" stroke="#cbd5e1" strokeWidth={1.5} />
                <Polygon points="45,140 130,105 155,145 75,185" fill="#ffffff" stroke="#9ab6cf" strokeWidth={1.5} />
                <Polygon points="220,190 320,155 345,195 245,235" fill="#ffffff" stroke="#9ab6cf" strokeWidth={1.5} />
                <Polygon points="80,200 175,165 210,210 115,245" fill="#ffffff" stroke="#9ab6cf" strokeWidth={1.5} />
              </>
            ) : (
              <>
                <Polygon points="90,90 220,45 255,90 130,135" fill="#ffffff" stroke="#9ab6cf" strokeWidth={1.5} />
                <Polygon points="200,115 310,75 335,115 225,160" fill="#ffffff" stroke="#9ab6cf" strokeWidth={1.5} />
              </>
            )}
          </Svg>

          {visiblePoints.map((point) => {
            const Icon = pinIcon(point.type);
            const isSelected = selected?.id === point.id;
            return (
              <Pressable
                key={point.id}
                onPress={() => setSelected(point)}
                style={[
                  styles.pin,
                  { left: `${point.x}%`, top: `${point.y}%` },
                  isSelected && { transform: [{ translateX: -18 }, { translateY: -18 }, { scale: 1.15 }] },
                ]}
              >
                <View style={[styles.pinDot, { backgroundColor: pinColor(point.type) }]}>
                  <Icon size={14} color={colors.white} />
                </View>
                <View style={[styles.pinLabel, isSelected && styles.pinLabelActive]}>
                  <Text style={[styles.pinLabelText, isSelected && { color: colors.white }]} numberOfLines={1}>
                    {point.name.split('(')[0].trim()}
                  </Text>
                </View>
              </Pressable>
            );
          })}

          <View style={styles.densityCard}>
            <View style={styles.densityHeaderRow}>
              <Text style={styles.densityTitle}>{t('map.densityTitle')}</Text>
              {selected ? (
                <Text style={[styles.densityValue, { color: DENSITY_COLORS[selected.density] }]}>
                  {selected.density}
                </Text>
              ) : null}
            </View>
            <View style={styles.densityBar}>
              <View style={[styles.densityMarker, { left: densityPosition }]} />
            </View>
          </View>
        </View>

        {selected ? (
          <View style={styles.detailCard}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              <Text style={styles.detailTitle}>{selected.name}</Text>
              <View
                style={[
                  styles.densityBadge,
                  { backgroundColor: `${DENSITY_COLORS[selected.density]}22` },
                ]}
              >
                <Text style={[styles.densityBadgeText, { color: DENSITY_COLORS[selected.density] }]}>
                  {selected.density}
                </Text>
              </View>
            </View>
            <Text style={styles.detailDesc}>{selected.description}</Text>

            {selected.currentEvent ? (
              <View style={styles.currentEventBox}>
                <MapPin size={14} color={colors.primary} />
                <View style={{ flex: 1 }}>
                  <Text style={styles.currentEventLabel}>{t('map.currentSession')}</Text>
                  <Text style={styles.currentEventText}>{selected.currentEvent}</Text>
                </View>
              </View>
            ) : null}

            <Pressable style={styles.directionsBtn}>
              <Navigation size={16} color={colors.white} />
              <Text style={styles.directionsBtnText}>{t('map.getDirections')}</Text>
            </Pressable>
          </View>
        ) : null}
      </ScrollView>

      <NotificationsModal visible={notificationsOpen} onClose={() => setNotificationsOpen(false)} />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  content: { padding: 16, paddingBottom: 32, gap: 14 },
  titleRow: { flexDirection: 'row', alignItems: 'flex-start' },
  title: { fontSize: 22, fontWeight: '800', color: colors.text },
  subtitle: { fontSize: 12, color: colors.textMuted, marginTop: 2 },
  floorSwitch: {
    flexDirection: 'row',
    backgroundColor: colors.surfaceMuted,
    borderRadius: 10,
    padding: 3,
    borderWidth: 1,
    borderColor: colors.border,
  },
  floorBtn: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 8 },
  floorBtnActive: { backgroundColor: colors.white },
  floorBtnText: { fontSize: 12, fontWeight: '700', color: colors.textMuted },
  floorBtnTextActive: { color: colors.primary },
  filterChip: {
    paddingHorizontal: 13,
    paddingVertical: 8,
    borderRadius: 999,
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: colors.border,
  },
  filterChipSelected: { backgroundColor: colors.primary, borderColor: colors.primary },
  filterChipText: { fontSize: 12, fontWeight: '700', color: colors.textMuted },
  filterChipTextSelected: { color: colors.white },
  mapStage: {
    height: 300,
    borderRadius: 18,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: '#eef3f8',
  },
  pin: {
    position: 'absolute',
    alignItems: 'center',
    width: 0,
  },
  pinDot: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: colors.white,
  },
  pinLabel: {
    marginTop: 4,
    backgroundColor: 'rgba(255,255,255,0.95)',
    borderRadius: 6,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderWidth: 1,
    borderColor: colors.border,
    maxWidth: 90,
  },
  pinLabelActive: { backgroundColor: colors.text, borderColor: colors.text },
  pinLabelText: { fontSize: 9, fontWeight: '700', color: colors.text },
  densityCard: {
    position: 'absolute',
    left: 12,
    right: 12,
    bottom: 12,
    backgroundColor: 'rgba(255,255,255,0.96)',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 12,
  },
  densityHeaderRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8 },
  densityTitle: { fontSize: 12, fontWeight: '800', color: colors.text },
  densityValue: { fontSize: 11, fontWeight: '700' },
  densityBar: {
    height: 8,
    borderRadius: 4,
    overflow: 'hidden',
    backgroundColor: '#34a853',
  },
  densityMarker: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    width: 4,
    backgroundColor: colors.white,
    borderRadius: 2,
  },
  detailCard: {
    backgroundColor: colors.white,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 16,
    gap: 10,
  },
  detailTitle: { fontSize: 16, fontWeight: '800', color: colors.text, flexShrink: 1 },
  densityBadge: { borderRadius: 999, paddingHorizontal: 8, paddingVertical: 3 },
  densityBadgeText: { fontSize: 10, fontWeight: '800' },
  detailDesc: { fontSize: 12, color: colors.textMuted, lineHeight: 18 },
  currentEventBox: {
    flexDirection: 'row',
    gap: 8,
    backgroundColor: colors.background,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 10,
  },
  currentEventLabel: { fontSize: 10, fontWeight: '800', color: colors.textFaint, textTransform: 'uppercase' },
  currentEventText: { fontSize: 12, fontWeight: '700', color: colors.text, marginTop: 2 },
  directionsBtn: {
    flexDirection: 'row',
    gap: 8,
    backgroundColor: colors.primary,
    borderRadius: 14,
    paddingVertical: 13,
    alignItems: 'center',
    justifyContent: 'center',
  },
  directionsBtnText: { color: colors.white, fontWeight: '700', fontSize: 13 },
});
