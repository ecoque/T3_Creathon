import { useQueryClient } from '@tanstack/react-query';
import { router } from 'expo-router';
import { Check, ChevronLeft } from 'lucide-react-native';
import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { colors } from '../../constants/theme';
import { isCorporateSchemaMissing } from '../../features/corporate/schema';
import { isInvestorSchemaMissing } from '../../features/investor/schema';
import { useOnboardingStore } from '../../lib/onboardingStore';
import { supabase } from '../../lib/supabase';
import type { ParticipantRole } from '../../types';

const ROLE_CONTENT: Record<ParticipantRole, { sectors: string[]; interests: string[]; goals: string[] }> = {
  girisimci: {
    sectors: ['Yapay Zeka', 'SaaS', 'Fintech', 'Sağlık Teknolojileri', 'Donanım & IoT', 'Oyun & Medya', 'Sürdürülebilirlik'],
    interests: ['Yatırım', 'Ürün Geliştirme', 'B2B SaaS', 'Yapay Zeka', 'Büyüme', 'İş Ortaklıkları'],
    goals: ['Yatırımcılarla görüşmek', 'Kurumsal pilot bulmak', 'İş ortağı bulmak', 'Ürün geri bildirimi almak'],
  },
  yatirimci: {
    sectors: ['Yapay Zeka', 'Fintech', 'SaaS', 'Sağlık Teknolojileri', 'Savunma Teknolojileri', 'İklim Teknolojileri', 'Oyun & Medya'],
    interests: ['Erken Aşama', 'Deep Tech', 'Fintech', 'B2B SaaS', 'Yapay Zeka', 'İklim Teknolojileri'],
    goals: ['Yeni girişimler keşfetmek', 'Yatırım görüşmesi yapmak', 'Ortak yatırım fırsatı bulmak', 'Ekosistemi takip etmek'],
  },
  kurum: {
    sectors: ['Kurumsal İnovasyon', 'Teknoloji Platformları', 'Finans', 'Telekomünikasyon', 'Enerji', 'Savunma', 'Perakende'],
    interests: ['Açık İnovasyon', 'Dijital Dönüşüm', 'Yapay Zeka', 'Sürdürülebilirlik', 'SaaS', 'Ekosistem'],
    goals: ['Pilot proje bulmak', 'Çözüm ortağı seçmek', 'Girişimlerle görüşmek', 'Yeni teknolojileri keşfetmek'],
  },
  ziyaretci: {
    sectors: ['Teknoloji', 'Tasarım', 'Eğitim', 'Medya', 'Finans', 'Kamu', 'Diğer'],
    interests: ['Yapay Zeka', 'Girişimcilik', 'Oyun & Medya', 'Fintech', 'Sürdürülebilirlik', 'Savunma Teknolojileri'],
    goals: ['Oturumları takip etmek', 'Yeni insanlarla tanışmak', 'Yeni ürünleri keşfetmek', 'İlham almak'],
  },
};

const CORPORATE_NEED_AREAS = ['Yapay Zeka', 'Veri & Analitik', 'SaaS', 'Siber Güvenlik', 'Sürdürülebilirlik', 'Fintech', 'Donanım & IoT', 'Müşteri Deneyimi'];

function toggleItem(items: string[], item: string, limit: number): string[] {
  if (items.includes(item)) return items.filter((value) => value !== item);
  return items.length >= limit ? items : [...items, item];
}

