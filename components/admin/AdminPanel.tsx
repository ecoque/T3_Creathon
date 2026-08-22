import { useQueryClient } from '@tanstack/react-query';
import { router } from 'expo-router';
import {
  Activity,
  Bell,
  CalendarDays,
  ChevronRight,
  CircleAlert,
  Clock3,
  Handshake,
  LayoutDashboard,
  LogOut,
  Map as MapIcon,
  MapPin,
  Megaphone,
  Menu,
  Navigation,
  Plus,
  RefreshCw,
  Search,
  Settings,
  ShieldCheck,
  Smartphone,
  Store,
  Users,
  X,
} from 'lucide-react-native';
import { useEffect, useMemo, useState, type ComponentType } from 'react';
import {
  ActivityIndicator,
  Image,
  Modal,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  useWindowDimensions,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { AdminSessionEditor, AdminStandEditor } from './AdminEditorModals';
import { TakeOffLogo } from '../TakeOffLogo';
import { colors } from '../../constants/theme';
import { venuePoints } from '../../constants/venuePoints';
import { supabase } from '../../lib/supabase';
import { useAdminData } from '../../lib/useAdminData';
import type { ParticipantRole, Session, Stand } from '../../types';

type AdminView =
  'dashboard' | 'program' | 'venues' | 'map' | 'attendees' | 'announcements' | 'settings';

type NavIcon = ComponentType<{ size?: number; color?: string }>;
type Announcement = {
  id: string;
  title: string;
  message: string;
  audience: string;
  status: 'Taslak' | 'Planlandı';
};

const ROLE_LABELS: Record<ParticipantRole, string> = {
  girisimci: 'Girişimci',
  yatirimci: 'Yatırımcı',
  kurum: 'Kurum / Partner',
  ziyaretci: 'Ziyaretçi',
};

const NAV_ITEMS: { id: AdminView; label: string; icon: NavIcon }[] = [
  { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { id: 'program', label: 'Program', icon: CalendarDays },
  { id: 'venues', label: 'Alan & Stantlar', icon: Store },
  { id: 'map', label: 'Harita', icon: MapIcon },
  { id: 'attendees', label: 'Katılımcılar', icon: Users },
  { id: 'announcements', label: 'Duyurular', icon: Megaphone },
  { id: 'settings', label: 'Etkinlik Ayarları', icon: Settings },
];

const INITIAL_ANNOUNCEMENTS: Announcement[] = [
  {
    id: 'announcement-1',
    title: 'Program güncellemesi',
    message: 'Ana Sahne programındaki güncellemeleri uygulama üzerinden takip edebilirsiniz.',
    audience: 'Tüm Katılımcılar',
    status: 'Taslak',
  },
  {
    id: 'announcement-2',
    title: 'Networking alanı hatırlatması',
    message: 'B2B görüşmeleri ikinci kattaki yatırımcı lounge alanında devam ediyor.',
    audience: 'Girişimciler ve Yatırımcılar',
    status: 'Planlandı',
  },
];

function initialsFor(name?: string) {
  if (!name) return '?';
  return name
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join('');
}

function formatDateTime(iso: string) {
  const date = new Date(iso);
  return `${date.toLocaleDateString('tr-TR', { day: '2-digit', month: 'short' })} · ${date.toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' })}`;
}

function sessionStatus(session: Session) {
  const now = Date.now();
  const start = new Date(session.start_time).getTime();
  const end = new Date(session.end_time).getTime();
  if (start <= now && end >= now)
    return { label: 'CANLI', color: colors.danger, bg: colors.dangerBg };
  if (end < now) return { label: 'TAMAMLANDI', color: colors.textMuted, bg: colors.surfaceHigh };
  return { label: 'YAYINDA', color: colors.success, bg: colors.successBg };
}

function PageHeading({
  title,
  subtitle,
  action,
  onAction,
}: {
  title: string;
  subtitle: string;
  action?: string;
  onAction?: () => void;
}) {
  return (
    <View style={styles.pageHeading}>
      <View style={{ flex: 1 }}>
        <Text style={styles.pageTitle}>{title}</Text>
        <Text style={styles.pageSubtitle}>{subtitle}</Text>
      </View>
      {action && onAction ? (
        <Pressable style={styles.primaryButton} onPress={onAction}>
          <Plus size={15} color={colors.white} />
          <Text style={styles.primaryButtonText}>{action}</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

function SearchBox({
  value,
  onChangeText,
  placeholder,
}: {
  value: string;
  onChangeText: (value: string) => void;
  placeholder: string;
}) {
  return (
    <View style={styles.searchBox}>
      <Search size={16} color={colors.textMuted} />
      <TextInput
        style={styles.searchInput}
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={colors.textFaint}
      />
      {value ? (
        <Pressable onPress={() => onChangeText('')}>
          <X size={15} color={colors.textFaint} />
        </Pressable>
      ) : null}
    </View>
  );
}

function Metric({
  icon: Icon,
  value,
  label,
  note,
  wide,
  accent = colors.primary,
}: {
  icon: NavIcon;
  value: number;
  label: string;
  note: string;
  wide: boolean;
  accent?: string;
}) {
  return (
    <View style={[styles.metric, { width: wide ? '31.8%' : '48.2%' }]}>
      <View style={[styles.metricIcon, { backgroundColor: `${accent}18` }]}>
        <Icon size={18} color={accent} />
      </View>
      <Text style={styles.metricValue}>{value}</Text>
      <Text style={styles.metricLabel}>{label}</Text>
      <Text style={styles.metricNote}>{note}</Text>
    </View>
  );
}

function Empty({ title, body }: { title: string; body: string }) {
  return (
    <View style={styles.emptyCard}>
      <CircleAlert size={20} color={colors.textMuted} />
      <Text style={styles.emptyTitle}>{title}</Text>
      <Text style={styles.emptyBody}>{body}</Text>
    </View>
  );
}

export function AdminPanel() {
  const { width } = useWindowDimensions();
  const wide = width >= 960;
  const queryClient = useQueryClient();
  const { data, isLoading, isRefetching, error, refetch } = useAdminData();
  const [view, setView] = useState<AdminView>('dashboard');
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [sessionEditorOpen, setSessionEditorOpen] = useState(false);
  const [editingSession, setEditingSession] = useState<Session | null>(null);
  const [standEditorOpen, setStandEditorOpen] = useState(false);
  const [editingStand, setEditingStand] = useState<Stand | null>(null);
  const [announcements, setAnnouncements] = useState(INITIAL_ANNOUNCEMENTS);
  const [announcementModal, setAnnouncementModal] = useState(false);
  const [announcementTitle, setAnnouncementTitle] = useState('');
  const [announcementMessage, setAnnouncementMessage] = useState('');
  const [toast, setToast] = useState<string | null>(null);
  const [trackingEnabled, setTrackingEnabled] = useState(false);
  const [autoReminders, setAutoReminders] = useState(true);

  useEffect(() => setSearch(''), [view]);

  function navigate(next: AdminView) {
    setView(next);
    setDrawerOpen(false);
  }

  function showToast(message: string) {
    setToast(message);
    setTimeout(() => setToast(null), 2800);
  }

  async function logout() {
    await supabase.auth.signOut();
    queryClient.clear();
    router.replace('/auth');
  }

  function openNewSession() {
    setEditingSession(null);
    setSessionEditorOpen(true);
  }

  function openNewStand() {
    setEditingStand(null);
    setStandEditorOpen(true);
  }

  function saveAnnouncement() {
    if (!announcementTitle.trim() || !announcementMessage.trim()) return;
    setAnnouncements((current) => [
      {
        id: `announcement-${Date.now()}`,
        title: announcementTitle.trim(),
        message: announcementMessage.trim(),
        audience: 'Tüm Katılımcılar',
        status: 'Taslak',
      },
      ...current,
    ]);
    setAnnouncementTitle('');
    setAnnouncementMessage('');
    setAnnouncementModal(false);
    showToast('Duyuru taslağı oluşturuldu.');
  }

  const profiles = data?.profiles ?? [];
  const sessions = data?.sessions ?? [];
  const stands = data?.stands ?? [];
  const zones = data?.zones ?? [];
  const usersById = useMemo(
    () => new Map((data?.users ?? []).map((user) => [user.id, user])),
    [data?.users],
  );
  const now = Date.now();
  const liveSessions = sessions.filter(
    (item) =>
      new Date(item.start_time).getTime() <= now && new Date(item.end_time).getTime() >= now,
  );
  const upcoming = sessions.filter((item) => new Date(item.start_time).getTime() > now).slice(0, 5);
  const activeLabel = NAV_ITEMS.find((item) => item.id === view)?.label ?? 'Dashboard';

  function dashboard() {
    return (
      <View style={styles.stack}>
        <View style={styles.hero}>
          <View style={{ flex: 1 }}>
            <View style={styles.livePill}>
              <Activity size={12} color="#34d399" />
              <Text style={styles.livePillText}>OPERASYON MERKEZİ</Text>
            </View>
            <Text style={styles.heroTitle}>Take Off İstanbul 2026</Text>
            <Text style={styles.heroSubtitle}>24–27 Ekim · Lütfi Kırdar ICEC</Text>
          </View>
          <View style={styles.heroStatus}>
            <Text style={styles.heroStatusValue}>{liveSessions.length}</Text>
            <Text style={styles.heroStatusLabel}>canlı oturum</Text>
          </View>
        </View>
        <View style={styles.metricGrid}>
          <Metric
            wide={wide}
            icon={Users}
            value={profiles.length}
            label="Katılımcı"
            note="Kayıtlı profil"
          />
          <Metric
            wide={wide}
            icon={CalendarDays}
            value={sessions.length}
            label="Oturum"
            note="Toplam program"
            accent={colors.success}
          />
          <Metric
            wide={wide}
            icon={Store}
            value={stands.length}
            label="Stant"
            note="Tanımlı stant"
            accent={colors.accent}
          />
          <Metric
            wide={wide}
            icon={MapIcon}
            value={zones.length}
            label="Bölge"
            note="Etkinlik alanı"
            accent={colors.secondaryDark}
          />
          <Metric
            wide={wide}
            icon={Handshake}
            value={data?.meetingRequests.length ?? 0}
            label="Toplantı"
            note="Yetkinizin gördüğü"
            accent="#7c3aed"
          />
          <Metric
            wide={wide}
            icon={ShieldCheck}
            value={data?.checkins.length ?? 0}
            label="Check-in"
            note="Yetkinizin gördüğü"
            accent="#0f766e"
          />
        </View>
        <View style={[styles.columns, wide && styles.columnsWide]}>
          <View style={[styles.panel, { flex: 1.35 }]}>
            <View style={styles.panelHeader}>
              <View>
                <Text style={styles.panelTitle}>Yaklaşan Oturumlar</Text>
                <Text style={styles.panelSubtitle}>Programın sıradaki akışı</Text>
              </View>
              <Pressable onPress={() => navigate('program')}>
                <Text style={styles.link}>Tümünü Gör</Text>
              </Pressable>
            </View>
            {upcoming.length ? (
              upcoming.slice(0, 3).map((item) => (
                <Pressable
                  key={item.id}
                  style={styles.compactRow}
                  onPress={() => {
                    setEditingSession(item);
                    setSessionEditorOpen(true);
                  }}
                >
                  <View style={styles.timeBadge}>
                    <Text style={styles.timeBadgeText}>
                      {new Date(item.start_time).toLocaleTimeString('tr-TR', {
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </Text>
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.rowTitle} numberOfLines={1}>
                      {item.title}
                    </Text>
                    <Text style={styles.rowSub}>
                      {item.location || 'Salon belirtilmedi'} · {formatDateTime(item.start_time)}
                    </Text>
                  </View>
                  <ChevronRight size={17} color={colors.textFaint} />
                </Pressable>
              ))
            ) : (
              <Empty
                title="Yaklaşan oturum yok"
                body="Yeni bir oturum ekleyerek programı oluşturabilirsiniz."
              />
            )}
          </View>
          <View style={[styles.panel, { flex: 1 }]}>
            <View style={styles.panelHeader}>
              <View>
                <Text style={styles.panelTitle}>Operasyon Uyarıları</Text>
                <Text style={styles.panelSubtitle}>Sistem ve saha notları</Text>
              </View>
              <Bell size={17} color={colors.primary} />
            </View>
            {data?.warnings.length ? (
              data.warnings.map((warning) => (
                <View key={warning} style={styles.warning}>
                  <CircleAlert size={16} color={colors.danger} />
                  <Text style={styles.warningText}>{warning}</Text>
                </View>
              ))
            ) : (
              <View style={styles.success}>
                <ShieldCheck size={18} color={colors.success} />
                <View style={{ flex: 1 }}>
                  <Text style={styles.successTitle}>Sistemler normal</Text>
                  <Text style={styles.successBody}>
                    Admin veri kaynaklarında aktif hata görünmüyor.
                  </Text>
                </View>
              </View>
            )}
            <Pressable style={styles.secondaryButton} onPress={() => refetch()}>
              <RefreshCw size={15} color={colors.textMuted} />
              <Text style={styles.secondaryButtonText}>Verileri Yenile</Text>
            </Pressable>
          </View>
        </View>
      </View>
    );
  }

  function program() {
    const query = search.toLowerCase();
    const filtered = sessions.filter((item) =>
      `${item.title} ${item.location ?? ''} ${item.description ?? ''}`
        .toLowerCase()
        .includes(query),
    );
    return (
      <View style={styles.stack}>
        <PageHeading
          title="Program Yönetimi"
          subtitle="Oturumları, yayın akışını ve salonları yönetin."
          action="Yeni Oturum"
          onAction={openNewSession}
        />
        <SearchBox value={search} onChangeText={setSearch} placeholder="Oturum veya salon ara…" />
        {filtered.length ? (
          filtered.map((item) => {
            const status = sessionStatus(item);
            return (
              <Pressable
                key={item.id}
                style={styles.entityCard}
                onPress={() => {
                  setEditingSession(item);
                  setSessionEditorOpen(true);
                }}
              >
                <View style={styles.entityIcon}>
                  <CalendarDays size={19} color={colors.primary} />
                </View>
                <View style={{ flex: 1, gap: 5 }}>
                  <View style={styles.titleRow}>
                    <Text style={styles.entityTitle}>{item.title}</Text>
                    <View style={[styles.statusPill, { backgroundColor: status.bg }]}>
                      <Text style={[styles.statusText, { color: status.color }]}>
                        {status.label}
                      </Text>
                    </View>
                  </View>
                  <View style={styles.metaRow}>
                    <Clock3 size={12} color={colors.textFaint} />
                    <Text style={styles.metaText}>{formatDateTime(item.start_time)}</Text>
                    {item.location ? <MapPin size={12} color={colors.textFaint} /> : null}
                    {item.location ? <Text style={styles.metaText}>{item.location}</Text> : null}
                  </View>
                  {item.description ? (
                    <Text style={styles.description} numberOfLines={2}>
                      {item.description}
                    </Text>
                  ) : null}
                </View>
                <ChevronRight size={18} color={colors.textFaint} />
              </Pressable>
            );
          })
        ) : (
          <Empty
            title="Oturum bulunamadı"
            body="Aramayı değiştirin veya yeni bir oturum ekleyin."
          />
        )}
      </View>
    );
  }

  function venues() {
    const query = search.toLowerCase();
    const filtered = stands.filter((item) =>
      `${item.name} ${item.type} ${item.sponsor ?? ''}`.toLowerCase().includes(query),
    );
    return (
      <View style={styles.stack}>
        <PageHeading
          title="Alan & Stantlar"
          subtitle="Sahne, bölge ve katılımcı stantlarını yönetin."
          action="Yeni Stant"
          onAction={openNewStand}
        />
        <SearchBox
          value={search}
          onChangeText={setSearch}
          placeholder="Stant, kategori veya sponsor ara…"
        />
        {zones.length ? (
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.horizontalCards}
          >
            {zones.map((zone) => (
              <View key={zone.id} style={styles.zoneCard}>
                <View style={styles.zoneIcon}>
                  <MapIcon size={18} color={colors.secondaryDark} />
                </View>
                <Text style={styles.rowTitle}>{zone.name}</Text>
                <Text style={styles.rowSub}>
                  {stands.filter((item) => item.zone_id === zone.id).length} stant bağlı
                </Text>
              </View>
            ))}
          </ScrollView>
        ) : null}
        <View style={styles.tileGrid}>
          {filtered.map((item) => (
            <Pressable
              key={item.id}
              style={[styles.standCard, { width: wide ? '48.8%' : '100%' }]}
              onPress={() => {
                setEditingStand(item);
                setStandEditorOpen(true);
              }}
            >
              <View style={styles.standIcon}>
                <Store size={20} color={colors.primary} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.entityTitle}>{item.name}</Text>
                <Text style={styles.rowSub}>
                  {item.type}
                  {item.sponsor ? ` · ${item.sponsor}` : ''}
                </Text>
                <Text style={styles.coordinate}>
                  {item.lat.toFixed(4)}, {item.lng.toFixed(4)}
                </Text>
              </View>
              <ChevronRight size={18} color={colors.textFaint} />
            </Pressable>
          ))}
        </View>
        {!filtered.length ? (
          <Empty
            title="Stant bulunamadı"
            body="Supabase stands tablosuna ilk standı ekleyebilirsiniz."
          />
        ) : null}
      </View>
    );
  }

  function map() {
    return (
      <View style={styles.stack}>
        <PageHeading
          title="Harita Yönetimi"
          subtitle="Salonları, servis noktalarını ve yoğunluk bilgisini kontrol edin."
        />
        <View style={styles.adminMap}>
          <View style={[styles.gridLineV, { left: '33%' }]} />
          <View style={[styles.gridLineV, { left: '66%' }]} />
          <View style={[styles.gridLineH, { top: '33%' }]} />
          <View style={[styles.gridLineH, { top: '66%' }]} />
          {venuePoints.map((point) => (
            <View
              key={point.id}
              style={[styles.mapPin, { left: `${point.x}%`, top: `${point.y}%` }]}
            >
              <MapPin size={13} color={colors.white} />
            </View>
          ))}
          <View style={styles.mapLegend}>
            <Text style={styles.rowTitle}>Canlı Alan Görünümü</Text>
            <Text style={styles.rowSub}>
              {venuePoints.length} nokta · {stands.length} Supabase standı
            </Text>
          </View>
        </View>
        <View style={styles.tileGrid}>
          {venuePoints.map((point) => (
            <View key={point.id} style={[styles.locationCard, { width: wide ? '48.8%' : '100%' }]}>
              <View
                style={[
                  styles.densityDot,
                  {
                    backgroundColor:
                      point.density === 'Yoğun'
                        ? colors.danger
                        : point.density === 'Normal'
                          ? colors.accent
                          : colors.success,
                  },
                ]}
              />
              <View style={{ flex: 1 }}>
                <Text style={styles.rowTitle}>{point.name}</Text>
                <Text style={styles.rowSub}>
                  {point.floor}. Kat · {point.density}
                </Text>
              </View>
              <Navigation size={16} color={colors.textFaint} />
            </View>
          ))}
        </View>
      </View>
    );
  }

  function attendees() {
    const query = search.toLowerCase();
    const filtered = profiles.filter((profile) =>
      `${profile.full_name} ${profile.sector ?? ''} ${profile.interests.join(' ')} ${usersById.get(profile.user_id)?.email ?? ''}`
        .toLowerCase()
        .includes(query),
    );
    return (
      <View style={styles.stack}>
        <PageHeading
          title="Katılımcılar"
          subtitle="Kayıtlı profilleri, rolleri ve eşleşme bilgilerini görüntüleyin."
        />
        <SearchBox
          value={search}
          onChangeText={setSearch}
          placeholder="İsim, e-posta, sektör veya ilgi alanı ara…"
        />
        {filtered.map((profile) => (
          <View key={profile.id} style={styles.attendeeCard}>
            {profile.photo_url ? (
              <Image source={{ uri: profile.photo_url }} style={styles.avatar} />
            ) : (
              <View style={[styles.avatar, styles.avatarFallback]}>
                <Text style={styles.avatarText}>{initialsFor(profile.full_name)}</Text>
              </View>
            )}
            <View style={{ flex: 1 }}>
              <View style={styles.titleRow}>
                <Text style={styles.entityTitle}>{profile.full_name}</Text>
                <View style={styles.rolePill}>
                  <Text style={styles.roleText}>{ROLE_LABELS[profile.role]}</Text>
                </View>
              </View>
              <Text style={styles.rowSub}>{profile.sector || 'Sektör belirtilmedi'}</Text>
              <Text style={styles.email}>
                {usersById.get(profile.user_id)?.email ?? 'E-posta bilgisi yok'}
              </Text>
            </View>
          </View>
        ))}
        {!filtered.length ? (
          <Empty title="Katılımcı bulunamadı" body="Arama kriterini değiştirerek tekrar deneyin." />
        ) : null}
      </View>
    );
  }

  function announcementView() {
    return (
      <View style={styles.stack}>
        <PageHeading
          title="Duyurular"
          subtitle="Katılımcı segmentlerine gönderilecek mesajları hazırlayın."
          action="Yeni Duyuru"
          onAction={() => setAnnouncementModal(true)}
        />
        <View style={styles.infoBanner}>
          <CircleAlert size={17} color={colors.primary} />
          <Text style={styles.infoText}>
            Duyuru tablosu henüz Supabase şemasında bulunmadığı için taslaklar yalnızca açık
            oturumda saklanır; gerçek gönderim yapılmaz.
          </Text>
        </View>
        {announcements.map((item) => (
          <View key={item.id} style={styles.announcementCard}>
            <View style={styles.entityIcon}>
              <Megaphone size={18} color={colors.primary} />
            </View>
            <View style={{ flex: 1 }}>
              <View style={styles.titleRow}>
                <Text style={styles.entityTitle}>{item.title}</Text>
                <View style={styles.rolePill}>
                  <Text style={styles.roleText}>{item.status}</Text>
                </View>
              </View>
              <Text style={styles.description}>{item.message}</Text>
              <Text style={styles.rowSub}>{item.audience}</Text>
            </View>
          </View>
        ))}
      </View>
    );
  }

  function settingsView() {
    return (
      <View style={styles.stack}>
        <PageHeading
          title="Etkinlik Ayarları"
          subtitle="Etkinlik kimliği, izinler ve otomatik operasyon tercihleri."
        />
        <View style={styles.panel}>
          <Text style={styles.panelTitle}>Etkinlik Bilgileri</Text>
          {[
            ['Etkinlik', 'Take Off İstanbul 2026'],
            ['Tarih', '24–27 Ekim 2026'],
            ['Mekân', 'Lütfi Kırdar ICEC'],
            ['Saat dilimi', 'Europe/Istanbul'],
          ].map(([label, value], index) => (
            <View key={label}>
              {index ? <View style={styles.divider} /> : null}
              <View style={styles.settingRow}>
                <Text style={styles.settingLabel}>{label}</Text>
                <Text style={styles.settingValue}>{value}</Text>
              </View>
            </View>
          ))}
        </View>
        <View style={styles.panel}>
          <Text style={styles.panelTitle}>Otomasyon ve Gizlilik</Text>
          <View style={styles.toggleRow}>
            <View style={{ flex: 1 }}>
              <Text style={styles.toggleTitle}>Oturum hatırlatmaları</Text>
              <Text style={styles.toggleBody}>Kayıtlı katılımcılara otomatik uyarı gönder.</Text>
            </View>
            <Switch
              value={autoReminders}
              onValueChange={setAutoReminders}
              trackColor={{ true: colors.primary, false: colors.surfaceHigh }}
              thumbColor={colors.white}
            />
          </View>
          <View style={styles.divider} />
          <View style={styles.toggleRow}>
            <View style={{ flex: 1 }}>
              <Text style={styles.toggleTitle}>Anonim bölge takibi</Text>
              <Text style={styles.toggleBody}>
                Yalnızca açık rıza veren cihazların yoğunluk verisini işle.
              </Text>
            </View>
            <Switch
              value={trackingEnabled}
              onValueChange={setTrackingEnabled}
              trackColor={{ true: colors.primary, false: colors.surfaceHigh }}
              thumbColor={colors.white}
            />
          </View>
          <View style={styles.infoBanner}>
            <CircleAlert size={17} color={colors.primary} />
            <Text style={styles.infoText}>
              Backend ayar tablosu bulunmadığından bu tercihler kalıcı değildir.
            </Text>
          </View>
        </View>
      </View>
    );
  }

  function content() {
    if (isLoading)
      return (
        <View style={styles.loading}>
          <ActivityIndicator color={colors.primary} />
          <Text style={styles.pageSubtitle}>Admin verileri yükleniyor…</Text>
        </View>
      );
    if (error)
      return (
        <Empty
          title="Admin verileri alınamadı"
          body={error instanceof Error ? error.message : String(error)}
        />
      );
    if (view === 'dashboard') return dashboard();
    if (view === 'program') return program();
    if (view === 'venues') return venues();
    if (view === 'map') return map();
    if (view === 'attendees') return attendees();
    if (view === 'announcements') return announcementView();
    return settingsView();
  }

  const sidebar = (
    <View style={[styles.sidebar, !wide && styles.drawer]}>
      <View style={styles.brandRow}>
        <TakeOffLogo size="md" />
        {!wide ? (
          <Pressable style={styles.iconButton} onPress={() => setDrawerOpen(false)}>
            <X size={20} color={colors.text} />
          </Pressable>
        ) : null}
      </View>
      <View style={styles.adminIdentity}>
        <View style={styles.adminAvatar}>
          <ShieldCheck size={18} color={colors.primary} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={styles.adminName}>Etkinlik Koordinatörü</Text>
          <Text style={styles.adminRole}>ADMIN PANELİ</Text>
        </View>
      </View>
      <ScrollView contentContainerStyle={styles.navList}>
        {NAV_ITEMS.map((item) => {
          const Icon = item.icon;
          const selected = item.id === view;
          return (
            <Pressable
              key={item.id}
              style={[styles.navItem, selected && styles.navItemActive]}
              onPress={() => navigate(item.id)}
            >
              <Icon size={18} color={selected ? colors.primary : colors.textMuted} />
              <Text style={[styles.navText, selected && styles.navTextActive]}>{item.label}</Text>
            </Pressable>
          );
        })}
      </ScrollView>
      <Pressable style={styles.previewButton} onPress={() => router.replace('/(tabs)/home')}>
        <Smartphone size={17} color={colors.secondaryDark} />
        <Text style={styles.previewText}>Mobil Uygulamayı Önizle</Text>
      </Pressable>
      <Pressable style={styles.logoutButton} onPress={logout}>
        <LogOut size={17} color={colors.danger} />
        <Text style={styles.logoutText}>Admin Oturumunu Kapat</Text>
      </Pressable>
    </View>
  );

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      <View style={[styles.frame, wide && styles.frameWide]}>
        {wide ? sidebar : null}
        <View style={styles.main}>
          <View style={styles.topBar}>
            {!wide ? (
              <Pressable style={styles.iconButton} onPress={() => setDrawerOpen(true)}>
                <Menu size={21} color={colors.text} />
              </Pressable>
            ) : null}
            {!wide ? <TakeOffLogo size="sm" /> : null}
            <View style={[styles.eventContext, !wide && { marginLeft: 'auto' }]}>
              <Text style={styles.contextLabel}>{activeLabel}</Text>
              {wide ? (
                <Text style={styles.contextTitle}>Take Off İstanbul 2026 · 24–27 Ekim</Text>
              ) : null}
            </View>
            <Pressable style={styles.systemStatus} onPress={() => refetch()}>
              {isRefetching ? (
                <ActivityIndicator size="small" color={colors.success} />
              ) : (
                <View style={styles.onlineDot} />
              )}
              {wide ? (
                <Text style={styles.systemStatusText}>
                  {isRefetching ? 'Yenileniyor' : 'Sistem Aktif'}
                </Text>
              ) : null}
            </Pressable>
          </View>
          {!wide ? (
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              style={styles.mobileNav}
              contentContainerStyle={styles.mobileNavContent}
            >
              {NAV_ITEMS.map((item) => {
                const Icon = item.icon;
                const selected = item.id === view;
                return (
                  <Pressable
                    key={item.id}
                    style={[styles.mobileNavItem, selected && styles.mobileNavItemActive]}
                    onPress={() => navigate(item.id)}
                  >
                    <Icon size={15} color={selected ? colors.white : colors.textMuted} />
                    <Text style={[styles.mobileNavText, selected && styles.mobileNavTextActive]}>
                      {item.label}
                    </Text>
                  </Pressable>
                );
              })}
            </ScrollView>
          ) : null}
          <ScrollView
            style={styles.contentScroll}
            contentContainerStyle={styles.contentContainer}
            refreshControl={
              <RefreshControl
                refreshing={isRefetching}
                onRefresh={refetch}
                tintColor={colors.primary}
              />
            }
          >
            {toast ? (
              <View style={styles.toast}>
                <ShieldCheck size={16} color="#34d399" />
                <Text style={styles.toastText}>{toast}</Text>
              </View>
            ) : null}
            {content()}
          </ScrollView>
        </View>
      </View>

      {!wide && drawerOpen ? (
        <Modal visible transparent animationType="fade" onRequestClose={() => setDrawerOpen(false)}>
          <View style={styles.overlay}>
            <Pressable style={StyleSheet.absoluteFill} onPress={() => setDrawerOpen(false)} />
            {sidebar}
          </View>
        </Modal>
      ) : null}
      <AdminSessionEditor
        visible={sessionEditorOpen}
        session={editingSession}
        onClose={() => setSessionEditorOpen(false)}
        onSaved={showToast}
      />
      <AdminStandEditor
        visible={standEditorOpen}
        stand={editingStand}
        zones={zones}
        onClose={() => setStandEditorOpen(false)}
        onSaved={showToast}
      />
      <Modal
        visible={announcementModal}
        transparent
        animationType="fade"
        onRequestClose={() => setAnnouncementModal(false)}
      >
        <View style={styles.centeredOverlay}>
          <Pressable style={StyleSheet.absoluteFill} onPress={() => setAnnouncementModal(false)} />
          <View style={styles.modalCard}>
            <View style={styles.panelHeader}>
              <Text style={styles.panelTitle}>Yeni Duyuru Taslağı</Text>
              <Pressable onPress={() => setAnnouncementModal(false)}>
                <X size={19} color={colors.textMuted} />
              </Pressable>
            </View>
            <TextInput
              style={styles.modalInput}
              value={announcementTitle}
              onChangeText={setAnnouncementTitle}
              placeholder="Duyuru başlığı"
              placeholderTextColor={colors.textFaint}
            />
            <TextInput
              style={[styles.modalInput, { minHeight: 96 }]}
              value={announcementMessage}
              onChangeText={setAnnouncementMessage}
              placeholder="Katılımcılara iletilecek mesaj"
              placeholderTextColor={colors.textFaint}
              multiline
              textAlignVertical="top"
            />
            <Pressable style={styles.primaryButton} onPress={saveAnnouncement}>
              <Plus size={15} color={colors.white} />
              <Text style={styles.primaryButtonText}>Taslak Oluştur</Text>
            </Pressable>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: '#f4f6f8' },
  frame: { flex: 1 },
  frameWide: { flexDirection: 'row' },
  main: { flex: 1, minWidth: 0 },
  sidebar: {
    width: 264,
    backgroundColor: colors.white,
    borderRightWidth: 1,
    borderRightColor: colors.border,
    padding: 14,
  },
  drawer: { width: 286, height: '100%', borderRightWidth: 0 },
  brandRow: {
    minHeight: 64,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 8,
  },
  adminIdentity: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: colors.primarySoft,
    borderRadius: 14,
    padding: 11,
    marginVertical: 10,
  },
  adminAvatar: {
    width: 38,
    height: 38,
    borderRadius: 12,
    backgroundColor: colors.white,
    alignItems: 'center',
    justifyContent: 'center',
  },
  adminName: { fontSize: 12, fontWeight: '800', color: colors.text },
  adminRole: {
    fontSize: 9,
    fontWeight: '800',
    color: colors.primary,
    letterSpacing: 0.8,
    marginTop: 2,
  },
  navList: { gap: 5, paddingVertical: 8 },
  navItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 11,
    borderRadius: 11,
    paddingHorizontal: 12,
    paddingVertical: 11,
  },
  navItemActive: { backgroundColor: colors.primarySoft },
  navText: { fontSize: 13, fontWeight: '700', color: colors.textMuted },
  navTextActive: { color: colors.primary },
  previewButton: {
    flexDirection: 'row',
    gap: 8,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.secondaryContainer,
    borderRadius: 12,
    paddingVertical: 11,
    marginTop: 8,
  },
  previewText: { fontSize: 11, fontWeight: '800', color: colors.secondaryDark },
  logoutButton: {
    flexDirection: 'row',
    gap: 8,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
  },
  logoutText: { fontSize: 11, fontWeight: '800', color: colors.danger },
  topBar: {
    height: 64,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: colors.white,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    paddingHorizontal: 16,
  },
  iconButton: {
    width: 38,
    height: 38,
    borderRadius: 11,
    backgroundColor: colors.background,
    alignItems: 'center',
    justifyContent: 'center',
  },
  eventContext: { flex: 1 },
  contextLabel: {
    fontSize: 10,
    fontWeight: '800',
    color: colors.primary,
    letterSpacing: 0.7,
    textTransform: 'uppercase',
  },
  contextTitle: { fontSize: 12, fontWeight: '700', color: colors.text, marginTop: 2 },
  systemStatus: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    borderWidth: 1,
    borderColor: colors.successBorder,
    backgroundColor: colors.successBg,
    paddingHorizontal: 10,
    paddingVertical: 7,
    borderRadius: 999,
  },
  onlineDot: { width: 7, height: 7, borderRadius: 4, backgroundColor: colors.success },
  systemStatusText: { fontSize: 10, fontWeight: '800', color: colors.success },
  mobileNav: {
    flexGrow: 0,
    backgroundColor: colors.white,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  mobileNavContent: { paddingHorizontal: 12, paddingVertical: 9, gap: 7 },
  mobileNavItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 999,
    backgroundColor: colors.background,
    borderWidth: 1,
    borderColor: colors.border,
  },
  mobileNavItemActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  mobileNavText: { fontSize: 11, fontWeight: '700', color: colors.textMuted },
  mobileNavTextActive: { color: colors.white },
  contentScroll: { flex: 1 },
  contentContainer: {
    width: '100%',
    maxWidth: 1240,
    alignSelf: 'center',
    padding: 16,
    paddingBottom: 48,
  },
  stack: { gap: 16 },
  pageHeading: { flexDirection: 'row', alignItems: 'flex-start', gap: 12 },
  pageTitle: { fontSize: 23, fontWeight: '900', color: colors.text, letterSpacing: -0.4 },
  pageSubtitle: { fontSize: 12, color: colors.textMuted, marginTop: 4, lineHeight: 17 },
  primaryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: colors.primary,
    borderRadius: 12,
    paddingHorizontal: 13,
    paddingVertical: 10,
  },
  primaryButtonText: { color: colors.white, fontSize: 11, fontWeight: '800' },
  hero: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
    backgroundColor: '#20262b',
    borderRadius: 20,
    padding: 20,
  },
  livePill: {
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: 'rgba(52,211,153,0.12)',
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  livePillText: { color: '#6ee7b7', fontSize: 9, fontWeight: '900', letterSpacing: 0.7 },
  heroTitle: { fontSize: 21, fontWeight: '900', color: colors.white, marginTop: 9 },
  heroSubtitle: { fontSize: 12, color: '#cbd5e1', marginTop: 4 },
  heroStatus: {
    alignItems: 'center',
    minWidth: 82,
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderRadius: 15,
    padding: 12,
  },
  heroStatusValue: { color: colors.white, fontSize: 26, fontWeight: '900' },
  heroStatusLabel: { color: '#cbd5e1', fontSize: 9, fontWeight: '700' },
  metricGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  metric: {
    minWidth: 145,
    flexGrow: 1,
    backgroundColor: colors.white,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 14,
  },
  metricIcon: {
    width: 34,
    height: 34,
    borderRadius: 11,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 10,
  },
  metricValue: { fontSize: 22, fontWeight: '900', color: colors.text },
  metricLabel: { fontSize: 11, fontWeight: '800', color: colors.text, marginTop: 2 },
  metricNote: { fontSize: 9, color: colors.textFaint, marginTop: 2 },
  columns: { gap: 12 },
  columnsWide: { flexDirection: 'row', alignItems: 'flex-start' },
  panel: {
    backgroundColor: colors.white,
    borderRadius: 17,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 15,
    gap: 12,
  },
  panelHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
  },
  panelTitle: { fontSize: 14, fontWeight: '900', color: colors.text },
  panelSubtitle: { fontSize: 10, color: colors.textFaint, marginTop: 2 },
  link: { fontSize: 10, fontWeight: '800', color: colors.primary },
  compactRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 10,
    borderTopWidth: 1,
    borderTopColor: colors.background,
  },
  timeBadge: {
    width: 46,
    height: 38,
    borderRadius: 10,
    backgroundColor: colors.primarySoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  timeBadgeText: { fontSize: 11, fontWeight: '900', color: colors.primary },
  rowTitle: { fontSize: 12, fontWeight: '800', color: colors.text },
  rowSub: { fontSize: 10, color: colors.textFaint, marginTop: 2 },
  warning: {
    flexDirection: 'row',
    gap: 8,
    backgroundColor: colors.dangerBg,
    borderRadius: 11,
    padding: 10,
  },
  warningText: { flex: 1, fontSize: 10, color: colors.danger, lineHeight: 15 },
  success: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 9,
    backgroundColor: colors.successBg,
    borderRadius: 11,
    padding: 11,
  },
  successTitle: { fontSize: 11, fontWeight: '800', color: colors.success },
  successBody: { fontSize: 9, color: colors.textMuted, marginTop: 2 },
  secondaryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 7,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.background,
    borderRadius: 11,
    paddingVertical: 10,
  },
  secondaryButtonText: { fontSize: 10, fontWeight: '800', color: colors.textMuted },
  searchBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: colors.borderStrong,
    borderRadius: 13,
    paddingHorizontal: 12,
  },
  searchInput: { flex: 1, paddingVertical: 11, fontSize: 12, color: colors.text },
  entityCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: colors.white,
    borderRadius: 15,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 13,
  },
  entityIcon: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: colors.primarySoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: 7, flexWrap: 'wrap' },
  entityTitle: { fontSize: 13, fontWeight: '900', color: colors.text, flexShrink: 1 },
  description: { fontSize: 10, color: colors.textMuted, lineHeight: 15, marginTop: 4 },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: 5, flexWrap: 'wrap' },
  metaText: { fontSize: 10, color: colors.textFaint, fontWeight: '600' },
  statusPill: { borderRadius: 999, paddingHorizontal: 7, paddingVertical: 3 },
  statusText: { fontSize: 8, fontWeight: '900', letterSpacing: 0.4 },
  horizontalCards: { gap: 10, paddingRight: 16 },
  zoneCard: {
    width: 160,
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 15,
    padding: 13,
  },
  zoneIcon: {
    width: 34,
    height: 34,
    borderRadius: 11,
    backgroundColor: colors.secondaryContainer,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 10,
  },
  tileGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  standCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 11,
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 15,
    padding: 13,
  },
  standIcon: {
    width: 42,
    height: 42,
    borderRadius: 13,
    backgroundColor: colors.primarySoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  coordinate: { fontSize: 9, color: colors.textFaint, marginTop: 5, fontFamily: 'monospace' },
  adminMap: {
    height: 330,
    borderRadius: 18,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: colors.borderStrong,
    backgroundColor: '#e7eef4',
    position: 'relative',
  },
  gridLineV: { position: 'absolute', top: 0, bottom: 0, width: 1, backgroundColor: '#cbd8e4' },
  gridLineH: { position: 'absolute', left: 0, right: 0, height: 1, backgroundColor: '#cbd8e4' },
  mapPin: {
    position: 'absolute',
    width: 28,
    height: 28,
    marginLeft: -14,
    marginTop: -14,
    borderRadius: 14,
    backgroundColor: colors.primary,
    borderWidth: 2,
    borderColor: colors.white,
    alignItems: 'center',
    justifyContent: 'center',
  },
  mapLegend: {
    position: 'absolute',
    left: 12,
    bottom: 12,
    backgroundColor: 'rgba(255,255,255,0.94)',
    borderRadius: 12,
    padding: 10,
  },
  locationCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 14,
    padding: 12,
  },
  densityDot: { width: 10, height: 10, borderRadius: 5 },
  attendeeCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 11,
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 15,
    padding: 12,
  },
  avatar: { width: 46, height: 46, borderRadius: 15 },
  avatarFallback: {
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.secondaryContainer,
  },
  avatarText: { fontSize: 13, fontWeight: '900', color: colors.secondaryDark },
  rolePill: {
    backgroundColor: colors.primarySoft,
    borderRadius: 999,
    paddingHorizontal: 7,
    paddingVertical: 3,
  },
  roleText: { fontSize: 8, fontWeight: '900', color: colors.primary },
  email: { fontSize: 9, color: colors.textFaint, marginTop: 4 },
  announcementCard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 11,
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 15,
    padding: 14,
  },
  infoBanner: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 9,
    backgroundColor: colors.primarySoft,
    borderWidth: 1,
    borderColor: colors.primaryLight,
    borderRadius: 13,
    padding: 12,
  },
  infoText: { flex: 1, fontSize: 10, color: colors.primaryDark, lineHeight: 15 },
  settingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    paddingVertical: 8,
  },
  settingLabel: { fontSize: 11, color: colors.textMuted },
  settingValue: { fontSize: 11, fontWeight: '800', color: colors.text, textAlign: 'right' },
  divider: { height: 1, backgroundColor: colors.border },
  toggleRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 4 },
  toggleTitle: { fontSize: 12, fontWeight: '800', color: colors.text },
  toggleBody: { fontSize: 9, color: colors.textFaint, marginTop: 2, lineHeight: 14 },
  emptyCard: {
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 15,
    padding: 24,
    alignItems: 'center',
    gap: 6,
  },
  emptyTitle: { fontSize: 12, fontWeight: '800', color: colors.text },
  emptyBody: { fontSize: 10, color: colors.textMuted, textAlign: 'center', lineHeight: 15 },
  loading: { padding: 30, alignItems: 'center', gap: 10 },
  toast: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#20262b',
    borderRadius: 12,
    padding: 12,
    marginBottom: 12,
  },
  toastText: { flex: 1, color: colors.white, fontSize: 11, fontWeight: '700' },
  overlay: { flex: 1, backgroundColor: 'rgba(25,28,29,0.55)', alignItems: 'flex-start' },
  centeredOverlay: {
    flex: 1,
    justifyContent: 'center',
    padding: 16,
    backgroundColor: 'rgba(25,28,29,0.55)',
  },
  modalCard: {
    width: '100%',
    maxWidth: 560,
    alignSelf: 'center',
    backgroundColor: colors.white,
    borderRadius: 18,
    padding: 17,
    gap: 12,
  },
  modalInput: {
    backgroundColor: colors.background,
    borderWidth: 1,
    borderColor: colors.borderStrong,
    borderRadius: 12,
    padding: 12,
    fontSize: 12,
    color: colors.text,
  },
});
