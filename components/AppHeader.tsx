import { router } from 'expo-router';
import { Bell, SlidersHorizontal } from 'lucide-react-native';
import { Image, Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { TakeOffLogo } from './TakeOffLogo';
import { colors } from '../constants/theme';
import type { Profile } from '../types';

type TabId = 'ajanda' | 'kesfet' | 'toplantilar' | 'harita' | 'profil';

type AppHeaderProps = {
  activeTab: TabId;
  profile?: Profile | null;
  onOpenFilter?: () => void;
  onOpenNotifications?: () => void;
  unreadNotifications?: number;
};

function initialsFor(profile?: Profile | null) {
  if (!profile?.full_name) return '?';
  return profile.full_name
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join('');
}

export function AppHeader({
  activeTab,
  profile,
  onOpenFilter,
  onOpenNotifications,
  unreadNotifications = 0,
}: AppHeaderProps) {
  const showFilter = (activeTab === 'kesfet' || activeTab === 'toplantilar') && onOpenFilter;

  return (
    <SafeAreaView edges={['top']} style={styles.safeArea}>
      <View style={styles.header}>
        <TakeOffLogo size="sm" />

        <View style={styles.actions}>
          {showFilter ? (
            <Pressable style={styles.iconButton} onPress={onOpenFilter} hitSlop={8}>
              <SlidersHorizontal size={20} color={colors.textMuted} />
            </Pressable>
          ) : null}

          {onOpenNotifications ? (
            <Pressable style={styles.iconButton} onPress={onOpenNotifications} hitSlop={8}>
              <Bell size={20} color={colors.textMuted} />
              {unreadNotifications > 0 ? <View style={styles.dot} /> : null}
            </Pressable>
          ) : null}

          <Pressable
            style={styles.avatarButton}
            onPress={() => router.push('/(tabs)/profile')}
            hitSlop={8}
          >
            {profile?.photo_url ? (
              <Image source={{ uri: profile.photo_url }} style={styles.avatarImg} />
            ) : (
              <View style={styles.avatarFallback}>
                <Text style={styles.avatarFallbackText}>{initialsFor(profile)}</Text>
              </View>
            )}
            <View style={styles.onlineDot} />
          </Pressable>
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    backgroundColor: colors.surface,
  },
  header: {
    paddingBottom: 12,
    paddingHorizontal: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  actions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  iconButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dot: {
    position: 'absolute',
    top: 8,
    right: 8,
    width: 9,
    height: 9,
    borderRadius: 5,
    backgroundColor: colors.primary,
    borderWidth: 2,
    borderColor: colors.white,
  },
  avatarButton: {
    marginLeft: 4,
    position: 'relative',
  },
  avatarImg: {
    width: 36,
    height: 36,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: colors.white,
  },
  avatarFallback: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colors.secondaryContainer,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarFallbackText: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.secondaryDark,
  },
  onlineDot: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: '#22c55e',
    borderWidth: 2,
    borderColor: colors.white,
  },
});
