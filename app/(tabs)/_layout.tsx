import { Tabs } from 'expo-router';

import { colors } from '../../constants/theme';

export default function TabsLayout() {
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.accent,
        tabBarInactiveTintColor: colors.textMuted,
      }}
    >
      <Tabs.Screen name="home" options={{ title: 'Ajanda' }} />
      <Tabs.Screen name="discover" options={{ title: 'Keşfet' }} />
      <Tabs.Screen name="meetings" options={{ title: 'Toplantılar' }} />
      <Tabs.Screen name="map" options={{ title: 'Harita' }} />
      <Tabs.Screen name="profile" options={{ title: 'Profil' }} />
    </Tabs>
  );
}
