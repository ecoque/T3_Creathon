export type AdminViewType =
  | 'dashboard'
  | 'program'
  | 'venues_and_stands'
  | 'stages' // alias
  | 'booths' // alias
  | 'map_management'
  | 'attendees'
  | 'announcements'
  | 'settings'
  | 'meals'
  | 'staff'
  | 'water_stations'
  | 'session_qr';

export type ProgramViewMode = 'list' | 'calendar';

export type SessionStatus = 'draft' | 'published' | 'live' | 'completed' | 'cancelled' | 'delayed';

export type SessionCategory =
  | 'Keynote'
  | 'Panel'
  | 'Workshop'
  | 'Pitch'
  | 'Networking'
  | 'Demo'
  | 'Ara'
  | 'Yemek'
  | 'Açılış'
  | 'Fireside Chat'
  | 'Diğer';

export interface AdminSpeaker {
  id: string;
  name: string;
  title: string;
  company: string;
  avatar?: string;
}

export interface AdminSession {
  id: string;
  startTimeIso?: string;
  endTimeIso?: string;
  day: string; // '24', '25', '26', '27'
  dayName: string; // 'Cum', 'Cmt', 'Paz', 'Pzt'
  dateStr: string; // '24 Ekim 2026'
  time: string; // '14:00'
  endTime: string; // '14:45'
  duration: string; // '45dk'
  category: SessionCategory;
  title: string;
  description: string;
  stageId: string;
  stageName: string;
  speakers: AdminSpeaker[];
  status: SessionStatus;
  delayMinutes?: number;
  capacity: number;
  bookmarkedCount: number;
  checkedInCount: number;
  tags: string[];
  coverImage?: string;
  isBookmarked?: boolean;
}

export interface AdminStage {
  id: string;
  name: string;
  type:
    | 'Main Stage'
    | 'AI Stage'
    | 'Startup Stage'
    | 'Workshop Area'
    | 'Networking Area'
    | 'Meeting Area'
    | 'Food Area'
    | 'Diğer';
  zone: 'Zone A' | 'Zone B' | 'Zone C' | 'Zone D';
  capacity: number;
  currentOccupancy: number;
  mapX: number; // 0-100%
  mapY: number; // 0-100%
  status: 'active' | 'maintenance' | 'closed';
  currentSessionId?: string;
  description: string;
}

export interface AdminBooth {
  id: string;
  boothNo: string; // 'A-101'
  companyName: string;
  category:
    | 'Yapay Zeka'
    | 'Fintech'
    | 'SaaS'
    | 'Sağlık Teknolojileri'
    | 'Oyun & Medya'
    | 'Sürdürülebilirlik'
    | 'Donanım & IoT'
    | 'Yatırım / VC';
  description: string;
  logo: string;
  // null ise stant henüz krokiye (etkinlik alanı yerleşim planı) yerleştirilmemiş
  // demektir — bkz. lib/boothGrid.ts > isBoothPlaced.
  zone: 'Zone A' | 'Zone B' | 'Zone C' | 'Zone D' | null;
  sponsorTier: 'Platinum' | 'Gold' | 'Silver' | 'Startup' | 'Partner';
  mapX: number; // 0-100% — krokideki serbest konum (admin tarafından dokunularak atanır)
  mapY: number; // 0-100% — krokideki serbest konum (admin tarafından dokunularak atanır)
  status: 'active' | 'passive' | 'reserved';
  contactPerson: string;
  contactEmail: string;
  qrCodeUrl?: string;
  totalVisits: number;
}

export interface AdminAnnouncement {
  id: string;
  title: string;
  message: string;
  targetAudience:
    | 'Tüm Katılımcılar'
    | 'Girişimciler'
    | 'Yatırımcılar'
    | 'Kurum / Partner'
    | 'Ziyaretçiler'
    | 'Oturumu Kaydedenler'
    | 'Zone Bazlı Kullanıcılar';
  targetZone?: string;
  targetSessionId?: string;
  targetBoothId?: string;
  ctaText?: string;
  ctaUrl?: string;
  sentAt?: string;
  scheduledFor?: string;
  status: 'sent' | 'scheduled' | 'draft';
  recipientCount: number;
  readCount: number;
  clickCount: number;
}

