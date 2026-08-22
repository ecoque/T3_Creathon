import { useQueryClient } from '@tanstack/react-query';
import { router } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { useOnboardingStore } from '../../lib/onboardingStore';
import { supabase } from '../../lib/supabase';
import type { ParticipantRole } from '../../types';

const ROLES: ParticipantRole[] = ['girisimci', 'yatirimci', 'kurum', 'ziyaretci'];

const ROLE_LABEL_KEY: Record<ParticipantRole, string> = {
  girisimci: 'onboarding.roleGirisimci',
  yatirimci: 'onboarding.roleYatirimci',
  kurum: 'onboarding.roleKurum',
  ziyaretci: 'onboarding.roleZiyaretci',
};

// Basit ilk versiyon: tasarım sonradan güncellenecek.
export default function OnboardingRoleScreen() {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const setRole = useOnboardingStore((state) => state.setRole);

  function handleSelect(role: ParticipantRole) {
    setRole(role);
    router.push('/onboarding/profile');
  }

  async function handleSignOut() {
    await supabase.auth.signOut();
    queryClient.clear();
    router.replace('/auth');
  }

  return (
    <View style={styles.container}>
      <Text style={styles.title}>{t('onboarding.roleTitle')}</Text>
      {ROLES.map((role) => (
        <Pressable key={role} style={styles.card} onPress={() => handleSelect(role)}>
          <Text style={styles.cardText}>{t(ROLE_LABEL_KEY[role])}</Text>
        </Pressable>
      ))}
      <Pressable onPress={handleSignOut}>
        <Text style={styles.signOut}>{t('auth.signOut')}</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    padding: 24,
    gap: 12,
  },
  title: {
    fontSize: 20,
    fontWeight: '600',
    marginBottom: 12,
    textAlign: 'center',
  },
  card: {
    borderWidth: 1,
    borderColor: '#ccc',
    borderRadius: 8,
    paddingVertical: 16,
    paddingHorizontal: 16,
  },
  cardText: {
    fontSize: 16,
    fontWeight: '500',
    textAlign: 'center',
  },
  signOut: {
    marginTop: 16,
    textAlign: 'center',
    color: '#6b7280',
    textDecorationLine: 'underline',
  },
});
