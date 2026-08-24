// Admin: örnek su istasyonu ekleme (krokideki x/y yüzde koordinatı ile —
// AdminVenuesAndStands.tsx'teki stant ekleme desenine benzer) + "Su
// Talepleri" bölümü (bkz. lib/useWaterStations.ts).
import { CircleAlert, Droplet, Plus, Trash2, Truck } from 'lucide-react-native';
import { useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';

import { colors } from '../../constants/theme';
import {
  useAdvanceWaterStationStatus,
  useCreateWaterStation,
  useDeleteWaterStation,
  useWaterStations,
} from '../../lib/useWaterStations';
import type { WaterStation } from '../../types';

const STATUS_COLOR: Record<WaterStation['status'], string> = {
  active: colors.success,
  reported_empty: colors.danger,
  dispatched: colors.primary,
  resolved: colors.textMuted,
};

// Admin panelinin tamamı (bkz. AdminAttendees.tsx, AdminMapManagement.tsx vb.)
// i18n kullanmadan doğrudan Türkçe metinlerle yazılmış — burada da aynı
// kurulu desen izleniyor.
const STATUS_LABEL_TR: Record<WaterStation['status'], string> = {
  active: 'Aktif',
  reported_empty: 'Su Bitti',
  dispatched: 'Yola Çıktı',
  resolved: 'Tamamlandı',
};

function statusLabel(status: WaterStation['status']) {
  return STATUS_LABEL_TR[status] ?? status;
}

export function AdminWaterStations() {
  const stationsQuery = useWaterStations();
  const createStation = useCreateWaterStation();
  const deleteStation = useDeleteWaterStation();
  const advance = useAdvanceWaterStationStatus();

  const [name, setName] = useState('');
  const [mapX, setMapX] = useState('50');
  const [mapY, setMapY] = useState('50');
  const [error, setError] = useState<string | null>(null);

  const stations = stationsQuery.data ?? [];
  const requests = stations.filter((s) => s.status === 'reported_empty' || s.status === 'dispatched');

  async function handleAdd() {
    const x = Number(mapX.replace(',', '.'));
    const y = Number(mapY.replace(',', '.'));
    if (!name.trim() || Number.isNaN(x) || Number.isNaN(y)) {
      setError('İstasyon adı ve geçerli bir X/Y koordinatı girin (0-100 arası).');
      return;
    }
    setError(null);
    try {
      await createStation.mutateAsync({ name: name.trim(), mapX: x, mapY: y });
      setName('');
      setMapX('50');
      setMapY('50');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'İstasyon eklenemedi.');
    }
  }

  return (
    <View style={s.stack}>
      <View>
        <Text style={s.title}>Su İstasyonları</Text>
        <Text style={s.subtitle}>
          Etkinlik krokisindeki (X/Y yüzde koordinatı, harita ekranındakiyle aynı sistem) su
          sebillerini yönetin. Görevliler haritada bir istasyona dokunup su bittiğini bildirebilir.
        </Text>
      </View>

      <View style={s.formCard}>
        <Text style={s.formTitle}>Yeni İstasyon Ekle</Text>
        {error ? <Text style={s.error}>{error}</Text> : null}
        <TextInput
          style={s.input}
          value={name}
          onChangeText={setName}
          placeholder="Örn. Ana Giriş Su Sebili"
          placeholderTextColor={colors.textFaint}
        />
        <View style={s.coordRow}>
          <View style={s.coordField}>
            <Text style={s.label}>X (%)</Text>
            <TextInput
              style={s.input}
              value={mapX}
              onChangeText={setMapX}
              keyboardType="numbers-and-punctuation"
              placeholder="50"
              placeholderTextColor={colors.textFaint}
            />
          </View>
          <View style={s.coordField}>
            <Text style={s.label}>Y (%)</Text>
            <TextInput
              style={s.input}
              value={mapY}
              onChangeText={setMapY}
              keyboardType="numbers-and-punctuation"
              placeholder="50"
              placeholderTextColor={colors.textFaint}
            />
          </View>
        </View>
        <Pressable style={s.primaryBtn} onPress={handleAdd} disabled={createStation.isPending}>
          {createStation.isPending ? (
            <ActivityIndicator size="small" color={colors.white} />
          ) : (
            <>
              <Plus size={14} color={colors.white} />
              <Text style={s.primaryBtnText}>İstasyon Ekle</Text>
            </>
          )}
        </Pressable>
      </View>

      <View style={s.listCard}>
        <Text style={s.formTitle}>Su Talepleri ({requests.length})</Text>
        {requests.length === 0 ? (
          <Text style={s.emptyText}>Bekleyen bir su talebi yok.</Text>
        ) : (
          <View style={{ gap: 8 }}>
            {requests.map((station) => (
              <View key={station.id} style={s.requestRow}>
                <CircleAlert size={16} color={STATUS_COLOR[station.status]} />
                <View style={{ flex: 1 }}>
                  <Text style={s.requestName}>{station.name}</Text>
                  <Text style={[s.requestStatus, { color: STATUS_COLOR[station.status] }]}>
                    {statusLabel(station.status)}
                  </Text>
                </View>
                {station.status === 'reported_empty' ? (
                  <Pressable
                    style={s.smallPrimaryBtn}
                    onPress={() => advance.mutate({ stationId: station.id, status: 'dispatched' })}
                  >
                    <Truck size={13} color={colors.white} />
                    <Text style={s.smallPrimaryBtnText}>Yola Çıktı</Text>
                  </Pressable>
                ) : (
                  <Pressable
                    style={s.smallSuccessBtn}
                    onPress={() => advance.mutate({ stationId: station.id, status: 'resolved' })}
                  >
                    <Text style={s.smallSuccessBtnText}>Tamamlandı</Text>
                  </Pressable>
                )}
              </View>
            ))}
          </View>
        )}
      </View>

      <View style={s.listCard}>
        <Text style={s.formTitle}>Tüm İstasyonlar ({stations.length})</Text>
        {stationsQuery.isLoading ? (
          <ActivityIndicator color={colors.primary} />
        ) : stations.length === 0 ? (
          <Text style={s.emptyText}>Henüz istasyon eklenmedi.</Text>
        ) : (
          <View style={{ gap: 8 }}>
            {stations.map((station) => (
              <View key={station.id} style={s.row}>
                <View style={s.rowIcon}>
                  <Droplet size={14} color={colors.primary} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={s.rowTitle}>{station.name}</Text>
                  <Text style={s.rowMeta}>
                    X %{station.map_x} · Y %{station.map_y} · {statusLabel(station.status)}
                  </Text>
                </View>
                <Pressable style={s.iconBtn} onPress={() => deleteStation.mutate(station.id)} hitSlop={6}>
                  <Trash2 size={14} color={colors.danger} />
                </Pressable>
              </View>
            ))}
          </View>
        )}
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  stack: { gap: 16 },
  title: { color: colors.text, fontSize: 22, fontWeight: '800' },
  subtitle: { color: colors.textMuted, fontSize: 12, lineHeight: 18, marginTop: 4, maxWidth: 640 },
  formCard: {
    gap: 8,
    padding: 16,
    borderRadius: 15,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  formTitle: { color: colors.text, fontSize: 14, fontWeight: '800', marginBottom: 2 },
  error: { color: colors.danger, fontSize: 11, fontWeight: '700' },
  label: { color: colors.textMuted, fontSize: 10, fontWeight: '800' },
  input: {
    minHeight: 40,
    paddingHorizontal: 11,
    borderWidth: 1,
    borderColor: colors.borderStrong,
    borderRadius: 10,
    backgroundColor: colors.surfaceMuted,
    color: colors.text,
    fontSize: 12,
  },
  coordRow: { flexDirection: 'row', gap: 10 },
  coordField: { flex: 1, gap: 4 },
  primaryBtn: {
    marginTop: 6,
    minHeight: 40,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    borderRadius: 10,
    backgroundColor: colors.primary,
  },
  primaryBtnText: { color: colors.white, fontSize: 12, fontWeight: '800' },
  listCard: {
    gap: 10,
    padding: 16,
    borderRadius: 15,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  emptyText: { color: colors.textMuted, fontSize: 12 },
  requestRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    padding: 10,
    borderRadius: 12,
    backgroundColor: colors.surfaceMuted,
  },
  requestName: { color: colors.text, fontSize: 12, fontWeight: '800' },
  requestStatus: { fontSize: 10, fontWeight: '800', marginTop: 2 },
  smallPrimaryBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    minHeight: 32,
    paddingHorizontal: 10,
    borderRadius: 9,
    backgroundColor: colors.primary,
  },
  smallPrimaryBtnText: { color: colors.white, fontSize: 10, fontWeight: '800' },
  smallSuccessBtn: {
    minHeight: 32,
    justifyContent: 'center',
    paddingHorizontal: 10,
    borderRadius: 9,
    backgroundColor: colors.success,
  },
  smallSuccessBtnText: { color: colors.white, fontSize: 10, fontWeight: '800' },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    padding: 10,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surfaceMuted,
  },
  rowIcon: {
    width: 30,
    height: 30,
    borderRadius: 9,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.primarySoft,
  },
  rowTitle: { color: colors.text, fontSize: 12, fontWeight: '700' },
  rowMeta: { color: colors.textMuted, fontSize: 10, marginTop: 2 },
  iconBtn: {
    width: 30,
    height: 30,
    borderRadius: 9,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.surface,
  },
});
