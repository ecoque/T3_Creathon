import * as Location from 'expo-location';
import {
  Activity,
  Check,
  Crosshair,
  Droplet,
  Edit3,
  Layers3,
  Maximize2,
  Move,
  PenLine,
  Plus,
  Radio,
  Share2,
  Store,
  Target,
  Trash2,
  X,
} from 'lucide-react-native';
import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import {
  ActivityIndicator,
  Image,
  Modal,
  PanResponder,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  useWindowDimensions,
  View,
  type DimensionValue,
  type GestureResponderEvent,
} from 'react-native';
import { Circle, Defs, Line, RadialGradient, Stop, Svg } from 'react-native-svg';

import { colors } from '../../constants/theme';
import {
  ZONE_COLORS,
  ZONE_LETTER,
  ZONE_ORDER,
  isBoothPlaced,
  isStagePlaced,
  shortStageLabel,
  zoneForPercent,
  zoneQuadrant,
} from '../../lib/boothGrid';
import { useAdminStore } from '../../lib/adminDbStore';
import {
  ENTRANCE_GATE_COLOR,
  ENTRANCE_GATE_LABEL,
  ENTRANCE_GATE_LINE,
  FLOOR_PLAN_ASPECT_RATIO,
  GRID_COLS,
  GRID_ROWS,
  snapToGrid,
} from '../../lib/floorPlanGrid';
import { buildKrokiHtml } from '../../lib/krokiExport';
import { useLiveDensityGrid } from '../../lib/useLiveDensity';
import { useCreateWaterStation, useUpdateWaterStationPosition, useWaterStations } from '../../lib/useWaterStations';
import { densityColor, distanceFromVenueCenterMeters, heatBlobsFromGrid } from '../../lib/zoneDensity';
import type { AdminBooth, AdminStage, EventSettings, FloorPlanWall, ZoneDensityInfo } from '../../types/admin';

// Yerleştirilmemiş bir stant/alanı krokiye ilk getirişte atanan varsayılan
// nokta — admin bir sonraki adımda etiketi sürükleyip gerçek yerine taşıyor
// (bkz. bringBoothToMap/bringStageToMap). Krokinin tam ortası, hangi
// yöne sürükleneceği belli olmadığı için nötr bir başlangıç noktası.
const DEFAULT_PLACEMENT = { x: 50, y: 50 };

// Stant/sahne/su sebili sürükleme artık duvar çizimiyle aynı "önce taslak,
// sonra toplu kaydet" desenini izliyor (bkz. pendingPositions state'i) —
// admin krokide istediği kadar öğeyi sürükleyip taşıyabiliyor, hiçbiri anında
// Supabase'e yazılmıyor; en sonda tek bir "Konumları Kaydet" ile hepsi aynı
// anda kaydediliyor. `kind`, kaydederken hangi API'nin (placeBooth /
// updateStagePosition / su sebili mutation'ı) çağrılacağını belirliyor.
type PendingPositionEntry = { kind: 'booth' | 'stage' | 'water'; id: string; x: number; y: number };

type LayerKey = 'booths' | 'stages' | 'zones';

type Props = {
  stages: AdminStage[];
  booths: AdminBooth[];
  zones: ZoneDensityInfo[];
  settings: EventSettings;
  selectedBoothIdFromNav?: string | null;
  selectedStageIdFromNav?: string | null;
  onSelectBooth?: (boothId: string) => void;
  onSelectStage?: (stageId: string) => void;
  onOpenEditBooth: (booth: AdminBooth) => void;
  onDeleteBooth: (booth: AdminBooth) => void;
  onNotify?: (message: string) => void;
};

// Yoğunluk seviyesine göre renk skalası: yeşilden kırmızıya doğru ilerleyen bu
// paletle hem bölge dörtgenlerinin hem de özet listedeki çubukların rengi aynı
// mantıkla belirleniyor, böylece haritaya bakan biri renkten anlık olarak
// "burası dolu mu boş mu" diyebiliyor.
const DENSITY_STYLES: Record<
  ZoneDensityInfo['densityLevel'],
  {
    background: string;
    border: string;
    badgeBackground: string;
    badgeBorder: string;
    badgeText: string;
    barColor: string;
  }
> = {
  Düşük: {
    background: 'rgba(34,197,94,0.16)',
    border: 'rgba(74,222,128,0.45)',
    badgeBackground: 'rgba(6,78,59,0.9)',
    badgeBorder: 'rgba(74,222,128,0.4)',
    badgeText: '#4ade80',
    barColor: '#22c55e',
  },
  Normal: {
    background: 'rgba(59,130,246,0.14)',
    border: 'rgba(96,165,250,0.4)',
    badgeBackground: 'rgba(23,37,84,0.9)',
    badgeBorder: 'rgba(96,165,250,0.35)',
    badgeText: '#93c5fd',
    barColor: '#3b82f6',
  },
  Orta: {
    background: 'rgba(245,158,11,0.16)',
    border: 'rgba(251,191,36,0.45)',
    badgeBackground: 'rgba(69,39,7,0.9)',
    badgeBorder: 'rgba(251,191,36,0.4)',
    badgeText: '#fbbf24',
    barColor: '#f59e0b',
  },
  Yoğun: {
    background: 'rgba(239,68,68,0.18)',
    border: 'rgba(248,113,113,0.55)',
    badgeBackground: 'rgba(69,10,10,0.92)',
    badgeBorder: 'rgba(248,113,113,0.5)',
    badgeText: '#fca5a5',
    barColor: '#ef4444',
  },
};

const DENSITY_LEVELS: ZoneDensityInfo['densityLevel'][] = ['Düşük', 'Normal', 'Orta', 'Yoğun'];

function DensityLegend() {
  return (
    <View style={styles.legendRow}>
      <Text style={styles.legendLabel}>Yoğunluk Skalası:</Text>
      {DENSITY_LEVELS.map((level) => (
        <View key={level} style={styles.legendItem}>
          <View style={[styles.legendSwatch, { backgroundColor: DENSITY_STYLES[level].barColor }]} />
          <Text style={styles.legendItemText}>{level}</Text>
        </View>
      ))}
    </View>
  );
}

function zoneSubtitle(zone: ZoneDensityInfo) {
  const separator = zone.name.indexOf(' - ');
  return separator >= 0 ? zone.name.slice(separator + 3) : zone.name;
}

// shortStageLabel artık lib/boothGrid.ts'de — katılımcı harita ekranıyla
// (app/(tabs)/map.tsx) aynı kısaltma kuralını paylaşıyor, bkz. yukarıdaki import.

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

// Krokideki bir stant veya sahne etiketini basılı tutup sürükleyerek
// taşımayı sağlar. PanResponder React Native'in kendi çekirdeğinde geliyor
// — react-native-gesture-handler gibi ek bir native modül/rebuild
// gerektirmiyor. Parmak kaldırılana kadar etiket parmağı takip eder
// (görsel önizleme, henüz kaydedilmez); bırakınca yeni yüzde konumu
// onDrop ile Supabase'e yazılır. Basit bir dokunuş (sürükleme olmadan)
// sadece seçim yapar, gereksiz bir "aynı yere yerleştirme" isteği
// göndermez.
function DraggablePin({
  x,
  y,
  onSelect,
  onDrop,
  canvasSize,
  style,
  children,
}: {
  x: number;
  y: number;
  onSelect: () => void;
  onDrop: (x: number, y: number) => void;
  canvasSize: { width: number; height: number };
  style: (object | false | null | undefined)[];
  children: ReactNode;
}) {
  const [dragOffset, setDragOffset] = useState<{ dx: number; dy: number } | null>(null);
  const startRef = useRef({ x, y });
  const liveRef = useRef({ x, y, canvasSize, onSelect, onDrop });
  useEffect(() => {
    liveRef.current = { x, y, canvasSize, onSelect, onDrop };
  });

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: (_, gesture) =>
        Math.abs(gesture.dx) > 2 || Math.abs(gesture.dy) > 2,
      onPanResponderGrant: () => {
        startRef.current = { x: liveRef.current.x, y: liveRef.current.y };
        liveRef.current.onSelect();
      },
      onPanResponderMove: (_, gesture) => {
        setDragOffset({ dx: gesture.dx, dy: gesture.dy });
      },
      onPanResponderRelease: (_, gesture) => {
        const moved = Math.abs(gesture.dx) > 4 || Math.abs(gesture.dy) > 4;
        setDragOffset(null);
        if (!moved) return;
        const { width, height } = liveRef.current.canvasSize;
        const dxPercent = width ? (gesture.dx / width) * 100 : 0;
        const dyPercent = height ? (gesture.dy / height) * 100 : 0;
        const nextX = Math.max(3, Math.min(97, Math.round(startRef.current.x + dxPercent)));
        const nextY = Math.max(3, Math.min(97, Math.round(startRef.current.y + dyPercent)));
        liveRef.current.onDrop(nextX, nextY);
      },
      onPanResponderTerminate: () => setDragOffset(null),
    }),
  ).current;

  const dragging = !!dragOffset;
  const displayX = dragOffset
    ? startRef.current.x + (dragOffset.dx / (canvasSize.width || 1)) * 100
    : x;
  const displayY = dragOffset
    ? startRef.current.y + (dragOffset.dy / (canvasSize.height || 1)) * 100
    : y;

  return (
    <View
      {...panResponder.panHandlers}
      style={[
        ...style,
        dragging && styles.pinDragging,
        {
          left: `${displayX}%` as DimensionValue,
          top: `${displayY}%` as DimensionValue,
        },
      ]}
    >
      {children}
    </View>
  );
}

