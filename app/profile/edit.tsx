import { useQueryClient } from '@tanstack/react-query';
import { router } from 'expo-router';
import { ArrowLeft, ArrowRight, Check } from 'lucide-react-native';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { colors } from '../../constants/theme';
import { isCorporateSchemaMissing } from '../../features/corporate/schema';
import { isInvestorSchemaMissing } from '../../features/investor/schema';
import { supabase } from '../../lib/supabase';
import { useCurrentProfile } from '../../lib/useCurrentProfile';

const SECTORS = [
  'Yapay Zeka',
  'SaaS',
  'Fintech',
  'Sağlık Teknolojileri',
  'Donanım & IoT',
  'Oyun & Medya',
  'Sürdürülebilirlik',
  'Savunma Teknolojileri',
  'İklim Teknolojileri',
  'Kurumsal İnovasyon',
  'Teknoloji Platformları',
  'Telekomünikasyon',
  'Enerji',
  'Perakende',
  'Teknoloji',
  'Tasarım',
  'Eğitim',
  'Medya',
  'Finans',
  'Kamu',
  'E-Ticaret',
];
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
const INVESTOR_PREFERENCES = ['Erken Aşama', 'Deep Tech', 'Fintech', 'B2B SaaS', 'Yapay Zeka', 'İklim Teknolojileri'];
const INVESTOR_GOALS = ['Yeni girişimler keşfetmek', 'Yatırım görüşmesi yapmak', 'Ortak yatırım fırsatı bulmak', 'Ekosistemi takip etmek'];
const CORPORATE_NEED_AREAS = ['Yapay Zeka', 'Veri & Analitik', 'SaaS', 'Siber Güvenlik', 'Sürdürülebilirlik', 'Fintech', 'Donanım & IoT', 'Müşteri Deneyimi'];

