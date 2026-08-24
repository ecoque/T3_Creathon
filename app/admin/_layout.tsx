import { Redirect, Slot } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';

import { colors } from '../../constants/theme';
import { isAdminUser } from '../../lib/adminAccess';
import { supabase } from '../../lib/supabase';

export default function AdminLayout() {
  const [state, setState] = useState<'checking' | 'allowed' | 'signed-out' | 'denied' | 'error'>(
    'checking',
  );

  useEffect(() => {
    let active = true;

    async function verifyAccess() {
      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (!active) return;
      if (!session) {
        setState('signed-out');
        return;
      }

      const allowed = await isAdminUser(session.user.id);
      if (active) setState(allowed ? 'allowed' : 'denied');
    }

    verifyAccess().catch(() => {
      if (active) setState('error');
    });

    return () => {
      active = false;
    };
  }, []);

  if (state === 'checking') {
    return (
      <View style={styles.center}>
        <ActivityIndicator color={colors.primary} />
        <Text style={styles.loadingText}>Admin yetkisi doğrulanıyor…</Text>
      </View>
    );
  }

  if (state === 'signed-out') {
    return <Redirect href="/auth" />;
  }

  if (state === 'denied') {
    return <Redirect href="/(tabs)/home" />;
  }

  if (state === 'error') {
    return (
      <View style={styles.center}>
        <Text style={styles.errorTitle}>Yetki kontrolü tamamlanamadı</Text>
        <Text style={styles.loadingText}>Bağlantınızı kontrol edip uygulamayı yeniden açın.</Text>
      </View>
    );
  }

  return <Slot />;
}

const styles = StyleSheet.create({
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    padding: 24,
    backgroundColor: colors.background,
  },
  loadingText: { fontSize: 13, color: colors.textMuted, textAlign: 'center' },
  errorTitle: { fontSize: 16, fontWeight: '800', color: colors.text },
});
