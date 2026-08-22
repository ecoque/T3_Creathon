import { router } from 'expo-router';
import { ArrowLeft, Check, LocateFixed, Trash2 } from 'lucide-react-native';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, ScrollView, StyleSheet, Switch, Text, View } from 'react-native';

import { colors } from '../../constants/theme';

// Not: Konum paylaşımı tercihi şu an yalnızca UI seviyesinde tutulur; gerçek arka
// plan konum takibi (expo-location/expo-task-manager) Faz 2'de eklenecek.
export default function PrivacyScreen() {
  const { t } = useTranslation();
  const [locationSharing, setLocationSharing] = useState(true);
  const [toast, setToast] = useState<string | null>(null);

  function showToast(message: string) {
    setToast(message);
    setTimeout(() => setToast(null), 2500);
  }

  return (
    <View style={styles.screen}>
      <View style={styles.header}>
        <Pressable style={styles.backBtn} onPress={() => router.back()} hitSlop={8}>
          <ArrowLeft size={20} color={colors.text} />
        </Pressable>
        <Text style={styles.headerTitle}>{t('privacyScreen.title')}</Text>
        <View style={{ width: 36 }} />
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        {toast ? (
          <View style={styles.toast}>
            <Check size={14} color="#34d399" />
            <Text style={styles.toastText}>{toast}</Text>
          </View>
        ) : null}

        <View style={styles.iconWrap}>
          <View style={styles.iconCircle}>
            <LocateFixed size={40} color={colors.secondaryDark} />
          </View>
        </View>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>{t('privacyScreen.infoTitle')}</Text>
          <Text style={styles.cardBody}>{t('privacyScreen.infoBody1')}</Text>
          <Text style={styles.cardBody}>{t('privacyScreen.infoBody2')}</Text>
        </View>

        <View style={styles.toggleCard}>
          <View style={{ flex: 1 }}>
            <Text style={styles.toggleTitle}>{t('privacyScreen.toggleTitle')}</Text>
            <Text style={styles.toggleDesc}>{t('privacyScreen.toggleDesc')}</Text>
          </View>
          <Switch
            value={locationSharing}
            onValueChange={(next) => {
              setLocationSharing(next);
              showToast(next ? t('privacyScreen.toggleOn') : t('privacyScreen.toggleOff'));
            }}
            trackColor={{ true: colors.primary, false: colors.surfaceHigh }}
            thumbColor={colors.white}
          />
        </View>

        <View style={styles.dangerCard}>
          <Text style={styles.dangerTitle}>{t('privacyScreen.dataTitle')}</Text>
          <Text style={styles.dangerBody}>{t('privacyScreen.dataBody')}</Text>
          <Pressable
            style={styles.deleteBtn}
            onPress={() => showToast(t('privacyScreen.deleted'))}
          >
            <Trash2 size={16} color={colors.danger} />
            <Text style={styles.deleteBtnText}>{t('privacyScreen.deleteButton')}</Text>
          </Pressable>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  header: {
    height: 60,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    backgroundColor: colors.white,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  backBtn: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
  headerTitle: { fontSize: 15, fontWeight: '800', color: colors.text },
  content: { padding: 16, paddingBottom: 40, gap: 18 },
  toast: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: colors.text,
    borderRadius: 12,
    padding: 12,
  },
  toastText: { color: colors.white, fontSize: 12, fontWeight: '700', flex: 1 },
  iconWrap: { alignItems: 'center', paddingVertical: 8 },
  iconCircle: {
    width: 96,
    height: 96,
    borderRadius: 48,
    backgroundColor: colors.secondaryContainer,
    alignItems: 'center',
    justifyContent: 'center',
  },
  card: {
    backgroundColor: colors.white,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 18,
    gap: 10,
  },
  cardTitle: { fontSize: 15, fontWeight: '800', color: colors.text },
  cardBody: { fontSize: 13, color: colors.textMuted, lineHeight: 19 },
  toggleCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: colors.white,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 18,
  },
  toggleTitle: { fontSize: 14, fontWeight: '800', color: colors.text },
  toggleDesc: { fontSize: 12, color: colors.textFaint, marginTop: 2 },
  dangerCard: {
    backgroundColor: 'rgba(255,218,214,0.2)',
    borderRadius: 18,
    borderWidth: 1,
    borderColor: colors.dangerBorder,
    padding: 18,
    gap: 10,
  },
  dangerTitle: { fontSize: 14, fontWeight: '800', color: colors.danger },
  dangerBody: { fontSize: 12, color: colors.textMuted, lineHeight: 18 },
  deleteBtn: {
    flexDirection: 'row',
    gap: 8,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: colors.danger,
    borderRadius: 12,
    paddingVertical: 12,
  },
  deleteBtnText: { color: colors.danger, fontWeight: '800', fontSize: 13 },
});
