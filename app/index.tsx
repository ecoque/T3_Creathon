import { Redirect } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, View } from 'react-native';

import { isAdminUser } from '../lib/adminAccess';
import { supabase } from '../lib/supabase';
import { getProfileForUser } from '../lib/useCurrentProfile';

export default function Index() {
  const [destination, setDestination] = useState<
    '/auth' | '/onboarding' | '/(tabs)/home' | '/admin' | null
  >(null);

  useEffect(() => {
    let active = true;

    async function resolveDestination() {
      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (!active) return;
      if (!session) {
        setDestination('/auth');
        return;
      }

      const admin = await isAdminUser(session.user.id);
      if (!active) return;
      if (admin) {
        setDestination('/admin');
        return;
      }

      const profile = await getProfileForUser(session.user.id);
      if (active) {
        if (profile?.status === 'passive') {
          await supabase.auth.signOut();
          setDestination('/auth');
        } else {
          setDestination(profile ? '/(tabs)/home' : '/onboarding');
        }
      }
    }

    resolveDestination().catch(() => {
      if (active) setDestination('/auth');
    });

    return () => {
      active = false;
    };
  }, []);

  if (destination === null) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
        <ActivityIndicator />
      </View>
    );
  }

  return <Redirect href={destination} />;
}
