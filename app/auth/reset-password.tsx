import { router } from 'expo-router';
import { Eye, EyeOff, Lock } from 'lucide-react-native';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ActivityIndicator, Linking, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { TakeOffLogo } from '../../components/TakeOffLogo';
import { colors } from '../../constants/theme';
import { supabase } from '../../lib/supabase';
import { getProfileForUser } from '../../lib/useCurrentProfile';

// Supabase'in şifre sıfırlama e-postasındaki link buraya
// (takeoffcompanion://reset-password#access_token=...&refresh_token=...) yönlendirir.
// Token'lar URL'nin # sonrasında (fragment) geldiği için normal query parametreleriyle
// yakalanamaz; gelen URL'yi elle ayrıştırıp geçici bir oturum kuruyoruz.
function parseRecoveryTokens(url: string | null) {
  if (!url) return null;
  const hashIndex = url.indexOf('#');
  const raw = hashIndex >= 0 ? url.slice(hashIndex + 1) : url.split('?')[1] ?? '';
  const params = new URLSearchParams(raw);
  const accessToken = params.get('access_token');
  const refreshToken = params.get('refresh_token');
  if (!accessToken || !refreshToken) return null;
  return { accessToken, refreshToken };
}

type Status = 'checking' | 'ready' | 'invalid';

export default function ResetPasswordScreen() {
  const { t } = useTranslation();
  const [status, setStatus] = useState<Status>('checking');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  useEffect(() => {
    let active = true;

    async function establishSession(url: string | null) {
      const tokens = parseRecoveryTokens(url);
      if (!tokens) {
        if (active) setStatus('invalid');
        return;
      }
      const { error: sessionError } = await supabase.auth.setSession({
        access_token: tokens.accessToken,
        refresh_token: tokens.refreshToken,
      });
      if (active) setStatus(sessionError ? 'invalid' : 'ready');
    }

    // Soğuk başlangıç: uygulama bu linkle açıldı.
    Linking.getInitialURL().then(establishSession);
    // Sıcak başlangıç: uygulama zaten açıkken linke tıklandı.
    const subscription = Linking.addEventListener('url', (event) => establishSession(event.url));

    return () => {
      active = false;
      subscription.remove();
    };
  }, []);

  async function handleSubmit() {
    if (password.length < 6) {
      setError(t('auth.resetPasswordTooShort'));
      return;
    }
    if (password !== confirmPassword) {
      setError(t('auth.resetPasswordMismatch'));
      return;
    }

    setLoading(true);
    setError(null);
    const { error: updateError } = await supabase.auth.updateUser({ password });
    if (updateError) {
      setLoading(false);
      setError(updateError.message);
      return;
    }
    setLoading(false);
    setDone(true);
  }

  async function continueToApp() {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      router.replace('/auth');
      return;
    }
    try {
      const profile = await getProfileForUser(user.id);
      router.replace(profile ? '/(tabs)/home' : '/onboarding');
    } catch {
      router.replace('/(tabs)/home');
    }
  }

  if (status === 'checking') {
    return (
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.screen}>
          <ActivityIndicator color={colors.primary} />
        </View>
      </SafeAreaView>
    );
  }

  if (status === 'invalid') {
    return (
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.screen}>
          <View style={styles.card}>
            <View style={styles.accentBar} />
            <View style={styles.cardBody}>
              <TakeOffLogo variant="badge" size="lg" />
              <Text style={styles.title}>{t('auth.resetLinkInvalidTitle')}</Text>
              <Text style={styles.subtitle}>{t('auth.resetLinkInvalidBody')}</Text>
              <Pressable style={styles.primaryBtn} onPress={() => router.replace('/auth')}>
                <Text style={styles.primaryBtnText}>{t('auth.backToSignIn')}</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </SafeAreaView>
    );
  }

  if (done) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.screen}>
          <View style={styles.card}>
            <View style={styles.accentBar} />
            <View style={styles.cardBody}>
              <TakeOffLogo variant="badge" size="lg" />
              <Text style={styles.title}>{t('auth.resetPasswordSuccessTitle')}</Text>
              <Pressable style={styles.primaryBtn} onPress={continueToApp}>
                <Text style={styles.primaryBtnText}>{t('common.continue')}</Text>
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
            <Text style={styles.title}>{t('auth.resetTitle')}</Text>

            {error ? (
              <View style={styles.errorBox}>
                <Text style={styles.errorText}>{error}</Text>
              </View>
            ) : null}

            <View style={styles.form}>
              <View style={styles.field}>
                <Text style={styles.label}>{t('auth.newPassword')}</Text>
                <View style={styles.inputWrap}>
                  <Lock size={16} color={colors.textFaint} style={styles.inputIcon} />
                  <TextInput
                    style={styles.inputWithTrailingIcon}
                    value={password}
                    onChangeText={setPassword}
                    secureTextEntry={!showPassword}
                    placeholder={t('auth.passwordPlaceholder')}
                    placeholderTextColor={colors.textFaint}
                  />
                  <Pressable
                    onPress={() => setShowPassword((prev) => !prev)}
                    style={styles.trailingIconBtn}
                    hitSlop={8}
                  >
                    {showPassword ? (
                      <EyeOff size={16} color={colors.textFaint} />
                    ) : (
                      <Eye size={16} color={colors.textFaint} />
                    )}
                  </Pressable>
                </View>
              </View>

              <View style={styles.field}>
                <Text style={styles.label}>{t('auth.newPasswordConfirm')}</Text>
                <View style={styles.inputWrap}>
                  <Lock size={16} color={colors.textFaint} style={styles.inputIcon} />
                  <TextInput
                    style={styles.inputWithTrailingIcon}
                    value={confirmPassword}
                    onChangeText={setConfirmPassword}
                    secureTextEntry={!showConfirmPassword}
                    placeholder={t('auth.passwordPlaceholder')}
                    placeholderTextColor={colors.textFaint}
                  />
                  <Pressable
                    onPress={() => setShowConfirmPassword((prev) => !prev)}
                    style={styles.trailingIconBtn}
                    hitSlop={8}
                  >
                    {showConfirmPassword ? (
                      <EyeOff size={16} color={colors.textFaint} />
                    ) : (
                      <Eye size={16} color={colors.textFaint} />
                    )}
                  </Pressable>
                </View>
              </View>

              {loading ? (
                <ActivityIndicator color={colors.primary} style={{ marginTop: 8 }} />
              ) : (
                <Pressable style={styles.primaryBtn} onPress={handleSubmit}>
                  <Text style={styles.primaryBtnText}>{t('auth.resetPasswordSubmit')}</Text>
                </Pressable>
              )}
            </View>
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: colors.background },
  screen: { flexGrow: 1, justifyContent: 'center', padding: 20, backgroundColor: colors.background },
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
    marginTop: 10,
  },
  errorText: { color: colors.danger, fontSize: 12, fontWeight: '700' },
  form: { width: '100%', gap: 14, marginTop: 12 },
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
  inputWithTrailingIcon: {
    backgroundColor: colors.background,
    borderWidth: 1,
    borderColor: colors.borderStrong,
    borderRadius: 12,
    paddingVertical: 13,
    paddingLeft: 40,
    paddingRight: 40,
    fontSize: 14,
    color: colors.text,
  },
  trailingIconBtn: { position: 'absolute', right: 14, zIndex: 1, padding: 2 },
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
