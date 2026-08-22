import { Image, type ImageStyle, StyleSheet } from 'react-native';

type TakeOffLogoProps = {
  variant?: 'horizontal' | 'mark-only' | 'badge' | 'white';
  size?: 'sm' | 'md' | 'lg' | 'xl';
};

const MARK_SIZES: Record<NonNullable<TakeOffLogoProps['size']>, number> = {
  sm: 24,
  md: 32,
  lg: 40,
  xl: 64,
};

const LOCKUP_SIZES: Record<NonNullable<TakeOffLogoProps['size']>, ImageStyle> = {
  sm: { width: 96, height: 32 },
  md: { width: 120, height: 40 },
  lg: { width: 144, height: 48 },
  xl: { width: 192, height: 64 },
};

const appIcon = require('../assets/branding/takeoff-app-icon.png');
const horizontalLogo = require('../assets/branding/takeoff-lockup.png');

export function TakeOffLogo({ variant = 'horizontal', size = 'md' }: TakeOffLogoProps) {
  if (variant === 'mark-only') {
    const dimension = MARK_SIZES[size];
    return <Image source={appIcon} style={{ width: dimension, height: dimension }} resizeMode="contain" />;
  }

  if (variant === 'badge') {
    return <Image source={appIcon} style={styles.badge} resizeMode="contain" />;
  }

  return <Image source={horizontalLogo} style={LOCKUP_SIZES[size]} resizeMode="contain" />;
}

const styles = StyleSheet.create({
  badge: {
    width: 80,
    height: 80,
  },
});