// Bir bölgenin adını düzenlemek için kullanılan basit form. Bölgenin GPS
// konumu artık BURADA değil — tek bir etkinlik-geneli "Harita Merkezi"nden
// geliyor (bkz. VenueCenterModal, aşağısı) — bkz. types/admin.ts >
// EventSettings.venueCenterLat için gerekçe.
function ZoneGeofenceModal({
  visible,
  zone,
  onClose,
  onNotify,
}: {
  visible: boolean;
  zone: ZoneDensityInfo | null;
  onClose: () => void;
  onNotify?: (message: string) => void;
}) {
  const saveZone = useAdminStore((state) => state.saveZone);
  const deleteZone = useAdminStore((state) => state.deleteZone);
  const [name, setName] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!visible) return;
    setName(zone?.name || '');
    setError(null);
  }, [visible, zone]);

  async function handleSave() {
    if (!name.trim()) {
      setError('Bölge adı gerekli.');
      return;
    }

    setSaving(true);
    setError(null);
    const ok = await saveZone(
      {
        name: name.trim(),
        capacity: zone?.capacity,
        description: zone?.description,
      },
      zone?.id,
    );
    setSaving(false);
    if (ok) {
      onNotify?.(zone ? 'Bölge güncellendi.' : 'Bölge oluşturuldu.');
      onClose();
    } else {
      setError('Bölge kaydedilemedi. Bağlantını kontrol edip tekrar dene.');
    }
  }

  async function handleDelete() {
    if (!zone) return;
    setSaving(true);
    const ok = await deleteZone(zone.id);
    setSaving(false);
    if (ok) {
      onNotify?.('Bölge silindi.');
      onClose();
    } else {
      setError('Bölge silinemedi.');
    }
  }

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={modalStyles.overlay}>
        <View style={modalStyles.card}>
          <View style={modalStyles.header}>
            <Text style={modalStyles.title}>{zone ? 'Bölgeyi Düzenle' : 'Yeni Bölge'}</Text>
            <Pressable onPress={onClose} hitSlop={8}>
              <X size={20} color={colors.textMuted} />
            </Pressable>
          </View>

          <ScrollView contentContainerStyle={modalStyles.form}>
            {error ? <Text style={modalStyles.errorText}>{error}</Text> : null}

            <View style={modalStyles.field}>
              <Text style={modalStyles.label}>Bölge Adı</Text>
              <TextInput
                style={modalStyles.input}
                value={name}
                onChangeText={setName}
                placeholder="Örn. Ana Sahne"
                placeholderTextColor={colors.textFaint}
              />
            </View>

            <Text style={modalStyles.hint}>
              Bu bölgenin canlı kişi sayısı artık "Harita Merkezi"nden (header'daki hedef ikonu)
              hesaplanıyor — harita merkezi ayarlanmadıysa bu sayı manuel girilir.
            </Text>

            <View style={modalStyles.actions}>
              {zone ? (
                <Pressable style={modalStyles.deleteBtn} onPress={handleDelete} disabled={saving}>
                  <Trash2 size={15} color={colors.danger} />
                  <Text style={modalStyles.deleteBtnText}>Sil</Text>
                </Pressable>
              ) : null}
              <Pressable style={modalStyles.saveBtn} onPress={handleSave} disabled={saving}>
                {saving ? (
                  <ActivityIndicator size="small" color={colors.white} />
                ) : (
                  <Text style={modalStyles.saveBtnText}>Kaydet</Text>
                )}
              </Pressable>
            </View>
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

// Etkinlik alanının GERÇEK DÜNYADAKİ tek merkez GPS noktasını + yoğunluk ısı
// haritasının krokinin yarı genişliğine karşılık geldiği yarıçapı (metre)
// düzenler. Etkinlik alanı her etkinlikte değiştiği için admin bunu istediği
// zaman güncelleyebiliyor — "Şu anki konumumu kullan" ile bulunduğu yerden de
// ayarlayabiliyor (ZoneGeofenceModal'daki eski per-zone "Şu anki konumumu
// kullan" ile birebir aynı desen, artık TEK bir merkez için). Bu merkez
// (bkz. lib/useLiveDensity.ts, supabase_venue_center_migration.sql >
// get_live_density_grid) katılımcılardan gelen canlı konum ping'lerinin
// krokideki yaklaşık x/y'sini hesaplayıp ısı haritasını ve zone bazlı canlı
// kişi sayısını besliyor.
function VenueCenterModal({
  visible,
  settings,
  onClose,
  onNotify,
}: {
  visible: boolean;
  settings: EventSettings;
  onClose: () => void;
  onNotify?: (message: string) => void;
}) {
  const saveSettings = useAdminStore((state) => state.saveSettings);
  const [lat, setLat] = useState('');
  const [lng, setLng] = useState('');
  const [radius, setRadius] = useState('150');
  const [locating, setLocating] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!visible) return;
    setLat(settings.venueCenterLat != null ? String(settings.venueCenterLat) : '');
    setLng(settings.venueCenterLng != null ? String(settings.venueCenterLng) : '');
    setRadius(String(settings.venueRadiusMeters || 150));
    setError(null);
  }, [visible, settings]);

  async function handleUseCurrentLocation() {
    setLocating(true);
    setError(null);
    try {
      const permission = await Location.requestForegroundPermissionsAsync();
      if (permission.status !== 'granted') {
        setError('Konum izni verilmeden bu cihazın konumu alınamaz.');
        return;
      }
      const position = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
      setLat(String(position.coords.latitude));
      setLng(String(position.coords.longitude));
    } catch (locationError) {
      setError(locationError instanceof Error ? locationError.message : 'Konum alınamadı.');
    } finally {
      setLocating(false);
    }
  }

  async function handleSave() {
    const parsedLat = lat.trim() ? Number(lat.replace(',', '.')) : null;
    const parsedLng = lng.trim() ? Number(lng.replace(',', '.')) : null;
    if ((parsedLat != null && Number.isNaN(parsedLat)) || (parsedLng != null && Number.isNaN(parsedLng))) {
      setError('Enlem/boylam geçerli bir sayı olmalı.');
      return;
    }
    const parsedRadius = Number(radius.replace(',', '.')) || 150;

    setSaving(true);
    setError(null);
    const ok = await saveSettings({
      venueCenterLat: parsedLat,
      venueCenterLng: parsedLng,
      venueRadiusMeters: parsedRadius,
    });
    setSaving(false);
    if (ok) {
      onNotify?.('Harita merkezi güncellendi.');
      onClose();
    } else {
      setError('Harita merkezi kaydedilemedi. Bağlantını kontrol edip tekrar dene.');
    }
  }

  async function handleClear() {
    setSaving(true);
    setError(null);
    const ok = await saveSettings({ venueCenterLat: null, venueCenterLng: null });
    setSaving(false);
    if (ok) {
      setLat('');
      setLng('');
      onNotify?.('Harita merkezi kaldırıldı — yoğunluk ısı haritası gizlendi.');
      onClose();
    } else {
      setError('İşlem başarısız oldu.');
    }
  }

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={modalStyles.overlay}>
        <View style={modalStyles.card}>
          <View style={modalStyles.header}>
            <Text style={modalStyles.title}>Harita Merkezi</Text>
            <Pressable onPress={onClose} hitSlop={8}>
              <X size={20} color={colors.textMuted} />
            </Pressable>
          </View>

          <ScrollView contentContainerStyle={modalStyles.form}>
            {error ? <Text style={modalStyles.errorText}>{error}</Text> : null}
            <Text style={modalStyles.hint}>
              Etkinlik alanının gerçek dünyadaki tek merkez noktası — katılımcılardan gelen canlı
              konumlar buraya olan uzaklığına göre krokideki yoğunluk ısı haritasına (kırmızı =
              yoğun, yeşil = az yoğun) dönüştürülür. Etkinlik alanı değiştiğinde bu noktayı
              güncelleyin.
            </Text>

            <View style={modalStyles.row}>
              <View style={[modalStyles.field, { flex: 1 }]}>
                <Text style={modalStyles.label}>Enlem (lat)</Text>
                <TextInput
                  style={modalStyles.input}
                  value={lat}
                  onChangeText={setLat}
                  keyboardType="numbers-and-punctuation"
                  placeholder="39.9374"
                  placeholderTextColor={colors.textFaint}
                />
              </View>
              <View style={[modalStyles.field, { flex: 1 }]}>
                <Text style={modalStyles.label}>Boylam (lng)</Text>
                <TextInput
                  style={modalStyles.input}
                  value={lng}
                  onChangeText={setLng}
                  keyboardType="numbers-and-punctuation"
                  placeholder="32.8301"
                  placeholderTextColor={colors.textFaint}
                />
              </View>
            </View>

            <Pressable style={modalStyles.locateBtn} onPress={handleUseCurrentLocation} disabled={locating}>
              {locating ? (
                <ActivityIndicator size="small" color={colors.primary} />
              ) : (
                <Crosshair size={16} color={colors.primary} />
              )}
              <Text style={modalStyles.locateBtnText}>Şu anki konumumu kullan</Text>
            </Pressable>

            <View style={modalStyles.field}>
              <Text style={modalStyles.label}>Yarıçap (metre)</Text>
              <TextInput
                style={modalStyles.input}
                value={radius}
                onChangeText={setRadius}
                keyboardType="numbers-and-punctuation"
                placeholder="150"
                placeholderTextColor={colors.textFaint}
              />
              <Text style={modalStyles.hint}>
                Bu yarıçap, krokinin merkezden kenarına kadar olan gerçek mesafeyi (metre) temsil
                eder — etkinlik alanı büyükse artırın, küçükse azaltın.
              </Text>
            </View>

            <View style={modalStyles.actions}>
              {settings.venueCenterLat != null ? (
                <Pressable style={modalStyles.deleteBtn} onPress={handleClear} disabled={saving}>
                  <X size={15} color={colors.danger} />
                  <Text style={modalStyles.deleteBtnText}>Kaldır</Text>
                </Pressable>
              ) : null}
              <Pressable style={modalStyles.saveBtn} onPress={handleSave} disabled={saving}>
                {saving ? (
                  <ActivityIndicator size="small" color={colors.white} />
                ) : (
                  <Text style={modalStyles.saveBtnText}>Kaydet</Text>
                )}
              </Pressable>
            </View>
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

