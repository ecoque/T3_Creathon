import { Redirect, Slot } from 'expo-router';
import { ActivityIndicator, View } from 'react-native';

import { useIsAdmin } from '../../lib/useIsAdmin';

// Bu route grubu, 4 katılımcı rolünden (girisimci/yatirimci/kurum/ziyaretci) tamamen
// ayrı bir yetki kontrolüyle (public.users.is_admin) korunur.
export default function AdminLayout() {
  const { data: isAdmin, isLoading } = useIsAdmin();

  if (isLoading) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
        <ActivityIndicator />
      </View>
    );
  }

  if (!isAdmin) {
    return <Redirect href="/" />;
  }

  return <Slot />;
}
