import { Tabs } from 'expo-router';
import { Calendar, CalendarDays, Compass, Handshake, Map, User } from 'lucide-react-native';
import { useTranslation } from 'react-i18next';
import { StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { colors } from '../../constants/theme';
import { useCurrentProfile } from '../../lib/useCurrentProfile';
import { useMeetingRequests } from '../../lib/useMeetingRequests';

function MeetingsIcon({ color, size, disabled = false }: { color: string; size: number; disabled?: boolean }) {
  const { data } = useMeetingRequests({ enabled: !disabled });
  const pendingCount =
    data?.items.filter((m) => m.direction === 'incoming' && m.status === 'pending').length ?? 0;

  return (
    <View>
      <Handshake color={color} size={size} />
      {pendingCount > 0 ? (
        <View style={styles.badge}>
          <Text style={styles.badgeText}>{pendingCount}</Text>
        </View>
      ) : null}
    </View>
  );
}

export default function TabsLayout() {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const { data: meResult } = useCurrentProfile();
  const isVisitor = meResult?.profile?.role === 'ziyaretci';

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.textMuted,
        tabBarLabelStyle: { fontSize: 11, fontWeight: '600' },
        tabBarStyle: {
          borderTopColor: colors.border,
          height: 60 + insets.bottom,
          paddingBottom: Math.max(insets.bottom, 8),
          paddingTop: 6,
        },
      }}
    >
      <Tabs.Screen
        name="home"
        options={{
          title: isVisitor ? t('visitorProgram.eventsTab') : t('home.title'),
          tabBarIcon: ({ color, size }) => isVisitor
            ? <CalendarDays color={color} size={size} />
            : <Calendar color={color} size={size} />,
        }}
      />
      <Tabs.Screen
        name="discover"
        options={{
          title: isVisitor ? t('visitorProgram.agendaTitle') : t('matching.title'),
          tabBarIcon: ({ color, size }) => isVisitor
            ? <Calendar color={color} size={size} />
            : <Compass color={color} size={size} />,
          // Visitors use the app to plan their program. Matching is reserved
          // for entrepreneur, investor, and corporate participant journeys.
          href: !meResult?.profile ? null : undefined,
        }}
      />
      <Tabs.Screen
        name="events"
        options={{
          title: t('visitorProgram.eventsTab'),
          tabBarIcon: ({ color, size }) => <CalendarDays color={color} size={size} />,
          href: null,
        }}
      />
      <Tabs.Screen
        name="meetings"
        options={{
          title: t('meetings.title'),
          tabBarIcon: ({ color, size }) => <MeetingsIcon color={color} size={size} disabled={isVisitor || !meResult?.profile} />,
          href: isVisitor || !meResult?.profile ? null : undefined,
        }}
      />
      <Tabs.Screen
        name="map"
        options={{
          title: t('map.title'),
          tabBarIcon: ({ color, size }) => <Map color={color} size={size} />,
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: t('profile.title'),
          tabBarIcon: ({ color, size }) => <User color={color} size={size} />,
        }}
      />
      <Tabs.Screen name="opportunities" options={{ href: null }} />
    </Tabs>
  );
}

const styles = StyleSheet.create({
  badge: {
    position: 'absolute',
    top: -4,
    right: -8,
    minWidth: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: colors.white,
    paddingHorizontal: 2,
  },
  badgeText: {
    color: colors.white,
    fontSize: 9,
    fontWeight: '700',
  },
});
