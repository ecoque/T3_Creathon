import { initialEventSettings } from '../constants/adminMockData';
import type {
  AdminAnnouncement,
  AdminAttendee,
  AdminBooth,
  AdminLogItem,
  AdminMeetingRecord,
  AdminSession,
  AdminSpeaker,
  AdminStage,
  AttendeeRole,
  EventSettings,
  SessionCategory,
  SessionStatus,
  ZoneDensityInfo,
} from '../types/admin';
import { isBoothPlaced, nextBoothNumber, zoneForPercent } from './boothGrid';
import { supabase } from './supabase';
import { computeLiveZoneOccupancy, LIVE_WINDOW_MS } from './zoneDensity';

type Row = Record<string, any>;

export type AdminWorkspaceData = {
  sessions: AdminSession[];
  stages: AdminStage[];
  booths: AdminBooth[];
  zones: ZoneDensityInfo[];
  attendees: AdminAttendee[];
  announcements: AdminAnnouncement[];
  meetings: AdminMeetingRecord[];
  logs: AdminLogItem[];
  settings: EventSettings;
};

const schemaHint =
  'Admin veritabanı şeması hazır değil. supabase_admin_workspace_migration.sql dosyasını Supabase SQL Editor içinde çalıştırın.';

function databaseError(error: { message?: string; code?: string } | null, context: string) {
  if (!error) return null;
  const message = error.message || 'Bilinmeyen veritabanı hatası';
  if (error.code === '23514' && message.includes('profiles_entrepreneur_identity_required')) {
    return new Error(
      'Aktif girişimci profili için unvan ve şirket zorunludur. Bu iki alanı doldurun veya hesabı pasif duruma alın.',
    );
  }
  if (error.code === '23514' && message.includes('profiles_investment_thesis_required')) {
    return new Error(
      'Aktif yatırımcı profili için yatırım tezi zorunludur. Kullanıcı profilinden yatırım tezini tamamlayın veya hesabı pasif duruma alın.',
    );
  }
  if (error.code === '42P01' || error.code === '42703' || /does not exist|schema cache/i.test(message)) {
    return new Error(schemaHint);
  }
  return new Error(`${context}: ${message}`);
}

function ensure(result: { error: any }, context: string) {
  const error = databaseError(result.error, context);
  if (error) throw error;
}

// Bağımlılıksız (Buffer/atob gerektirmeyen — Hermes'te ikisi de garanti değil)
// base64 → binary çözücü. Supabase Storage'a yerel bir resmi yüklerken
// fetch(localUri) yerine bunu kullanıyoruz (bkz. uploadFloorPlanImage).
const BASE64_ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';

function decodeBase64(base64: string): Uint8Array {
  const clean = base64.replace(/[^A-Za-z0-9+/]/g, '');
  const bytes: number[] = [];
  let buffer = 0;
  let bits = 0;
  for (let i = 0; i < clean.length; i++) {
    const value = BASE64_ALPHABET.indexOf(clean[i]);
    if (value === -1) continue;
    buffer = (buffer << 6) | value;
    bits += 6;
    if (bits >= 8) {
      bits -= 8;
      bytes.push((buffer >> bits) & 0xff);
    }
  }
  return Uint8Array.from(bytes);
}

function safeDate(value?: string | null) {
  const date = value ? new Date(value) : new Date();
  return Number.isNaN(date.getTime()) ? new Date() : date;
}

function datePart(date: Date, part: Intl.DateTimeFormatPartTypes) {
  return (
    new Intl.DateTimeFormat('tr-TR', {
      timeZone: 'Europe/Istanbul',
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      weekday: 'short',
      hour: '2-digit',
      minute: '2-digit',
      hourCycle: 'h23',
    })
      .formatToParts(date)
      .find((item) => item.type === part)?.value || ''
  );
}

function formatShortDate(value?: string | null) {
  if (!value) return undefined;
  return new Intl.DateTimeFormat('tr-TR', {
    timeZone: 'Europe/Istanbul',
    dateStyle: 'short',
    timeStyle: 'short',
  }).format(safeDate(value));
}

function eventTimestamp(day: string, time: string, existingIso?: string, eventStartDate?: string) {
  const normalizedDay = String(Number(day) || 24).padStart(2, '0');
  const normalizedTime = /^\d{2}:\d{2}$/.test(time) ? time : '10:00';
  const base = existingIso || eventStartDate;
  const baseDate = base ? safeDate(base) : new Date();
  const year = datePart(baseDate, 'year') || String(new Date().getFullYear());
  const month = datePart(baseDate, 'month') || String(new Date().getMonth() + 1).padStart(2, '0');
  return new Date(`${year}-${month}-${normalizedDay}T${normalizedTime}:00+03:00`).toISOString();
}

