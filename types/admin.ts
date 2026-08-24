export type AdminViewType =
  | 'dashboard'
  | 'program'
  | 'venues_and_stands'
  | 'stages' // alias
  | 'booths' // alias
  | 'map_management'
  | 'attendees'
  | 'announcements'
  | 'settings';

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
  zone: 'Zone A' | 'Zone B' | 'Zone C' | 'Zone D';
  sponsorTier: 'Platinum' | 'Gold' | 'Silver' | 'Startup' | 'Partner';
  mapX: number; // 0-100%
  mapY: number; // 0-100%
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
}

export type AttendeeRole = 'Girişimci' | 'Yatırımcı' | 'Kurum / Partner' | 'Ziyaretçi';
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
  type: 'session' | 'stage' | 'booth' | 'announcement' | 'system';
}

export interface EventSettings {
  eventName: string;
  edition?: string;
  eventDates: string;
  venueName: string;
  venueAddress?: string;
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
