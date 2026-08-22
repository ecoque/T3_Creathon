import { router } from 'expo-router';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, TextInput } from 'react-native';

import { useOnboardingStore } from '../../lib/onboardingStore';
import { supabase } from '../../lib/supabase';

function splitCommaList(value: string): string[] {
  return value
    .split(',')
    .map((item) => item.trim())
    .filter((item) => item.length > 0);
}

// Basit ilk versiyon: tasarım sonradan güncellenecek.
export default function OnboardingProfileScreen() {
  const { t } = useTranslation();
  const role = useOnboardingStore((state) => state.role);
  const [fullName, setFullName] = useState('');
  const [sector, setSector] = useState('');
  const [interests, setInterests] = useState('');
  const [goals, setGoals] = useState('');
  const [linkedinUrl, setLinkedinUrl] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit() {
    if (!role) {
      router.replace('/onboarding');
      return;
    }

    setLoading(true);
    setError(null);

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      setLoading(false);
      router.replace('/auth');
      return;
    }

    const { error: insertError } = await supabase.from('profiles').insert({
      user_id: user.id,
      full_name: fullName,
      role,
      sector,
      interests: splitCommaList(interests),
      goals: splitCommaList(goals),
      linkedin_url: linkedinUrl || null,
    });

    setLoading(false);

    if (insertError) {
      setError(insertError.message);
      return;
    }

    router.replace('/(tabs)/home');
  }

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Text style={styles.title}>{t('profile.formTitle')}</Text>
      <TextInput
        style={styles.input}
        placeholder={t('profile.fullName')}
        value={fullName}
        onChangeText={setFullName}
      />
      <TextInput style={styles.input} placeholder={t('profile.sector')} value={sector} onChangeText={setSector} />
      <TextInput
        style={styles.input}
        placeholder={t('profile.interests')}
        value={interests}
        onChangeText={setInterests}
      />
      <TextInput style={styles.input} placeholder={t('profile.goals')} value={goals} onChangeText={setGoals} />
      <TextInput
        style={styles.input}
        placeholder={t('profile.linkedin')}
        autoCapitalize="none"
        value={linkedinUrl}
        onChangeText={setLinkedinUrl}
      />
      {error ? <Text style={styles.error}>{error}</Text> : null}
      {loading ? (
        <ActivityIndicator />
      ) : (
        <Pressable style={styles.button} onPress={handleSubmit}>
          <Text style={styles.buttonText}>{t('profile.submit')}</Text>
        </Pressable>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flexGrow: 1,
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
  input: {
    borderWidth: 1,
    borderColor: '#ccc',
    borderRadius: 8,
    paddingVertical: 12,
    paddingHorizontal: 16,
    fontSize: 16,
  },
  button: {
    backgroundColor: '#F7941D',
    borderRadius: 8,
    paddingVertical: 14,
    alignItems: 'center',
    marginTop: 8,
  },
  buttonText: {
    color: '#fff',
    fontWeight: '600',
    fontSize: 15,
  },
  error: {
    color: '#c62828',
    textAlign: 'center',
  },
});
