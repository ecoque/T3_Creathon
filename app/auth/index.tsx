import { router } from 'expo-router';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ActivityIndicator, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';

import { supabase } from '../../lib/supabase';

// Basit ilk versiyon: tasarım sonradan güncellenecek.
export default function AuthScreen() {
  const { t } = useTranslation();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [checkEmail, setCheckEmail] = useState(false);

  async function handleSignIn() {
    setLoading(true);
    setError(null);
    const { error: signInError } = await supabase.auth.signInWithPassword({ email, password });
    setLoading(false);
    if (signInError) {
      setError(signInError.message);
      return;
    }
    router.replace('/onboarding');
  }

  async function handleSignUp() {
    setLoading(true);
    setError(null);
    const { data, error: signUpError } = await supabase.auth.signUp({ email, password });
    setLoading(false);
    if (signUpError) {
      setError(signUpError.message);
      return;
    }
    if (data.session) {
      // E-posta doğrulaması kapalıysa oturum direkt açılır.
      router.replace('/onboarding');
      return;
    }
    // E-posta doğrulaması açık: onay linkine tıklanana kadar oturum açılmaz.
    setCheckEmail(true);
  }

  if (checkEmail) {
    return (
      <View style={styles.container}>
        <Text style={styles.title}>{t('auth.checkEmailTitle')}</Text>
        <Text style={styles.info}>{t('auth.checkEmailBody')}</Text>
        <Pressable style={styles.button} onPress={() => setCheckEmail(false)}>
          <Text style={styles.buttonText}>{t('auth.signIn')}</Text>
        </Pressable>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Text style={styles.title}>{t('auth.title')}</Text>
      <TextInput
        style={styles.input}
        placeholder={t('auth.email')}
        autoCapitalize="none"
        keyboardType="email-address"
        value={email}
        onChangeText={setEmail}
      />
      <TextInput
        style={styles.input}
        placeholder={t('auth.password')}
        secureTextEntry
        value={password}
        onChangeText={setPassword}
      />
      {error ? <Text style={styles.error}>{error}</Text> : null}
      {loading ? (
        <ActivityIndicator />
      ) : (
        <View style={styles.buttonRow}>
          <Pressable style={styles.button} onPress={handleSignIn}>
            <Text style={styles.buttonText}>{t('auth.signIn')}</Text>
          </Pressable>
          <Pressable style={[styles.button, styles.buttonSecondary]} onPress={handleSignUp}>
            <Text style={styles.buttonText}>{t('auth.signUp')}</Text>
          </Pressable>
        </View>
      )}
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
  input: {
    borderWidth: 1,
    borderColor: '#ccc',
    borderRadius: 8,
    paddingVertical: 12,
    paddingHorizontal: 16,
    fontSize: 16,
  },
  buttonRow: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 8,
  },
  button: {
    flex: 1,
    backgroundColor: '#1B3764',
    borderRadius: 8,
    paddingVertical: 14,
    alignItems: 'center',
  },
  buttonSecondary: {
    backgroundColor: '#F7941D',
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
  info: {
    fontSize: 15,
    textAlign: 'center',
    color: '#444',
    marginBottom: 8,
  },
});
