// Günlük yemek menüsü + kullanıcıya özel, günlük olarak SABİT yemek saati
// dilimi ataması.
//
// Dilim penceresi 12:00-13:30 arası, 10'ar dakikalık 9 dilime bölünür. Her
// kullanıcı için dilim, kullanıcı id'sinin basit bir hash'i ile başlangıç
// noktası seçilip (böylece kullanıcılar dilimlere dengeli/pseudo-rastgele
// dağılır), kullanıcının o günkü ajandasındaki (bookmarklı oturumlar) ve
// kabul edilmiş toplantılarındaki çakışmalar atlanarak seçilir. Hiçbir dilim
// çakışmasız değilse en az çakışanı seçilir. Sonuç meal_assignments'a
// unique(user_id, event_date) + on conflict do nothing ile yazılır, böylece
// aynı kullanıcı için aynı gün asla değişmez — bir sonraki açılışta doğrudan
// var olan satır okunur.

import { useQuery } from '@tanstack/react-query';

import { istanbulDateString, istanbulTimestamp } from './eventDate';
import { supabase } from './supabase';
import { useCurrentProfile } from './useCurrentProfile';
import type { Meal, MealAssignment } from '../types';

const SLOT_COUNT = 9;
const SLOT_MINUTES = 10;
const WINDOW_START_MINUTES = 12 * 60; // 12:00
const MEETING_DURATION_MINUTES = 30;

function slotBoundsMinutes(index: number) {
  const startMinutes = WINDOW_START_MINUTES + index * SLOT_MINUTES;
  return { startMinutes, endMinutes: startMinutes + SLOT_MINUTES };
}

function minutesToHHMM(minutes: number) {
  const h = Math.floor(minutes / 60)
    .toString()
    .padStart(2, '0');
  const m = (minutes % 60).toString().padStart(2, '0');
  return `${h}:${m}`;
}

// Basit, bağımlılıksız string hash (djb2 varyantı) — kripto amaçlı değil,
// sadece kullanıcıları 9 dilime pseudo-rastgele/dengeli dağıtmak için.
function hashStringToInt(value: string): number {
  let hash = 5381;
  for (let i = 0; i < value.length; i++) {
    hash = (hash * 33) ^ value.charCodeAt(i);
  }
  return Math.abs(hash);
}

type BusyInterval = { startMs: number; endMs: number };

function overlaps(a: BusyInterval, startMs: number, endMs: number) {
  return a.startMs < endMs && startMs < a.endMs;
}

async function fetchBusyIntervals(userId: string, eventDate: string): Promise<BusyInterval[]> {
  const dayStart = new Date(`${eventDate}T00:00:00+03:00`).toISOString();
  const dayEnd = new Date(`${eventDate}T23:59:59+03:00`).toISOString();
  const intervals: BusyInterval[] = [];

  const bookmarkResult = await supabase.from('session_bookmarks').select('session_id').eq('user_id', userId);
  if (!bookmarkResult.error) {
    const sessionIds = (bookmarkResult.data ?? []).map((row) => row.session_id as string);
    if (sessionIds.length) {
      const sessionResult = await supabase
        .from('sessions')
        .select('start_time, end_time')
        .in('id', sessionIds);
      if (!sessionResult.error) {
        for (const row of sessionResult.data ?? []) {
          if (!row.start_time || !row.end_time) continue;
          const startMs = new Date(row.start_time).getTime();
          const endMs = new Date(row.end_time).getTime();
          // Sadece bugüne ait oturumlar dilim çakışması sayılır.
          if (istanbulDateString(new Date(startMs)) !== eventDate) continue;
          intervals.push({ startMs, endMs });
        }
      }
    }
  }

  const meetingResult = await supabase
    .from('meeting_requests')
    .select('proposed_time')
    .eq('status', 'accepted')
    .or(`from_user_id.eq.${userId},to_user_id.eq.${userId}`)
    .gte('proposed_time', dayStart)
    .lte('proposed_time', dayEnd);
  if (!meetingResult.error) {
    for (const row of meetingResult.data ?? []) {
      if (!row.proposed_time) continue;
      const startMs = new Date(row.proposed_time).getTime();
      intervals.push({ startMs, endMs: startMs + MEETING_DURATION_MINUTES * 60_000 });
    }
  }

  return intervals;
}