export function AdminMapManagement({
  stages,
  booths,
  zones,
  settings,
  selectedBoothIdFromNav,
  selectedStageIdFromNav,
  onSelectBooth,
  onSelectStage,
  onOpenEditBooth,
  onDeleteBooth,
  onNotify,
}: Props) {
  const { width } = useWindowDimensions();
  const wide = width >= 1120;
  const placeBooth = useAdminStore((state) => state.placeBooth);
  const unplaceBooth = useAdminStore((state) => state.unplaceBooth);
  const updateStagePosition = useAdminStore((state) => state.updateStagePosition);
  const unplaceStage = useAdminStore((state) => state.unplaceStage);
  const saveSettings = useAdminStore((state) => state.saveSettings);
  const { data: waterStations = [] } = useWaterStations();
  // Su sebilleri artık bu ekrandan da eklenip sürüklenebiliyor — konum
  // güncellemesi stant/sahne sürüklemesiyle aynı desen (bkz.
  // handleMoveWaterStation), ekleme ise varsayılan olarak krokinin ortasına
  // düşüyor ve admin hemen ardından etiketi sürükleyerek yerini ayarlıyor
  // (bkz. handleAddWaterStation). Silme/durum takibi hâlâ "Su İstasyonları"
  // sekmesinde.
  const createWaterStation = useCreateWaterStation();
  const updateWaterStationPosition = useUpdateWaterStationPosition();
  // Yoğunluk ısı haritası: harita merkezi ayarlandıysa (bkz.
  // settings.venueCenterLat, VenueCenterModal), canlı konum ping'lerinden
  // özetlenmiş ızgara hücreleri 20 saniyede bir yenileniyor (bkz.
  // lib/useLiveDensity.ts) — krokide kırmızı (yoğun) - yeşil (az yoğun) bir
  // ısı lekesi olarak gösteriliyor (bkz. renderMapCardBody).
  const { data: densityCells = [] } = useLiveDensityGrid();
  const heatBlobs = useMemo(() => heatBlobsFromGrid(densityCells), [densityCells]);
  const [venueCenterModalVisible, setVenueCenterModalVisible] = useState(false);
  const [layers, setLayers] = useState<Record<LayerKey, boolean>>({
    booths: true,
    stages: true,
    zones: true,
  });
  const [selectedBoothId, setSelectedBoothId] = useState<string | null>(
    selectedBoothIdFromNav || booths[0]?.id || null,
  );
  const [selectedStageId, setSelectedStageId] = useState<string | null>(null);
  const [placementError, setPlacementError] = useState<string | null>(null);
  const [exporting, setExporting] = useState(false);
  const [canvasSize, setCanvasSize] = useState({ width: 1, height: 1 });
  const [zoneModalVisible, setZoneModalVisible] = useState(false);
  const [editingZone, setEditingZone] = useState<ZoneDensityInfo | null>(null);
  // Admin krokiyi tamamen elle çizdiği için normal ekranda bile kroki kartı
  // zaten büyütüldü (bkz. mapCardWide), ama daha rahat çizim isteyen admin
  // için ayrıca tüm ekranı kaplayan bir "Tam Ekran Çiz" modu var — aynı
  // canvas içeriği (renderCanvas/renderTray) hem normal ekranda hem bu tam
  // ekran Modal'ının içinde render ediliyor, ikisi aynı anda MONTE OLMUYOR
  // (aşağıdaki JSX'te birbirini dışlıyor) ki canvasSize ölçümü çakışmasın.
  const [focusMode, setFocusMode] = useState(false);
  // Duvar çizme modu: kroki artık bir fotoğraf değil, admin'in tamamen elle
  // oluşturduğu bir plan — admin krokiyi sıfırdan iki noktaya dokunarak
  // (duvarın başı ve sonu) çiziyor, her dokunuş en yakın ızgara kesişimine
  // yapıştırılıyor (bkz. lib/floorPlanGrid.ts > snapToGrid) ki çizgiler yamuk
  // çıkmasın. Rota bulma algoritması (lib/routePlanner.ts) bu duvarları
  // stant/sahne gibi birer engel sayıp etraflarından dolanıyor. wallStart,
  // ilk noktaya dokunulduktan sonra ikinci nokta beklenirken geçici olarak
  // tutuluyor.
  //
  // wallDraft: duvar çizme modundayken eklenen/silinen duvarlar artık HER
  // ÇİZGİDE ayrı ayrı Supabase'e kaydedilmiyor (bu, çok sayıda duvar
  // çizerken zahmetli ve yavaştı) — bunun yerine yerel bir taslak olarak
  // burada tutuluyor, admin "Kaydet" ile bitirene kadar hiç ağ isteği
  // gitmiyor (bkz. startWallDrawing/finishWallDrawing).
  const [wallDrawing, setWallDrawing] = useState(false);
  const [wallStart, setWallStart] = useState<{ x: number; y: number } | null>(null);
  const [wallDraft, setWallDraft] = useState<FloorPlanWall[] | null>(null);
  const [savingWalls, setSavingWalls] = useState(false);
  const displayWalls = wallDrawing ? wallDraft ?? [] : settings.floorPlanWalls;

  // Stant/sahne/su sebili konumları için taslak: sürükleyip bıraktıkça
  // sadece burada güncelleniyor (bkz. placeBoothAt/moveStageTo/
  // handleMoveWaterStation), hiçbir ağ isteği gitmiyor. Anahtar `"kind:id"`
  // biçiminde ("booth:<uuid>" / "stage:<uuid>" / "water:<uuid>") — aynı
  // öğenin ikinci bir sürüklemesi sadece bu taslaktaki girdiyi güncelliyor.
  // `saveAllPositions` bunların HEPSİNİ tek bir "Konumları Kaydet" basışında
  // Supabase'e yazıyor (bkz. aşağısı).
  const [pendingPositions, setPendingPositions] = useState<Record<string, PendingPositionEntry>>({});
  const [savingPositions, setSavingPositions] = useState(false);
  const pendingPositionCount = Object.keys(pendingPositions).length;

  const selectedBooth = booths.find((booth) => booth.id === selectedBoothId) || null;
  const selectedStage = stages.find((stage) => stage.id === selectedStageId) || null;

  // Bir stant/sahne, ya gerçekten kaydedilmiş (isBoothPlaced/isStagePlaced)
  // ya da henüz kaydedilmemiş ama taslakta bir konumu VARSA (admin daha yeni
  // krokiye getirdi/sürükledi ama henüz "Konumları Kaydet"e basmadı) krokide
  // görünür kabul ediliyor — "Yerleştirilmemiş Öğeler" tepsisinden düşüp
  // krokide pin olarak belirmesi için persist edilmiş olması ŞART DEĞİL.
  function isBoothOnCanvas(booth: AdminBooth) {
    return isBoothPlaced(booth) || `booth:${booth.id}` in pendingPositions;
  }
  function isStageOnCanvas(stage: AdminStage) {
    return isStagePlaced(stage) || `stage:${stage.id}` in pendingPositions;
  }
  // Bir öğenin krokide GÖSTERİLECEĞİ konum — taslakta bekleyen bir değişiklik
  // varsa o, yoksa son kaydedilmiş (gerçek) konum.
  function boothMapPosition(booth: AdminBooth) {
    const pending = pendingPositions[`booth:${booth.id}`];
    return pending ? { x: pending.x, y: pending.y } : { x: booth.mapX, y: booth.mapY };
  }
  function stageMapPosition(stage: AdminStage) {
    const pending = pendingPositions[`stage:${stage.id}`];
    return pending ? { x: pending.x, y: pending.y } : { x: stage.mapX, y: stage.mapY };
  }
  // Inspector panelindeki "Merkeze Uzaklık" satırı için — bkz.
  // lib/zoneDensity.ts > distanceFromVenueCenterMeters. Harita merkezi
  // ayarlıysa (çağıran taraf zaten `settings.venueCenterLat != null` ile
  // kontrol ediyor) bu her zaman bir sayı döner; yine de `radiusMeters`
  // geçersizse (0 veya tanımsız) fonksiyon `null` dönebildiği için bir
  // metin fallback'i tutuluyor.
  function formatDistanceFromCenter(position: { x: number; y: number }, radiusMeters: number) {
    const meters = distanceFromVenueCenterMeters(position.x, position.y, radiusMeters);
    if (meters == null) return 'Bilinmiyor';
    return meters >= 1000 ? `~${(meters / 1000).toFixed(2)} km` : `~${Math.round(meters)} m`;
  }
  // Inspector panelinde gösterilecek zone — henüz kaydedilmemiş ama taslakta
  // yerleştirilmiş bir öğe için zone, o taslak konumdan anlık hesaplanıyor
  // (persist edilmiş `booth.zone`/`stage.zone` henüz null olabilir).
  function boothZoneDisplay(booth: AdminBooth) {
    if (!isBoothOnCanvas(booth)) return null;
    if (isBoothPlaced(booth)) return booth.zone;
    const pos = boothMapPosition(booth);
    return zoneForPercent(pos.x, pos.y);
  }
  function stageZoneDisplay(stage: AdminStage) {
    if (!isStageOnCanvas(stage)) return null;
    if (isStagePlaced(stage)) return stage.zone;
    const pos = stageMapPosition(stage);
    return zoneForPercent(pos.x, pos.y);
  }

  const unplacedBooths = booths.filter((booth) => !isBoothOnCanvas(booth));
  const unplacedStages = stages.filter((stage) => !isStageOnCanvas(stage));

  useEffect(() => {
    if (!selectedBoothIdFromNav) return;
    const target = booths.find((booth) => booth.id === selectedBoothIdFromNav);
    if (!target) return;
    setSelectedBoothId(target.id);
    setSelectedStageId(null);
    setPlacementError(null);
    // Krokiye henüz yerleştirilmemiş bir stant, buradan seçilir seçilmez
    // (tıpkı aşağıdaki "Yerleştirilmemiş Öğeler" tepsisinden seçilmiş gibi)
    // varsayılan bir noktaya otomatik getiriliyor — admin ekstra bir kroki
    // tıklamasına gerek kalmadan doğrudan sürükleyerek konumlandırabiliyor.
    if (!isBoothOnCanvas(target)) placeBoothAt(target, DEFAULT_PLACEMENT.x, DEFAULT_PLACEMENT.y);
  }, [booths, selectedBoothIdFromNav]);

  useEffect(() => {
    if (!selectedStageIdFromNav) return;
    const target = stages.find((stage) => stage.id === selectedStageIdFromNav);
    if (!target) return;
    setSelectedStageId(target.id);
    setSelectedBoothId(null);
    setPlacementError(null);
    // Booth'takiyle birebir aynı mantık: henüz yerleştirilmemiş bir alan/sahne
    // seçilir seçilmez varsayılan bir noktaya otomatik getiriliyor.
    if (!isStageOnCanvas(target)) moveStageTo(target, DEFAULT_PLACEMENT.x, DEFAULT_PLACEMENT.y);
  }, [stages, selectedStageIdFromNav]);

  useEffect(() => {
    if (selectedBoothId && !booths.some((booth) => booth.id === selectedBoothId)) {
      const nextId = booths[0]?.id || null;
      setSelectedBoothId(nextId);
      if (nextId) onSelectBooth?.(nextId);
    }
  }, [booths, onSelectBooth, selectedBoothId]);

  function toggleLayer(key: LayerKey) {
    setLayers((current) => ({ ...current, [key]: !current[key] }));
  }

  function selectBooth(booth: AdminBooth) {
    setSelectedBoothId(booth.id);
    setSelectedStageId(null);
    setPlacementError(null);
    onSelectBooth?.(booth.id);
  }

  function selectStage(stage: AdminStage) {
    setSelectedStageId(stage.id);
    setSelectedBoothId(null);
    setPlacementError(null);
    onSelectStage?.(stage.id);
  }

  // Taslağa (pendingPositions) bir konum yazar/günceller — hiçbir ağ isteği
  // göndermez. `saveAllPositions` çağrılana kadar sadece bu taslakta durur.
  function setPendingPosition(kind: PendingPositionEntry['kind'], id: string, x: number, y: number) {
    setPendingPositions((current) => ({ ...current, [`${kind}:${id}`]: { kind, id, x, y } }));
  }

  function clearPendingPosition(kind: PendingPositionEntry['kind'], id: string) {
    setPendingPositions((current) => {
      const key = `${kind}:${id}`;
      if (!(key in current)) return current;
      const next = { ...current };
      delete next[key];
      return next;
    });
  }

  // "Yerleştirilmemiş Öğeler" tepsisindeki bir stant/alan chip'ine dokununca
  // (ya da başka bir ekrandan nav ile seçilince, bkz. yukarıdaki effect'ler)
  // çağrılır: öğeyi hemen varsayılan bir noktaya yerleştirip krokide görünür
  // hale getirir ve seçili yapar — admin ardından etiketi sürükleyerek asıl
  // yerine taşır. Bu da (sürüklemede olduğu gibi) sadece taslağa yazılıyor,
  // Supabase'e "Konumları Kaydet"e basılana kadar hiçbir şey gitmiyor.
  function bringBoothToMap(booth: AdminBooth) {
    selectBooth(booth);
    placeBoothAt(booth, DEFAULT_PLACEMENT.x, DEFAULT_PLACEMENT.y);
  }

  function bringStageToMap(stage: AdminStage) {
    selectStage(stage);
    moveStageTo(stage, DEFAULT_PLACEMENT.x, DEFAULT_PLACEMENT.y);
  }

  // Krokiden kaldırma: eğer öğe hiç kaydedilmemiş, sadece taslakta yeni
  // getirilmişse (henüz Supabase'de bir kaydı yok) silinecek gerçek bir şey
  // yok — taslaktan çıkarmak yeterli. Zaten kaydedilmiş bir öğeyse gerçek
  // `unplaceBooth`/`unplaceStage` çağrısı gerekiyor (bu işlem ERTELENMİYOR,
  // "krokiden kaldırma" bir konum değişikliği değil, ayrı bir eylem).
  async function handleUnplace() {
    if (!selectedBooth) return;
    if (!isBoothPlaced(selectedBooth)) {
      clearPendingPosition('booth', selectedBooth.id);
      onNotify?.(`${selectedBooth.companyName} krokiden kaldırıldı.`);
      return;
    }
    const ok = await unplaceBooth(selectedBooth.id);
    if (ok) clearPendingPosition('booth', selectedBooth.id);
    onNotify?.(ok ? `${selectedBooth.companyName} krokiden kaldırıldı.` : 'İşlem başarısız oldu.');
  }

  async function handleUnplaceStage() {
    if (!selectedStage) return;
    if (!isStagePlaced(selectedStage)) {
      clearPendingPosition('stage', selectedStage.id);
      onNotify?.(`${selectedStage.name} krokiden kaldırıldı.`);
      return;
    }
    const ok = await unplaceStage(selectedStage.id);
    if (ok) clearPendingPosition('stage', selectedStage.id);
    onNotify?.(ok ? `${selectedStage.name} krokiden kaldırıldı.` : 'İşlem başarısız oldu.');
  }

  // Hem stantlar hem de sahneler/oturum yerleri artık krokinin herhangi bir
  // noktasına serbestçe yerleştiriliyor — kareye takılma yok. Hangi zone'a ait
  // olduğu bırakılan noktanın krokideki çeyreğinden otomatik belirleniyor
  // (bkz. boothZoneDisplay/stageZoneDisplay, kaydedilirken de aynı hesap
  // adminRepository.placeBooth/updateStagePosition içinde tekrarlanıyor).
  //
  // Duvar çiziminde olduğu gibi burası da artık SADECE taslağı günceller —
  // hem ilk kez krokiye getirilirken (bkz. bringBoothToMap) hem de etiketi
  // doğrudan sürükleyip bırakınca (DraggablePin > onDrop) hiçbir ağ isteği
  // gitmiyor, admin istediği kadar öğeyi taşıyabiliyor. Gerçek kayıt sadece
  // "Konumları Kaydet" ile, tek seferde oluyor (bkz. saveAllPositions).
  function placeBoothAt(booth: AdminBooth, x: number, y: number) {
    setPlacementError(null);
    setPendingPosition('booth', booth.id, x, y);
  }

  function moveStageTo(stage: AdminStage, x: number, y: number) {
    setPlacementError(null);
    setPendingPosition('stage', stage.id, x, y);
  }

  // Taslaktaki TÜM bekleyen konum değişikliklerini (stant + sahne + su
  // sebili, hepsi bir arada) TEK bir "Konumları Kaydet" basışında paralel
  // olarak Supabase'e yazar — duvar çizimindeki "hepsini bitir, sonra tek
  // seferde kaydet" deseniyle birebir aynı. Başarısız olanlar taslakta kalır
  // (admin tekrar "Kaydet"e basarak yeniden deneyebilir), başarılı olanlar
  // taslaktan temizlenir.
  async function saveAllPositions() {
    const entries = Object.values(pendingPositions);
    if (!entries.length) return;
    setSavingPositions(true);

    const results: Array<PendingPositionEntry & { ok: boolean }> = [];

    // Stantlar SIRAYLA (paralel değil) kaydediliyor. Sebebi: stant numarası
    // aynı zone'daki DİĞER stantlara bakılarak hesaplanıyor (bkz.
    // adminRepository.placeBooth > nextBoothNumber). Birden fazla stant aynı
    // anda paralel kaydedilseydi, hepsi henüz güncellenmemiş aynı stant
    // listesine bakıp ÇAKIŞAN (aynı) numarayı üretebilirdi — tam olarak "bir
    // dahaki sefere tek tek taşımak" ihtiyacını doğuran hataydı bu. Sırayla
    // işleyerek her stant bir öncekinin kaydedilmiş numarasını görmüş oluyor.
    const boothEntries = entries.filter((entry) => entry.kind === 'booth');
    for (const entry of boothEntries) {
      try {
        const ok = await placeBooth(entry.id, entry.x, entry.y);
        results.push({ ...entry, ok });
      } catch {
        results.push({ ...entry, ok: false });
      }
    }

    // Sahne ve su sebili konumlarının böyle bir numaralandırma bağımlılığı
    // yok — birbirlerinden bağımsız satırlar, paralel kaydedilmeleri güvenli.
    const otherEntries = entries.filter((entry) => entry.kind !== 'booth');
    const otherResults = await Promise.all(
      otherEntries.map(async (entry) => {
        try {
          if (entry.kind === 'stage') {
            const ok = await updateStagePosition(entry.id, entry.x, entry.y);
            return { ...entry, ok };
          }
          await updateWaterStationPosition.mutateAsync({ stationId: entry.id, mapX: entry.x, mapY: entry.y });
          return { ...entry, ok: true };
        } catch {
          return { ...entry, ok: false };
        }
      }),
    );
    results.push(...otherResults);

    setSavingPositions(false);
    const succeeded = results.filter((r) => r.ok);
    const failed = results.filter((r) => !r.ok);
    if (succeeded.length) {
      setPendingPositions((current) => {
        const next = { ...current };
        succeeded.forEach((r) => delete next[`${r.kind}:${r.id}`]);
        return next;
      });
    }
    onNotify?.(
      failed.length
        ? `${succeeded.length}/${results.length} konum kaydedildi, ${failed.length} tanesi başarısız oldu — tekrar "Kaydet"e dokunabilirsin.`
        : `${results.length} konum kaydedildi.`,
    );
  }

  // Duvar çizmeye başlarken mevcut kayıtlı duvarların bir kopyası taslağa
  // alınıyor — çizim boyunca eklenen/silinen her şey bu taslakta kalıyor,
  // Supabase'e hiç dokunulmuyor.
  function startWallDrawing() {
    setWallDraft([...settings.floorPlanWalls]);
    setWallStart(null);
    setPlacementError(null);
    setWallDrawing(true);
  }

  // Duvar çizimini bitirir: taslaktaki TÜM duvarlar TEK bir Supabase
  // isteğiyle kaydedilir — admin artık her çizgiden sonra beklemek zorunda
  // kalmıyor, istediği kadar duvar çizip en sonda tek seferde kaydediyor.
  async function finishWallDrawing() {
    const draft = wallDraft ?? settings.floorPlanWalls;
    setWallStart(null);
    setSavingWalls(true);
    const ok = await saveSettings({ floorPlanWalls: draft });
    setSavingWalls(false);
    setWallDrawing(false);
    setWallDraft(null);
    onNotify?.(
      ok ? `Duvarlar kaydedildi (${draft.length}).` : useAdminStore.getState().error || 'Duvarlar kaydedilemedi.',
    );
  }

  function handleWallToolPress() {
    if (wallDrawing) {
      void finishWallDrawing();
    } else {
      startWallDrawing();
    }
  }

  // Duvar çizim modundayken bir duvarı silmek de taslak üzerinde yapılır,
  // ayrı bir kayıt isteği göndermez — "Kaydet" ile birlikte kalıcı olur.
  function handleDeleteWall(wallId: string) {
    setWallDraft((current) => (current ?? []).filter((wall) => wall.id !== wallId));
  }

  // Krokideki tek tıklama etkileşimi artık sadece duvar çizmek için — stant/
  // alan yerleştirme "Yerleştirilmemiş Öğeler" tepsisinden seçilip otomatik
  // getirildikten sonra sürükleyerek yapılıyor (bkz. bringBoothToMap/
  // bringStageToMap), ayrı bir "krokide bir noktaya dokun" modu yok. Duvar
  // çizme modunda ilk dokunuş başlangıç noktasını, ikinci dokunuş bitiş
  // noktasını belirleyip yeni bir duvar çizgisi oluşturuyor.
  function handleCanvasPress(event: GestureResponderEvent) {
    if (!wallDrawing) return;
    const x = (event.nativeEvent.locationX / canvasSize.width) * 100;
    const y = (event.nativeEvent.locationY / canvasSize.height) * 100;

    // Duvar noktaları serbest yüzdeye değil, referans ızgaranın en yakın
    // kesişimine yapıştırılıyor — admin elle çizerken çizgiler yamuk
    // çıkmasın diye (bkz. lib/floorPlanGrid.ts).
    const snapped = snapToGrid(x, y);
    if (!wallStart) {
      setWallStart(snapped);
      return;
    }
    const newWall: FloorPlanWall = {
      id: `wall-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      x1: wallStart.x,
      y1: wallStart.y,
      x2: snapped.x,
      y2: snapped.y,
    };
    setWallStart(null);
    // Sadece taslağa ekleniyor — Supabase'e "Kaydet" (finishWallDrawing)
    // basılana kadar hiçbir şey yazılmıyor.
    setWallDraft((current) => [...(current ?? []), newWall]);
  }

  // "Su Sebili Ekle" — krokinin ortasına varsayılan konumda yeni bir su
  // sebili oluşturur, admin ardından etiketi sürükleyerek istediği yere
  // taşır (bkz. handleMoveWaterStation). İstediği kadar tekrar basıp yeni
  // su sebili ekleyebilir.
  async function handleAddWaterStation() {
    try {
      await createWaterStation.mutateAsync({
        name: `Su Sebili ${waterStations.length + 1}`,
        mapX: DEFAULT_PLACEMENT.x,
        mapY: DEFAULT_PLACEMENT.y,
      });
      onNotify?.('Yeni su sebili eklendi. Krokideki etiketi sürükleyerek yerini ayarlayabilirsin.');
    } catch (error) {
      onNotify?.(error instanceof Error ? error.message : 'Su sebili eklenemedi.');
    }
  }

  // Su sebili sürükleme de artık stant/sahne ile aynı şekilde SADECE taslağa
  // yazıyor — anında Supabase'e gitmiyor, "Konumları Kaydet" ile toplu
  // kaydediliyor (bkz. saveAllPositions).
  function handleMoveWaterStation(stationId: string, x: number, y: number) {
    setPendingPosition('water', stationId, x, y);
  }

  // Kroki kartının içeriği (uyarı çubuğu + yoğunluk skalası + asıl kroki
  // canvas'ı + yerleştirilmemiş öğeler tepsisi) — bu içerik hem normal
  // ekranda hem de "Tam Ekran Çiz" modundaki Modal'ın içinde birebir aynı
  // şekilde kullanılıyor (bkz. focusMode). İkisi aynı anda MONTE OLMUYOR
  // (JSX'te birbirini dışlıyor), bu yüzden canvasSize ölçümü çakışmıyor.
  function renderMapCardBody() {
    // Üstteki uyarı çubuğu artık üç ayrı durumu tek bir yerden yönetiyor —
    // duvar çizimi, bir yerleştirme hatası, ya da bekleyen konum
    // değişiklikleri (stant/sahne/su sebili sürüklemesi). Öncelik sırası
    // önemli: aktif bir duvar çizimi varken bile bir hata gösterilmeli
    // değil, ama hata yoksa ve bekleyen konum varsa o gösterilsin.
    const alertMode: 'wall' | 'error' | 'positions' | null = wallDrawing
      ? 'wall'
      : placementError
        ? 'error'
        : pendingPositionCount > 0
          ? 'positions'
          : null;
    return (
      <>
        {alertMode ? (
          <View style={[styles.repositionAlert, alertMode === 'error' && styles.repositionAlertError]}>
            <View style={styles.repositionCopy}>
              <Crosshair size={17} color={colors.white} />
              <Text style={styles.repositionText}>
                {alertMode === 'wall'
                  ? savingWalls
                    ? 'Duvarlar kaydediliyor…'
                    : wallStart
                      ? 'Duvarın bitiş noktasına dokunun.'
                      : `Duvarın başlangıç noktasına dokunun. İstediğin kadar duvar ekleyebilirsin, hepsi "Kaydet" ile tek seferde kaydedilir (${displayWalls.length}).`
                  : alertMode === 'error'
                    ? placementError
                    : savingPositions
                      ? 'Konumlar kaydediliyor…'
                      : `${pendingPositionCount} konum değişikliği henüz kaydedilmedi. İstediğin kadar taşı, bitirince "Kaydet"e dokun.`}
              </Text>
            </View>
            <Pressable
              style={styles.cancelMove}
              disabled={savingWalls || savingPositions}
              onPress={() => {
                if (alertMode === 'wall') {
                  handleWallToolPress();
                } else if (alertMode === 'error') {
                  setPlacementError(null);
                } else {
                  void saveAllPositions();
                }
              }}
            >
              {savingWalls || savingPositions ? (
                <ActivityIndicator size="small" color={colors.primary} />
              ) : alertMode === 'error' ? (
                <X size={14} color={colors.primary} />
              ) : (
                <Check size={14} color={colors.primary} />
              )}
              <Text style={styles.cancelMoveText}>{alertMode === 'error' ? 'Kapat' : 'Kaydet'}</Text>
            </Pressable>
          </View>
        ) : null}

        <DensityLegend />

        {settings.venueCenterLat != null ? (
          <View style={styles.legendRow}>
            <Text style={styles.legendLabel}>Yoğunluk Isı Haritası:</Text>
            <View style={styles.legendItem}>
              <View style={[styles.legendSwatch, { backgroundColor: '#22c55e' }]} />
              <Text style={styles.legendItemText}>Az yoğun</Text>
            </View>
            <View style={styles.legendItem}>
              <View style={[styles.legendSwatch, { backgroundColor: '#ef4444' }]} />
              <Text style={styles.legendItemText}>Yoğun</Text>
            </View>
          </View>
        ) : (
          <Text style={styles.uploadHintText}>
            Yoğunluk ısı haritası için üstteki "Harita Merkezini Ayarla" ile etkinlik alanının
            gerçek konumunu belirleyin.
          </Text>
        )}

        {/* Pusula — krokinin "yukarısı" her zaman coğrafi kuzey, "sağı" doğu
            kabul ediliyor (bkz. lib/zoneDensity.ts > gpsToMapPercent, yoğunluk
            ısı haritası ve GPS-tabanlı mesafe hesapları bu varsayıma
            dayanıyor). Krokinin gerçek pusula yönü FARKLIYSA (admin duvarları
            o yöne göre çizmediyse) ısı haritası/mesafe hesapları hafif
            yanıltıcı olabilir — bu widget admin'in bu varsayımı görüp
            krokiyi ona göre çizmesini/yorumlamasını sağlıyor. Kullanıcının
            "pusula haritanın dışında üstte sağ tarafta dursun" isteği üzerine
            krokinin (SVG canvas'ının) İÇİNDEN çıkarılıp kroki kutusunun hemen
            ÜSTÜNE, sağa yaslı ayrı bir satıra taşındı — artık kroki
            çizimiyle hiç çakışmıyor. Sadece görsel bir referans, hiçbir
            hesaplamaya dahil değil. */}
        <View style={styles.compassRow} pointerEvents="none">
          <View style={styles.compassBadge}>
            <View style={styles.compassNeedle} />
            <Text style={[styles.compassLabel, styles.compassLabelTop]}>K</Text>
            <Text style={[styles.compassLabel, styles.compassLabelBottom]}>G</Text>
            <Text style={[styles.compassLabel, styles.compassLabelRight]}>D</Text>
            <Text style={[styles.compassLabel, styles.compassLabelLeft]}>B</Text>
          </View>
        </View>

        <View
          accessibilityLabel="Etkinlik alan krokisi"
          onLayout={(event) =>
            setCanvasSize({
              width: event.nativeEvent.layout.width,
              height: event.nativeEvent.layout.height,
            })
          }
          style={[styles.mapCanvas, { aspectRatio: FLOOR_PLAN_ASPECT_RATIO }]}
        >
          {/* Referans ızgara: admin duvar çizerken her dokunuş bu ızgaranın
              en yakın kesişimine yapıştırılıyor (bkz. snapToGrid) — çizgiler
              bu sayede yamuk/eğri çıkmıyor. Sadece görsel bir kılavuz,
              dokunmayı engellemiyor. */}
          <Svg pointerEvents="none" style={StyleSheet.absoluteFill} viewBox="0 0 100 100" preserveAspectRatio="none">
            {Array.from({ length: GRID_COLS + 1 }).map((_, index) => (
              <Line
                key={`grid-v-${index}`}
                x1={(index * 100) / GRID_COLS}
                y1={0}
                x2={(index * 100) / GRID_COLS}
                y2={100}
                stroke="rgba(255,255,255,0.1)"
                strokeWidth={0.25}
              />
            ))}
            {Array.from({ length: GRID_ROWS + 1 }).map((_, index) => (
              <Line
                key={`grid-h-${index}`}
                x1={0}
                y1={(index * 100) / GRID_ROWS}
                x2={100}
                y2={(index * 100) / GRID_ROWS}
                stroke="rgba(255,255,255,0.1)"
                strokeWidth={0.25}
              />
            ))}
          </Svg>

          {/* Yoğunluk ısı haritası — harita merkezi ayarlandıysa (bkz.
              settings.venueCenterLat, VenueCenterModal) canlı konum
              ping'lerinden özetlenmiş hücreler (bkz. heatBlobs) her biri
              yarı saydam, kırmızı(yoğun)-yeşil(az yoğun) bir radyal gradyan
              olarak çiziliyor. Üst üste binen daireler doğal olarak
              birbirine karışıp TEK bir yumuşak leke gibi görünüyor — ayrı
              ızgara hücreleri belli olmuyor. Merkez ayarlanmadıysa hiç
              render edilmiyor. */}
          {settings.venueCenterLat != null && heatBlobs.length ? (
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

          {!displayWalls.length && !wallDrawing ? (
            <View pointerEvents="none" style={styles.uploadHint}>
              <PenLine size={18} color="rgba(255,255,255,0.55)" />
              <Text style={styles.uploadHintText}>
                Henüz kroki çizilmedi. Yukarıdaki "Duvar Ekle" butonuyla etkinlik alanının
                duvarlarını ızgaraya oturarak çizmeye başlayın.
              </Text>
            </View>
          ) : null}

          {/* İnce bir artı çizgisi krokiyi dört bölgeye ayırıyor — sadece
              görsel bir referans, dokunmayı engellemiyor. */}
          <View pointerEvents="none" style={styles.centerDividerV} />
          <View pointerEvents="none" style={styles.centerDividerH} />

          {/* Sabit "giriş kapısı" işareti — taşınamaz/silinemez, krokinin her
              zaman aynı yerinde duran görsel bir referans (bkz.
              lib/floorPlanGrid.ts > ENTRANCE_GATE_LINE). Rota bulmaya dahil
              değil, sadece admin ve katılımcı ekranında tutarlı görünsün diye. */}
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

          {layers.zones
            ? ZONE_ORDER.map((code) => {
                const { right, bottom } = zoneQuadrant(code);
                return (
                  <View
                    key={code}
                    pointerEvents="none"
                    style={[
                      styles.zoneCornerTag,
                      { backgroundColor: ZONE_COLORS[code] },
                      right ? { right: 10 } : { left: 10 },
                      bottom ? { bottom: 10 } : { top: 10 },
                    ]}
                  >
                    <Text style={styles.zoneCornerTagText}>{ZONE_LETTER[code]}</Text>
                  </View>
                );
              })
            : null}

          {displayWalls.length ? (
            <Svg
              pointerEvents="none"
              style={StyleSheet.absoluteFill}
              viewBox="0 0 100 100"
              preserveAspectRatio="none"
            >
              {displayWalls.map((wall) => (
                <Line
                  key={wall.id}
                  x1={wall.x1}
                  y1={wall.y1}
                  x2={wall.x2}
                  y2={wall.y2}
                  stroke="#f87171"
                  strokeWidth={1.8}
                  strokeLinecap="round"
                />
              ))}
            </Svg>
          ) : null}

          {wallDrawing
            ? displayWalls.map((wall) => {
                const midX = (wall.x1 + wall.x2) / 2;
                const midY = (wall.y1 + wall.y2) / 2;
                return (
                  <Pressable
                    key={`wall-delete-${wall.id}`}
                    onPress={() => handleDeleteWall(wall.id)}
                    style={[styles.wallDeleteHandle, { left: `${midX}%`, top: `${midY}%` }]}
                  >
                    <X size={11} color={colors.white} />
                  </Pressable>
                );
              })
            : null}

          {wallDrawing && wallStart ? (
            <View
              pointerEvents="none"
              style={[styles.wallStartMarker, { left: `${wallStart.x}%`, top: `${wallStart.y}%` }]}
            />
          ) : null}

          {/* Su sebilleri — artık krokide etiketi basılı tutup sürükleyerek
              taşınabiliyor (bkz. handleMoveWaterStation), tıpkı stant/sahne
              pin'leri gibi. Yeni su sebili eklemek için üstteki "Su Sebili
              Ekle" butonu kullanılıyor (bkz. handleAddWaterStation); silme/
              durum takibi hâlâ "Su İstasyonları" sekmesinde. */}
          {waterStations.map((station) => {
            const pending = pendingPositions[`water:${station.id}`];
            const x = pending ? pending.x : station.map_x;
            const y = pending ? pending.y : station.map_y;
            return (
              <DraggablePin
                key={`water-${station.id}`}
                x={x}
                y={y}
                canvasSize={canvasSize}
                onSelect={() => {}}
                onDrop={(nx, ny) => handleMoveWaterStation(station.id, nx, ny)}
                style={[
                  styles.waterPin,
                  station.status !== 'active' && styles.waterPinAlert,
                  pending && styles.pinPendingSave,
                ]}
              >
                <Droplet size={8} color={colors.white} />
              </DraggablePin>
            );
          })}

          {layers.booths
            ? booths.filter(isBoothOnCanvas).map((booth) => {
                const active = selectedBooth?.id === booth.id;
                const pos = boothMapPosition(booth);
                const pending = `booth:${booth.id}` in pendingPositions;
                const zone = isBoothPlaced(booth) ? booth.zone! : zoneForPercent(pos.x, pos.y);
                return (
                  <DraggablePin
                    key={booth.id}
                    x={pos.x}
                    y={pos.y}
                    canvasSize={canvasSize}
                    onSelect={() => selectBooth(booth)}
                    onDrop={(x, y) => placeBoothAt(booth, x, y)}
                    style={[styles.boothPin, active && styles.boothPinSelected, pending && styles.pinPendingSave]}
                  >
                    <View style={[styles.boothPulse, { backgroundColor: ZONE_COLORS[zone] }]} />
                    <Text style={styles.boothPinText} numberOfLines={1}>
                      {booth.boothNo}
                    </Text>
                  </DraggablePin>
                );
              })
            : null}

          {layers.stages
            ? stages.filter(isStageOnCanvas).map((stage) => {
                const active = selectedStage?.id === stage.id;
                const pos = stageMapPosition(stage);
                const pending = `stage:${stage.id}` in pendingPositions;
                return (
                  <DraggablePin
                    key={stage.id}
                    x={pos.x}
                    y={pos.y}
                    canvasSize={canvasSize}
                    onSelect={() => selectStage(stage)}
                    onDrop={(x, y) => moveStageTo(stage, x, y)}
                    style={[styles.stagePin, active && styles.stagePinSelected, pending && styles.pinPendingSave]}
                  >
                    <View style={styles.stagePulse} />
                    <Text style={styles.stagePinText} numberOfLines={1}>
                      {shortStageLabel(stage.name)}
                    </Text>
                  </DraggablePin>
                );
              })
            : null}

          {wallDrawing ? (
            <Pressable
              accessibilityLabel="Krokide duvar noktası seç"
              onPress={handleCanvasPress}
              style={[StyleSheet.absoluteFill, styles.placementOverlay]}
            />
          ) : null}
        </View>

        <View style={styles.trayCard}>
          <View style={styles.trayHeader}>
            <Text style={styles.trayTitle}>YERLEŞTİRİLMEMİŞ ÖĞELER</Text>
            <Text style={styles.trayCount}>{unplacedBooths.length + unplacedStages.length}</Text>
          </View>
          {unplacedBooths.length + unplacedStages.length === 0 ? (
            <Text style={styles.trayEmptyText}>
              Tüm stant ve alanlar krokiye yerleştirildi. Yeni bir stant/alan eklediğinde burada
              görünür.
            </Text>
          ) : (
            <View style={styles.trayList}>
              {unplacedBooths.map((booth) => (
                <Pressable
                  key={`tray-booth-${booth.id}`}
                  style={styles.trayChip}
                  onPress={() => bringBoothToMap(booth)}
                >
                  <Store size={13} color={colors.primary} />
                  <View style={styles.trayChipCopy}>
                    <Text style={styles.trayChipTitle} numberOfLines={1}>
                      {booth.companyName || 'Yeni Stand'}
                    </Text>
                    <Text style={styles.trayChipSubtitle} numberOfLines={1}>
                      Stant · Krokiye eklemek için dokun
                    </Text>
                  </View>
                </Pressable>
              ))}
              {unplacedStages.map((stage) => (
                <Pressable
                  key={`tray-stage-${stage.id}`}
                  style={styles.trayChip}
                  onPress={() => bringStageToMap(stage)}
                >
                  <Radio size={13} color={colors.primary} />
                  <View style={styles.trayChipCopy}>
                    <Text style={styles.trayChipTitle} numberOfLines={1}>
                      {stage.name}
                    </Text>
                    <Text style={styles.trayChipSubtitle} numberOfLines={1}>
                      {stage.type} · Krokiye eklemek için dokun
                    </Text>
                  </View>
                </Pressable>
              ))}
            </View>
          )}
        </View>
      </>
    );
  }

  async function handleExportKroki() {
    let Print: typeof import('expo-print');
    let Sharing: typeof import('expo-sharing');
    try {
      Print = require('expo-print');
      Sharing = require('expo-sharing');
    } catch {
      onNotify?.('Bu özellik için uygulamanın güncel bir build ile yeniden kurulması gerekiyor.');
      return;
    }

    setExporting(true);
    try {
      const html = buildKrokiHtml(zones, booths, stages, 'Take Off', settings.floorPlanWalls);
      const { uri } = await Print.printToFileAsync({ html });
      const canShare = await Sharing.isAvailableAsync();
      if (canShare) {
        await Sharing.shareAsync(uri, { mimeType: 'application/pdf', dialogTitle: 'Etkinlik Krokisi' });
      } else {
        onNotify?.('PDF oluşturuldu ama bu cihazda paylaşım seçeneği yok.');
      }
    } catch (error) {
      onNotify?.(error instanceof Error ? `Kroki oluşturulamadı: ${error.message}` : 'Kroki oluşturulamadı.');
    } finally {
      setExporting(false);
    }
  }

  return (
    <View style={styles.page}>
      <View style={styles.header}>
        <View style={styles.headerCopy}>
          <Text style={styles.title}>Etkinlik Haritası ve Alan Koordinat Yönetimi</Text>
          <Text style={styles.subtitle}>
            Krokiyi tamamen elle çiziyorsun: duvarları "Duvar Ekle" ile çiz, istediğin kadar çizgi
            ekleyip en sonda "Kaydet" ile tek seferde kaydet. Stant/alanları aşağıdaki
            "Yerleştirilmemiş Öğeler" listesinden seçip krokiye getir, su sebillerini "Su Sebili
            Ekle" ile ekle, sonra hepsinin etiketini basılı tutup istediğin kadar sürükle — hiçbiri
            anında kaydedilmez, bitirince "Konumları Kaydet"e basınca hepsi tek seferde kaydedilir.
            Rota bulma sırasında aradan geçilmemesi gereken duvarları bu krokiye özel olarak
            işaretleyebilirsin.
          </Text>
          <View style={styles.headerButtonsRow}>
            <Pressable style={styles.uploadBtn} onPress={() => setFocusMode(true)}>
              <Maximize2 size={14} color={colors.primary} />
              <Text style={styles.uploadBtnText}>Tam Ekran Çiz</Text>
            </Pressable>
            <Pressable
              style={[styles.uploadBtn, wallDrawing && styles.wallToolBtnActive]}
              onPress={handleWallToolPress}
              disabled={savingWalls}
            >
              {savingWalls ? (
                <ActivityIndicator size="small" color={wallDrawing ? colors.white : colors.primary} />
              ) : (
                <PenLine size={14} color={wallDrawing ? colors.white : colors.primary} />
              )}
              <Text style={[styles.uploadBtnText, wallDrawing && styles.wallToolBtnTextActive]}>
                {savingWalls
                  ? 'Kaydediliyor…'
                  : wallDrawing
                    ? `Duvarları Kaydet (${displayWalls.length})`
                    : `Duvar Ekle (${displayWalls.length})`}
              </Text>
            </Pressable>
            <Pressable style={styles.uploadBtn} onPress={handleAddWaterStation} disabled={createWaterStation.isPending}>
              {createWaterStation.isPending ? (
                <ActivityIndicator size="small" color={colors.primary} />
              ) : (
                <Droplet size={14} color={colors.primary} />
              )}
              <Text style={styles.uploadBtnText}>Su Sebili Ekle ({waterStations.length})</Text>
            </Pressable>
            <Pressable
              style={[styles.uploadBtn, settings.venueCenterLat != null && styles.wallToolBtnActive]}
              onPress={() => setVenueCenterModalVisible(true)}
            >
              <Target
                size={14}
                color={settings.venueCenterLat != null ? colors.white : colors.primary}
              />
              <Text
                style={[styles.uploadBtnText, settings.venueCenterLat != null && styles.wallToolBtnTextActive]}
              >
                {settings.venueCenterLat != null ? 'Harita Merkezi Ayarlı' : 'Harita Merkezini Ayarla'}
              </Text>
            </Pressable>
            <Pressable
              style={[styles.uploadBtn, pendingPositionCount === 0 && styles.uploadBtnDisabled]}
              onPress={() => void saveAllPositions()}
              disabled={savingPositions || pendingPositionCount === 0}
            >
              {savingPositions ? (
                <ActivityIndicator size="small" color={colors.primary} />
              ) : (
                <Check size={14} color={colors.primary} />
              )}
              <Text style={styles.uploadBtnText}>
                {savingPositions ? 'Kaydediliyor…' : `Konumları Kaydet (${pendingPositionCount})`}
              </Text>
            </Pressable>
            <Pressable style={styles.exportBtn} onPress={handleExportKroki} disabled={exporting}>
              {exporting ? (
                <ActivityIndicator size="small" color={colors.white} />
              ) : (
                <Share2 size={14} color={colors.white} />
              )}
              <Text style={styles.exportBtnText}>Krokiyi Belge Olarak Gönder</Text>
            </Pressable>
          </View>
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
          </View>
        </View>
      </View>

      <View style={[styles.mainGrid, wide && styles.mainGridWide]}>
        <View style={[styles.mapCard, wide && styles.mapCardWide]}>
          {focusMode ? (
            <Pressable style={styles.focusReopenCard} onPress={() => setFocusMode(false)}>
              <Maximize2 size={18} color={colors.textMuted} />
              <Text style={styles.focusReopenText}>
                Kroki şu anda "Tam Ekran Çiz" modunda düzenleniyor. Kapatmak için dokun.
              </Text>
            </Pressable>
          ) : (
            renderMapCardBody()
          )}
        </View>

        <View style={[styles.inspectorColumn, wide && styles.inspectorColumnWide]}>
          {selectedBooth ? (
            <View style={styles.inspectorCard}>
              <View style={styles.inspectorHeader}>
                <View style={styles.inspectorHeaderTitle}>
                  <Store size={17} color={colors.primary} />
                  <Text style={styles.eyebrow}>STANT BİLGİ PANELİ</Text>
                </View>
                <Text style={styles.boothNumber}>{selectedBooth.boothNo || 'Yerleştirilmedi'}</Text>
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
                <InfoLine
                  label="Kroki Konumu:"
                  value={
                    isBoothOnCanvas(selectedBooth)
                      ? `${boothZoneDisplay(selectedBooth)} · X %${boothMapPosition(selectedBooth).x} · Y %${
                          boothMapPosition(selectedBooth).y
                        }${`booth:${selectedBooth.id}` in pendingPositions ? ' · kaydedilmedi' : ''}`
                      : 'Henüz yerleştirilmedi'
                  }
                  valueColor={isBoothOnCanvas(selectedBooth) ? colors.primary : colors.textMuted}
                />
                <InfoLine
                  label="Ziyaret & Check-in:"
                  value={`${selectedBooth.totalVisits.toLocaleString('tr-TR')} kişi`}
                />
                {settings.venueCenterLat != null && isBoothOnCanvas(selectedBooth) ? (
                  <InfoLine
                    label="Merkeze Uzaklık:"
                    value={formatDistanceFromCenter(boothMapPosition(selectedBooth), settings.venueRadiusMeters)}
                  />
                ) : null}
              </View>

              {isBoothOnCanvas(selectedBooth) ? (
                // Stant zaten krokide bir pin'e sahip — taşıma artık sadece
                // etiketi sürükleyerek yapılıyor, ayrı bir "yerini değiştir"
                // butonu/tıkla-yerleştir modu bilinçli olarak kaldırıldı
                // (o mod tüm krokiyi kaplayan bir tıklama katmanı açıyordu ve
                // bu da sürüklemeyi engelliyordu).
                <View style={styles.dragHint}>
                  <Move size={14} color={colors.textMuted} />
                  <Text style={styles.dragHintText}>
                    Taşımak için krokideki etiketi basılı tutup sürükleyin. Konum değişiklikleri
                    "Konumları Kaydet"e basana kadar geçici kalır.
                  </Text>
                </View>
              ) : (
                <Pressable style={styles.moveButton} onPress={() => bringBoothToMap(selectedBooth)}>
                  <Move size={16} color={colors.primary} />
                  <Text style={styles.moveButtonText}>Krokiye Ekle</Text>
                </Pressable>
              )}
              {isBoothOnCanvas(selectedBooth) ? (
                <Pressable style={styles.unplaceButton} onPress={handleUnplace}>
                  <X size={13} color={colors.textMuted} />
                  <Text style={styles.unplaceButtonText}>Krokiden Kaldır</Text>
                </Pressable>
              ) : null}
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
                <Text style={styles.stageZone}>{stageZoneDisplay(selectedStage) || 'Yerleştirilmedi'}</Text>
              </View>
              <View>
                <Text style={styles.stageName}>{selectedStage.name}</Text>
                <Text style={styles.companyCategory}>{selectedStage.type}</Text>
              </View>
              <Text style={styles.description}>{selectedStage.description}</Text>
              <View style={styles.infoBox}>
                <InfoLine
                  label="Kroki Konumu:"
                  value={
                    isStageOnCanvas(selectedStage)
                      ? `${stageZoneDisplay(selectedStage)} · X %${stageMapPosition(selectedStage).x} · Y %${
                          stageMapPosition(selectedStage).y
                        }${`stage:${selectedStage.id}` in pendingPositions ? ' · kaydedilmedi' : ''}`
                      : 'Henüz yerleştirilmedi'
                  }
                  valueColor={isStageOnCanvas(selectedStage) ? colors.primary : colors.textMuted}
                />
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
                {settings.venueCenterLat != null && isStageOnCanvas(selectedStage) ? (
                  <InfoLine
                    label="Merkeze Uzaklık:"
                    value={formatDistanceFromCenter(stageMapPosition(selectedStage), settings.venueRadiusMeters)}
                  />
                ) : null}
              </View>

              {isStageOnCanvas(selectedStage) ? (
                <View style={styles.dragHint}>
                  <Move size={14} color={colors.textMuted} />
                  <Text style={styles.dragHintText}>
                    Taşımak için krokideki etiketi basılı tutup sürükleyin. Konum değişiklikleri
                    "Konumları Kaydet"e basana kadar geçici kalır.
                  </Text>
                </View>
              ) : (
                <Pressable style={styles.moveButton} onPress={() => bringStageToMap(selectedStage)}>
                  <Move size={16} color={colors.primary} />
                  <Text style={styles.moveButtonText}>Krokiye Ekle</Text>
                </Pressable>
              )}
              {isStageOnCanvas(selectedStage) ? (
                <Pressable style={styles.unplaceButton} onPress={handleUnplaceStage}>
                  <X size={13} color={colors.textMuted} />
                  <Text style={styles.unplaceButtonText}>Krokiden Kaldır</Text>
                </Pressable>
              ) : null}
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
              <Pressable
                style={styles.addZoneBtn}
                onPress={() => {
                  setEditingZone(null);
                  setZoneModalVisible(true);
                }}
              >
                <Plus size={13} color={colors.primary} />
                <Text style={styles.addZoneBtnText}>Yeni Bölge</Text>
              </Pressable>
            </View>
            <View style={styles.summaryList}>
              {zones.map((zone) => {
                const density = DENSITY_STYLES[zone.densityLevel];
                return (
                  <View key={zone.id} style={styles.summaryRow}>
                    <View
                      style={[
                        styles.summaryAccent,
                        { backgroundColor: ZONE_COLORS[zone.code] || zone.color },
                      ]}
                    />
                    <View style={styles.summaryCopy}>
                      <Text style={styles.summaryCode}>{zone.code}</Text>
                      <Text style={styles.summaryName} numberOfLines={1}>
                        {zoneSubtitle(zone)}
                      </Text>
                      <Text style={styles.summaryGeofence} numberOfLines={1}>
                        {settings.venueCenterLat != null ? 'Canlı (harita merkezine göre)' : 'Manuel giriş'}
                      </Text>
                    </View>
                    <View style={styles.summaryValue}>
                      <Text style={styles.summaryCount}>
                        {zone.activeAttendees.toLocaleString('tr-TR')} kişi
                      </Text>
                      <Text style={[styles.summaryDensity, { color: density.barColor }]}>
                        {zone.densityLevel} · %{zone.densityPercent}
                      </Text>
                      <View style={styles.summaryBarTrack}>
                        <View
                          style={[
                            styles.summaryBarFill,
                            {
                              width: `${Math.min(100, Math.max(0, zone.densityPercent))}%` as DimensionValue,
                              backgroundColor: density.barColor,
                            },
                          ]}
                        />
                      </View>
                    </View>
                    <Pressable
                      style={styles.editZoneBtn}
                      onPress={() => {
                        setEditingZone(zone);
                        setZoneModalVisible(true);
                      }}
                      hitSlop={8}
                    >
                      <Edit3 size={14} color={colors.textMuted} />
                    </Pressable>
                  </View>
                );
              })}
            </View>
          </View>
        </View>
      </View>

      <ZoneGeofenceModal
        visible={zoneModalVisible}
        zone={editingZone}
        onClose={() => setZoneModalVisible(false)}
        onNotify={onNotify}
      />

      <VenueCenterModal
        visible={venueCenterModalVisible}
        settings={settings}
        onClose={() => setVenueCenterModalVisible(false)}
        onNotify={onNotify}
      />

      {/* "Tam Ekran Çiz" modu: admin elle çizim yaparken çok daha geniş bir
          alanda çalışabilsin diye krokiyi tüm ekranı kaplayan bir Modal'da
          açıyor. İçerik (renderMapCardBody) normal ekrandakiyle BİREBİR
          AYNI — yukarıda focusMode true iken normal karttaki gerçek canvas
          render edilmiyor (sadece bir "kapat" kartı), bu yüzden ikisi aynı
          anda monte olup canvasSize ölçümünü karıştırmıyor. */}
      <Modal visible={focusMode} animationType="slide" onRequestClose={() => setFocusMode(false)}>
        <View style={styles.focusScreen}>
          <View style={styles.focusHeader}>
            <Text style={styles.focusHeaderTitle}>Krokiyi Çiz</Text>
            <Pressable
              accessibilityLabel="Tam ekran çizimi kapat"
              style={styles.focusCloseBtn}
              onPress={() => setFocusMode(false)}
              hitSlop={8}
            >
              <X size={18} color={colors.text} />
            </Pressable>
          </View>
          <ScrollView contentContainerStyle={styles.focusScrollContent}>{renderMapCardBody()}</ScrollView>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  page: { gap: 20 },
  header: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 14 },
  headerCopy: { flex: 1, minWidth: 260, gap: 10 },
  title: { color: colors.text, fontSize: 25, fontWeight: '900', letterSpacing: -0.5 },
  subtitle: { color: colors.textMuted, fontSize: 13, lineHeight: 19, marginTop: 4 },
  exportBtn: {
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    paddingHorizontal: 12,
    paddingVertical: 9,
    borderRadius: 10,
    backgroundColor: colors.primary,
  },
  exportBtnText: { color: colors.white, fontSize: 11, fontWeight: '900' },
  headerButtonsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  uploadBtn: {
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    paddingHorizontal: 12,
    paddingVertical: 9,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.primary,
    backgroundColor: colors.primarySoft,
  },
  uploadBtnText: { color: colors.primary, fontSize: 11, fontWeight: '900' },
  // "Konumları Kaydet" butonu bekleyen bir değişiklik yokken bu şekilde
  // soluklaştırılıyor — hâlâ basılabilir görünüp kafa karıştırmasın diye.
  uploadBtnDisabled: { opacity: 0.4 },
  wallToolBtnActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  wallToolBtnTextActive: { color: colors.white },
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
  // Admin krokiyi tamamen elle çizdiği için kroki kartına mümkün olduğunca
  // çok yer ayrılıyor — bilgi paneli (inspectorColumnWide) sabit bir üst
  // sınırda (430) kaldığından geri kalan tüm boşluk krokiye gidiyor (bkz.
  // AdminWorkspace.tsx > contentWide, geniş ekranlarda sayfanın kendisi de
  // büyütüldü ki kroki dar bir alana sıkışmasın).
  mapCardWide: { flex: 5 },
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
  repositionAlertError: { backgroundColor: '#b91c1c' },
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
    // Sabit en-boy oranı (FLOOR_PLAN_ASPECT_RATIO, bkz. lib/floorPlanGrid.ts)
    // katılımcı ekranıyla (app/(tabs)/map.tsx) birebir aynı — admin'in
    // çizdiği duvarlar ve yerleştirdiği pinler iki ekranda da tam olarak
    // aynı noktaya denk geliyor. Kroki artık bir fotoğraf olmadığı için
    // (tamamen admin'in elle çizdiği bir vektör plan) burada sabit bir
    // koyu zemin kullanılıyor.
    width: '100%',
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#374151',
    borderRadius: 16,
    backgroundColor: '#0f172a',
  },
  uploadHint: {
    position: 'absolute',
    left: 24,
    right: 24,
    top: '40%',
    alignItems: 'center',
    gap: 8,
    padding: 14,
  },
  uploadHintText: {
    color: 'rgba(255,255,255,0.65)',
    fontSize: 10,
    lineHeight: 15,
    textAlign: 'center',
  },
  placementOverlay: { zIndex: 10 },
  wallDeleteHandle: {
    position: 'absolute',
    zIndex: 15,
    width: 22,
    height: 22,
    marginLeft: -11,
    marginTop: -11,
    borderRadius: 11,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#dc2626',
    borderWidth: 1.5,
    borderColor: colors.white,
  },
  wallStartMarker: {
    position: 'absolute',
    zIndex: 11,
    width: 12,
    height: 12,
    marginLeft: -6,
    marginTop: -6,
    borderRadius: 6,
    backgroundColor: '#f87171',
    borderWidth: 2,
    borderColor: colors.white,
  },
  centerDividerV: {
    position: 'absolute',
    left: '50%',
    top: 0,
    bottom: 0,
    width: StyleSheet.hairlineWidth,
    backgroundColor: 'rgba(255,255,255,0.35)',
  },
  centerDividerH: {
    position: 'absolute',
    top: '50%',
    left: 0,
    right: 0,
    height: StyleSheet.hairlineWidth,
    backgroundColor: 'rgba(255,255,255,0.35)',
  },
  zoneCornerTag: {
    position: 'absolute',
    width: 26,
    height: 26,
    borderRadius: 13,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
    borderColor: colors.white,
  },
  zoneCornerTagText: { color: colors.white, fontSize: 12, fontWeight: '900' },
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
  compassRow: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    marginBottom: 8,
  },
  compassBadge: {
    width: 42,
    height: 42,
    borderRadius: 21,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
    borderColor: colors.borderStrong,
    backgroundColor: colors.surfaceMuted,
  },
  compassNeedle: {
    position: 'absolute',
    top: 4,
    width: 0,
    height: 0,
    borderLeftWidth: 4,
    borderRightWidth: 4,
    borderBottomWidth: 7,
    borderLeftColor: 'transparent',
    borderRightColor: 'transparent',
    borderBottomColor: colors.primary,
  },
  compassLabel: { position: 'absolute', color: colors.text, fontSize: 9, fontWeight: '900' },
  compassLabelTop: { top: 11, color: colors.primary },
  compassLabelBottom: { bottom: 3, opacity: 0.6 },
  compassLabelRight: { right: 4, opacity: 0.6 },
  compassLabelLeft: { left: 4, opacity: 0.6 },
  waterPin: {
    position: 'absolute',
    zIndex: 3,
    width: 15,
    height: 15,
    transform: [{ translateX: -7.5 }, { translateY: -7.5 }],
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 8,
    borderWidth: 1.5,
    borderColor: colors.white,
    backgroundColor: '#0ea5e9',
  },
  waterPinAlert: { backgroundColor: colors.danger },
  boothPin: {
    position: 'absolute',
    zIndex: 4,
    maxWidth: 78,
    minHeight: 19,
    transform: [{ translateX: -7 }, { translateY: -9.5 }],
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    paddingHorizontal: 5,
    paddingVertical: 2,
    borderWidth: 1,
    borderColor: '#64748b',
    borderRadius: 6,
    backgroundColor: 'rgba(15,23,42,0.94)',
  },
  boothPinSelected: {
    borderColor: colors.white,
    transform: [{ translateX: -7 }, { translateY: -9.5 }, { scale: 1.06 }],
  },
  boothPulse: { width: 5, height: 5, borderRadius: 3 },
  boothPinText: { flexShrink: 1, color: colors.white, fontSize: 7, fontWeight: '900' },
  pinDragging: {
    zIndex: 20,
    borderColor: colors.white,
    borderWidth: 2,
    shadowColor: '#000',
    shadowOpacity: 0.35,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 3 },
    elevation: 8,
  },
  // Konumu taslakta değişmiş ama henüz "Konumları Kaydet"e basılmamış bir
  // stant/sahne/su sebili pin'ini kesikli turuncu bir çerçeveyle işaretler —
  // admin hangi öğelerin kaydedilmeyi beklediğini krokiye bakarak görebilsin.
  pinPendingSave: {
    borderColor: '#f59e0b',
    borderWidth: 2,
    borderStyle: 'dashed',
  },
  legendRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 3,
    paddingBottom: 10,
  },
  legendLabel: { color: colors.textMuted, fontSize: 9, fontWeight: '800' },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  legendSwatch: { width: 10, height: 10, borderRadius: 3 },
  legendItemText: { color: colors.textMuted, fontSize: 9, fontWeight: '700' },
  stagePin: {
    position: 'absolute',
    zIndex: 4,
    maxWidth: 88,
    minHeight: 20,
    transform: [{ translateX: -8 }, { translateY: -10 }],
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    paddingHorizontal: 5,
    paddingVertical: 2,
    borderWidth: 1,
    borderColor: '#64748b',
    borderRadius: 7,
    backgroundColor: 'rgba(15,23,42,0.94)',
  },
  stagePinSelected: {
    borderColor: colors.primary,
    transform: [{ translateX: -8 }, { translateY: -10 }, { scale: 1.06 }],
  },
  stagePulse: { width: 5, height: 5, borderRadius: 3, backgroundColor: '#34d399' },
  stagePinText: { flexShrink: 1, color: colors.white, fontSize: 7, fontWeight: '800' },
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
  dragHint: {
    minHeight: 40,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 10,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surfaceMuted,
  },
  dragHintText: { flex: 1, color: colors.textMuted, fontSize: 10, lineHeight: 14, fontWeight: '700' },
  unplaceButton: {
    minHeight: 32,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    marginTop: 8,
    borderRadius: 9,
    borderWidth: 1,
    borderColor: colors.border,
  },
  unplaceButtonText: { color: colors.textMuted, fontSize: 9, fontWeight: '800' },
  actionRow: { flexDirection: 'row', gap: 8, marginTop: 8 },
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
  summaryGeofence: { color: colors.textFaint, fontSize: 8, marginTop: 2 },
  summaryValue: { alignItems: 'flex-end', minWidth: 54 },
  summaryCount: { color: colors.text, fontSize: 10, fontWeight: '900' },
  summaryDensity: { fontSize: 8, fontWeight: '900', marginTop: 2 },
  summaryBarTrack: {
    width: 54,
    height: 4,
    marginTop: 4,
    borderRadius: 2,
    overflow: 'hidden',
    backgroundColor: colors.border,
  },
  summaryBarFill: { height: '100%', borderRadius: 2 },
  addZoneBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 999,
    backgroundColor: colors.primarySoft,
  },
  addZoneBtnText: { color: colors.primary, fontSize: 9, fontWeight: '800' },
  editZoneBtn: {
    width: 26,
    height: 26,
    borderRadius: 13,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.background,
    borderWidth: 1,
    borderColor: colors.border,
  },
  // "Yerleştirilmemiş Öğeler" tepsisi — kroki canvas'ının hemen altında,
  // admin'in yeni eklediği (henüz krokiye getirilmemiş) stant/alanları
  // listeler. Bir chip'e dokunmak onu otomatik olarak krokiye getirir (bkz.
  // bringBoothToMap/bringStageToMap), admin sonra sürükleyerek yerini ayarlar.
  trayCard: {
    marginTop: 14,
    padding: 12,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 14,
    backgroundColor: colors.surfaceMuted,
    gap: 8,
  },
  trayHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  trayTitle: { color: colors.textMuted, fontSize: 10, fontWeight: '900', letterSpacing: 0.5 },
  trayCount: {
    color: colors.primary,
    fontSize: 10,
    fontWeight: '900',
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 999,
    backgroundColor: colors.primarySoft,
    overflow: 'hidden',
  },
  trayEmptyText: { color: colors.textFaint, fontSize: 11, lineHeight: 16 },
  trayList: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  trayChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    maxWidth: 220,
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: 11,
    borderWidth: 1,
    borderColor: colors.primaryLight,
    backgroundColor: colors.surface,
  },
  trayChipCopy: { minWidth: 0 },
  trayChipTitle: { color: colors.text, fontSize: 11, fontWeight: '800' },
  trayChipSubtitle: { color: colors.textFaint, fontSize: 9, marginTop: 1 },
  // "Tam Ekran Çiz" modu — admin krokiyi elle çizerken çok daha geniş bir
  // alanda çalışabilsin diye tüm ekranı kaplayan bir Modal (bkz.
  // renderMapCardBody/focusMode).
  focusReopenCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    padding: 20,
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: colors.border,
    borderRadius: 16,
    backgroundColor: colors.surfaceMuted,
  },
  focusReopenText: { flex: 1, color: colors.textMuted, fontSize: 12, lineHeight: 17, fontWeight: '700' },
  focusScreen: { flex: 1, backgroundColor: colors.background },
  focusHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    backgroundColor: colors.surface,
  },
  focusHeaderTitle: { color: colors.text, fontSize: 17, fontWeight: '900' },
  focusCloseBtn: {
    width: 34,
    height: 34,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 17,
    backgroundColor: colors.surfaceMuted,
  },
  focusScrollContent: { padding: 16, paddingBottom: 40 },
});

const modalStyles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(15,23,42,0.5)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
  },
  card: {
    width: '100%',
    maxWidth: 420,
    maxHeight: '85%',
    backgroundColor: colors.white,
    borderRadius: 20,
    overflow: 'hidden',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  title: { fontSize: 15, fontWeight: '800', color: colors.text },
  form: { padding: 16, gap: 14 },
  errorText: {
    color: colors.danger,
    backgroundColor: colors.dangerBg,
    borderWidth: 1,
    borderColor: colors.dangerBorder,
    borderRadius: 10,
    padding: 10,
    fontSize: 12,
  },
  field: { gap: 6 },
  row: { flexDirection: 'row', gap: 10 },
  label: { fontSize: 12, fontWeight: '800', color: colors.text },
  input: {
    backgroundColor: colors.background,
    borderWidth: 1,
    borderColor: colors.borderStrong,
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 14,
    fontSize: 14,
    color: colors.text,
  },
  hint: { fontSize: 11, color: colors.textFaint, lineHeight: 15, marginTop: 2 },
  locateBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 11,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.primary,
    backgroundColor: colors.primarySoft,
  },
  locateBtnText: { color: colors.primary, fontSize: 13, fontWeight: '800' },
  actions: { flexDirection: 'row', gap: 10, marginTop: 4 },
  deleteBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.dangerBorder,
  },
  deleteBtnText: { color: colors.danger, fontSize: 13, fontWeight: '800' },
  saveBtn: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 13,
    borderRadius: 12,
    backgroundColor: colors.primary,
  },
  saveBtnText: { color: colors.white, fontSize: 13, fontWeight: '800' },
});
