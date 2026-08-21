// Geçici tema değerleri — gerçek marka renkleri/tipografi tasarım ekibiyle netleşince güncellenecek.
export const colors = {
  primary: '#1c2b56', // koyu lacivert
  accent: '#f5821f', // turuncu vurgu
  background: '#ffffff',
  surface: '#f4f5f7',
  text: '#1a1a1a',
  textMuted: '#6b7280',
  border: '#e2e4e9',
  success: '#2e7d32',
  danger: '#c62828',
};

export const spacing = {
  xs: 4,
  sm: 8,
  md: 16,
  lg: 24,
  xl: 32,
};

export const typography = {
  title: { fontSize: 22, fontWeight: '700' as const },
  subtitle: { fontSize: 16, fontWeight: '600' as const },
  body: { fontSize: 14, fontWeight: '400' as const },
};