function scheduledTimestamp(value?: string) {
  if (!value) return new Date().toISOString();
  const direct = new Date(value);
  if (!Number.isNaN(direct.getTime())) return direct.toISOString();
  const time = value.match(/(\d{1,2}):(\d{2})/);
  if (!time) throw new Error('Planlanan gönderim zamanı HH:MM biçiminde olmalı.');
  const now = new Date();
  now.setHours(Number(time[1]), Number(time[2]), 0, 0);
  return now.toISOString();
}

const participantRole: Record<string, AttendeeRole> = {
  girisimci: 'Girişimci',
  yatirimci: 'Yatırımcı',
  kurum: 'Kurum / Partner',
  ziyaretci: 'Ziyaretçi',
};

const databaseRole: Record<AttendeeRole, string> = {
  Girişimci: 'girisimci',
  Yatırımcı: 'yatirimci',
  'Kurum / Partner': 'kurum',
  Ziyaretçi: 'ziyaretci',
};

function zoneCode(row: Row, index = 0): AdminStage['zone'] {
  const value = row.code || row.name;
  const found = String(value || '').match(/Zone\s+[A-D]/i)?.[0];
  if (found) return (`Zone ${found.slice(-1).toUpperCase()}` as AdminStage['zone']);
  return (`Zone ${String.fromCharCode(65 + Math.min(index, 3))}` as AdminStage['zone']);
}

function mapSession(row: Row, stageById: Map<string, AdminStage>): AdminSession {
  const start = safeDate(row.start_time);
  const end = safeDate(row.end_time);
  const stage = row.stage_id ? stageById.get(row.stage_id) : undefined;
  const minutes = Math.max(0, Math.round((end.getTime() - start.getTime()) / 60_000));
  const day = datePart(start, 'day').replace(/^0/, '') || '24';
  return {
    id: row.id,
    startTimeIso: row.start_time,
    endTimeIso: row.end_time,
    day,
    dayName: datePart(start, 'weekday').replace('.', ''),
    dateStr: new Intl.DateTimeFormat('tr-TR', {
      timeZone: 'Europe/Istanbul',
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    }).format(start),
    time: `${datePart(start, 'hour')}:${datePart(start, 'minute')}`,
    endTime: `${datePart(end, 'hour')}:${datePart(end, 'minute')}`,
    duration: `${minutes}dk`,
    category: (row.category || 'Panel') as SessionCategory,
    title: row.title,
    description: row.description || '',
    stageId: stage?.id || row.stage_id || '',
    stageName: stage?.name || row.location || 'Alan atanmamış',
    speakers: Array.isArray(row.speakers) ? (row.speakers as AdminSpeaker[]) : [],
    status: (row.status || 'published') as SessionStatus,
    delayMinutes: Number(row.delay_minutes || 0) || undefined,
    capacity: Number(row.capacity || 0),
    bookmarkedCount: Number(row.bookmarked_count || 0),
    checkedInCount: Number(row.checked_in_count || 0),
    tags: Array.isArray(row.tags) ? row.tags : [],
    coverImage: row.cover_image || undefined,
  };
}

function mapSettings(row?: Row): EventSettings {
  if (!row) return { ...(initialEventSettings as EventSettings) };
  return {
    eventName: row.event_name,
    edition: row.edition || undefined,
    eventDates: row.event_dates,
    venueName: row.venue_name,
    venueAddress: row.venue_address || undefined,
    startDate: row.start_date || undefined,
    endDate: row.end_date || undefined,
    logoUrl: row.logo_url || undefined,
    floorPlanUrl: row.floor_plan_url || undefined,
    floorPlanWalls: Array.isArray(row.floor_plan_walls) ? row.floor_plan_walls : [],
    openingTime: row.opening_time,
    closingTime: row.closing_time,
    locationTrackingStart: row.location_tracking_start,
    locationTrackingEnd: row.location_tracking_end,
    trackingDisclaimer: row.tracking_disclaimer || undefined,
    defaultLanguage: row.default_language === 'en' ? 'en' : 'tr',
    timezone: row.timezone,
    autoNotifyScheduleChanges: row.auto_notify_schedule_changes,
    enableAnonymousZoneTracking: row.enable_anonymous_zone_tracking,
    requireCheckInQr: row.require_check_in_qr,
    notificationTriggers: {
      autoSessionReminders: Boolean(row.notification_triggers?.autoSessionReminders),
      autoCapacityAlerts: Boolean(row.notification_triggers?.autoCapacityAlerts),
      autoMeetingReminders: Boolean(row.notification_triggers?.autoMeetingReminders),
    },
  };
}

