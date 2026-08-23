import { useQueryClient } from '@tanstack/react-query';
import { Save, X } from 'lucide-react-native';
import { useEffect, useState, type ReactNode } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { colors } from '../../constants/theme';
import { supabase } from '../../lib/supabase';
import { ADMIN_DATA_QUERY_KEY } from '../../lib/useAdminData';
import type { Session, Stand, Zone } from '../../types';

const EDITOR_HEADER_HEIGHT = 62;
const EDITOR_CONTENT_BOTTOM_PADDING = 44;

type EditorBaseProps = {
  visible: boolean;
  onClose: () => void;
  onSaved: (message: string) => void;
};

function EditorModal({
  visible,
  title,
  onClose,
  children,
}: {
  visible: boolean;
  title: string;
  onClose: () => void;
  children: ReactNode;
}) {
  const insets = useSafeAreaInsets();
  const safeTop = Math.max(insets.top, 12);

  return (
    <Modal
      visible={visible}
      animationType="slide"
      statusBarTranslucent
      navigationBarTranslucent={Platform.OS === 'android'}
      onRequestClose={onClose}
    >
      <KeyboardAvoidingView
        style={styles.screen}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <View
          style={[
            styles.header,
            { paddingTop: safeTop, minHeight: EDITOR_HEADER_HEIGHT + safeTop },
          ]}
        >
          <Text style={styles.headerTitle}>{title}</Text>
          <Pressable style={styles.iconButton} onPress={onClose}>
            <X size={20} color={colors.text} />
          </Pressable>
        </View>
        <ScrollView
          contentContainerStyle={[
            styles.content,
            { paddingBottom: EDITOR_CONTENT_BOTTOM_PADDING + Math.max(insets.bottom, 8) },
          ]}
          keyboardShouldPersistTaps="handled"
        >
          {children}
        </ScrollView>
      </KeyboardAvoidingView>
    </Modal>
  );
}

function Field({
  label,
  value,
  onChangeText,
  placeholder,
  multiline = false,
}: {
  label: string;
  value: string;
  onChangeText: (value: string) => void;
  placeholder: string;
  multiline?: boolean;
}) {
  return (
    <View style={styles.field}>
      <Text style={styles.label}>{label}</Text>
      <TextInput
        style={[styles.input, multiline && styles.multiline]}
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={colors.textFaint}
        multiline={multiline}
        textAlignVertical={multiline ? 'top' : 'center'}
      />
    </View>
  );
}

function SubmitButton({
  loading,
  label,
  onPress,
}: {
  loading: boolean;
  label: string;
  onPress: () => void;
}) {
  return (
    <Pressable style={styles.submitButton} onPress={onPress} disabled={loading}>
      {loading ? (
        <ActivityIndicator color={colors.white} />
      ) : (
        <Save size={16} color={colors.white} />
      )}
      <Text style={styles.submitText}>{loading ? 'Kaydediliyor…' : label}</Text>
    </Pressable>
  );
}

function localInputParts(iso?: string, fallbackTime = '10:00') {
  const value = iso ? new Date(iso) : new Date(`2026-10-24T${fallbackTime}:00`);
  return {
    date: `${value.getFullYear()}-${String(value.getMonth() + 1).padStart(2, '0')}-${String(value.getDate()).padStart(2, '0')}`,
    time: `${String(value.getHours()).padStart(2, '0')}:${String(value.getMinutes()).padStart(2, '0')}`,
  };
}

