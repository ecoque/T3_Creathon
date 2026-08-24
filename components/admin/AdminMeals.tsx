// Admin: günlük yemek menüsü yönetimi (bkz. lib/useMeals.ts). Diğer yeni
// admin bölümleri (Görevliler, Su İstasyonları) gibi bu da kasıtlı olarak
// büyük useAdminStore/adminRepository katmanının DIŞINDA, kendi hafif
// react-query sorgularıyla çalışır — mevcut admin store sözleşmesine hiç
// dokunmadan eklenebilsin diye.
import { useQueryClient } from '@tanstack/react-query';
import { CalendarDays, Pencil, Plus, Trash2, UtensilsCrossed, X } from 'lucide-react-native';
import { useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';

import { colors } from '../../constants/theme';
import { istanbulDateString } from '../../lib/eventDate';
import { deleteMeal, saveMealForDate, useAllMeals } from '../../lib/useMeals';
import type { Meal } from '../../types';

function emptyForm(eventDate: string) {
  return { eventDate, title: '', description: '' };
}

export function AdminMeals() {
  const queryClient = useQueryClient();
  const mealsQuery = useAllMeals();
  const meals = mealsQuery.data ?? [];
  const [form, setForm] = useState(emptyForm(istanbulDateString()));
  const [editingId, setEditingId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function invalidate() {
    return queryClient.invalidateQueries({ queryKey: ['meals'] });
  }

  function startEdit(meal: Meal) {
    setEditingId(meal.id);
    setForm({ eventDate: meal.event_date, title: meal.title, description: meal.description || '' });
    setError(null);
  }

  function startNew() {
    setEditingId(null);
    setForm(emptyForm(istanbulDateString()));
    setError(null);
  }

  async function handleSave() {
    if (!form.eventDate.trim() || !form.title.trim()) {
      setError('Tarih ve menü başlığı gerekli.');
      return;
    }
    setSaving(true);
    setError(null);
    try {
      await saveMealForDate(form.eventDate.trim(), form.title.trim(), form.description.trim() || null);
      await invalidate();
      startNew();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Menü kaydedilemedi.');
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(id: string) {
    try {
      await deleteMeal(id);
      await invalidate();
      if (editingId === id) startNew();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Menü silinemedi.');
    }
  }

  return (
    <View style={s.stack}>
      <View style={s.heading}>
        <View style={{ flex: 1 }}>
          <Text style={s.title}>Yemek Menüsü</Text>
          <Text style={s.subtitle}>
            Her gün için menü başlığını girin — katılımcılar bunu ana sayfalarında, kendilerine atanan
            kişisel yemek saatiyle birlikte görür.
          </Text>
        </View>
      </View>

      <View style={s.columns}>
        <View style={s.formCard}>
          <Text style={s.formTitle}>{editingId ? 'Menüyü Düzenle' : 'Yeni Gün Menüsü'}</Text>
          {error ? <Text style={s.error}>{error}</Text> : null}

          <Text style={s.label}>Tarih (YYYY-AA-GG)</Text>
          <View style={s.inputRow}>
            <CalendarDays size={15} color={colors.textMuted} />
            <TextInput
              style={s.input}
              value={form.eventDate}
              onChangeText={(v) => setForm((f) => ({ ...f, eventDate: v }))}
              placeholder="2026-08-24"
              placeholderTextColor={colors.textFaint}
            />
          </View>

          <Text style={s.label}>Menü Başlığı</Text>
          <TextInput
            style={s.inputPlain}
            value={form.title}
            onChangeText={(v) => setForm((f) => ({ ...f, title: v }))}
            placeholder="Mercimek Çorbası, Izgara Tavuk, Salata"
            placeholderTextColor={colors.textFaint}
          />

          <Text style={s.label}>Açıklama (opsiyonel)</Text>
          <TextInput
            style={[s.inputPlain, s.textArea]}
            value={form.description}
            onChangeText={(v) => setForm((f) => ({ ...f, description: v }))}
            placeholder="Vejetaryen seçenek de mevcuttur."
            placeholderTextColor={colors.textFaint}
            multiline
          />

          <View style={s.actionsRow}>
            {editingId ? (
              <Pressable style={s.secondaryBtn} onPress={startNew}>
                <X size={14} color={colors.textMuted} />
                <Text style={s.secondaryBtnText}>Vazgeç</Text>
              </Pressable>
            ) : null}
            <Pressable style={s.primaryBtn} onPress={handleSave} disabled={saving}>
              {saving ? (
                <ActivityIndicator size="small" color={colors.white} />
              ) : (
                <>
                  <Plus size={14} color={colors.white} />
                  <Text style={s.primaryBtnText}>{editingId ? 'Güncelle' : 'Kaydet'}</Text>
                </>
              )}
            </Pressable>
          </View>
        </View>

        <View style={s.listCard}>
          <Text style={s.formTitle}>Girilen Menüler</Text>
          {mealsQuery.isLoading ? (
            <ActivityIndicator color={colors.primary} />
          ) : meals.length === 0 ? (
            <Text style={s.emptyText}>Henüz bir menü girilmedi.</Text>
          ) : (
            <ScrollView style={{ maxHeight: 420 }} contentContainerStyle={{ gap: 8 }}>
              {meals.map((meal) => (
                <View key={meal.id} style={s.row}>
                  <View style={s.rowIcon}>
                    <UtensilsCrossed size={15} color={colors.primary} />
                  </View>
                  <View style={{ flex: 1, minWidth: 0 }}>
                    <Text style={s.rowDate}>{meal.event_date}</Text>
                    <Text style={s.rowTitle} numberOfLines={1}>
                      {meal.title}
                    </Text>
                  </View>
                  <Pressable style={s.iconBtn} onPress={() => startEdit(meal)} hitSlop={6}>
                    <Pencil size={14} color={colors.textMuted} />
                  </Pressable>
                  <Pressable style={s.iconBtn} onPress={() => handleDelete(meal.id)} hitSlop={6}>
                    <Trash2 size={14} color={colors.danger} />
                  </Pressable>
                </View>
              ))}
            </ScrollView>
          )}
        </View>
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  stack: { gap: 18 },
  heading: { flexDirection: 'row', alignItems: 'flex-start', gap: 12 },
  title: { color: colors.text, fontSize: 22, fontWeight: '800' },
  subtitle: { color: colors.textMuted, fontSize: 12, lineHeight: 18, marginTop: 4, maxWidth: 620 },
  columns: { flexDirection: 'row', flexWrap: 'wrap', gap: 14 },
  formCard: {
    flexGrow: 1,
    flexBasis: 320,
    gap: 8,
    padding: 16,
    borderRadius: 15,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  listCard: {
    flexGrow: 1,
    flexBasis: 320,
    gap: 10,
    padding: 16,
    borderRadius: 15,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  formTitle: { color: colors.text, fontSize: 14, fontWeight: '800', marginBottom: 4 },
  label: { color: colors.textMuted, fontSize: 11, fontWeight: '700', marginTop: 6 },
  error: { color: colors.danger, fontSize: 11, fontWeight: '700' },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    height: 42,
    paddingHorizontal: 11,
    borderWidth: 1,
    borderColor: colors.borderStrong,
    borderRadius: 10,
    backgroundColor: colors.surfaceMuted,
  },
  input: { flex: 1, color: colors.text, fontSize: 12 },
  inputPlain: {
    minHeight: 42,
    paddingHorizontal: 11,
    paddingVertical: 10,
    borderWidth: 1,
    borderColor: colors.borderStrong,
    borderRadius: 10,
    backgroundColor: colors.surfaceMuted,
    color: colors.text,
    fontSize: 12,
  },
  textArea: { minHeight: 70, textAlignVertical: 'top' },
  actionsRow: { flexDirection: 'row', justifyContent: 'flex-end', gap: 8, marginTop: 10 },
  primaryBtn: {
    minHeight: 40,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingHorizontal: 14,
    borderRadius: 10,
    backgroundColor: colors.primary,
  },
  primaryBtnText: { color: colors.white, fontSize: 12, fontWeight: '800' },
  secondaryBtn: {
    minHeight: 40,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingHorizontal: 12,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.border,
  },
  secondaryBtnText: { color: colors.textMuted, fontSize: 12, fontWeight: '700' },
  emptyText: { color: colors.textMuted, fontSize: 12 },
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
    width: 32,
    height: 32,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.primarySoft,
  },
  rowDate: { color: colors.textFaint, fontSize: 9, fontWeight: '800' },
  rowTitle: { color: colors.text, fontSize: 12, fontWeight: '700', marginTop: 2 },
  iconBtn: {
    width: 30,
    height: 30,
    borderRadius: 9,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.surface,
  },
});