export async function fetchAdminWorkspace(): Promise<AdminWorkspaceData> {
  const liveWindowStart = new Date(Date.now() - LIVE_WINDOW_MS).toISOString();
  const results = await Promise.all([
    supabase.from('zones').select('*').order('name'),
    supabase.from('stages').select('*').order('name'),
    supabase.from('sessions').select('*').order('start_time'),
    supabase.from('stands').select('*').order('name'),
    supabase.from('profiles').select('*').order('full_name'),
    supabase.from('admin_attendee_details').select('*'),
    supabase.from('users').select('id,email,created_at').order('created_at', { ascending: false }),
    supabase.from('announcements').select('*').order('created_at', { ascending: false }),
    supabase.from('event_settings').select('*').limit(1),
    supabase.from('meeting_requests').select('*').order('created_at', { ascending: false }),
    supabase.from('checkins').select('*'),
    supabase.from('admin_logs').select('*').order('created_at', { ascending: false }).limit(30),
    supabase.from('location_pings').select('user_id,lat,lng,timestamp').gte('timestamp', liveWindowStart),
  ]);
  const labels = [
    'Bölgeler alınamadı',
    'Alanlar alınamadı',
    'Oturumlar alınamadı',
    'Stantlar alınamadı',
    'Profiller alınamadı',
    'Özel katılımcı bilgileri alınamadı',
    'Kullanıcılar alınamadı',
    'Duyurular alınamadı',
    'Etkinlik ayarları alınamadı',
    'Görüşmeler alınamadı',
    'Check-in kayıtları alınamadı',
    'Admin günlükleri alınamadı',
    'Canlı konum verileri alınamadı',
  ];
  results.forEach((result, index) => ensure(result, labels[index]));

  const [zoneResult, stageResult, sessionResult, standResult, profileResult, privateAttendeeResult, userResult, announcementResult, settingsResult, meetingResult, checkinResult, logResult, livePingResult] = results;
  const zoneRows = (zoneResult.data || []) as Row[];
  const zoneById = new Map(zoneRows.map((row, index) => [row.id, zoneCode(row, index)]));
  const stages: AdminStage[] = ((stageResult.data || []) as Row[]).map((row) => ({
    id: row.id,
    name: row.name,
    type: (row.type || 'Diğer') as AdminStage['type'],
    zone: zoneById.get(row.zone_id) || 'Zone A',
    capacity: Number(row.capacity || 0),
    currentOccupancy: Number(row.current_occupancy || 0),
    mapX: Number(row.map_x ?? 50),
    mapY: Number(row.map_y ?? 50),
    status: (row.status || 'active') as AdminStage['status'],
    currentSessionId: row.current_session_id || undefined,
    description: row.description || '',
  }));
  const stageById = new Map(stages.map((stage) => [stage.id, stage]));
  const sessions = ((sessionResult.data || []) as Row[]).map((row) => mapSession(row, stageById));

  const booths: AdminBooth[] = ((standResult.data || []) as Row[]).map((row) => ({
    id: row.id,
    boothNo: row.booth_no || '',
    companyName: row.company_name || row.name,
    category: (row.category || row.type || 'Yapay Zeka') as AdminBooth['category'],
    description: row.description || '',
    logo: row.logo_url || '',
    // row.zone_id null ise (henüz krokiye yerleştirilmemiş) zone de null
    // kalmalı — isBoothPlaced bu alana bakıyor (bkz. lib/boothGrid.ts).
    zone: row.zone_id ? zoneById.get(row.zone_id) || null : null,
    sponsorTier: (row.sponsor_tier || row.sponsor || 'Startup') as AdminBooth['sponsorTier'],
    mapX: Number(row.map_x ?? row.lng ?? 50),
    mapY: Number(row.map_y ?? row.lat ?? 50),
    status: (row.status || 'active') as AdminBooth['status'],
    contactPerson: row.contact_person || '',
    contactEmail: row.contact_email || '',
    qrCodeUrl: row.qr_code_url || undefined,
    totalVisits: Number(row.total_visits || 0),
  }));

  const users = (userResult.data || []) as Row[];
  const userById = new Map(users.map((row) => [row.id, row]));
  const checkins = (checkinResult.data || []) as Row[];
  const checkinsByUser = new Map<string, number>();
  checkins.forEach((row) => checkinsByUser.set(row.user_id, (checkinsByUser.get(row.user_id) || 0) + 1));
  const meetingRows = (meetingResult.data || []) as Row[];
  const meetingsByUser = new Map<string, number>();
  meetingRows.forEach((row) => {
    meetingsByUser.set(row.from_user_id, (meetingsByUser.get(row.from_user_id) || 0) + 1);
    meetingsByUser.set(row.to_user_id, (meetingsByUser.get(row.to_user_id) || 0) + 1);
  });
  const profiles = (profileResult.data || []) as Row[];
  const privateByProfileId = new Map(
    ((privateAttendeeResult.data || []) as Row[]).map((row) => [row.profile_id, row]),
  );
  const profileByUserId = new Map(profiles.map((row) => [row.user_id, row]));
  const attendees: AdminAttendee[] = profiles.map((row) => {
    const names = String(row.full_name || '').trim().split(/\s+/);
    const user = userById.get(row.user_id);
    const privateDetails = privateByProfileId.get(row.id) || {};
    return {
      id: row.id,
      firstName: names[0] || '',
      lastName: names.slice(1).join(' '),
      name: row.full_name || '',
      title: row.title || '',
      position: row.position || '',
      company: row.company || '',
      role: participantRole[row.role] || 'Ziyaretçi',
      sector: row.sector || '',
      interests: Array.isArray(row.interests) ? row.interests : [],
      avatar: row.photo_url || undefined,
      email: user?.email || '',
      phone: privateDetails.phone || '',
      linkedin: row.linkedin_url || undefined,
      status: row.status === 'passive' ? 'passive' : 'active',
      meetingsCount: meetingsByUser.get(row.user_id) || 0,
      checkInCount: checkinsByUser.get(row.user_id) || 0,
      lastActive: formatShortDate(privateDetails.last_active_at),
      currentZone: privateDetails.current_zone || undefined,
      badgeScanned: Boolean(privateDetails.badge_scanned),
      notes: privateDetails.notes || '',
      createdAt: user?.created_at,
    };
  });

  const meetings: AdminMeetingRecord[] = meetingRows.map((row) => {
    const a = profileByUserId.get(row.from_user_id) || {};
    const b = profileByUserId.get(row.to_user_id) || {};
    const proposed = safeDate(row.proposed_time || row.created_at);
    const participant = (profile: Row, userId: string) => ({
      id: userId,
      name: profile.full_name || 'Bilinmeyen katılımcı',
      role: participantRole[profile.role] || 'Ziyaretçi',
      company: profile.company || '',
      avatar: profile.photo_url || undefined,
    });
    return {
      id: row.id,
      date: new Intl.DateTimeFormat('tr-TR', { dateStyle: 'short' }).format(proposed),
      timeSlot: new Intl.DateTimeFormat('tr-TR', { timeStyle: 'short' }).format(proposed),
      participantA: participant(a, row.from_user_id),
      participantB: participant(b, row.to_user_id),
      tableLocation: 'B2B Lounge',
      status: row.status === 'rejected' ? 'declined' : row.status,
    } as AdminMeetingRecord;
  });

  // Bölge merkezi tanımlanmışsa (center_lat/center_lng dolu), aktif kişi sayısı
  // artık admin'in elle girdiği bir sayı değil, son LIVE_WINDOW_MS içindeki gerçek
  // location_pings verisinden hesaplanan canlı bir değer. Merkezi tanımlanmamış
  // bölgeler için eski davranış (manuel active_attendees) korunuyor.
  const livePings = (livePingResult.data || []) as Row[];
  const zoneCircles = zoneRows.map((row) => ({
    id: row.id,
    centerLat: row.center_lat != null ? Number(row.center_lat) : null,
    centerLng: row.center_lng != null ? Number(row.center_lng) : null,
    radiusMeters: Number(row.radius_meters || 60),
  }));
  const liveOccupancyByZone = computeLiveZoneOccupancy(
    zoneCircles,
    livePings.map((row) => ({
      user_id: row.user_id,
      lat: Number(row.lat),
      lng: Number(row.lng),
      timestamp: row.timestamp,
    })),
  );

  const zones: ZoneDensityInfo[] = zoneRows.map((row, index) => {
    const capacity = Number(row.capacity || 0);
    const hasGeofence = row.center_lat != null && row.center_lng != null;
    const active = hasGeofence ? liveOccupancyByZone.get(row.id) || 0 : Number(row.active_attendees || 0);
    const percent = capacity > 0 ? Math.round((active / capacity) * 100) : 0;
    return {
      id: row.id,
      name: row.name,
      code: zoneCode(row, index),
      activeAttendees: active,
      capacity,
      densityLevel: (percent >= 85 ? 'Yoğun' : percent >= 65 ? 'Orta' : percent >= 30 ? 'Normal' : 'Düşük') as ZoneDensityInfo['densityLevel'],
      densityPercent: percent,
      peakAttendees: Number(row.peak_attendees || 0),
      avgAttendees: Number(row.avg_attendees || 0),
      description: row.description || '',
      color: row.color || '#0F766E',
      centerLat: row.center_lat != null ? Number(row.center_lat) : null,
      centerLng: row.center_lng != null ? Number(row.center_lng) : null,
      radiusMeters: Number(row.radius_meters || 60),
    };
  });

  const announcements: AdminAnnouncement[] = ((announcementResult.data || []) as Row[]).map((row) => ({
    id: row.id,
    title: row.title,
    message: row.message,
    targetAudience: row.target_audience,
    targetZone: row.target_zone || undefined,
    targetSessionId: row.target_session_id || undefined,
    targetBoothId: row.target_booth_id || undefined,
    ctaText: row.cta_text || undefined,
    ctaUrl: row.cta_url || undefined,
    sentAt: formatShortDate(row.sent_at),
    scheduledFor: formatShortDate(row.scheduled_for),
    status: row.status,
    recipientCount: Number(row.recipient_count || 0),
    readCount: Number(row.read_count || 0),
    clickCount: Number(row.click_count || 0),
  }));

  const logs: AdminLogItem[] = ((logResult.data || []) as Row[]).map((row) => ({
    id: row.id,
    timestamp: formatShortDate(row.created_at) || '',
    adminName: 'Etkinlik Koordinatörü',
    action: row.action,
    target: row.target,
    type: row.type,
  }));

  return {
    sessions,
    stages,
    booths,
    zones,
    attendees,
    announcements,
    meetings,
    logs,
    settings: mapSettings(((settingsResult.data || []) as Row[])[0]),
  };
}