export function AdminSessionEditor({
  visible,
  session,
  onClose,
  onSaved,
}: EditorBaseProps & { session: Session | null }) {
  const queryClient = useQueryClient();
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [location, setLocation] = useState('');
  const [date, setDate] = useState('2026-10-24');
  const [startTime, setStartTime] = useState('10:00');
  const [endTime, setEndTime] = useState('10:45');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!visible) return;
    const start = localInputParts(session?.start_time, '10:00');
    const end = localInputParts(session?.end_time, '10:45');
    setTitle(session?.title ?? '');
    setDescription(session?.description ?? '');
    setLocation(session?.location ?? '');
    setDate(start.date);
    setStartTime(start.time);
    setEndTime(end.time);
    setError(null);
  }, [session, visible]);

  async function save() {
    if (!title.trim()) {
      setError('Oturum başlığı zorunludur.');
      return;
    }
    const start = new Date(`${date}T${startTime}:00`);
    const end = new Date(`${date}T${endTime}:00`);
    if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime()) || end <= start) {
      setError('Geçerli bir tarih ve bitiş saati girin.');
      return;
    }

    setSaving(true);
    setError(null);
    const payload = {
      title: title.trim(),
      description: description.trim() || null,
      location: location.trim() || null,
      start_time: start.toISOString(),
      end_time: end.toISOString(),
    };
    const result = session
      ? await supabase.from('sessions').update(payload).eq('id', session.id)
      : await supabase.from('sessions').insert(payload);
    setSaving(false);
    if (result.error) {
      setError(result.error.message);
      return;
    }

    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ADMIN_DATA_QUERY_KEY }),
      queryClient.invalidateQueries({ queryKey: ['sessions'] }),
    ]);
    onSaved(session ? 'Oturum başarıyla güncellendi.' : 'Yeni oturum programa eklendi.');
    onClose();
  }

  return (
    <EditorModal
      visible={visible}
      title={session ? 'Oturumu Düzenle' : 'Yeni Oturum'}
      onClose={onClose}
    >
      <Field
        label="Oturum Başlığı"
        value={title}
        onChangeText={setTitle}
        placeholder="Oturum başlığı"
      />
      <Field
        label="Açıklama"
        value={description}
        onChangeText={setDescription}
        placeholder="Kısa açıklama"
        multiline
      />
      <Field
        label="Salon / Alan"
        value={location}
        onChangeText={setLocation}
        placeholder="Ana Sahne"
      />
      <View style={styles.splitRow}>
        <View style={{ flex: 1 }}>
          <Field label="Tarih" value={date} onChangeText={setDate} placeholder="2026-10-24" />
        </View>
        <View style={{ flex: 1 }}>
          <Field
            label="Başlangıç"
            value={startTime}
            onChangeText={setStartTime}
            placeholder="10:00"
          />
        </View>
        <View style={{ flex: 1 }}>
          <Field label="Bitiş" value={endTime} onChangeText={setEndTime} placeholder="10:45" />
        </View>
      </View>
      {error ? <Text style={styles.error}>{error}</Text> : null}
      <SubmitButton loading={saving} label="Oturumu Kaydet" onPress={save} />
    </EditorModal>
  );
}