function pickBestSlotIndex(userId: string, eventDate: string, busy: BusyInterval[]): number {
  const startIndex = hashStringToInt(userId) % SLOT_COUNT;
  let bestIndex = startIndex;
  let bestConflicts = Infinity;

  for (let offset = 0; offset < SLOT_COUNT; offset++) {
    const index = (startIndex + offset) % SLOT_COUNT;
    const { startMinutes, endMinutes } = slotBoundsMinutes(index);
    const startMs = new Date(istanbulTimestamp(eventDate, minutesToHHMM(startMinutes))).getTime();
    const endMs = new Date(istanbulTimestamp(eventDate, minutesToHHMM(endMinutes))).getTime();
    const conflicts = busy.filter((interval) => overlaps(interval, startMs, endMs)).length;
    if (conflicts === 0) return index;
    if (conflicts < bestConflicts) {
      bestConflicts = conflicts;
      bestIndex = index;
    }
  }
  return bestIndex;
}

async function fetchTodayMeal(): Promise<Meal | null> {
  const eventDate = istanbulDateString();
  const { data, error } = await supabase.from('meals').select('*').eq('event_date', eventDate).maybeSingle();
  if (error) throw error;
  return (data as Meal) ?? null;
}

export function useTodayMeal() {
  return useQuery({
    queryKey: ['meals', 'today'],
    queryFn: fetchTodayMeal,
    staleTime: 60_000,
  });
}

async function fetchOrCreateMyMealAssignment(userId: string): Promise<MealAssignment> {
  const eventDate = istanbulDateString();

  const existing = await supabase
    .from('meal_assignments')
    .select('*')
    .eq('user_id', userId)
    .eq('event_date', eventDate)
    .maybeSingle();
  if (existing.error) throw existing.error;
  if (existing.data) return existing.data as MealAssignment;

  const busy = await fetchBusyIntervals(userId, eventDate);
  const slotIndex = pickBestSlotIndex(userId, eventDate, busy);
  const { startMinutes, endMinutes } = slotBoundsMinutes(slotIndex);
  const slotStart = istanbulTimestamp(eventDate, minutesToHHMM(startMinutes));
  const slotEnd = istanbulTimestamp(eventDate, minutesToHHMM(endMinutes));

  // unique(user_id, event_date) + ignoreDuplicates: iki cihaz/istek aynı anda
  // hesaplarsa biri kazanır, diğeri sessizce no-op olur; ardından her ikisi de
  // aşağıdaki select ile aynı (kazanan) satırı okur.
  const insertResult = await supabase
    .from('meal_assignments')
    .upsert(
      { user_id: userId, event_date: eventDate, slot_start: slotStart, slot_end: slotEnd },
      { onConflict: 'user_id,event_date', ignoreDuplicates: true },
    );
  if (insertResult.error) throw insertResult.error;

  const final = await supabase
    .from('meal_assignments')
    .select('*')
    .eq('user_id', userId)
    .eq('event_date', eventDate)
    .maybeSingle();
  if (final.error) throw final.error;
  if (!final.data) throw new Error('Yemek saati ataması oluşturulamadı.');
  return final.data as MealAssignment;
}

// Ana sayfa/ajanda ekranında gösterilecek "Yemek Saatin" kartı için — o gün
// için henüz atanmamışsa ilk çağrıda lazy olarak hesaplayıp tabloya yazar.
export function useMyMealAssignment() {
  const { data: meResult } = useCurrentProfile();
  const userId = meResult?.userId;
  // Bugünün tarihini query key'e dahil ediyoruz: uygulama gece yarısını
  // geçerek açık kalırsa (arka planda), react-query bunu otomatik olarak
  // "farklı bir sorgu" sayıp yeni günün atamasını hesaplar — staleTime:
  // Infinity olduğu için tarih key'de olmasa dünün önbelleğe alınmış
  // sonucunda takılı kalırdı.
  const eventDate = istanbulDateString();
  return useQuery({
    queryKey: ['meal_assignments', 'mine', userId, eventDate],
    queryFn: () => fetchOrCreateMyMealAssignment(userId as string),
    enabled: !!userId,
    staleTime: Infinity,
  });
}

// Admin panelinden günün menüsünü ayarlamak için — aynı tarih için tekrar
// çağrıldığında var olan satırı günceller (unique(event_date) ile upsert).
export async function saveMealForDate(eventDate: string, title: string, description: string | null) {
  const result = await supabase
    .from('meals')
    .upsert(
      { event_date: eventDate, title, description, updated_at: new Date().toISOString() },
      { onConflict: 'event_date' },
    );
  if (result.error) throw result.error;
}

export async function deleteMeal(id: string) {
  const result = await supabase.from('meals').delete().eq('id', id);
  if (result.error) throw result.error;
}

async function fetchAllMeals(): Promise<Meal[]> {
  const { data, error } = await supabase.from('meals').select('*').order('event_date', { ascending: true });
  if (error) throw error;
  return (data ?? []) as Meal[];
}

export function useAllMeals() {
  return useQuery({
    queryKey: ['meals', 'all'],
    queryFn: fetchAllMeals,
    staleTime: 15_000,
  });
}
