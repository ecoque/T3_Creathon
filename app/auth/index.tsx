import { useQueryClient } from '@tanstack/react-query';
import { router } from 'expo-router';
import { Lock, Mail } from 'lucide-react-native';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { TakeOffLogo } from '../../components/TakeOffLogo';
import { colors } from '../../constants/theme';
import { routeAfterAuth } from '../../lib/resolvePostAuthRoute';
import { supabase } from '../../lib/supabase';
import { getProfileForUser } from '../../lib/useCurrentProfile';

export default function AuthScreen() {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [checkEmail, setCheckEmail] = useState(false);

  async function handleSignIn() {
    setLoading(true);
    setError(null);
    const { data, error: signInError } = await supabase.auth.signInWithPassword({ email, password });
    if (signInError) {
      setLoading(false);
      setError(signInError.message);
      return;
    }

    try {
      queryClient.removeQueries({ queryKey: ['me', 'profile'] });
      const profile = await getProfileForUser(data.user.id);
      router.replace(profile ? '/(tabs)/home' : '/onboarding');
    } catch (profileError) {
      setError(profileError instanceof Error ? profileError.message : String(profileError));
    } finally {
      setLoading(false);
    }
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
      queryClient.removeQueries({ queryKey: ['me', 'profile'] });
      router.replace('/onboarding');
      return;
    }
    setCheckEmail(true);
  }

  if (checkEmail) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.screen}>
          <View style={styles.card}>
            <View style={styles.accentBar} />
            <View style={styles.cardBody}>
              <TakeOffLogo variant="badge" size="lg" />
              <Text style={styles.title}>{t('auth.checkEmailTitle')}</Text>
              <Text style={styles.subtitle}>{t('auth.checkEmailBody')}</Text>
              <Pressable style={styles.primaryBtn} onPress={() => setCheckEmail(false)}>
                <Text style={styles.primaryBtnText}>{t('auth.signIn')}</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView
        contentContainerStyle={styles.screen}
        automaticallyAdjustKeyboardInsets
        keyboardDismissMode="interactive"
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.card}>
          <View style={styles.accentBar} />
          <View style={styles.cardBody}>
          <TakeOffLogo variant="badge" size="lg" />
          <Text style={styles.title}>{t('auth.title')}</Text>
          <Text style={styles.subtitle}>{t('auth.subtitle')}</Text>

          {error ? (
            <View style={styles.errorBox}>
              <Text style={styles.errorText}>{error}</Text>
            </View>
          ) : null}

          <View style={styles.form}>
            <View style={styles.field}>
              <Text style={styles.label}>{t('auth.email')}</Text>
              <View style={styles.inputWrap}>
                <Mail size={16} color={colors.textFaint} style={styles.inputIcon} />
                <TextInput
                  style={styles.input}
                  value={email}
                  onChangeText={setEmail}
                  autoCapitalize="none"
                  keyboardType="email-address"
                  placeholder={t('auth.emailPlaceholder')}
                  placeholderTextColor={colors.textFaint}
                />
              </View>
            </View>

            <View style={styles.field}>
              <Text style={styles.label}>{t('auth.password')}</Text>
              <View style={styles.inputWrap}>
                <Lock size={16} color={colors.textFaint} style={styles.inputIcon} />
                <TextInput
                  style={styles.input}
                  value={password}
                  onChangeText={setPassword}
                  secureTextEntry
                  placeholder={t('auth.passwordPlaceholder')}
                  placeholderTextColor={colors.textFaint}
                />
              </View>
            </View>

            {loading ? (
              <ActivityIndicator color={colors.primary} style={{ marginTop: 8 }} />
            ) : (
              <View style={styles.buttonRow}>
                <Pressable style={styles.secondaryBtn} onPress={handleSignUp}>
                  <Text style={styles.secondaryBtnText}>{t('auth.signUp')}</Text>
                </Pressable>
                <Pressable style={styles.primaryBtnInline} onPress={handleSignIn}>
                  <Text style={styles.primaryBtnText}>{t('auth.signIn')}</Text>
                </Pressable>
              </View>
            )}
          </View>
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: colors.background,
  },
  screen: {
    flexGrow: 1,
    justifyContent: 'center',
    padding: 20,
    backgroundColor: colors.background,
  },
  card: {
    borderRadius: 24,
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: colors.border,
    overflow: 'hidden',
  },
  accentBar: { height: 6, backgroundColor: colors.primary },
  cardBody: { padding: 28, alignItems: 'center', gap: 6 },
  title: { fontSize: 22, fontWeight: '800', color: colors.text, textAlign: 'center', marginTop: 8 },
  subtitle: { fontSize: 13, color: colors.textMuted, textAlign: 'center', marginBottom: 8 },
  errorBox: {
    width: '100%',
    backgroundColor: colors.dangerBg,
    borderWidth: 1,
    borderColor: colors.dangerBorder,
    borderRadius: 12,
    padding: 12,
  },
  errorText: { color: colors.danger, fontSize: 12, fontWeight: '700' },
  form: { width: '100%', gap: 14, marginTop: 8 },
  field: { gap: 6 },
  label: { fontSize: 12, fontWeight: '800', color: colors.text },
  inputWrap: { position: 'relative', justifyContent: 'center' },
  inputIcon: { position: 'absolute', left: 14, zIndex: 1 },
  input: {
    backgroundColor: colors.background,
    borderWidth: 1,
    borderColor: colors.borderStrong,
    borderRadius: 12,
    paddingVertical: 13,
    paddingLeft: 40,
    paddingRight: 14,
    fontSize: 14,
    color: colors.text,
  },
  buttonRow: { flexDirection: 'row', gap: 10, marginTop: 6 },
  secondaryBtn: {
    flex: 1,
    paddingVertical: 13,
    borderRadius: 12,
    backgroundColor: colors.surfaceMuted,
    alignItems: 'center',
  },
  secondaryBtnText: { fontSize: 13, fontWeight: '800', color: colors.text },
  primaryBtnInline: {
    flex: 1,
    paddingVertical: 13,
    borderRadius: 12,
    backgroundColor: colors.primary,
    alignItems: 'center',
  },
  primaryBtn: {
    width: '100%',
    paddingVertical: 14,
    borderRadius: 12,
    backgroundColor: colors.primary,
    alignItems: 'center',
    marginTop: 12,
  },
  primaryBtnText: { fontSize: 13, fontWeight: '800', color: colors.white },
});
