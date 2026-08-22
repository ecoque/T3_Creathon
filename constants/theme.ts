// T3 Vakfı marka renklerine göre uyarlanmıştır (logo: kırmızı-turuncu, mavi, sarı-turuncu üçgen).
export const colors = {
  primary: '#1B3764', // logo mavisinin koyu tonu — ana renk, header/nav
  primaryLight: '#29ABE2', // logo mavisinin açık tonu — ikincil vurgu
  secondary: '#C1272D', // logo kırmızısı — dikkat çekici aksiyonlar
  accent: '#F7941D', // logo turuncusu — birincil CTA/buton rengi
  accentLight: '#FBB03B', // logo sarısı — rozet/başarı vurgusu
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