async function writeLog(action: string, target: string, type: AdminLogItem['type']) {
  const { data, error: userError } = await supabase.auth.getUser();
  if (userError) throw new Error(`Denetim kullanıcısı doğrulanamadı: ${userError.message}`);
  if (!data.user) throw new Error('Denetim kaydı için aktif admin oturumu bulunamadı.');
  const result = await supabase.from('admin_logs').insert({
    admin_user_id: data.user.id,
    action,
    target,
    type,
  });
  ensure(result, 'İşlem tamamlandı ancak denetim kaydı yazılamadı');
}

function zoneIdFor(code: AdminStage['zone'], zones: ZoneDensityInfo[]) {
  return zones.find((zone) => zone.code === code)?.id || null;
}

export const adminRepository = {
  fetch: fetchAdminWorkspace,

  async saveSession(data: Partial<AdminSession>, publish: boolean, editingId?: string, eventStartDate?: string) {
    const start = eventTimestamp(data.day || '24', data.time || '10:00', data.startTimeIso, eventStartDate);
    const end = eventTimestamp(data.day || '24', data.endTime || '10:45', data.endTimeIso || data.startTimeIso, eventStartDate);
    const payload = {
      title: data.title || 'Yeni Oturum',
      description: data.description || null,
      start_time: start,
      end_time: end,
      location: data.stageName || null,
      stage_id: data.stageId || null,
      category: data.category || 'Panel',
      status: publish ? 'published' : data.status || 'draft',
      delay_minutes: data.delayMinutes || 0,
      capacity: data.capacity || 0,
      bookmarked_count: data.bookmarkedCount || 0,
      checked_in_count: data.checkedInCount || 0,
      speakers: data.speakers || [],
      tags: data.tags || [],
      cover_image: data.coverImage || null,
      updated_at: new Date().toISOString(),
    };
    const result = editingId
      ? await supabase.from('sessions').update(payload).eq('id', editingId)
      : await supabase.from('sessions').insert(payload);
    ensure(result, 'Oturum kaydedilemedi');
    await writeLog(editingId ? 'Oturum güncellendi' : 'Oturum oluşturuldu', payload.title, 'session');
  },

  async deleteSession(id: string) {
    const result = await supabase.from('sessions').delete().eq('id', id);
    ensure(result, 'Oturum silinemedi');
    await writeLog('Oturum silindi', id, 'session');
  },

  async updateSession(id: string, changes: Row) {
    const result = await supabase.from('sessions').update({ ...changes, updated_at: new Date().toISOString() }).eq('id', id);
    ensure(result, 'Oturum güncellenemedi');
    await writeLog('Oturum operasyonu güncellendi', id, 'session');
  },

  async saveStage(data: Partial<AdminStage>, zones: ZoneDensityInfo[], editingId?: string) {
    // Zone artık bu formdan manuel seçilmiyor — krokideki gerçek konumdan
    // (mapX/mapY) otomatik türetiliyor, tıpkı updateStagePosition'da olduğu
    // gibi. Böylece yeni bir alan için gösterilen "Zone D" (varsayılan merkez
    // nokta) ile veritabanına yazılan zone_id her zaman tutarlı kalır.
    const mapX = data.mapX ?? 50;
    const mapY = data.mapY ?? 50;
    const payload = {
      name: data.name || 'Yeni Alan',
      type: data.type || 'Other',
      zone_id: zoneIdFor(data.zone || zoneForPercent(mapX, mapY), zones),
      capacity: data.capacity || 0,
      current_occupancy: data.currentOccupancy || 0,
      map_x: mapX,
      map_y: mapY,
      status: data.status || 'active',
      description: data.description || null,
      updated_at: new Date().toISOString(),
    };
    const result = editingId
      ? await supabase.from('stages').update(payload).eq('id', editingId)
      : await supabase.from('stages').insert(payload);
    ensure(result, 'Alan kaydedilemedi');
    await writeLog(editingId ? 'Alan güncellendi' : 'Alan oluşturuldu', payload.name, 'stage');
  },

  async deleteStage(id: string) {
    const result = await supabase.from('stages').delete().eq('id', id);
    ensure(result, 'Alan silinemedi');
    await writeLog('Alan silindi', id, 'stage');
  },

  // Bir alanı (sahne/oturum yeri) krokide serbestçe (kareye takılmadan)
  // konumlandırır. Hangi zone'a düştüğü, dokunulan noktanın krokideki
  // çeyreğinden otomatik belirlenir.
  async updateStagePosition(id: string, mapX: number, mapY: number, zones: ZoneDensityInfo[]) {
    const zone = zoneForPercent(mapX, mapY);
    const result = await supabase
      .from('stages')
      .update({
        map_x: mapX,
        map_y: mapY,
        zone_id: zoneIdFor(zone, zones),
        updated_at: new Date().toISOString(),
      })
      .eq('id', id);
    ensure(result, 'Alan konumu güncellenemedi');
    await writeLog('Alan krokide konumlandırıldı', id, 'stage');
  },

  async saveZone(data: Partial<ZoneDensityInfo>, editingId?: string) {
    const payload: Row = {
      name: data.name || 'Yeni Bölge',
      center_lat: data.centerLat ?? null,
      center_lng: data.centerLng ?? null,
      radius_meters: data.radiusMeters || 60,
      capacity: data.capacity || 0,
      description: data.description || null,
      updated_at: new Date().toISOString(),
    };
    if (!editingId) {
      // Eski şemadan kalan zorunlu sütun; artık merkez + yarıçap kullanıyoruz.
      payload.polygon = [];
    }
    const result = editingId
      ? await supabase.from('zones').update(payload).eq('id', editingId)
      : await supabase.from('zones').insert(payload);
    ensure(result, 'Bölge kaydedilemedi');
    await writeLog(editingId ? 'Bölge güncellendi' : 'Bölge oluşturuldu', payload.name, 'zone');
  },

  async deleteZone(id: string) {
    const result = await supabase.from('zones').delete().eq('id', id);
    ensure(result, 'Bölge silinemedi');
    await writeLog('Bölge silindi', id, 'zone');
  },

  async saveBooth(data: Partial<AdminBooth>, zones: ZoneDensityInfo[], editingId?: string) {
    // Stant no ve krokideki konum artık bu formdan değil, Harita Yönetimi >
    // Kroki ekranından atanıyor (bkz. placeBooth). Burada zone/booth_no
    // sadece zaten atanmışsa (data içinde geliyorsa) korunuyor —
    // yeni/henüz yerleştirilmemiş bir standa asla sahte bir zone atanmıyor.
    const payload: Row = {
      name: data.boothNo || data.companyName || 'Yeni Stand',
      type: data.category || 'Stand',
      sponsor: data.sponsorTier || null,
      zone_id: data.zone ? zoneIdFor(data.zone, zones) : null,
      booth_no: data.boothNo || null,
      company_name: data.companyName || null,
      category: data.category || null,
      description: data.description || null,
      logo_url: data.logo || null,
      sponsor_tier: data.sponsorTier || null,
      map_x: data.mapX ?? 50,
      map_y: data.mapY ?? 50,
      status: data.status || 'active',
      contact_person: data.contactPerson || null,
      contact_email: data.contactEmail || null,
      qr_code_url: data.qrCodeUrl || null,
      total_visits: data.totalVisits || 0,
      updated_at: new Date().toISOString(),
    };
    if (!editingId) {
      // Required by the legacy schema. Later admin edits must not overwrite real geo coordinates.
      payload.lat = 0;
      payload.lng = 0;
    }
    const result = editingId
      ? await supabase.from('stands').update(payload).eq('id', editingId)
      : await supabase.from('stands').insert(payload);
    ensure(result, 'Stand kaydedilemedi');
    await writeLog(editingId ? 'Stand güncellendi' : 'Stand oluşturuldu', data.companyName || payload.name, 'booth');
  },

  // Bir standı krokinin (gerçek fotoğraf veya soyut görünüm) herhangi bir
  // noktasına serbestçe yerleştirir — kareye takılma yok. Hangi zone'a
  // düştüğü dokunulan noktadan otomatik belirlenir (bkz. zoneForPercent).
  // Stant aynı zone içinde kalıyorsa numarası değişmez; başka bir zone'a
  // taşınıyorsa (veya ilk kez yerleştiriliyorsa) o zone'un bir sonraki
  // numarası otomatik atanır.
  async placeBooth(boothId: string, mapX: number, mapY: number, booths: AdminBooth[], zones: ZoneDensityInfo[]) {
    const target = booths.find((booth) => booth.id === boothId);
    if (!target) throw new Error('Stant bulunamadı.');

    const zone = zoneForPercent(mapX, mapY);
    const keepsNumber = target.zone === zone && isBoothPlaced(target);
    const boothNo = keepsNumber
      ? target.boothNo
      : nextBoothNumber(
          zone,
          booths.filter((booth) => booth.id !== boothId).map((booth) => booth.boothNo),
        );

    const result = await supabase
      .from('stands')
      .update({
        zone_id: zoneIdFor(zone, zones),
        booth_no: boothNo,
        name: boothNo,
        map_x: mapX,
        map_y: mapY,
        updated_at: new Date().toISOString(),
      })
      .eq('id', boothId);
    ensure(result, 'Stant krokiye yerleştirilemedi');
    await writeLog('Stant krokiye yerleştirildi', `${boothNo} · ${target.companyName}`, 'booth');
  },

  // Bir standı krokiden kaldırır (silmez) — stant "Yerleştirilmedi" durumuna
  // döner ve tekrar krokinin herhangi bir noktasına yerleştirilebilir.
  async unplaceBooth(boothId: string, booths: AdminBooth[]) {
    const target = booths.find((booth) => booth.id === boothId);
    const result = await supabase
      .from('stands')
      .update({ zone_id: null, updated_at: new Date().toISOString() })
      .eq('id', boothId);
    ensure(result, 'Stant krokiden kaldırılamadı');
    await writeLog('Stant krokiden kaldırıldı', target?.companyName || boothId, 'booth');
  },

  async deleteBooth(id: string) {
    const result = await supabase.from('stands').delete().eq('id', id);
    ensure(result, 'Stand silinemedi');
    await writeLog('Stand silindi', id, 'booth');
  },

  async updateBooth(id: string, changes: Row) {
    const result = await supabase.from('stands').update({ ...changes, updated_at: new Date().toISOString() }).eq('id', id);
    ensure(result, 'Stand güncellenemedi');
    await writeLog('Stand operasyonu güncellendi', id, 'booth');
  },

  async saveAttendee(data: Partial<AdminAttendee>, editingId?: string, current?: AdminAttendee) {
    if (!editingId) {
      throw new Error('Yeni gerçek kullanıcı hesabı istemciden güvenli biçimde oluşturulamaz. Supabase Authentication üzerinden kullanıcıyı davet edin; profil oluşunca bu ekrandan düzenleyebilirsiniz.');
    }
    if (current && data.email && data.email.trim().toLowerCase() !== current.email.trim().toLowerCase()) {
      throw new Error('Giriş e-postası bu panelden değiştirilemez. E-postayı Supabase Authentication üzerinden güncelleyin.');
    }
    const role = data.role || 'Ziyaretçi';
    const status = data.status || 'active';
    const title = data.title?.trim() || '';
    const company = data.company?.trim() || '';
    if (role === 'Girişimci' && status === 'active' && (!title || !company)) {
      throw new Error(
        'Aktif girişimci profili için unvan ve şirket zorunludur. Bu iki alanı doldurun veya hesabı pasif duruma alın.',
      );
    }
    const payload = {
      full_name: data.name || `${data.firstName || ''} ${data.lastName || ''}`.trim(),
      title: title || null,
      position: data.position || null,
      company: company || null,
      role: databaseRole[role],
      sector: data.sector || null,
      interests: data.interests || [],
      linkedin_url: data.linkedin || null,
      status,
      updated_at: new Date().toISOString(),
    };
    const result = await supabase.from('profiles').update(payload).eq('id', editingId);
    ensure(result, 'Katılımcı güncellenemedi');
    const privateResult = await supabase.from('admin_attendee_details').upsert(
      {
        profile_id: editingId,
        phone: data.phone || null,
        notes: data.notes || null,
        current_zone: data.currentZone || current?.currentZone || null,
        badge_scanned: data.badgeScanned ?? current?.badgeScanned ?? false,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'profile_id' },
    );
    ensure(privateResult, 'Özel katılımcı bilgileri kaydedilemedi');
    await writeLog('Katılımcı profili güncellendi', payload.full_name, 'system');
  },

  async deleteAttendee(profileId: string) {
    const result = await supabase.from('profiles').delete().eq('id', profileId);
    ensure(result, 'Katılımcı profili silinemedi');
    await writeLog('Katılımcı profili silindi', profileId, 'system');
  },

  async publishAnnouncement(data: Partial<AdminAnnouncement>, scheduled: boolean) {
    const now = new Date().toISOString();
    const payload = {
      title: data.title || 'Yeni Duyuru',
      message: data.message || '',
      target_audience: data.targetAudience || 'Tüm Katılımcılar',
      target_zone: data.targetZone || null,
      target_session_id: data.targetSessionId || null,
      target_booth_id: data.targetBoothId || null,
      cta_text: data.ctaText || null,
      cta_url: data.ctaUrl || null,
      sent_at: scheduled ? null : now,
      scheduled_for: scheduled ? scheduledTimestamp(data.scheduledFor) : null,
      status: scheduled ? 'scheduled' : 'sent',
      recipient_count: data.recipientCount || 0,
      read_count: 0,
      click_count: 0,
      updated_at: now,
    };
    const result = await supabase.from('announcements').insert(payload);
    ensure(result, 'Duyuru kaydedilemedi');
    await writeLog(scheduled ? 'Duyuru planlandı' : 'Duyuru gönderildi', payload.title, 'announcement');
  },

  async deleteAnnouncement(id: string) {
    const result = await supabase.from('announcements').delete().eq('id', id);
    ensure(result, 'Duyuru silinemedi');
    await writeLog('Duyuru silindi', id, 'announcement');
  },

  async saveSettings(settings: EventSettings) {
    const payload = {
      settings_key: 'default',
      event_name: settings.eventName,
      edition: settings.edition || null,
      event_dates: settings.eventDates,
      venue_name: settings.venueName,
      venue_address: settings.venueAddress || null,
      start_date: settings.startDate || null,
      end_date: settings.endDate || null,
      logo_url: settings.logoUrl || null,
      floor_plan_url: settings.floorPlanUrl || null,
      floor_plan_walls: settings.floorPlanWalls || [],
      opening_time: settings.openingTime,
      closing_time: settings.closingTime,
      location_tracking_start: settings.locationTrackingStart,
      location_tracking_end: settings.locationTrackingEnd,
      tracking_disclaimer: settings.trackingDisclaimer || null,
      default_language: settings.defaultLanguage,
      timezone: settings.timezone,
      auto_notify_schedule_changes: settings.autoNotifyScheduleChanges ?? true,
      enable_anonymous_zone_tracking: settings.enableAnonymousZoneTracking ?? true,
      require_check_in_qr: settings.requireCheckInQr ?? false,
      notification_triggers: settings.notificationTriggers,
      updated_at: new Date().toISOString(),
    };
    const result = await supabase
      .from('event_settings')
      .upsert(payload, { onConflict: 'settings_key' });
    ensure(result, 'Etkinlik ayarları kaydedilemedi');
    await writeLog('Etkinlik ayarları güncellendi', settings.eventName, 'system');
  },

  // Admin tarafından cihazdan seçilen bir kroki resmini Supabase Storage'a
  // yükler ve herkesin erişebileceği public bir URL döndürür (DB'ye
  // kaydetmez — çağıran taraf bu URL'i saveSettings ile ayarlara yazar).
  //
  // NOT: React Native'in fetch()'i yerel galeri URI'lerini (file://, content://)
  // güvenilir biçimde okuyamıyor — "Network request failed" hatasının sebebi bu
  // (bilinen bir RN/Expo kısıtı). Bu yüzden dosyayı fetch ile okumak yerine,
  // ImagePicker'dan doğrudan base64 olarak alıyoruz (bkz. AdminMapManagement.tsx
  // > handlePickFloorPlan, base64: true) ve burada saf JS ile binary'e çeviriyoruz
  // — expo-file-system gibi ek bir native modül/rebuild gerektirmiyor.
  async uploadFloorPlanImage(base64: string, mimeType?: string): Promise<string> {
    const bytes = decodeBase64(base64);
    const ext = mimeType?.split('/')[1]?.toLowerCase() || 'jpg';
    const path = `floor-plan-${Date.now()}.${ext}`;
    const uploadResult = await supabase.storage
      .from('floor-plans')
      .upload(path, bytes, { contentType: mimeType || `image/${ext}`, upsert: true });
    ensure(uploadResult, 'Kroki yüklenemedi');
    const { data } = supabase.storage.from('floor-plans').getPublicUrl(path);
    if (!data?.publicUrl) throw new Error('Kroki yüklendi ama bağlantı alınamadı.');
    return data.publicUrl;
  },
};
