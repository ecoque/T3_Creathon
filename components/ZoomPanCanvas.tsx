// Katılımcı harita ekranında krokiyi rahatça inceleyebilmek için basit bir
// iki-parmak yakınlaştır (pinch-zoom) + kaydır (pan) sarmalayıcısı.
//
// react-native-gesture-handler / react-native-reanimated gibi ek bir native
// modül EKLEMEDEN — bu projede daha önce de bilinçli olarak tercih edilen bir
// yaklaşım, bkz. AdminMapManagement.tsx > DraggablePin — React Native'in
// çekirdek `PanResponder` + `Animated` API'leriyle yazıldı. İki parmaklı
// dokunuşlar `event.nativeEvent.touches` üzerinden okunuyor.
//
// Basit bir dokunuş (parmağı kaldırmadan sürüklemeden) ile gerçek bir
// kaydırma/yakınlaştırma hareketini ayırt etmek için bir hareket eşiği
// kullanılıyor (DraggablePin'deki ile aynı mantık) — aksi halde altındaki
// stant/sahne pin'lerine giden dokunuşlar bu sarmalayıcı tarafından yutulur.
import { useRef, type ReactNode } from 'react';
import { Animated, PanResponder, Pressable, StyleSheet, View, type LayoutChangeEvent } from 'react-native';
import { RotateCcw } from 'lucide-react-native';

import { colors } from '../constants/theme';

const MIN_SCALE = 1;
const MAX_SCALE = 4;
const PAN_THRESHOLD = 4;

type Touch = { pageX: number; pageY: number };

function distanceBetween(a: Touch, b: Touch) {
  return Math.hypot(a.pageX - b.pageX, a.pageY - b.pageY);
}

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}

export function ZoomPanCanvas({ children, aspectRatio }: { children: ReactNode; aspectRatio: number }) {
  const scale = useRef(new Animated.Value(1)).current;
  const translateX = useRef(new Animated.Value(0)).current;
  const translateY = useRef(new Animated.Value(0)).current;

  // Animated.Value'lar senkron okunamadığı için güncel sayısal değerleri
  // ayrı bir "canlı" ref'te de tutuyoruz (DraggablePin'deki liveRef deseni).
  const live = useRef({ scale: 1, x: 0, y: 0 });
  const gestureStart = useRef({ scale: 1, x: 0, y: 0, distance: 0 });
  const containerSize = useRef({ width: 1, height: 1 });

  function clampTranslate(nextScale: number, x: number, y: number) {
    // İçerik yakınlaştırılınca/kaydırılınca krokinin tamamen ekran dışına
    // çıkmaması için kabaca bir sınır.
    const maxOffsetX = (containerSize.current.width * (nextScale - 1)) / 2 + containerSize.current.width * 0.35;
    const maxOffsetY = (containerSize.current.height * (nextScale - 1)) / 2 + containerSize.current.height * 0.35;
    return { x: clamp(x, -maxOffsetX, maxOffsetX), y: clamp(y, -maxOffsetY, maxOffsetY) };
  }

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => false,
      onMoveShouldSetPanResponder: (evt, gesture) =>
        evt.nativeEvent.touches.length === 2 ||
        Math.abs(gesture.dx) > PAN_THRESHOLD ||
        Math.abs(gesture.dy) > PAN_THRESHOLD,
      onPanResponderGrant: (evt) => {
        gestureStart.current.scale = live.current.scale;
        gestureStart.current.x = live.current.x;
        gestureStart.current.y = live.current.y;
        const touches = evt.nativeEvent.touches;
        gestureStart.current.distance = touches.length === 2 ? distanceBetween(touches[0], touches[1]) : 0;
      },
      onPanResponderMove: (evt, gesture) => {
        const touches = evt.nativeEvent.touches;
        if (touches.length === 2 && gestureStart.current.distance) {
          const newDistance = distanceBetween(touches[0], touches[1]);
          const nextScale = clamp(
            gestureStart.current.scale * (newDistance / gestureStart.current.distance),
            MIN_SCALE,
            MAX_SCALE,
          );
          live.current.scale = nextScale;
          scale.setValue(nextScale);
          return;
        }
        const next = clampTranslate(
          live.current.scale,
          gestureStart.current.x + gesture.dx,
          gestureStart.current.y + gesture.dy,
        );
        live.current.x = next.x;
        live.current.y = next.y;
        translateX.setValue(next.x);
        translateY.setValue(next.y);
      },
      onPanResponderRelease: () => {},
      onPanResponderTerminate: () => {},
    }),
  ).current;

  function reset() {
    live.current = { scale: 1, x: 0, y: 0 };
    Animated.parallel([
      Animated.spring(scale, { toValue: 1, useNativeDriver: true }),
      Animated.spring(translateX, { toValue: 0, useNativeDriver: true }),
      Animated.spring(translateY, { toValue: 0, useNativeDriver: true }),
    ]).start();
  }

  return (
    <View
      style={[styles.wrap, { aspectRatio }]}
      onLayout={(event: LayoutChangeEvent) => {
        containerSize.current = {
          width: event.nativeEvent.layout.width,
          height: event.nativeEvent.layout.height,
        };
      }}
      {...panResponder.panHandlers}
    >
      <Animated.View style={[styles.inner, { transform: [{ translateX }, { translateY }, { scale }] }]}>
        {children}
      </Animated.View>
      <Pressable accessibilityLabel="Yakınlaştırmayı sıfırla" style={styles.resetBtn} onPress={reset} hitSlop={8}>
        <RotateCcw size={14} color={colors.white} />
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { width: '100%', overflow: 'hidden', borderRadius: 16 },
  inner: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 },
  resetBtn: {
    position: 'absolute',
    right: 8,
    bottom: 8,
    width: 30,
    height: 30,
    borderRadius: 15,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(15,23,42,0.65)',
    zIndex: 20,
  },
});
