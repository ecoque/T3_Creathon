// TakeOff marka renk paleti (Google Stitch tasarımından alınmıştır).
export const colors = {
  primary: '#c85000', // ana turuncu — CTA, aktif sekme, vurgular
  primaryDark: '#a03e00',
  primaryLight: '#ffdbcc',
  primarySoft: '#ffeedb',
  accent: '#E59E2D', // rozet/gradient ikincil rengi
  secondary: '#4c6173', // soluk metin / ikincil ikon rengi
  secondaryDark: '#34495b',
  secondaryContainer: '#cce2f8',
  background: '#f8f9fa',
  surface: '#ffffff',
  surfaceContainer: '#edeeef',
  surfaceHigh: '#e7e8e9',
  surfaceMuted: '#f3f4f5',
  text: '#191c1d',
  textMuted: '#4c6173',
  textFaint: '#506578',
  border: '#edeeef',
  borderStrong: '#b3c9de',
  success: '#137333',
  successBg: '#e6f4ea',
  successBorder: '#ceead6',
  danger: '#ba1a1a',
  dangerBg: '#ffdad6',
  dangerBorder: '#ffb4ab',
  white: '#ffffff',
};

export const gradient = {
  primary: ['#c85000', '#E59E2D'] as const,
};

export const spacing = {
  xs: 4,
  sm: 8,
  md: 16,
  lg: 24,
  xl: 32,
};

export const radius = {
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  full: 999,
};

export const typography = {
  title: { fontSize: 24, fontWeight: '700' as const, color: colors.text },
  subtitle: { fontSize: 16, fontWeight: '600' as const, color: colors.text },
  body: { fontSize: 14, fontWeight: '400' as const, color: colors.textMuted },
  caption: { fontSize: 12, fontWeight: '500' as const, color: colors.textFaint },
};
