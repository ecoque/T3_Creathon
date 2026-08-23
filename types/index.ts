export type ParticipantRole = 'girisimci' | 'yatirimci' | 'kurum' | 'ziyaretci';

export type MeetingStatus = 'pending' | 'accepted' | 'rejected';

// is_admin, katılımcı rolünden (ParticipantRole) tamamen ayrı bir yetki bayrağıdır;
// stant pin yönetimi gibi sahne arkası aksiyonlar için kullanılır.
export interface User {
  id: string;
  email: string;
  is_admin: boolean;
  created_at: string;
}

export interface Profile {
  id: string;
  user_id: string;
  full_name: string;
  photo_url?: string;
  linkedin_url?: string;
  role: ParticipantRole;
  sector: string;
  interests: string[];
  goals: string[];
  status?: 'active' | 'passive';
}

export interface Session {
  id: string;
  title: string;
  description?: string;
  start_time: string;
  end_time: string;
  location?: string;
}

export interface MeetingRequest {
  id: string;
  from_user_id: string;
  to_user_id: string;
  status: MeetingStatus;
  proposed_time?: string;
  created_at: string;
}

export interface Badge {
  id: string;
  user_id: string;
  name: string;
  awarded_at: string;
}

export interface CheckIn {
  id: string;
  user_id: string;
  target_type: 'session' | 'stand';
  target_id: string;
  checked_in_at: string;
}

export interface Stand {
  id: string;
  name: string;
  lat: number;
  lng: number;
  type: string;
  sponsor?: string;
  zone_id: string;
}

export interface Zone {
  id: string;
  name: string;
  // Kaba bölge tanımı: basit poligon köşe noktaları [lat, lng][]
  polygon: [number, number][];
}

export interface LocationPing {
  id: string;
  user_id: string;
  lat: number;
  lng: number;
  accuracy: number;
  timestamp: string;
}

// Aşağıdaki tipler sadece harita görselleştirmesi için kullanılan, henüz backend
// şemasına (zones/stands) bağlanmamış statik UI verisidir (bkz. constants/venuePoints.ts).
export type VenueDensity = 'Sakin' | 'Normal' | 'Yoğun';

export interface VenuePoint {
  id: string;
  name: string;
  type: 'stage' | 'networking' | 'service' | 'food';
  floor: 1 | 2;
  x: number; // 0-100 arası yüzde konum
  y: number; // 0-100 arası yüzde konum
  density: VenueDensity;
  description: string;
  currentEvent?: string;
}
