// Oturum QR'ını okutup rozet kazanma ekranı. expo-camera STATİK import
// EDİLMİYOR (bkz. types/lazy-require.d.ts) — Dev Client bu native modülü
// içermeyen bir cihazda tüm uygulamayı çökertmemesi için require() burada
// sadece bu ekran açıldığında (useEffect içinde) çalışır ve hata durumunda
// kullanıcıya "güncel bir build gerekiyor" mesajı gösterilir.
import { router } from 'expo-router';
import { CheckCircle2, CircleAlert, QrCode, X } from 'lucide-react-native';
import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { colors } from '../../constants/theme';
import { parseSessionQrValue, useAwardBadgeFromQr } from '../../lib/useMyBadges';

type ScreenState = 'loading' | 'unavailable' | 'denied' | 'ready';

export default function ScanBadgeScreen() {
  const { t } = useTranslation();
  const [state, setState] = useState<ScreenState>('loading');
  const [cameraApi, setCameraApi] = useState<any>(null);
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const scannedRef = useRef(false);
  const awardBadge = useAwardBadgeFromQr();

  useEffect(() => {
    let active = true;
    (async () => {
      let cameraModule: any;
      try {
        cameraModule = require('expo-camera');
      } catch {
        if (active) setState('unavailable');
        return;
      }
      try {
        const permission = await cameraModule.Camera.requestCameraPermissionsAsync();
        if (!active) return;
        if (!permission?.granted) {
          setState('denied');
          return;
        }
        setCameraApi(cameraModule);
        setState('ready');
      } catch {
        if (active) setState('unavailable');
      }
    })();
    return () => {
      active = false;
    };
  }, []);

  function handleBarcodeScanned(result: { data: string }) {
    if (scannedRef.current) return;
    scannedRef.current = true;
    const sessionId = parseSessionQrValue(result.data ?? '');
    if (!sessionId) {
      setFeedback({ type: 'error', text: t('badges.scanInvalid') });
      return;
    }
    awardBadge.mutate(sessionId, {
      onSuccess: (awardResult) => {
        setFeedback({
          type: 'success',
          text: t(awardResult.status === 'already_owned' ? 'badges.scanAlreadyOwned' : 'badges.scanSuccess', {
            title: awardResult.sessionTitle,
          }),
        });
      },
      onError: (error) => {
        setFeedback({
          type: 'error',
          text: error instanceof Error ? error.message : t('badges.scanError'),
        });
      },
    });
  }

  function scanAgain() {
    scannedRef.current = false;
    setFeedback(null);
  }

  return (
    <SafeAreaView style={styles.screen} edges={['top', 'bottom']}>
      <View style={styles.header}>
        <Pressable style={styles.closeBtn} onPress={() => router.back()} hitSlop={8}>
          <X size={20} color={colors.white} />
        </Pressable>
        <Text style={styles.headerTitle}>{t('badges.scanQrTitle')}</Text>
        <View style={{ width: 36 }} />
      </View>

      {state === 'loading' ? (
        <View style={styles.centerState}>
          <ActivityIndicator color={colors.white} />
        </View>
      ) : state === 'unavailable' ? (
        <View style={styles.centerState}>
          <CircleAlert size={32} color={colors.white} />
          <Text style={styles.stateText}>{t('badges.nativeModuleMissing')}</Text>
        </View>
      ) : state === 'denied' ? (
        <View style={styles.centerState}>
          <CircleAlert size={32} color={colors.white} />
          <Text style={styles.stateText}>{t('badges.cameraPermissionDenied')}</Text>
        </View>
      ) : cameraApi ? (
        <View style={styles.cameraWrap}>
          <cameraApi.CameraView
            style={StyleSheet.absoluteFill}
            facing="back"
            barcodeScannerSettings={{ barcodeTypes: ['qr'] }}
            onBarcodeScanned={scannedRef.current ? undefined : handleBarcodeScanned}
          />
          <View pointerEvents="none" style={styles.scanFrame}>
            <QrCode size={28} color="rgba(255,255,255,0.85)" />
          </View>
          {!feedback ? <Text style={styles.hint}>{t('badges.scanHint')}</Text> : null}
        </View>
      ) : null}

      {feedback ? (
        <View style={[styles.feedbackCard, feedback.type === 'error' && styles.feedbackCardError]}>
          {feedback.type === 'success' ? (
            <CheckCircle2 size={20} color={colors.white} />
          ) : (
            <CircleAlert size={20} color={colors.white} />
          )}
          <Text style={styles.feedbackText}>{feedback.text}</Text>
          <Pressable style={styles.feedbackAction} onPress={scanAgain}>
            <Text style={styles.feedbackActionText}>{t('badges.scanAgain')}</Text>
          </Pressable>
        </View>
      ) : null}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#0f172a' },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  closeBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.15)',
  },
  headerTitle: { color: colors.white, fontSize: 14, fontWeight: '800' },
  centerState: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12, padding: 32 },
  stateText: { color: colors.white, fontSize: 13, lineHeight: 19, textAlign: 'center' },
  cameraWrap: { flex: 1, position: 'relative' },
  scanFrame: {
    position: 'absolute',
    top: '38%',
    alignSelf: 'center',
    width: 220,
    height: 220,
    borderRadius: 24,
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.5)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  hint: {
    position: 'absolute',
    bottom: 40,
    alignSelf: 'center',
    color: colors.white,
    fontSize: 12,
    fontWeight: '700',
    backgroundColor: 'rgba(0,0,0,0.4)',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 99,
  },
  feedbackCard: {
    margin: 16,
    padding: 16,
    borderRadius: 16,
    backgroundColor: colors.success,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  feedbackCardError: { backgroundColor: colors.danger },
  feedbackText: { flex: 1, color: colors.white, fontSize: 12, fontWeight: '700', lineHeight: 17 },
  feedbackAction: {
    paddingHorizontal: 10,
    paddingVertical: 7,
    borderRadius: 10,
    backgroundColor: 'rgba(255,255,255,0.25)',
  },
  feedbackActionText: { color: colors.white, fontSize: 11, fontWeight: '800' },
});
