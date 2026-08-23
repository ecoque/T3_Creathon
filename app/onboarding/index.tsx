import { useQueryClient } from '@tanstack/react-query';
import { router } from 'expo-router';
import { Building2, BriefcaseBusiness, Check, Rocket, Users } from 'lucide-react-native';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { colors } from '../../constants/theme';
import { useOnboardingStore } from '../../lib/onboardingStore';
import { supabase } from '../../lib/supabase';
import type { ParticipantRole } from '../../types';

const ROLES: { id: ParticipantRole; title: string; description: string; Icon: typeof Rocket }[] = [
  { id: 'girisimci', title: 'Girişimci', description: 'Girişimini tanıt, yatırımcı ve iş ortağı bul.', Icon: Rocket },
  { id: 'yatirimci', title: 'Yatırımcı', description: 'Yeni girişimleri keşfet ve yatırım fırsatlarını değerlendir.', Icon: BriefcaseBusiness },
  { id: 'kurum', title: 'Kurum / Partner', description: 'İş birliği ve açık inovasyon fırsatlarını takip et.', Icon: Building2 },
  { id: 'ziyaretci', title: 'Ziyaretçi', description: 'Programı keşfet, topluluğa dahil ol.', Icon: Users },
];

export default function OnboardingRoleScreen() {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const setRole = useOnboardingStore((state) => state.setRole);
  const [selectedRole, setSelectedRole] = useState<ParticipantRole | null>(null);

  function handleContinue() {
    if (!selectedRole) return;
    setRole(selectedRole);
    router.push('/onboarding/profile');
  }

  async function handleSignOut() {
    await supabase.auth.signOut();
    queryClient.clear();
    router.replace('/auth');
  }

  return (
    <SafeAreaView style={styles.screen} edges={['top', 'bottom']}>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.stepRow}><View style={styles.stepActive} /><View style={styles.stepInactive} /></View>
        <Text style={styles.eyebrow}>TAKEOFF İSTANBUL 2026</Text>
        <Text style={styles.title}>{t('onboarding.roleTitle')}</Text>
        <Text style={styles.subtitle}>Sana daha uygun kişiler ve içerikler önermemize yardımcı olur.</Text>

        <View style={styles.roleList}>
          {ROLES.map(({ id, title, description, Icon }) => {
            const selected = selectedRole === id;
            return (
              <Pressable key={id} accessibilityRole="radio" accessibilityState={{ selected }} style={[styles.card, selected && styles.cardSelected]} onPress={() => setSelectedRole(id)}>
                <View style={[styles.iconCircle, selected && styles.iconCircleSelected]}><Icon size={20} color={selected ? colors.white : colors.primary} strokeWidth={2.2} /></View>
                <View style={styles.cardBody}><Text style={styles.cardTitle}>{title}</Text><Text style={styles.cardDescription}>{description}</Text></View>
                <View style={[styles.radio, selected && styles.radioSelected]}>{selected ? <Check size={13} color={colors.white} strokeWidth={3} /> : null}</View>
              </Pressable>
            );
          })}
        </View>

        <Pressable accessibilityRole="button" disabled={!selectedRole} style={[styles.continueButton, !selectedRole && styles.continueButtonDisabled]} onPress={handleContinue}>
          <Text style={styles.continueButtonText}>Devam et</Text>
        </Pressable>
        <Text style={styles.note}>Bu seçimleri daha sonra profilinden güncelleyebilirsin.</Text>
        <Pressable onPress={handleSignOut} hitSlop={8}><Text style={styles.signOut}>{t('auth.signOut')}</Text></Pressable>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  content: { flexGrow: 1, paddingHorizontal: 24, paddingTop: 20, paddingBottom: 28 },
  stepRow: { flexDirection: 'row', gap: 6, marginBottom: 28 },
  stepActive: { height: 4, flex: 1, borderRadius: 4, backgroundColor: colors.primary },
  stepInactive: { height: 4, flex: 1, borderRadius: 4, backgroundColor: colors.borderStrong },
  eyebrow: { color: colors.primary, fontSize: 11, fontWeight: '800', letterSpacing: 1.2, marginBottom: 8 },
  title: { color: colors.text, fontSize: 28, fontWeight: '800', letterSpacing: -0.5 },
  subtitle: { color: colors.textMuted, fontSize: 15, lineHeight: 22, marginTop: 8, marginBottom: 24 },
  roleList: { gap: 10 },
  card: { minHeight: 86, flexDirection: 'row', alignItems: 'center', gap: 12, borderWidth: 1, borderColor: colors.border, borderRadius: 16, padding: 14, backgroundColor: colors.white },
  cardSelected: { borderColor: colors.primary, backgroundColor: colors.primarySoft },
  iconCircle: { width: 42, height: 42, borderRadius: 21, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.primarySoft },
  iconCircleSelected: { backgroundColor: colors.primary },
  cardBody: { flex: 1, gap: 3 },
  cardTitle: { color: colors.text, fontSize: 16, fontWeight: '800' },
  cardDescription: { color: colors.textMuted, fontSize: 12, lineHeight: 17 },
  radio: { width: 22, height: 22, borderRadius: 11, borderWidth: 1.5, borderColor: colors.borderStrong, alignItems: 'center', justifyContent: 'center' },
  radioSelected: { backgroundColor: colors.primary, borderColor: colors.primary },
  continueButton: { alignItems: 'center', backgroundColor: colors.primary, borderRadius: 14, marginTop: 24, paddingVertical: 15 },
  continueButtonDisabled: { backgroundColor: colors.surfaceHigh },
  continueButtonText: { color: colors.white, fontSize: 15, fontWeight: '800' },
  note: { color: colors.textFaint, fontSize: 12, lineHeight: 18, marginTop: 12, textAlign: 'center' },
  signOut: { color: colors.textMuted, fontSize: 13, marginTop: 22, textAlign: 'center', textDecorationLine: 'underline' },
});