export interface ZoneDensityInfo {
  id: string;
  name: string;
  code: 'Zone A' | 'Zone B' | 'Zone C' | 'Zone D';
  activeAttendees: number;
  capacity: number;
  densityLevel: 'Düşük' | 'Normal' | 'Orta' | 'Yoğun';
  densityPercent: number;
  peakAttendees: number;
  avgAttendees: number;
  description: string;
  color: string;
  // Bölgenin gerçek dünyadaki konumu: merkez GPS noktası + metre cinsinden yarıçap.
  // İkisi de null ise bölge henüz haritada tanımlanmamış demektir; bu durumda
  // activeAttendees, location_pings'ten değil admin tarafından girilen sayıdan gelir.
  centerLat: number | null;
  centerLng: number | null;
  radiusMeters: number;
}

// 'Görevli' (staff) is admin-assigned only — it never appears in the
// onboarding role picker (bkz. app/onboarding/index.tsx), only in this admin
// attendee editor's role dropdown (bkz. AdminWorkspaceModals.tsx).
export type AttendeeRole = 'Girişimci' | 'Yatırımcı' | 'Kurum / Partner' | 'Ziyaretçi' | 'Görevli';
export type AttendeeStatus = 'active' | 'passive';

export interface AdminAttendee {
  id: string;
  firstName: string;
  lastName: string;
  name: string;
  title: string;
  position: string;
  company: string;
  role: AttendeeRole;
  sector: string;
  interests: string[];
  avatar?: string;
  email: string;
  phone: string;
  linkedin?: string;
  status: AttendeeStatus;
  agendaCount?: number;
  meetingsCount?: number;
  checkInCount?: number;
  lastActive?: string;
  currentZone?: string;
  badgeScanned?: boolean;
  notes?: string;
  createdAt?: string;
}

export interface AdminMeetingRecord {
  id: string;
  date: string;
  timeSlot: string;
  participantA: {
    id: string;
    name: string;
    role: string;
    company: string;
    avatar?: string;
  };
  participantB: {
    id: string;
    name: string;
    role: string;
    company: string;
    avatar?: string;
  };
  tableLocation: string; // 'B2B Lounge Masa 04'
  status: 'pending' | 'accepted' | 'declined' | 'completed' | 'no-show';
  note?: string;
}

export interface AdminLogItem {
  id: string;
  timestamp: string;
  adminName: string;
  action: string;
  target: string;
  type: 'session' | 'stage' | 'booth' | 'zone' | 'announcement' | 'system';
}

// Admin'in krokiye elle çizdiği bir duvar çizgisi — iki uç nokta, krokideki
// yüzde (0-100) koordinat sisteminde. Rota bulma algoritması (bkz.
// lib/routePlanner.ts) bunları stant/sahne gibi birer engel sayıp
// etraflarından dolanıyor. Her kroki fotoğrafı farklı olduğu için bu
// çizgiler otomatik değil, admin tarafından krokiyi yükledikten sonra bir
// kere elle işaretleniyor (bkz. AdminMapManagement.tsx > duvar çizme modu).
export interface FloorPlanWall {
  id: string;
  x1: number;
  y1: number;
  x2: number;
  y2: number;
}

export interface EventSettings {
  eventName: string;
  edition?: string;
  eventDates: string;
  venueName: string;
  venueAddress?: string;
  // Admin tarafından yüklenen gerçek etkinlik alanı krokisi (fotoğraf/çizim).
  // Harita Yönetimi ekranında arka plan olarak gösterilir. Henüz
  // yüklenmediyse undefined — bu durumda soyut zone görünümü kullanılır.
  floorPlanUrl?: string;
  // Krokiye admin tarafından elle çizilmiş duvar çizgileri — bkz. FloorPlanWall.
  floorPlanWalls: FloorPlanWall[];
  startDate?: string;
  endDate?: string;
  logoUrl?: string;
  openingTime: string;
  closingTime: string;
  locationTrackingStart: string;
  locationTrackingEnd: string;
  trackingDisclaimer?: string;
  defaultLanguage: 'tr' | 'en';
  timezone: string;
  autoNotifyScheduleChanges?: boolean;
  enableAnonymousZoneTracking?: boolean;
  requireCheckInQr?: boolean;
  notificationTriggers: {
    autoSessionReminders: boolean;
    autoCapacityAlerts: boolean;
    autoMeetingReminders: boolean;
  };
}

export type EventSettingsState = EventSettings;