export default function EditProfileScreen() {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const { data: meResult } = useCurrentProfile();
  const profile = meResult?.profile;

  const [fullName, setFullName] = useState('');
  const [sector, setSector] = useState('Teknoloji');
  const [title, setTitle] = useState('');
  const [company, setCompany] = useState('');
  const [investmentFocuses, setInvestmentFocuses] = useState<string[]>([]);
  const [investmentThesis, setInvestmentThesis] = useState('');
  const [technologyNeedSummary, setTechnologyNeedSummary] = useState('');
  const [technologyNeedAreas, setTechnologyNeedAreas] = useState<string[]>([]);
  const [linkedin, setLinkedin] = useState('');
  const [interests, setInterests] = useState<string[]>([]);
  const [goals, setGoals] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (profile) {
      setFullName(profile.full_name ?? '');
      setSector(profile.sector || 'Teknoloji');
      setTitle(profile.title ?? '');
      setCompany(profile.company ?? '');
      setInvestmentFocuses(profile.investment_focuses ?? []);
      setInvestmentThesis(profile.investment_thesis ?? '');
      setTechnologyNeedSummary(profile.technology_need_summary ?? '');
      setTechnologyNeedAreas(profile.technology_need_areas ?? []);
      setLinkedin(profile.linkedin_url ?? '');
      setInterests(profile.interests ?? []);
      setGoals(profile.goals ?? []);
    }
  }, [profile]);

  useEffect(() => {
    if (profile?.role === 'yatirimci') {
      setInvestmentFocuses((current) => current.filter((focus) => focus !== sector));
    }
  }, [profile?.role, sector]);

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
    setGoals((prev) => {
      if (prev.includes(item)) return prev.filter((goal) => goal !== item);
      if (profile?.role === 'yatirimci' && prev.length >= 2) {
        setError(t('investor.maxGoals'));
        return prev;
      }
      return [...prev, item];
    });
  }

  function toggleInvestmentFocus(item: string) {
    setInvestmentFocuses((current) => {
      if (current.includes(item)) return current.filter((focus) => focus !== item);
      return current.length >= 2 ? current : [...current, item];
    });
  }

  function toggleTechnologyNeedArea(item: string) {
    setTechnologyNeedAreas((current) => current.includes(item)
      ? current.filter((area) => area !== item)
      : current.length >= 5 ? current : [...current, item]);
  }

  async function handleSave() {
    if (!fullName.trim()) {
      setError(t('editProfile.nameRequired'));
      return;
    }
    if (profile?.role === 'girisimci' && (!title.trim() || !company.trim())) {
      setError(t('entrepreneur.profileRequired'));
      return;
    }
    if (profile?.role === 'kurum' && (!title.trim() || !company.trim() || technologyNeedSummary.trim().length < 20 || technologyNeedAreas.length < 1)) {
      setError(t('corporate.profileValidation'));
      return;
    }
    if (profile?.role === 'yatirimci') {
      if (!investmentThesis.trim()) {
        setError(t('investor.thesisRequired'));
        return;
      }
      const secondaryCount = investmentFocuses.filter((focus) => focus !== sector).length;
      if (secondaryCount < 1 || secondaryCount > 2) {
        setError(t('investor.secondaryFocusRequired'));
        return;
      }
      if (interests.length < 2 || interests.length > 3 || goals.length < 1 || goals.length > 2) {
        setError(t('investor.editValidation'));
        return;
      }
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

    const updatePayload = {
      full_name: fullName,
      sector,
      title: title.trim() || null,
      company: company.trim() || null,
      ...(profile?.role === 'yatirimci'
        ? {
            investment_focuses: investmentFocuses.filter((focus) => focus !== sector),
            investment_thesis: investmentThesis.trim(),
          }
        : profile?.role === 'kurum'
          ? { technology_need_summary: technologyNeedSummary.trim(), technology_need_areas: technologyNeedAreas }
          : {}),
      linkedin_url: linkedin || null,
      interests,
      goals,
    };

    let { error: updateError } = await supabase
      .from('profiles')
      .update(updatePayload)
      .eq('user_id', user.id);

    if (updateError && !['yatirimci', 'girisimci', 'kurum'].includes(profile?.role ?? '') && isInvestorSchemaMissing(updateError)) {
      const legacyResult = await supabase
        .from('profiles')
        .update({
          full_name: fullName,
          sector,
          linkedin_url: linkedin || null,
          interests,
          goals,
        })
        .eq('user_id', user.id);
      updateError = legacyResult.error;
    }

    setSaving(false);

    if (updateError) {
      setError(isCorporateSchemaMissing(updateError) ? t('corporate.migrationRequired') : isInvestorSchemaMissing(updateError) ? t(profile?.role === 'girisimci' ? 'entrepreneur.migrationRequired' : 'investor.migrationRequired') : updateError.message);
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
            <Text style={styles.label}>{t(profile?.role === 'yatirimci' ? 'investor.primaryFocusLabel' : 'editProfile.sectorLabel')}</Text>
            <View style={styles.chipRow}>
              {[...new Set([...SECTORS, sector])].map((s) => {
                const selected = sector === s;
                return (
                  <Pressable key={s} onPress={() => setSector(s)} style={[styles.chip, selected && styles.chipSelected]}>
                    <Text style={[styles.chipText, selected && styles.chipTextSelected]}>{s}</Text>
                  </Pressable>
                );
              })}
            </View>
          </View>

          {profile?.role === 'yatirimci' ? (
            <View style={styles.field}>
              <Text style={styles.label}>{t('investor.secondaryFocusLabel')}</Text>
              <Text style={styles.hint}>{t('investor.secondaryFocusHint', { count: investmentFocuses.filter((focus) => focus !== sector).length })}</Text>
              <View style={styles.chipRow}>
                {[...new Set([...SECTORS, ...investmentFocuses])].filter((focus) => focus !== sector).map((focus) => {
                  const selected = investmentFocuses.includes(focus);
                  return (
                    <Pressable key={focus} onPress={() => toggleInvestmentFocus(focus)} style={[styles.selectableChip, selected && styles.selectableChipSelected]}>
                      {selected ? <Check size={12} color={colors.primary} /> : null}
                      <Text style={[styles.chipText, selected && styles.chipTextSelected]}>{focus}</Text>
                    </Pressable>
                  );
                })}
              </View>
            </View>
          ) : null}

          <View style={styles.field}>
            <Text style={styles.label}>{t(profile?.role === 'yatirimci' ? 'investor.titleLabel' : profile?.role === 'girisimci' ? 'entrepreneur.titleLabel' : profile?.role === 'kurum' ? 'corporate.titleLabel' : 'editProfile.titleLabel')}</Text>
            <TextInput
              style={styles.input}
              value={title}
              onChangeText={setTitle}
              placeholder={t(profile?.role === 'yatirimci' ? 'investor.titlePlaceholder' : profile?.role === 'girisimci' ? 'entrepreneur.titlePlaceholder' : profile?.role === 'kurum' ? 'corporate.titlePlaceholder' : 'editProfile.titlePlaceholder')}
              placeholderTextColor={colors.textFaint}
            />
          </View>

          <View style={styles.field}>
            <Text style={styles.label}>{profile?.role === 'girisimci' ? t('entrepreneur.companyLabel') : profile?.role === 'yatirimci' ? t('investor.fundLabel') : profile?.role === 'kurum' ? t('corporate.companyLabel') : t('onboarding.companyLabel')}</Text>
            <TextInput
              style={styles.input}
              value={company}
              onChangeText={setCompany}
              placeholder={profile?.role === 'girisimci' ? t('entrepreneur.companyPlaceholder') : profile?.role === 'yatirimci' ? t('investor.fundPlaceholder') : profile?.role === 'kurum' ? t('corporate.companyPlaceholder') : t('onboarding.companyPlaceholder')}
              placeholderTextColor={colors.textFaint}
              autoComplete="organization"
              textContentType="organizationName"
            />
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

        {profile?.role === 'yatirimci' ? (
          <View style={styles.card}>
            <View style={styles.field}>
              <Text style={styles.label}>{t('investor.thesisLabel')}</Text>
              <Text style={styles.hint}>{t('investor.thesisHint', { count: investmentThesis.length })}</Text>
              <TextInput
                style={[styles.input, styles.textArea]}
                value={investmentThesis}
                onChangeText={(value) => setInvestmentThesis(value.slice(0, 280))}
                placeholder={t('investor.thesisPlaceholder')}
                placeholderTextColor={colors.textFaint}
                multiline
                maxLength={280}
                textAlignVertical="top"
              />
            </View>
          </View>
        ) : null}

        {profile?.role === 'kurum' ? (
          <View style={styles.card}>
            <View style={styles.field}>
              <Text style={styles.label}>{t('corporate.needAreasLabel')}</Text>
              <Text style={styles.hint}>{t('corporate.needAreasHint', { count: technologyNeedAreas.length })}</Text>
              <View style={styles.chipRow}>
                {CORPORATE_NEED_AREAS.map((area) => {
                  const selected = technologyNeedAreas.includes(area);
                  return (
                    <Pressable key={area} onPress={() => toggleTechnologyNeedArea(area)} style={[styles.selectableChip, selected && styles.selectableChipSelected]}>
                      {selected ? <Check size={12} color={colors.primary} /> : null}
                      <Text style={[styles.chipText, selected && styles.chipTextSelected]}>{area}</Text>
                    </Pressable>
                  );
                })}
              </View>
            </View>
            <View style={styles.field}>
              <Text style={styles.label}>{t('corporate.needSummaryLabel')}</Text>
              <Text style={styles.hint}>{t('corporate.needSummaryHint', { count: technologyNeedSummary.length })}</Text>
              <TextInput style={[styles.input, styles.textArea]} value={technologyNeedSummary} onChangeText={(value) => setTechnologyNeedSummary(value.slice(0, 500))} placeholder={t('corporate.needSummaryPlaceholder')} placeholderTextColor={colors.textFaint} multiline maxLength={500} textAlignVertical="top" />
            </View>
          </View>
        ) : null}

        <View style={styles.card}>
          <View style={styles.field}>
            <Text style={styles.label}>{t(profile?.role === 'yatirimci' ? 'investor.preferencesLabel' : 'editProfile.interestsLabel')}</Text>
            <Text style={styles.hint}>{t(profile?.role === 'yatirimci' ? 'investor.preferencesHint' : 'editProfile.interestsHint', { count: interests.length })}</Text>
            <View style={styles.chipRow}>
              {[...new Set([...(profile?.role === 'yatirimci' ? INVESTOR_PREFERENCES : INTERESTS), ...interests])].map((item) => {
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
              {[...new Set([...(profile?.role === 'yatirimci' ? INVESTOR_GOALS : GOALS), ...goals])].map((item) => {
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
  textArea: { minHeight: 112 },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'flex-start', alignContent: 'flex-start', columnGap: 8, rowGap: 10 },
  chip: {
    alignSelf: 'flex-start',
    flexGrow: 0,
    flexShrink: 0,
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
    alignSelf: 'flex-start',
    flexGrow: 0,
    flexShrink: 0,
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
