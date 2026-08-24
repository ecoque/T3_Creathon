import { router } from 'expo-router';
import { Eye, LogOut } from 'lucide-react-native';
import { useTranslation } from 'react-i18next';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { colors } from '../../constants/theme';
import { supabase } from '../../lib/supabase';

export default function AdminScreen() {
  const { t } = useTranslation();

  async function handleSignOut() {
    await supabase.auth.signOut();
    router.replace('/auth');
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.container}>
        <Text style={styles.title}>{t('admin.title')}</Text>
        <Text style={styles.subtitle}>{t('admin.subtitle')}</Text>

        <Pressable style={styles.card} onPress={() => router.push('/(tabs)/home')}>
          <Eye size={20} color={colors.primary} />
          <View style={styles.cardTextWrap}>
            <Text style={styles.cardTitle}>{t('admin.previewTitle')}</Text>
            <Text style={styles.cardDescription}>{t('admin.previewDescription')}</Text>
          </View>
        </Pressable>

        <Text style={styles.comingSoon}>{t('admin.comingSoon')}</Text>

        <Pressable style={styles.signOut} onPress={handleSignOut}>
          <LogOut size={16} color={colors.danger} />
          <Text style={styles.signOutText}>{t('auth.signOut')}</Text>
        </Pressable>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: colors.background },
  container: { flex: 1, padding: 20, gap: 12 },
  title: { fontSize: 24, fontWeight: '800', color: colors.text, marginTop: 8 },
  subtitle: { fontSize: 13, color: colors.textMuted, marginBottom: 12 },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 16,
    padding: 16,
  },
  cardTextWrap: { flex: 1, gap: 2 },
  cardTitle: { fontSize: 15, fontWeight: '700', color: colors.text },
  cardDescription: { fontSize: 12, color: colors.textMuted },
  comingSoon: {
    fontSize: 12,
    color: colors.textFaint,
    textAlign: 'center',
    marginTop: 24,
  },
  signOut: {
    marginTop: 'auto',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 14,
  },
  signOutText: { color: colors.danger, fontWeight: '700', fontSize: 14 },
});
