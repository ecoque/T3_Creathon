import { Tabs } from 'expo-router';
import { Calendar, CalendarDays, Compass, FolderKanban, Handshake, Map, User } from 'lucide-react-native';
import { useTranslation } from 'react-i18next';
import { StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { colors } from '../../constants/theme';
import { useCurrentProfile } from '../../lib/useCurrentProfile';
import { useMeetingRequests } from '../../lib/useMeetingRequests';

function MeetingsIcon({ color, size }: { color: string; size: number }) {
  const { data } = useMeetingRequests();
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
  const role = meResult?.profile?.role;
  const isCorporate = role === 'kurum';
  const isVisitor = role === 'ziyaretci';

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
          title: t('home.title'),
          tabBarIcon: ({ color, size }) => <Calendar color={color} size={size} />,
        }}
      />
      <Tabs.Screen
        name="discover"
        options={{
          title: t('matching.title'),
          tabBarIcon: ({ color, size }) => <Compass color={color} size={size} />,
        }}
      />
      <Tabs.Screen
        name="meetings"
        options={{
          title: t('meetings.title'),
          tabBarIcon: ({ color, size }) => <MeetingsIcon color={color} size={size} />,
        }}
      />
      <Tabs.Screen
        name="opportunities"
        options={{
          title: t('corporate.opportunitiesTitle', 'Fırsatlar'),
          tabBarIcon: ({ color, size }) => <FolderKanban color={color} size={size} />,
          href: isCorporate ? undefined : null,
        }}
      />
      <Tabs.Screen
        name="events"
        options={{
          title: t('visitorProgram.eventsTab', 'Program'),
          tabBarIcon: ({ color, size }) => <CalendarDays color={color} size={size} />,
          href: isVisitor ? undefined : null,
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