export default function OnboardingProfileScreen() {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const role = useOnboardingStore((state) => state.role);
  const content = useMemo(() => (role ? ROLE_CONTENT[role] : null), [role]);
  const [fullName, setFullName] = useState('');
  const [title, setTitle] = useState('');
  const [company, setCompany] = useState('');
  const [sector, setSector] = useState('');
  const [investmentFocuses, setInvestmentFocuses] = useState<string[]>([]);
  const [investmentThesis, setInvestmentThesis] = useState('');
  const [technologyNeedSummary, setTechnologyNeedSummary] = useState('');
  const [technologyNeedAreas, setTechnologyNeedAreas] = useState<string[]>([]);
  const [interests, setInterests] = useState<string[]>([]);
  const [goals, setGoals] = useState<string[]>([]);
  const [otherSector, setOtherSector] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [investorSchemaReady, setInvestorSchemaReady] = useState<boolean | null>(role === 'yatirimci' ? null : true);
  const [investorSchemaIssue, setInvestorSchemaIssue] = useState<'missing' | 'unavailable' | null>(null);
  const [corporateSchemaReady, setCorporateSchemaReady] = useState<boolean | null>(role === 'kurum' ? null : true);
  const [corporateSchemaIssue, setCorporateSchemaIssue] = useState<'missing' | 'unavailable' | null>(null);

  useEffect(() => {
    if (!role) router.replace('/onboarding');
  }, [role]);

  useEffect(() => {
    setInvestmentFocuses((current) => current.filter((item) => item !== sector));
  }, [sector]);

  useEffect(() => {
    let active = true;
    if (role !== 'yatirimci') {
      setInvestorSchemaReady(true);
      setInvestorSchemaIssue(null);
      return () => { active = false; };
    }
    setInvestorSchemaReady(null);
    void supabase
      .from('profiles')
      .select('investment_thesis,investment_focuses')
      .limit(0)
      .then(({ error: schemaError }) => {
        if (!active) return;
        if (!schemaError) {
          setInvestorSchemaReady(true);
          setInvestorSchemaIssue(null);
          return;
        }
        setInvestorSchemaReady(false);
        const issue = isInvestorSchemaMissing(schemaError) ? 'missing' : 'unavailable';
        setInvestorSchemaIssue(issue);
        setError(
          issue === 'missing'
            ? t('investor.migrationRequired')
            : t('investor.schemaCheckFailed'),
        );
      });
    return () => { active = false; };
  }, [role, t]);

  useEffect(() => {
    let active = true;
    if (role !== 'kurum') {
      setCorporateSchemaReady(true);
      setCorporateSchemaIssue(null);
      return () => { active = false; };
    }
    setCorporateSchemaReady(null);
    void supabase.from('profiles').select('technology_need_summary,technology_need_areas').limit(0).then(({ error: schemaError }) => {
      if (!active) return;
      if (!schemaError) {
        setCorporateSchemaReady(true);
        setCorporateSchemaIssue(null);
        return;
      }
      setCorporateSchemaReady(false);
      const issue = isCorporateSchemaMissing(schemaError) ? 'missing' : 'unavailable';
      setCorporateSchemaIssue(issue);
      setError(t(issue === 'missing' ? 'corporate.migrationRequired' : 'corporate.schemaCheckFailed'));
    });
    return () => { active = false; };
  }, [role, t]);

  async function handleSubmit() {
    const selectedSector = sector === 'Diğer' ? otherSector.trim() : sector;
    if (!role) {
      router.replace('/onboarding');
      return;
    }
    if (
      !fullName.trim()
      || !selectedSector
      || interests.length < 2
      || goals.length < 1
      || (role === 'girisimci' && (!title.trim() || !company.trim()))
      || (role === 'yatirimci' && !investmentThesis.trim())
      || (role === 'kurum' && (!title.trim() || !company.trim() || technologyNeedSummary.trim().length < 20 || technologyNeedAreas.length < 1))
    ) {
      setError(t(role === 'yatirimci' ? 'investor.onboardingValidation' : role === 'girisimci' ? 'entrepreneur.onboardingValidation' : role === 'kurum' ? 'corporate.onboardingValidation' : 'onboarding.profileValidation'));
      return;
    }
    if (role === 'kurum' && corporateSchemaReady !== true) {
      setError(t(corporateSchemaIssue === 'missing' ? 'corporate.migrationRequired' : corporateSchemaIssue === 'unavailable' ? 'corporate.schemaCheckFailed' : 'corporate.onboardingValidation'));
      return;
    }
    if (role === 'yatirimci' && (investmentFocuses.length < 1 || investorSchemaReady !== true)) {
      setError(t(
        investorSchemaIssue === 'missing'
          ? 'investor.migrationRequired'
          : investorSchemaIssue === 'unavailable'
            ? 'investor.schemaCheckFailed'
            : 'investor.onboardingValidation',
      ));
      return;
    }
    setLoading(true);
    setError(null);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      setLoading(false);
      router.replace('/auth');
      return;
    }

    const profilePayload = {
        user_id: user.id,
        full_name: fullName.trim(),
        role,
        sector: selectedSector,
        interests,
        goals,
        title: title.trim() || null,
        company: company.trim() || null,
        ...(role === 'yatirimci'
          ? {
              investment_focuses: investmentFocuses,
              investment_thesis: investmentThesis.trim(),
            }
          : role === 'kurum'
            ? {
                technology_need_summary: technologyNeedSummary.trim(),
                technology_need_areas: technologyNeedAreas,
              }
            : {}),
      };

    let { error: saveError } = await supabase.from('profiles').upsert(
      profilePayload,
      { onConflict: 'user_id' },
    );
    if (saveError && !['yatirimci', 'girisimci', 'kurum'].includes(role) && isInvestorSchemaMissing(saveError)) {
      const legacyResult = await supabase.from('profiles').upsert(
        {
          user_id: user.id,
          full_name: fullName.trim(),
          role,
          sector: selectedSector,
          interests,
          goals,
        },
        { onConflict: 'user_id' },
      );
      saveError = legacyResult.error;
    }
    setLoading(false);
    if (saveError) {
      setError(isCorporateSchemaMissing(saveError) ? t('corporate.migrationRequired') : isInvestorSchemaMissing(saveError) ? t(role === 'girisimci' ? 'entrepreneur.migrationRequired' : 'investor.migrationRequired') : saveError.message);
      return;
    }

    await queryClient.invalidateQueries({ queryKey: ['me', 'profile'] });
    router.replace('/(tabs)/home');
  }

  if (!content) {
    return (
      <SafeAreaView style={styles.fallback} edges={['top', 'bottom']}>
        <ActivityIndicator color={colors.primary} />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.screen} edges={['top', 'bottom']}>
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
        <View style={styles.topRow}>
          <Pressable style={styles.backButton} onPress={() => router.back()} hitSlop={8}><ChevronLeft size={21} color={colors.text} /></Pressable>
          <View style={styles.stepRow}><View style={styles.stepDone} /><View style={styles.stepActive} /></View>
        </View>
        <Text style={styles.eyebrow}>{t('onboarding.lastStep')}</Text>
        <Text style={styles.title}>{t(role === 'yatirimci' ? 'investor.onboardingTitle' : role === 'girisimci' ? 'entrepreneur.onboardingTitle' : role === 'kurum' ? 'corporate.onboardingTitle' : 'onboarding.profileTitle')}</Text>
        <Text style={styles.subtitle}>{t(role === 'yatirimci' ? 'investor.onboardingSubtitle' : role === 'girisimci' ? 'entrepreneur.onboardingSubtitle' : role === 'kurum' ? 'corporate.onboardingSubtitle' : 'onboarding.profileSubtitle')}</Text>

        <View style={styles.card}>
          <Text style={styles.label}>{t('onboarding.fullNameLabel')}</Text>
          <TextInput style={styles.input} placeholder={t('onboarding.fullNamePlaceholder')} placeholderTextColor={colors.textFaint} value={fullName} onChangeText={setFullName} autoComplete="name" textContentType="name" />
          <Text style={styles.label}>{t(role === 'yatirimci' ? 'investor.titleLabel' : role === 'girisimci' ? 'entrepreneur.titleLabel' : role === 'kurum' ? 'corporate.titleLabel' : 'onboarding.titleLabel')}</Text>
          <TextInput style={styles.input} placeholder={t(role === 'yatirimci' ? 'investor.titlePlaceholder' : role === 'girisimci' ? 'entrepreneur.titlePlaceholder' : role === 'kurum' ? 'corporate.titlePlaceholder' : 'onboarding.titlePlaceholder')} placeholderTextColor={colors.textFaint} value={title} onChangeText={setTitle} />
          <Text style={styles.label}>{role === 'girisimci' ? t('entrepreneur.companyLabel') : role === 'yatirimci' ? t('investor.fundLabel') : role === 'kurum' ? t('corporate.companyLabel') : t('onboarding.companyLabel')}</Text>
          <TextInput style={styles.input} placeholder={role === 'girisimci' ? t('entrepreneur.companyPlaceholder') : role === 'yatirimci' ? t('investor.fundPlaceholder') : role === 'kurum' ? t('corporate.companyPlaceholder') : t('onboarding.companyPlaceholder')} placeholderTextColor={colors.textFaint} value={company} onChangeText={setCompany} autoComplete="organization" textContentType="organizationName" />
        </View>

        <View style={styles.card}>
          <Text style={styles.label}>{t(role === 'yatirimci' ? 'investor.primaryFocusLabel' : 'onboarding.sectorLabel')}</Text>
          <Text style={styles.hint}>{t(role === 'yatirimci' ? 'investor.primaryFocusHint' : 'onboarding.sectorHint')}</Text>
          <View style={styles.chipRow}>
            {[...new Set([...content.sectors, 'Diğer'])].map((item) => <ChoiceChip key={item} label={item} selected={sector === item} onPress={() => setSector(item)} />)}
          </View>
          {sector === 'Diğer' ? <TextInput style={styles.input} placeholder={t('onboarding.otherSectorPlaceholder')} placeholderTextColor={colors.textFaint} value={otherSector} onChangeText={setOtherSector} /> : null}
        </View>

        {role === 'yatirimci' ? (
          <View style={styles.card}>
            <Text style={styles.label}>{t('investor.secondaryFocusLabel')}</Text>
            <Text style={styles.hint}>{t('investor.secondaryFocusHint', { count: investmentFocuses.length })}</Text>
            <View style={styles.chipRow}>
              {content.sectors.filter((item) => item !== sector).map((item) => (
                <ChoiceChip
                  key={item}
                  label={item}
                  selected={investmentFocuses.includes(item)}
                  onPress={() => setInvestmentFocuses((current) => toggleItem(current, item, 2))}
                />
              ))}
            </View>
          </View>
        ) : null}

        {role === 'kurum' ? (
          <View style={styles.card}>
            <Text style={styles.label}>{t('corporate.needAreasLabel')}</Text>
            <Text style={styles.hint}>{t('corporate.needAreasHint', { count: technologyNeedAreas.length })}</Text>
            <View style={styles.chipRow}>
              {CORPORATE_NEED_AREAS.map((item) => <ChoiceChip key={item} label={item} selected={technologyNeedAreas.includes(item)} onPress={() => setTechnologyNeedAreas((current) => toggleItem(current, item, 5))} />)}
            </View>
            <Text style={styles.label}>{t('corporate.needSummaryLabel')}</Text>
            <Text style={styles.hint}>{t('corporate.needSummaryHint', { count: technologyNeedSummary.length })}</Text>
            <TextInput style={[styles.input, styles.textArea]} placeholder={t('corporate.needSummaryPlaceholder')} placeholderTextColor={colors.textFaint} value={technologyNeedSummary} onChangeText={(value) => setTechnologyNeedSummary(value.slice(0, 500))} multiline maxLength={500} textAlignVertical="top" />
          </View>
        ) : null}

        <View style={styles.card}>
          <Text style={styles.label}>{t(role === 'yatirimci' ? 'investor.preferencesLabel' : 'onboarding.interestsLabel')}</Text>
          <Text style={styles.hint}>{t(role === 'yatirimci' ? 'investor.preferencesHint' : 'onboarding.interestsHint', { count: interests.length })}</Text>
          <View style={styles.chipRow}>
            {content.interests.map((item) => <ChoiceChip key={item} label={item} selected={interests.includes(item)} onPress={() => setInterests((current) => toggleItem(current, item, 3))} />)}
          </View>
        </View>

        {role === 'yatirimci' ? (
          <View style={styles.card}>
            <Text style={styles.label}>{t('investor.thesisLabel')}</Text>
            <Text style={styles.hint}>{t('investor.thesisHint', { count: investmentThesis.length })}</Text>
            <TextInput
              style={[styles.input, styles.textArea]}
              placeholder={t('investor.thesisPlaceholder')}
              placeholderTextColor={colors.textFaint}
              value={investmentThesis}
              onChangeText={(value) => setInvestmentThesis(value.slice(0, 280))}
              multiline
              maxLength={280}
              textAlignVertical="top"
            />
          </View>
        ) : null}

        <View style={styles.card}>
          <Text style={styles.label}>{t('onboarding.goalLabel')}</Text>
          <Text style={styles.hint}>{t('onboarding.goalsHint', { count: goals.length })}</Text>
          <View style={styles.chipRow}>
            {content.goals.map((item) => <ChoiceChip key={item} label={item} selected={goals.includes(item)} onPress={() => setGoals((current) => toggleItem(current, item, 2))} />)}
          </View>
        </View>

        {error ? <Text style={styles.error}>{error}</Text> : null}
        <Pressable style={[styles.button, (loading || investorSchemaReady === null || corporateSchemaReady === null) && styles.buttonDisabled]} onPress={handleSubmit} disabled={loading || investorSchemaReady === null || corporateSchemaReady === null}>
          {loading || investorSchemaReady === null || corporateSchemaReady === null ? <ActivityIndicator color={colors.white} /> : <Text style={styles.buttonText}>{t('onboarding.discoverEvent')}</Text>}
        </Pressable>
      </ScrollView>
    </SafeAreaView>
  );
}

