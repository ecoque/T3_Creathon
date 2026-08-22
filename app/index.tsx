import { Redirect } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, View } from 'react-native';

import { supabase } from '../lib/supabase';

// TODO: Onboarding tamamlanmış mı (profil var mı) kontrolü eklenip
// buna göre doğrudan ana sayfaya yönlendirme yapılacak.
export default function Index() {
  const [hasSession, setHasSession] = useState<boolean | null>(null);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setHasSession(!!data.session);
    });
  }, []);

  if (hasSession === null) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
        <ActivityIndicator />
      </View>
    );
  }

  return <Redirect href={hasSession ? '/onboarding' : '/auth'} />;
}
