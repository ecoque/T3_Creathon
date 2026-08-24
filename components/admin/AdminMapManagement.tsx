import * as Location from 'expo-location';
import {
  Activity,
  Check,
  Crosshair,
  Edit3,
  Layers3,
  Move,
  PenLine,
  Plus,
  Radio,
  Share2,
  Store,
  Trash2,
  Upload,
  X,
} from 'lucide-react-native';
import { useEffect, useRef, useState, type ReactNode } from 'react';
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
import { Line, Svg } from 'react-native-svg';

import { colors } from '../../constants/theme';
import { ZONE_COLORS, ZONE_LETTER, ZONE_ORDER, isBoothPlaced, zoneQuadrant } from '../../lib/boothGrid';
import { useAdminStore } from '../../lib/adminDbStore';
import { buildKrokiHtml } from '../../lib/krokiExport';
import { useImageAspectRatio } from '../../lib/useImageAspectRatio';
import type { AdminBooth, AdminStage, EventSettings, FloorPlanWall, ZoneDensityInfo } from '../../types/admin';

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

// Bir bölgenin merkez GPS koordinatını ve yarıçapını (metre) düzenlemek için
// kullanılan basit form. "Şu anki konumumu kullan" butonu, admin etkinlik
// alanındayken cihazın gerçek konumunu otomatik dolduruyor — poligon köşe
// noktası çizmek gibi bir harita aracına ihtiyaç kalmıyor.
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
  const [lat, setLat] = useState('');
  const [lng, setLng] = useState('');
  const [radius, setRadius] = useState('60');
  const [locating, setLocating] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!visible) return;
    setName(zone?.name || '');
    setLat(zone?.centerLat != null ? String(zone.centerLat) : '');
    setLng(zone?.centerLng != null ? String(zone.centerLng) : '');
    setRadius(zone ? String(zone.radiusMeters) : '60');
    setError(null);
  }, [visible, zone]);

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
    if (!name.trim()) {
      setError('Bölge adı gerekli.');
      return;
    }
    const parsedLat = lat.trim() ? Number(lat.replace(',', '.')) : null;
    const parsedLng = lng.trim() ? Number(lng.replace(',', '.')) : null;
    if ((parsedLat != null && Number.isNaN(parsedLat)) || (parsedLng != null && Number.isNaN(parsedLng))) {
      setError('Enlem/boylam geçerli bir sayı olmalı.');
      return;
    }
    const parsedRadius = Number(radius.replace(',', '.')) || 60;

    setSaving(true);
    setError(null);
    const ok = await saveZone(
      {
        name: name.trim(),
        centerLat: parsedLat,
        centerLng: parsedLng,
        radiusMeters: parsedRadius,
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
                placeholder="60"
                placeholderTextColor={colors.textFaint}
              />
              <Text style={modalStyles.hint}>
                Bu yarıçap içindeki konum ping'leri bu bölgede sayılır. Merkez boşsa bölge haritada
                tanımlanmamış kabul edilir ve kişi sayısı manuel girilir.
              </Text>
            </View>

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
  const uploadFloorPlan = useAdminStore((state) => state.uploadFloorPlan);
  const saveSettings = useAdminStore((state) => state.saveSettings);
  const [layers, setLayers] = useState<Record<LayerKey, boolean>>({
    booths: true,
    stages: true,
    zones: true,
  });
  const [selectedBoothId, setSelectedBoothId] = useState<string | null>(
    selectedBoothIdFromNav || booths[0]?.id || null,
  );
  const [selectedStageId, setSelectedStageId] = useState<string | null>(null);
  const [repositioning, setRepositioning] = useState(false);
  const [placementError, setPlacementError] = useState<string | null>(null);
  const [exporting, setExporting] = useState(false);
  const [uploadingFloorPlan, setUploadingFloorPlan] = useState(false);
  const [canvasSize, setCanvasSize] = useState({ width: 1, height: 1 });
  const [zoneModalVisible, setZoneModalVisible] = useState(false);
  const [editingZone, setEditingZone] = useState<ZoneDensityInfo | null>(null);
  // Duvar çizme modu: her kroki fotoğrafı farklı olduğu için duvarların
  // nerede olduğu otomatik tespit edilmiyor — admin krokiyi yükledikten
  // sonra üzerine elle duvar çizgileri çiziyor (iki noktaya dokunarak),
  // rota bulma algoritması (lib/routePlanner.ts) bunları stant/sahne gibi
  // birer engel sayıp etraflarından dolanıyor. wallStart, ilk noktaya
  // dokunulduktan sonra ikinci nokta beklenirken geçici olarak tutuluyor.
  const [wallDrawing, setWallDrawing] = useState(false);
  const [wallStart, setWallStart] = useState<{ x: number; y: number } | null>(null);

  const selectedBooth = booths.find((booth) => booth.id === selectedBoothId) || null;
  const selectedStage = stages.find((stage) => stage.id === selectedStageId) || null;
  const hasFloorPlan = !!settings.floorPlanUrl;
  // Katılımcı ekranıyla (app/(tabs)/map.tsx) BİREBİR AYNI en-boy oranı —
  // ikisi de bu hook'u kullanıyor, böylece aynı kroki fotoğrafı hiçbir
  // ekranda farklı kırpılmıyor ve yüzde koordinatlı pin/duvarlar iki
  // ekranda da fotoğrafın tam olarak aynı noktasına denk geliyor.
  const floorPlanAspectRatio = useImageAspectRatio(hasFloorPlan ? settings.floorPlanUrl : null);

  useEffect(() => {
    if (!selectedBoothIdFromNav) return;
    const target = booths.find((booth) => booth.id === selectedBoothIdFromNav);
    if (!target) return;
    setSelectedBoothId(target.id);
    setSelectedStageId(null);
    setPlacementError(null);
    // Krokiye henüz yerleştirilmemiş bir stant için doğrudan yerleştirme
    // moduna geç, admin ekstra bir tıklamaya gerek kalmadan kareyi seçebilsin.
    setRepositioning(!isBoothPlaced(target));
  }, [booths, selectedBoothIdFromNav]);

  useEffect(() => {
    if (!selectedStageIdFromNav) return;
    const target = stages.find((stage) => stage.id === selectedStageIdFromNav);
    if (!target) return;
    setSelectedStageId(target.id);
    setSelectedBoothId(null);
    setPlacementError(null);
    // Bir sahne/alan her zaman krokide zaten bir pin'e sahiptir (yerleştirilmemiş
    // durumu yok) — bu yüzden tıkla-yerleştir modunu (repositioning) hiç açmıyoruz,
    // taşıma artık sadece etiketi sürükleyerek yapılıyor. Bunu true yapmak, tüm
    // krokiyi kaplayan tıklama katmanının (placementOverlay) pinlerin üzerine
    // binip sürüklemeyi tamamen engellemesine yol açıyordu.
    setRepositioning(false);
  }, [stages, selectedStageIdFromNav]);

  useEffect(() => {
    if (selectedBoothId && !booths.some((booth) => booth.id === selectedBoothId)) {
      const nextId = booths[0]?.id || null;
      setSelectedBoothId(nextId);
      setRepositioning(false);
      if (nextId) onSelectBooth?.(nextId);
    }
  }, [booths, onSelectBooth, selectedBoothId]);

  function toggleLayer(key: LayerKey) {
    setLayers((current) => ({ ...current, [key]: !current[key] }));
  }

  function selectBooth(booth: AdminBooth) {
    setSelectedBoothId(booth.id);
    setSelectedStageId(null);
    setRepositioning(false);
    setPlacementError(null);
    onSelectBooth?.(booth.id);
  }

  function selectStage(stage: AdminStage) {
    setSelectedStageId(stage.id);
    setSelectedBoothId(null);
    setRepositioning(false);
    setPlacementError(null);
    onSelectStage?.(stage.id);
  }

  async function handleUnplace() {
    if (!selectedBooth) return;
    const ok = await unplaceBooth(selectedBooth.id);
    onNotify?.(ok ? `${selectedBooth.companyName} krokiden kaldırıldı.` : 'İşlem başarısız oldu.');
  }

  // Hem stantlar hem de sahneler/oturum yerleri artık krokinin (gerçek
  // fotoğraf veya soyut görünüm) herhangi bir noktasına serbestçe dokunularak
  // yerleştiriliyor — kareye takılma yok. Hangi zone'a ait olduğu dokunulan
  // noktanın krokideki çeyreğinden otomatik belirleniyor (bkz.
  // adminRepository.placeBooth / updateStagePosition).
  // Bir standı krokide belirli bir yüzde koordinatına yerleştirir/taşır —
  // hem "buton ile seç, sonra dokun" akışında (handleCanvasPress) hem de
  // etiketi doğrudan sürükleyip bırakınca (DraggablePin > onDrop) kullanılıyor.
  async function placeBoothAt(booth: AdminBooth, x: number, y: number) {
    const ok = await placeBooth(booth.id, x, y);
    if (ok) {
      setRepositioning(false);
      setPlacementError(null);
      const placed = useAdminStore.getState().booths.find((item) => item.id === booth.id);
      onNotify?.(`${placed?.boothNo || booth.companyName} krokiye yerleştirildi.`);
    } else {
      setPlacementError(useAdminStore.getState().error || 'Stant krokiye yerleştirilemedi.');
    }
  }

  async function moveStageTo(stage: AdminStage, x: number, y: number) {
    const ok = await updateStagePosition(stage.id, x, y);
    if (ok) {
      setRepositioning(false);
      setPlacementError(null);
      onNotify?.(`${stage.name} krokide konumlandırıldı.`);
    } else {
      setPlacementError(useAdminStore.getState().error || 'Alan konumu güncellenemedi.');
    }
  }

  function toggleWallDrawing() {
    setWallDrawing((current) => {
      const next = !current;
      if (next) {
        // Duvar modu, stant yerleştirme moduyla aynı anda açık kalmasın —
        // ikisi de aynı tam-ekran tıklama katmanını kullanıyor.
        setRepositioning(false);
        setPlacementError(null);
      }
      setWallStart(null);
      return next;
    });
  }

  async function handleDeleteWall(wallId: string) {
    const ok = await saveSettings({
      floorPlanWalls: settings.floorPlanWalls.filter((wall) => wall.id !== wallId),
    });
    onNotify?.(ok ? 'Duvar silindi.' : useAdminStore.getState().error || 'Duvar silinemedi.');
  }

  // Tıkla-yerleştir modu artık sadece henüz krokiye hiç konulmamış (pini
  // olmayan) bir stant için gerekli — sahneler ve zaten yerleştirilmiş
  // stantlar için taşıma DraggablePin'in onDrop'u üzerinden sürükleyerek
  // yapılıyor (bkz. placeBoothAt / moveStageTo çağrıları aşağıda). Duvar
  // çizme modunda ise ilk dokunuş başlangıç noktasını, ikinci dokunuş
  // bitiş noktasını belirleyip yeni bir duvar çizgisi oluşturuyor.
  async function handleCanvasPress(event: GestureResponderEvent) {
    const x = Math.round((event.nativeEvent.locationX / canvasSize.width) * 100);
    const y = Math.round((event.nativeEvent.locationY / canvasSize.height) * 100);
    const clampedX = Math.max(3, Math.min(97, x));
    const clampedY = Math.max(3, Math.min(97, y));

    if (wallDrawing) {
      if (!wallStart) {
        setWallStart({ x: clampedX, y: clampedY });
        return;
      }
      const newWall: FloorPlanWall = {
        id: `wall-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
        x1: wallStart.x,
        y1: wallStart.y,
        x2: clampedX,
        y2: clampedY,
      };
      setWallStart(null);
      const ok = await saveSettings({ floorPlanWalls: [...settings.floorPlanWalls, newWall] });
      onNotify?.(ok ? 'Duvar eklendi.' : useAdminStore.getState().error || 'Duvar eklenemedi.');
      return;
    }

    if (!repositioning || !selectedBooth) return;
    await placeBoothAt(selectedBooth, clampedX, clampedY);
  }

  async function handlePickFloorPlan() {
    // Lazy require: bu native modül eski Dev Client build'lerinde bulunmayabilir
    // (yeni eklendi, yeni build gerektirir). Statik import tüm dosyayı çökertir.
    let ImagePicker: typeof import('expo-image-picker');
    try {
      ImagePicker = require('expo-image-picker');
    } catch {
      onNotify?.('Bu özellik için uygulamanın güncel bir build ile yeniden kurulması gerekiyor.');
      return;
    }

    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      onNotify?.('Kroki resmi seçmek için galeri izni gerekiyor.');
      return;
    }
    // base64: true — React Native'in fetch()'i yerel galeri URI'lerini
    // güvenilir okuyamadığı için (bkz. adminRepository > uploadFloorPlanImage),
    // resmi doğrudan base64 olarak alıp yüklüyoruz.
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      quality: 0.85,
      base64: true,
    });
    const asset = result.canceled ? null : result.assets?.[0];
    if (!asset?.base64) {
      if (!result.canceled) onNotify?.('Seçilen resim okunamadı, tekrar deneyin.');
      return;
    }
    setUploadingFloorPlan(true);
    try {
      const ok = await uploadFloorPlan(asset.base64, asset.mimeType);
      onNotify?.(ok ? 'Kroki yüklendi.' : useAdminStore.getState().error || 'Kroki yüklenemedi.');
    } finally {
      setUploadingFloorPlan(false);
    }
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
      const html = buildKrokiHtml(zones, booths, stages, settings.floorPlanUrl, 'Take Off', settings.floorPlanWalls);
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
            Stantların krokideki yerleşimi, sahnelerin konumu ve zone yoğunluk katmanları.
            Yerleştirilmiş bir stant veya sahnenin yerini değiştirmek için etiketini basılı
            tutup doğrudan sürükleyin — yeni bir stant için ise "Krokiye Yerleştir" ile
            krokide bir noktaya dokunun. Rota bulma sırasında aradan geçilmemesi gereken
            duvarları "Duvar Ekle" ile bu krokiye özel olarak işaretleyebilirsin.
          </Text>
          <View style={styles.headerButtonsRow}>
            <Pressable style={styles.uploadBtn} onPress={handlePickFloorPlan} disabled={uploadingFloorPlan}>
              {uploadingFloorPlan ? (
                <ActivityIndicator size="small" color={colors.primary} />
              ) : (
                <Upload size={14} color={colors.primary} />
              )}
              <Text style={styles.uploadBtnText}>
                {hasFloorPlan ? 'Krokiyi Değiştir' : 'Kroki Yükle'}
              </Text>
            </Pressable>
            <Pressable
              style={[styles.uploadBtn, wallDrawing && styles.wallToolBtnActive]}
              onPress={toggleWallDrawing}
            >
              <PenLine size={14} color={wallDrawing ? colors.white : colors.primary} />
              <Text style={[styles.uploadBtnText, wallDrawing && styles.wallToolBtnTextActive]}>
                {wallDrawing
                  ? `Duvar Ekleniyor · Bitti (${settings.floorPlanWalls.length})`
                  : `Duvar Ekle (${settings.floorPlanWalls.length})`}
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
          {(repositioning && selectedBooth) || wallDrawing ? (
            <View style={[styles.repositionAlert, placementError && styles.repositionAlertError]}>
              <View style={styles.repositionCopy}>
                <Crosshair size={17} color={colors.white} />
                <Text style={styles.repositionText}>
                  {wallDrawing
                    ? wallStart
                      ? 'Duvarın bitiş noktasına dokunun.'
                      : 'Duvarın başlangıç noktasına dokunun. İstediğin kadar duvar ekleyebilirsin.'
                    : placementError || `"${selectedBooth?.companyName}" için krokide bir noktaya dokunun.`}
                </Text>
              </View>
              <Pressable
                style={styles.cancelMove}
                onPress={() => {
                  if (wallDrawing) {
                    setWallDrawing(false);
                    setWallStart(null);
                  } else {
                    setRepositioning(false);
                    setPlacementError(null);
                  }
                }}
              >
                <X size={14} color={colors.primary} />
                <Text style={styles.cancelMoveText}>{wallDrawing ? 'Bitti' : 'Vazgeç'}</Text>
              </Pressable>
            </View>
          ) : null}

          <DensityLegend />

          <View
            accessibilityLabel="Etkinlik alan krokisi"
            onLayout={(event) =>
              setCanvasSize({
                width: event.nativeEvent.layout.width,
                height: event.nativeEvent.layout.height,
              })
            }
            style={[
              styles.mapCanvas,
              { aspectRatio: floorPlanAspectRatio },
              repositioning && styles.mapCanvasMoving,
            ]}
          >
            {hasFloorPlan ? (
              <Image
                source={{ uri: settings.floorPlanUrl }}
                resizeMode="contain"
                style={StyleSheet.absoluteFill}
              />
            ) : null}

            {!hasFloorPlan ? (
              <View pointerEvents="none" style={styles.uploadHint}>
                <Upload size={18} color="rgba(255,255,255,0.55)" />
                <Text style={styles.uploadHintText}>
                  Henüz gerçek kroki yüklenmedi. Yukarıdaki "Kroki Yükle" butonuyla etkinlik
                  alanının fotoğrafını ekleyin.
                </Text>
              </View>
            ) : null}

            {/* İnce bir artı çizgisi krokiyi dört bölgeye ayırıyor — sadece
                görsel bir referans, dokunmayı engellemiyor. */}
            <View pointerEvents="none" style={styles.centerDividerV} />
            <View pointerEvents="none" style={styles.centerDividerH} />

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

            {settings.floorPlanWalls.length ? (
              <Svg
                pointerEvents="none"
                style={StyleSheet.absoluteFill}
                viewBox="0 0 100 100"
                preserveAspectRatio="none"
              >
                {settings.floorPlanWalls.map((wall) => (
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
              ? settings.floorPlanWalls.map((wall) => {
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

            {layers.booths
              ? booths.filter(isBoothPlaced).map((booth) => {
                  const active = selectedBooth?.id === booth.id;
                  return (
                    <DraggablePin
                      key={booth.id}
                      x={booth.mapX}
                      y={booth.mapY}
                      canvasSize={canvasSize}
                      onSelect={() => selectBooth(booth)}
                      onDrop={(x, y) => placeBoothAt(booth, x, y)}
                      style={[styles.boothPin, active && styles.boothPinSelected]}
                    >
                      <View style={[styles.boothPulse, { backgroundColor: ZONE_COLORS[booth.zone!] }]} />
                      <Text style={styles.boothPinText} numberOfLines={1}>
                        {booth.boothNo}
                      </Text>
                    </DraggablePin>
                  );
                })
              : null}

            {layers.stages
              ? stages.map((stage) => {
                  const active = selectedStage?.id === stage.id;
                  return (
                    <DraggablePin
                      key={stage.id}
                      x={stage.mapX}
                      y={stage.mapY}
                      canvasSize={canvasSize}
                      onSelect={() => selectStage(stage)}
                      onDrop={(x, y) => moveStageTo(stage, x, y)}
                      style={[styles.stagePin, active && styles.stagePinSelected]}
                    >
                      <View style={styles.stagePulse} />
                      <Text style={styles.stagePinText} numberOfLines={1}>
                        {stage.name}
                      </Text>
                    </DraggablePin>
                  );
                })
              : null}

            {(repositioning && selectedBooth) || wallDrawing ? (
              <Pressable
                accessibilityLabel="Krokide konum seç"
                onPress={handleCanvasPress}
                style={[StyleSheet.absoluteFill, styles.placementOverlay]}
              />
            ) : null}
          </View>
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
                    isBoothPlaced(selectedBooth)
                      ? `${selectedBooth.zone} · X %${selectedBooth.mapX} · Y %${selectedBooth.mapY}`
                      : 'Henüz yerleştirilmedi'
                  }
                  valueColor={isBoothPlaced(selectedBooth) ? colors.primary : colors.textMuted}
                />
                <InfoLine
                  label="Ziyaret & Check-in:"
                  value={`${selectedBooth.totalVisits.toLocaleString('tr-TR')} kişi`}
                />
              </View>

              {isBoothPlaced(selectedBooth) ? (
                // Stant zaten krokide bir pin'e sahip — taşıma artık sadece
                // etiketi sürükleyerek yapılıyor, ayrı bir "yerini değiştir"
                // butonu/tıkla-yerleştir modu bilinçli olarak kaldırıldı
                // (o mod tüm krokiyi kaplayan bir tıklama katmanı açıyordu ve
                // bu da sürüklemeyi engelliyordu).
                <View style={styles.dragHint}>
                  <Move size={14} color={colors.textMuted} />
                  <Text style={styles.dragHintText}>
                    Taşımak için krokideki etiketi basılı tutup sürükleyin.
                  </Text>
                </View>
              ) : (
                <Pressable
                  style={[styles.moveButton, repositioning && styles.moveButtonActive]}
                  onPress={() => {
                    setPlacementError(null);
                    setRepositioning((current) => !current);
                  }}
                >
                  <Move size={16} color={colors.primary} />
                  <Text style={styles.moveButtonText}>
                    {repositioning ? 'Krokide Bir Noktaya Dokunun' : 'Krokiye Yerleştir'}
                  </Text>
                </Pressable>
              )}
              {isBoothPlaced(selectedBooth) ? (
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
                <Text style={styles.stageZone}>{selectedStage.zone}</Text>
              </View>
              <View>
                <Text style={styles.stageName}>{selectedStage.name}</Text>
                <Text style={styles.companyCategory}>{selectedStage.type}</Text>
              </View>
              <Text style={styles.description}>{selectedStage.description}</Text>
              <View style={styles.infoBox}>
                <InfoLine
                  label="Kroki Konumu:"
                  value={`${selectedStage.zone} · X %${selectedStage.mapX} · Y %${selectedStage.mapY}`}
                  valueColor={colors.primary}
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
              </View>
              <View style={styles.dragHint}>
                <Move size={14} color={colors.textMuted} />
                <Text style={styles.dragHintText}>
                  Taşımak için krokideki etiketi basılı tutup sürükleyin.
                </Text>
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
                const hasGeofence = zone.centerLat != null && zone.centerLng != null;
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
                        {hasGeofence
                          ? `${zone.centerLat?.toFixed(4)}, ${zone.centerLng?.toFixed(4)} · ${zone.radiusMeters}m`
                          : 'Konum tanımlanmamış'}
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
    // Yükseklik artık sabit değil — krokinin GERÇEK en-boy oranına göre
    // (bkz. lib/useImageAspectRatio.ts) otomatik hesaplanıyor, katılımcı
    // ekranıyla birebir aynı oranı kullanmak için (bkz. o dosyadaki
    // `mapCanvas` stili).
    width: '100%',
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#374151',
    borderRadius: 16,
    backgroundColor: '#0f172a',
  },
  mapCanvasMoving: { borderWidth: 3, borderColor: colors.primary },
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
    borderColor: 'rgba(255,255,255,0.85)',
  },
  zoneCornerTagText: { color: colors.white, fontSize: 12, fontWeight: '900' },
  boothPin: {
    position: 'absolute',
    zIndex: 4,
    maxWidth: 130,
    minHeight: 26,
    transform: [{ translateX: -10 }, { translateY: -13 }],
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderWidth: 1,
    borderColor: '#64748b',
    borderRadius: 8,
    backgroundColor: 'rgba(15,23,42,0.94)',
  },
  boothPinSelected: {
    borderColor: colors.white,
    transform: [{ translateX: -10 }, { translateY: -13 }, { scale: 1.06 }],
  },
  boothPulse: { width: 7, height: 7, borderRadius: 4 },
  boothPinText: { flexShrink: 1, color: colors.white, fontSize: 8, fontWeight: '900' },
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