function ChoiceChip({ label, selected, onPress }: { label: string; selected: boolean; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} style={[styles.chip, selected && styles.chipSelected]} accessibilityRole="checkbox" accessibilityState={{ checked: selected }}>
      {selected ? <Check size={13} color={colors.primary} strokeWidth={3} /> : null}
      <Text style={[styles.chipText, selected && styles.chipTextSelected]}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  fallback: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.background },
  content: { padding: 24, paddingBottom: 32, gap: 14 },
  topRow: { height: 42, alignItems: 'center', justifyContent: 'center', marginBottom: 6, position: 'relative' },
  backButton: { position: 'absolute', left: 0, width: 38, height: 38, alignItems: 'center', justifyContent: 'center', borderRadius: 19, backgroundColor: colors.white, borderWidth: 1, borderColor: colors.border },
  stepRow: { width: '72%', flexDirection: 'row', gap: 6 },
  stepDone: { height: 4, flex: 1, borderRadius: 4, backgroundColor: colors.primary },
  stepActive: { height: 4, flex: 1, borderRadius: 4, backgroundColor: colors.primary },
  eyebrow: { color: colors.primary, fontSize: 11, fontWeight: '800', letterSpacing: 1.2, marginTop: 8 },
  title: { color: colors.text, fontSize: 27, fontWeight: '800', letterSpacing: -0.5 },
  subtitle: { color: colors.textMuted, fontSize: 14, lineHeight: 21, marginBottom: 8 },
  card: { backgroundColor: colors.white, borderRadius: 18, borderWidth: 1, borderColor: colors.border, padding: 16, gap: 10 },
  label: { color: colors.text, fontSize: 14, fontWeight: '800' },
  hint: { color: colors.textFaint, fontSize: 12, lineHeight: 18, marginTop: -4 },
  input: { backgroundColor: colors.background, borderColor: colors.borderStrong, borderRadius: 12, borderWidth: 1, color: colors.text, fontSize: 15, paddingHorizontal: 14, paddingVertical: 12 },
  textArea: { minHeight: 112 },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: colors.background, borderColor: colors.border, borderRadius: 999, borderWidth: 1, paddingHorizontal: 12, paddingVertical: 9 },
  chipSelected: { backgroundColor: colors.primarySoft, borderColor: colors.primary },
  chipText: { color: colors.textMuted, fontSize: 12, fontWeight: '700' },
  chipTextSelected: { color: colors.primary },
  error: { color: colors.danger, fontSize: 12, fontWeight: '700', lineHeight: 18, textAlign: 'center' },
  button: { alignItems: 'center', backgroundColor: colors.primary, borderRadius: 14, justifyContent: 'center', marginTop: 2, minHeight: 52 },
  buttonDisabled: { opacity: 0.65 },
  buttonText: { color: colors.white, fontSize: 15, fontWeight: '800' },
});
