import { useQueryClient } from '@tanstack/react-query';
import { router } from 'expo-router';
import { ArrowLeft, ArrowRight, Check } from 'lucide-react-native';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { colors } from '../../constants/theme';
import { supabase } from '../../lib/supabase';
import { useCurrentProfile } from '../../lib/useCurrentProfile';

const SECTORS = ['Teknoloji', 'Sağlık', 'Finans', 'Eğitim', 'Medya', 'E-Ticaret'];
const INTERESTS = [
  'Yapay Zeka',
  'SaaS',
  'Fintech',
  'Kripto & Web3',
  'E-Ticaret',
  'Pazarlama',
  'Blockchain',
  'Mobil Geliştirme',
  'Sürdürülebilirlik',
];
const GOALS = ['Yatırım Arama', 'Networking', 'Ortaklık', 'Öğrenme / Keşif', 'İşe Alım', 'Mentorluk Bulmak'];

export default function EditProfileScreen() {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const { data: meResult } = useCurrentProfile();
  const profile = meResult?.profile;

  const [fullName, setFullName] = useState('');
  const [sector, setSector] = useState('Teknoloji');
  const [linkedin, setLinkedin] = useState('');
  const [interests, setInterests] = useState<string[]>([]);
  const [goals, setGoals] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (profile) {
      setFullName(profile.full_name ?? '');
      setSector(profile.sector || 'Teknoloji');
      setLinkedin(profile.linkedin_url ?? '');
      setInterests(profile.interests ?? []);
      setGoals(profile.goals ?? []);
    }
  }, [profile]);

  function toggleInterest(item: string) {
    setInterests((prev) => {
      if (prev.includes(item)) return prev.filter((i) => i !== item);
      if (prev.length >= 3) {
        setError(t('editProfile.maxInterests'));
        setTimeout(() => setError(null), 2500);
        return prev;
      }
      return [...prev, item];
    });
  }

  function toggleGoal(item: string) {
    setGoals((prev) => (prev.includes(item) ? prev.filter((g) => g !== item) : [...prev, item]));
  }

  async function handleSave() {
    if (!fullName.trim()) {
      setError(t('editProfile.nameRequired'));
      return;
    }
    setSaving(true);
    setError(null);

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      setSaving(false);
      router.replace('/auth');
      return;
    }

    const { error: updateError } = await supabase
      .from('profiles')
      .update({
        full_name: fullName,
        sector,
        linkedin_url: linkedin || null,
        interests,
        goals,
      })
      .eq('user_id', user.id);

    setSaving(false);

    if (updateError) {
      setError(updateError.message);
      return;
    }

    await queryClient.invalidateQueries({ queryKey: ['me', 'profile'] });
    router.back();
  }

  return (
    <SafeAreaView style={styles.screen}>
      <View style={styles.header}>
        <Pressable style={styles.backBtn} onPress={() => router.back()} hitSlop={8}>
          <ArrowLeft size={20} color={colors.text} />
        </Pressable>
        <Text style={styles.headerTitle}>{t('editProfile.title')}</Text>
        <View style={{ width: 36 }} />
      </View>

      <ScrollView
        contentContainerStyle={styles.content}
        automaticallyAdjustKeyboardInsets
        keyboardDismissMode="interactive"
        keyboardShouldPersistTaps="handled"
      >
        <Text style={styles.subtitle}>{t('editProfile.subtitle')}</Text>

        {error ? (
          <View style={styles.toast}>
            <Text style={styles.toastText}>{error}</Text>
          </View>
        ) : null}

        <View style={styles.card}>
          <View style={styles.field}>
            <Text style={styles.label}>{t('editProfile.fullNameLabel')}</Text>
            <TextInput
              style={styles.input}
              value={fullName}
              onChangeText={setFullName}
              placeholder={t('editProfile.fullNamePlaceholder')}
              placeholderTextColor={colors.textFaint}
            />
          </View>

          <View style={styles.field}>
            <Text style={styles.label}>{t('editProfile.sectorLabel')}</Text>
            <View style={styles.chipRow}>
              {SECTORS.map((s) => {
                const selected = sector === s;
                return (
                  <Pressable key={s} onPress={() => setSector(s)} style={[styles.chip, selected && styles.chipSelected]}>
                    <Text style={[styles.chipText, selected && styles.chipTextSelected]}>{s}</Text>
                  </Pressable>
                );
              })}
            </View>
          </View>

          <View style={styles.field}>
            <Text style={styles.label}>{t('editProfile.linkedinLabel')}</Text>
            <TextInput
              style={styles.input}
              value={linkedin}
              onChangeText={setLinkedin}
              autoCapitalize="none"
              placeholder={t('editProfile.linkedinPlaceholder')}
              placeholderTextColor={colors.textFaint}
            />
          </View>
        </View>

        <View style={styles.card}>
          <View style={styles.field}>
            <Text style={styles.label}>{t('editProfile.interestsLabel')}</Text>
            <Text style={styles.hint}>{t('editProfile.interestsHint')}</Text>
            <View style={styles.chipRow}>
              {INTERESTS.map((item) => {
                const selected = interests.includes(item);
                return (
                  <Pressable
                    key={item}
                    onPress={() => toggleInterest(item)}
                    style={[styles.selectableChip, selected && styles.selectableChipSelected]}
                  >
                    {selected ? <Check size={12} color={colors.primary} /> : null}
                    <Text style={[styles.chipText, selected && styles.chipTextSelected]}>{item}</Text>
                  </Pressable>
                );
              })}
            </View>
          </View>

          <View style={styles.field}>
            <Text style={styles.label}>{t('editProfile.goalsLabel')}</Text>
            <Text style={styles.hint}>{t('editProfile.goalsHint')}</Text>
            <View style={styles.chipRow}>
              {GOALS.map((item) => {
                const selected = goals.includes(item);
                return (
                  <Pressable
                    key={item}
                    onPress={() => toggleGoal(item)}
                    style={[styles.selectableChip, selected && styles.selectableChipSelected]}
                  >
                    {selected ? <Check size={12} color={colors.primary} /> : null}
                    <Text style={[styles.chipText, selected && styles.chipTextSelected]}>{item}</Text>
                  </Pressable>
                );
              })}
            </View>
          </View>
        </View>

        <Pressable style={styles.saveBtn} onPress={handleSave} disabled={saving}>
          <Text style={styles.saveBtnText}>{saving ? t('common.loading') : t('editProfile.save')}</Text>
          <ArrowRight size={16} color={colors.white} />
        </Pressable>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  header: {
    height: 60,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    backgroundColor: colors.white,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  backBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: { fontSize: 15, fontWeight: '800', color: colors.text },
  content: { padding: 16, paddingBottom: 40, gap: 16 },
  subtitle: { fontSize: 13, color: colors.textMuted, lineHeight: 19 },
  toast: {
    backgroundColor: colors.primary,
    borderRadius: 12,
    padding: 12,
  },
  toastText: { color: colors.white, fontSize: 12, fontWeight: '700' },
  card: {
    backgroundColor: colors.white,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 18,
    gap: 16,
  },
  field: { gap: 8 },
  label: { fontSize: 13, fontWeight: '800', color: colors.text },
  hint: { fontSize: 11, color: colors.textFaint, marginTop: -4 },
  input: {
    backgroundColor: colors.background,
    borderWidth: 1,
    borderColor: colors.borderStrong,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 14,
    color: colors.text,
  },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: {
    paddingHorizontal: 14,
    paddingVertical: 9,
    borderRadius: 999,
    backgroundColor: colors.background,
    borderWidth: 1,
    borderColor: colors.border,
  },
  chipSelected: { backgroundColor: colors.primarySoft, borderColor: colors.primary },
  chipText: { fontSize: 12, fontWeight: '600', color: colors.textMuted },
  chipTextSelected: { color: colors.primary },
  selectableChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 9,
    borderRadius: 999,
    backgroundColor: colors.background,
    borderWidth: 1,
    borderColor: 'transparent',
  },
  selectableChipSelected: { backgroundColor: colors.primarySoft, borderColor: colors.primary },
  saveBtn: {
    flexDirection: 'row',
    gap: 8,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.primary,
    borderRadius: 14,
    paddingVertical: 15,
  },
  saveBtnText: { color: colors.white, fontWeight: '800', fontSize: 14 },
});