export function AdminStandEditor({
  visible,
  stand,
  zones,
  onClose,
  onSaved,
}: EditorBaseProps & { stand: Stand | null; zones: Zone[] }) {
  const queryClient = useQueryClient();
  const [name, setName] = useState('');
  const [type, setType] = useState('Startup');
  const [sponsor, setSponsor] = useState('');
  const [lat, setLat] = useState('41.0478');
  const [lng, setLng] = useState('28.9914');
  const [zoneId, setZoneId] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!visible) return;
    setName(stand?.name ?? '');
    setType(stand?.type ?? 'Startup');
    setSponsor(stand?.sponsor ?? '');
    setLat(String(stand?.lat ?? 41.0478));
    setLng(String(stand?.lng ?? 28.9914));
    setZoneId(stand?.zone_id ?? zones[0]?.id ?? '');
    setError(null);
  }, [stand, visible, zones]);

  async function save() {
    const parsedLat = Number(lat.replace(',', '.'));
    const parsedLng = Number(lng.replace(',', '.'));
    if (
      !name.trim() ||
      !type.trim() ||
      !Number.isFinite(parsedLat) ||
      !Number.isFinite(parsedLng)
    ) {
      setError('Stant adı, türü ve geçerli koordinatlar zorunludur.');
      return;
    }
    setSaving(true);
    setError(null);
    const payload = {
      name: name.trim(),
      type: type.trim(),
      sponsor: sponsor.trim() || null,
      lat: parsedLat,
      lng: parsedLng,
      zone_id: zoneId || null,
    };
    const result = stand
      ? await supabase.from('stands').update(payload).eq('id', stand.id)
      : await supabase.from('stands').insert(payload);
    setSaving(false);
    if (result.error) {
      setError(result.error.message);
      return;
    }
    await queryClient.invalidateQueries({ queryKey: ADMIN_DATA_QUERY_KEY });
    onSaved(stand ? 'Stant bilgileri güncellendi.' : 'Yeni stant eklendi.');
    onClose();
  }

  return (
    <EditorModal
      visible={visible}
      title={stand ? 'Standı Düzenle' : 'Yeni Stant'}
      onClose={onClose}
    >
      <Field
        label="Stant / Şirket Adı"
        value={name}
        onChangeText={setName}
        placeholder="Şirket adı"
      />
      <View style={styles.splitRow}>
        <View style={{ flex: 1 }}>
          <Field label="Kategori" value={type} onChangeText={setType} placeholder="Startup" />
        </View>
        <View style={{ flex: 1 }}>
          <Field
            label="Sponsor"
            value={sponsor}
            onChangeText={setSponsor}
            placeholder="Opsiyonel"
          />
        </View>
      </View>
      <View style={styles.splitRow}>
        <View style={{ flex: 1 }}>
          <Field label="Enlem" value={lat} onChangeText={setLat} placeholder="41.0478" />
        </View>
        <View style={{ flex: 1 }}>
          <Field label="Boylam" value={lng} onChangeText={setLng} placeholder="28.9914" />
        </View>
      </View>
      {zones.length ? (
        <View style={styles.field}>
          <Text style={styles.label}>Bölge</Text>
          <View style={styles.chips}>
            {zones.map((zone) => (
              <Pressable
                key={zone.id}
                style={[styles.chip, zoneId === zone.id && styles.chipActive]}
                onPress={() => setZoneId(zone.id)}
              >
                <Text style={[styles.chipText, zoneId === zone.id && styles.chipTextActive]}>
                  {zone.name}
                </Text>
              </Pressable>
            ))}
          </View>
        </View>
      ) : null}
      {error ? <Text style={styles.error}>{error}</Text> : null}
      <SubmitButton loading={saving} label="Standı Kaydet" onPress={save} />
    </EditorModal>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  header: {
    minHeight: EDITOR_HEADER_HEIGHT,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    backgroundColor: colors.white,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  headerTitle: { fontSize: 16, fontWeight: '900', color: colors.text },
  iconButton: {
    width: 38,
    height: 38,
    borderRadius: 11,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.background,
  },
  content: {
    width: '100%',
    maxWidth: 720,
    alignSelf: 'center',
    padding: 16,
    paddingBottom: EDITOR_CONTENT_BOTTOM_PADDING,
    gap: 14,
  },
  field: { gap: 6 },
  label: { fontSize: 11, fontWeight: '800', color: colors.text },
  input: {
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: colors.borderStrong,
    borderRadius: 12,
    paddingHorizontal: 13,
    paddingVertical: 11,
    fontSize: 12,
    color: colors.text,
  },
  multiline: { minHeight: 100 },
  splitRow: { flexDirection: 'row', gap: 10 },
  error: {
    fontSize: 11,
    fontWeight: '700',
    color: colors.danger,
    backgroundColor: colors.dangerBg,
    borderRadius: 10,
    padding: 10,
  },
  submitButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: colors.primary,
    borderRadius: 13,
    paddingVertical: 14,
  },
  submitText: { color: colors.white, fontSize: 12, fontWeight: '900' },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 7 },
  chip: {
    borderRadius: 999,
    paddingHorizontal: 11,
    paddingVertical: 8,
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: colors.border,
  },
  chipActive: { backgroundColor: colors.primarySoft, borderColor: colors.primary },
  chipText: { fontSize: 10, fontWeight: '700', color: colors.textMuted },
  chipTextActive: { color: colors.primary },
});
