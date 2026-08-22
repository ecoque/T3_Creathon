import Svg, { Path } from 'react-native-svg';
import { StyleSheet, Text, View } from 'react-native';

import { colors } from '../constants/theme';

type TakeOffLogoProps = {
  variant?: 'horizontal' | 'mark-only' | 'badge' | 'white';
  size?: 'sm' | 'md' | 'lg' | 'xl';
};

const ICON_SIZES: Record<NonNullable<TakeOffLogoProps['size']>, number> = {
  sm: 24,
  md: 32,
  lg: 40,
  xl: 64,
};

const TEXT_SIZES: Record<NonNullable<TakeOffLogoProps['size']>, number> = {
  sm: 20,
  md: 24,
  lg: 28,
  xl: 34,
};

function Mark({ size }: { size: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 100 100" fill="none">
      <Path d="M25 48 L46 43 L37 35 Z" fill={colors.primary} />
      <Path d="M25 50 L38 58 L30 74 Z" fill={colors.primary} />
      <Path d="M40 37 L62 21 L56 50 L40 66 Z" fill={colors.primary} />
      <Path d="M62 27 L66 50 L57 59 Z" fill="#b34200" />
      <Path d="M54 55 L60 67 L56 65 Z" fill={colors.primary} />
    </Svg>
  );
}

export function TakeOffLogo({ variant = 'horizontal', size = 'md' }: TakeOffLogoProps) {
  if (variant === 'mark-only') {
    return <Mark size={ICON_SIZES[size]} />;
  }

  if (variant === 'badge') {
    return (
      <View style={styles.badge}>
        <View style={styles.badgeRow}>
          <Mark size={28} />
          <Text style={styles.badgeText}>TakeOff</Text>
        </View>
      </View>
    );
  }

  const textSize = TEXT_SIZES[size];
  const isWhite = variant === 'white';

  return (
    <View style={styles.row}>
      <Mark size={ICON_SIZES[size]} />
      <Text style={[styles.wordmark, { fontSize: textSize, color: isWhite ? colors.white : colors.text }]}>
        Take<Text style={{ color: colors.primary }}>Off</Text>
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  wordmark: {
    fontWeight: '800',
    letterSpacing: -0.5,
  },
  badge: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: 'rgba(200,80,0,0.1)',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: colors.primary,
    shadowOpacity: 0.15,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
    elevation: 3,
  },
  badgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  badgeText: {
    fontWeight: '800',
    color: colors.text,
    fontSize: 14,
    letterSpacing: -0.3,
  },
});
