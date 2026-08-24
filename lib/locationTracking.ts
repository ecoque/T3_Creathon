import * as Location from 'expo-location';
import * as TaskManager from 'expo-task-manager';
import { Platform } from 'react-native';

import { supabase } from './supabase';

// Bu isim hem expo-task-manager kaydı hem de Android'deki foreground service
// bildirimi için kullanılıyor. Değiştirilirse eski görev otomatik durur.
export const LOCATION_TRACKING_TASK = 'takeoff-background-location-task';

const isTrackingSupported = Platform.OS === 'ios' || Platform.OS === 'android';

type LocationTaskPayload = {
  locations: Location.LocationObject[];
};

// TaskManager.defineTask, modül import edildiği anda (yani JS bundle her
// başladığında) senkron olarak çalışmalı. Bu yüzden bu dosya app/_layout.tsx
// içinde en üstte import ediliyor: uygulama arka planda konum güncellemesi
// almak için OS tarafından uyandırıldığında da görev tanımlı olsun diye.
if (isTrackingSupported) {
  TaskManager.defineTask(LOCATION_TRACKING_TASK, async ({ data, error }) => {
    if (error) {
      console.warn('[locationTracking] task error:', error.message);
      return;
    }

    const { locations } = (data ?? {}) as LocationTaskPayload;
    if (!locations || locations.length === 0) return;

    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return;

    const rows = locations.map((loc) => ({
      user_id: user.id,
      lat: loc.coords.latitude,
      lng: loc.coords.longitude,
      accuracy: loc.coords.accuracy,
      timestamp: new Date(loc.timestamp).toISOString(),
    }));

    const { error: insertError } = await supabase.from('location_pings').insert(rows);
    if (insertError) {
      console.warn('[locationTracking] insert error:', insertError.message);
    }
  });
}

export type LocationPermissionResult = 'granted' | 'foreground-only' | 'denied' | 'unsupported';

// Önce ön plan iznini, kabul edilirse ardından arka plan iznini ister.
// Android 11+ ve iOS'ta arka plan izni ayrı bir sistem diyaloğu gerektirir;
// kullanıcı bazen "Her Zaman İzin Ver"i Ayarlar'dan seçmek zorunda kalabilir.
export async function requestLocationPermissions(): Promise<LocationPermissionResult> {
  if (!isTrackingSupported) return 'unsupported';

  const foreground = await Location.requestForegroundPermissionsAsync();
  if (foreground.status !== 'granted') return 'denied';

  const background = await Location.requestBackgroundPermissionsAsync();
  if (background.status !== 'granted') return 'foreground-only';

  return 'granted';
}

export async function isLocationTrackingActive(): Promise<boolean> {
  if (!isTrackingSupported) return false;
  if (!TaskManager.isTaskDefined(LOCATION_TRACKING_TASK)) return false;
  return Location.hasStartedLocationUpdatesAsync(LOCATION_TRACKING_TASK);
}

// Etkinlik boyunca ortalama 1 dakikada bir veya 50 metre hareket edildiğinde
// bir konum ping'i kaydeder. Bu aralık pil tüketimi ile yoğunluk haritasının
// güncelliği arasındaki dengeyi gözetiyor; ihtiyaca göre ayarlanabilir.
export async function startLocationTracking(): Promise<LocationPermissionResult> {
  const permission = await requestLocationPermissions();
  if (permission !== 'granted') return permission;

  const alreadyStarted = await isLocationTrackingActive();
  if (alreadyStarted) return 'granted';

  await Location.startLocationUpdatesAsync(LOCATION_TRACKING_TASK, {
    accuracy: Location.Accuracy.Balanced,
    timeInterval: 60_000,
    distanceInterval: 50,
    showsBackgroundLocationIndicator: true,
    pausesUpdatesAutomatically: false,
    foregroundService: {
      notificationTitle: 'TakeOff konum paylaşımı aktif',
      notificationBody: 'Etkinlik boyunca yoğunluk haritası ve rota önerileri için konumun kullanılıyor.',
    },
  });

  return 'granted';
}

export async function stopLocationTracking(): Promise<void> {
  if (!isTrackingSupported) return;
  const started = await isLocationTrackingActive();
  if (started) {
    await Location.stopLocationUpdatesAsync(LOCATION_TRACKING_TASK);
  }
}

// "Verilerimi Sil" butonu: kullanıcının bugüne kadar biriken tüm konum
// ping'lerini Supabase'den kalıcı olarak siler (RLS: sadece kendi satırları).
export async function deleteMyLocationHistory(userId: string): Promise<void> {
  const { error } = await supabase.from('location_pings').delete().eq('user_id', userId);
  if (error) throw error;
}
