import '../lib/i18n';
import '../lib/locationTracking';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { router, Stack, useRootNavigationState, useSegments } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import { ActivityIndicator, AppState, StyleSheet, View } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { colors } from '../constants/theme';
import { isAdminUser } from '../lib/adminAccess';
import { supabase } from '../lib/supabase';
import { getProfileForUser } from '../lib/useCurrentProfile';

const queryClient = new QueryClient();

function SessionGate({ children }: { children: ReactNode }) {
  const segments = useSegments();
  const navigationState = useRootNavigationState();
  const [checked, setChecked] = useState(false);
  const checking = useRef(false);
  const mounted = useRef(true);
  const firstSegment = segments[0] || 'index';
  const segmentRef = useRef(firstSegment);
  segmentRef.current = firstSegment;

  const validate = useCallback(async () => {
    if (!navigationState?.key || checking.current) return;
    checking.current = true;
    try {
      const { data, error } = await supabase.auth.getSession();
      if (error) throw error;
      const session = data.session;
      const route = segmentRef.current;
      if (!session) {
        if (route !== 'auth') router.replace('/auth');
        return;
      }

      const admin = await isAdminUser(session.user.id);
      if (admin) {
        if (route === 'auth' || route === 'onboarding' || route === 'index') {
          router.replace('/admin');
        }
        return;
      }

      const profile = await getProfileForUser(session.user.id);
      if (profile?.status === 'passive') {
        await supabase.auth.signOut();
        queryClient.clear();
        router.replace('/auth');
        return;
      }
      if (!profile) {
        if (route !== 'onboarding') router.replace('/onboarding');
        return;
      }
      if (route === 'admin' || route === 'auth' || route === 'onboarding' || route === 'index') {
        router.replace('/(tabs)/home');
      }
    } catch {
      // A transient network/database error must not sign out an otherwise valid session.
      // Server-side RLS remains the authorization boundary while the next check retries.
    } finally {
      checking.current = false;
      if (mounted.current) setChecked(true);
    }
  }, [navigationState?.key]);

  useEffect(() => {
    void validate();
  }, [firstSegment, validate]);

  useEffect(() => {
    mounted.current = true;
    const interval = setInterval(() => void validate(), 15_000);
    const appState = AppState.addEventListener('change', (state) => {
      if (state === 'active') void validate();
    });
    const { data } = supabase.auth.onAuthStateChange(() => {
      void validate();
    });
    return () => {
      mounted.current = false;
      clearInterval(interval);
      appState.remove();
      data.subscription.unsubscribe();
    };
  }, [validate]);

  if (!checked) {
    return (
      <View style={styles.guardLoading}>
        <ActivityIndicator color={colors.primary} />
      </View>
    );
  }
  return children;
}

export default function RootLayout() {
  return (
    <SafeAreaProvider>
      <QueryClientProvider client={queryClient}>
        <SessionGate>
          <StatusBar style="auto" />
          <Stack screenOptions={{ headerShown: false }}>
            <Stack.Screen name="index" />
            <Stack.Screen name="auth/index" />
            <Stack.Screen name="auth/reset-password" />
            <Stack.Screen name="onboarding" />
            <Stack.Screen name="(tabs)" />
            <Stack.Screen name="admin" />
          </Stack>
        </SessionGate>
      </QueryClientProvider>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  guardLoading: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.background,
  },
});
