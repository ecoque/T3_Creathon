import { Redirect } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, View } from 'react-native';

import { supabase } from '../lib/supabase';

type RouteStatus = 'loading' | 'no-session' | 'no-profile' | 'has-profile';

// Oturum var mı VE profil tamamlanmış mı, ikisini birden kontrol edip
// buna göre doğru yere yönlendiriyor (auth / onboarding / ana sayfa).
export default function Index() {
  const [status, setStatus] = useState<RouteStatus>('loading');

  useEffect(() => {
    let isMounted = true;

    async function resolveInitialRoute() {
      const { data: sessionData } = await supabase.auth.getSession();
      const session = sessionData.session;

      if (!session) {
        if (isMounted) setStatus('no-session');
        return;
      }

      const { data: profile, error } = await supabase
        .from('profiles')
        .select('id')
        .eq('user_id', session.user.id)
        .maybeSingle();

      if (!isMounted) return;

      // Profil kontrolü beklenmedik şekilde hata verirse (ör. geçici ağ sorunu),
      // güvenli tarafta kalıp onboarding'e yönlendiriyoruz; profili olan kullanıcı
      // orada tekrar "zaten profilin var" durumuna düşmez çünkü submit artık upsert.
      setStatus(!error && profile ? 'has-profile' : 'no-profile');
    }

    resolveInitialRoute();
    return () => {
      isMounted = false;
    };
  }, []);

  if (status === 'loading') {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
        <ActivityIndicator />
      </View>
    );
  }

  if (status === 'no-session') return <Redirect href="/auth" />;
  if (status === 'no-profile') return <Redirect href="/onboarding" />;
  return <Redirect href="/(tabs)/home" />;
}
