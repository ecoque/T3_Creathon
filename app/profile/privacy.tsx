import { router } from 'expo-router';
import { ArrowLeft, Check, LocateFixed, Trash2 } from 'lucide-react-native';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Switch, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { colors } from '../../constants/theme';
import {
  deleteMyLocationHistory,
  isLocationTrackingActive,
  startLocationTracking,
  stopLocationTracking,
} from '../../lib/locationTracking';
import { useCurrentProfile } from '../../lib/useCurrentProfile';

export default function PrivacyScreen() {
  const { t } = useTranslation();
  const { data: meResult } = useCurrentProfile();
  const [locationSharing, setLocationSharing] = useState(false);
  const [checkingStatus, setCheckingStatus] = useState(true);
  const [updating, setUpdating] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  // Ekran her açıldığında gerçek takip durumunu (uygulama yeniden başlatılmış
  // olabilir, izin sonradan geri alınmış olabilir vb.) native taraftan sorar.
  useEffect(() => {
    let active = true;
    isLocationTrackingActive().then((started) => {
      if (active) {
        setLocationSharing(started);
        setCheckingStatus(false);
      }
    });
    return () => {
      active = false;
    };
  }, []);

  function showToast(message: string) {
    setToast(message);
    setTimeout(() => setToast(null), 2500);
  }

  async function handleToggle(next: boolean) {
    setUpdating(true);
    try {
      if (next) {
        const result = await startLocationTracking();
        if (result === 'granted') {
          setLocationSharing(true);
          showToast(t('privacyScreen.toggleOn'));
        } else if (result === 'foreground-only') {
          setLocationSharing(false);
          showToast(t('privacyScreen.permissionForegroundOnly'));
        } else {
          setLocationSharing(false);
          showToast(t('privacyScreen.permissionDenied'));
        }
      } else {
        await stopLocationTracking();
        setLocationSharing(false);
        showToast(t('privacyScreen.toggleOff'));
      }
    } finally {
      setUpdating(false);
    }
  }

  async function handleDeleteData() {
    if (!meResult?.userId) return;
    setDeleting(true);
    try {
      await deleteMyLocationHistory(meResult.userId);
      showToast(t('privacyScreen.deleted'));
    } catch {
      showToast(t('privacyScreen.deleteError'));
    } finally {
      setDeleting(false);
    }
  }

  return (
    <SafeAreaView style={styles.screen}>
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
          {checkingStatus || updating ? (
            <ActivityIndicator color={colors.primary} />
          ) : (
            <Switch
              value={locationSharing}
              onValueChange={(next) => void handleToggle(next)}
              trackColor={{ true: colors.primary, false: colors.surfaceHigh }}
              thumbColor={colors.white}
            />
          )}
        </View>

        <View style={styles.dangerCard}>
          <Text style={styles.dangerTitle}>{t('privacyScreen.dataTitle')}</Text>
          <Text style={styles.dangerBody}>{t('privacyScreen.dataBody')}</Text>
          <Pressable
            style={styles.deleteBtn}
            onPress={() => void handleDeleteData()}
            disabled={deleting || !meResult?.userId}
          >
            {deleting ? (
              <ActivityIndicator color={colors.danger} size="small" />
            ) : (
              <>
                <Trash2 size={16} color={colors.danger} />
                <Text style={styles.deleteBtnText}>{t('privacyScreen.deleteButton')}</Text>
              </>
            )}
          </Pressable>
        </View>
      </ScrollView>
    </SafeAreaView>
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
