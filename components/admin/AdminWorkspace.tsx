import { useQueryClient } from '@tanstack/react-query';
import { router } from 'expo-router';
import {
  Bell,
  CalendarDays,
  CheckCircle2,
  ChevronRight,
  CircleAlert,
  Handshake,
  LayoutDashboard,
  LogOut,
  Map as MapIcon,
  Megaphone,
  Menu,
  PanelLeftClose,
  PanelLeftOpen,
  Plus,
  RefreshCw,
  Search,
  Settings,
  ShieldCheck,
  Smartphone,
  Store,
  Users,
  X,
  Zap,
} from 'lucide-react-native';
import { useEffect, useMemo, useRef, useState, type ComponentType, type ReactNode } from 'react';
import {
  ActivityIndicator,
  Alert,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  useWindowDimensions,
  View,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';

import {
  AnnouncementEditorModal,
  AttendeeEditorModal,
  BoothEditorModal,
  ConfirmDeleteModal,
  QuickSessionModal,
  SessionEditorModal,
  SettingsEditor,
  StageEditorModal,
} from './AdminWorkspaceModals';
import { AdminDashboard } from './AdminDashboard';
import { AdminMapManagement } from './AdminMapManagement';
import { AdminAnnouncements } from './AdminAnnouncements';
import { AdminAttendees } from './AdminAttendees';
import { AdminNotificationsDrawer } from './AdminNotificationsDrawer';
import { AdminProgram } from './AdminProgram';
import { AdminVenuesAndStands } from './AdminVenuesAndStands';
import { TakeOffLogo } from '../TakeOffLogo';
import { colors } from '../../constants/theme';
import { useAdminStore } from '../../lib/adminStore';
import { supabase } from '../../lib/supabase';
import type {
  AdminAttendee,
  AdminBooth,
  AdminSession,
  AdminStage,
  AdminViewType,
} from '../../types/admin';

type IconType = ComponentType<{ size?: number; color?: string }>;
type DeleteTarget = {
  kind: 'session' | 'stage' | 'booth' | 'attendee' | 'announcement';
  id: string;
  name: string;
};

const NAV: { id: AdminViewType; label: string; icon: IconType }[] = [
  { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { id: 'program', label: 'Program Yönetimi', icon: CalendarDays },
  { id: 'venues_and_stands', label: 'Alanlar & Stantlar', icon: Store },
  { id: 'map_management', label: 'Harita Yönetimi', icon: MapIcon },
  { id: 'attendees', label: 'Katılımcılar', icon: Users },
  { id: 'announcements', label: 'Duyurular', icon: Megaphone },
  { id: 'settings', label: 'Etkinlik Ayarları', icon: Settings },
];

const NAV_GROUPS: { label: string; items: AdminViewType[] }[] = [
  { label: 'DASHBOARD', items: ['dashboard'] },
  { label: 'ETKİNLİK', items: ['program', 'venues_and_stands', 'map_management'] },
  { label: 'KATILIMCILAR', items: ['attendees'] },
  { label: 'İLETİŞİM', items: ['announcements'] },
  { label: 'SİSTEM', items: ['settings'] },
];

function Heading({
  title,
  subtitle,
  action,
  onAction,
  extra,
}: {
  title: string;
  subtitle: string;
  action?: string;
  onAction?: () => void;
  extra?: ReactNode;
}) {
  return (
    <View style={s.heading}>
      <View style={s.headingCopy}>
        <Text style={s.title}>{title}</Text>
        <Text style={s.subtitle}>{subtitle}</Text>
      </View>
      {extra}
      {action && onAction ? (
        <Pressable style={s.primary} onPress={onAction}>
          <Plus size={16} color={colors.white} />
          <Text style={s.primaryText}>{action}</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

function Empty({ title, body }: { title: string; body: string }) {
  return (
    <View style={s.empty}>
      <CircleAlert size={22} color={colors.textMuted} />
      <Text style={s.rowTitle}>{title}</Text>
      <Text style={s.rowSub}>{body}</Text>
    </View>
  );
}

export function AdminWorkspace() {
  const { width } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const desktop = width >= 980;
  const wide = width >= 1240;
  const store = useAdminStore();
  const hydrateAdminData = store.hydrate;
  const queryClient = useQueryClient();
  const [view, setView] = useState<AdminViewType>('dashboard');
  const [drawer, setDrawer] = useState(false);
  const [collapsed, setCollapsed] = useState(false);
  const [globalSearch, setGlobalSearch] = useState(false);
  const [notifications, setNotifications] = useState(false);
  const [unreadNotificationCount, setUnreadNotificationCount] = useState(0);
  const [quickAdd, setQuickAdd] = useState(false);
  const [sessionEditor, setSessionEditor] = useState<AdminSession | 'new' | null>(null);
  const [boothEditor, setBoothEditor] = useState<AdminBooth | 'new' | null>(null);
  const [stageEditor, setStageEditor] = useState<AdminStage | 'new' | null>(null);
  const [attendeeEditor, setAttendeeEditor] = useState<AdminAttendee | 'new' | null>(null);
  const [announcementEditor, setAnnouncementEditor] = useState(false);
  const [quickSessionId, setQuickSessionId] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<DeleteTarget | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [selectedBoothId, setSelectedBoothId] = useState(store.booths[0]?.id || null);
  const [selectedStageId, setSelectedStageId] = useState<string | null>(null);

  useEffect(
    () => () => {
      if (toastTimer.current) clearTimeout(toastTimer.current);
    },
    [],
  );

  useEffect(() => {
    void hydrateAdminData();
  }, [hydrateAdminData]);

  function navigate(next: AdminViewType) {
    setView(next);
    setDrawer(false);
    setGlobalSearch(false);
    setNotifications(false);
    setQuickAdd(false);
  }
  function notify(message: string) {
    if (toastTimer.current) clearTimeout(toastTimer.current);
    setToast(message);
    toastTimer.current = setTimeout(() => {
      setToast(null);
      toastTimer.current = null;
    }, 2600);
  }
  function explainAttendeeInvite() {
    Alert.alert(
      'Yeni katılımcı hesabı',
      'Gerçek giriş hesabı güvenlik nedeniyle mobil istemciden oluşturulamaz. Kullanıcıyı Supabase Authentication > Users bölümünden davet edin. Kullanıcı profilini tamamladıktan sonra burada görüntülenir ve düzenlenebilir.',
      [{ text: 'Anladım' }],
    );
  }
  async function logout() {
    await supabase.auth.signOut();
    queryClient.clear();
    router.replace('/auth');
  }
  function askDelete(kind: DeleteTarget['kind'], id: string, name: string) {
    if (kind === 'stage' && store.stages.length <= 1) {
      notify('Program akışı için en az bir alan korunmalı.');
      return;
    }
    setSessionEditor(null);
    setStageEditor(null);
    setBoothEditor(null);
    setAttendeeEditor(null);
    setAnnouncementEditor(false);
    setQuickSessionId(null);
    setGlobalSearch(false);
    setNotifications(false);
    setQuickAdd(false);
    setDeleteTarget({ kind, id, name });
  }
  async function removeTarget() {
    if (!deleteTarget) return;
    let success = false;
    if (deleteTarget.kind === 'session') success = await store.deleteSession(deleteTarget.id);
    if (deleteTarget.kind === 'stage') success = await store.deleteStage(deleteTarget.id);
    if (deleteTarget.kind === 'booth') success = await store.deleteBooth(deleteTarget.id);
    if (deleteTarget.kind === 'attendee') success = await store.deleteAttendee(deleteTarget.id);
    if (deleteTarget.kind === 'announcement')
      success = await store.deleteAnnouncement(deleteTarget.id);
    if (success) notify(deleteTarget.name + ' silindi.');
    setDeleteTarget(null);
  }

  const quickSession = store.sessions.find((session) => session.id === quickSessionId) || null;

  useEffect(() => {
    if (!store.booths.length) {
      setSelectedBoothId(null);
      return;
    }
    if (!selectedBoothId || !store.booths.some((booth) => booth.id === selectedBoothId)) {
      setSelectedBoothId(store.booths[0].id);
    }
  }, [selectedBoothId, store.booths]);

  function Dashboard() {
    return (
      <AdminDashboard
        onNavigate={navigate}
        onOpenCreateSession={() => setSessionEditor('new')}
        onOpenCreateAnnouncement={() => setAnnouncementEditor(true)}
        onOpenQuickSession={setQuickSessionId}
        onOpenEditSession={setSessionEditor}
        onNotify={notify}
      />
    );
  }
  function Program() {
    return (
      <AdminProgram
        sessions={store.sessions}
        stages={store.stages}
        onOpenCreateSession={() => setSessionEditor('new')}
        onOpenEditSession={setSessionEditor}
        onOpenQuickSessionAction={(session) => setQuickSessionId(session.id)}
        onDeleteSession={(session) => askDelete('session', session.id, session.title)}
      />
    );
  }

  function Venues() {
    return (
      <AdminVenuesAndStands
        booths={store.booths}
        stages={store.stages}
        zones={store.zones}
        sessions={store.sessions}
        initialTab={view === 'stages' ? 'stages' : 'booths'}
        onOpenCreateBooth={() => setBoothEditor('new')}
        onOpenEditBooth={setBoothEditor}
        onDeleteBooth={(booth) => askDelete('booth', booth.id, booth.companyName)}
        onToggleBoothStatus={async (booth) => {
          if (await store.toggleBoothStatus(booth.id)) notify('Stant durumu güncellendi.');
        }}
        onOpenCreateStage={() => setStageEditor('new')}
        onOpenEditStage={setStageEditor}
        onDeleteStage={(stage) => askDelete('stage', stage.id, stage.name)}
        onNavigateToMap={(booth) => {
          if (booth) setSelectedBoothId(booth.id);
          navigate('map_management');
        }}
        onNavigateToStageMap={(stage) => {
          setSelectedStageId(stage.id);
          navigate('map_management');
        }}
      />
    );
  }

  function MapManager() {
    return (
      <AdminMapManagement
        stages={store.stages}
        booths={store.booths}
        zones={store.zones}
        settings={store.settings}
        selectedBoothIdFromNav={selectedBoothId}
        selectedStageIdFromNav={selectedStageId}
        onSelectBooth={setSelectedBoothId}
        onSelectStage={setSelectedStageId}
        onOpenEditBooth={setBoothEditor}
        onDeleteBooth={(booth) => askDelete('booth', booth.id, booth.companyName)}
        onNotify={notify}
      />
    );
  }
  function Attendees() {
    return (
      <AdminAttendees
        attendees={store.attendees}
        onOpenCreateAttendee={explainAttendeeInvite}
        onOpenEditAttendee={setAttendeeEditor}
        onToggleAttendeeStatus={async (attendee) => {
          if (await store.toggleAttendeeStatus(attendee.id)) {
            notify(
              attendee.status === 'active'
                ? 'Katılımcı erişimi kapatıldı.'
                : 'Katılımcı erişimi açıldı.',
            );
          }
        }}
        onDeleteAttendee={(attendee) => askDelete('attendee', attendee.id, attendee.name)}
      />
    );
  }

  function Announcements() {
    return (
      <AdminAnnouncements
        announcements={store.announcements}
        onOpenCreateAnnouncement={() => setAnnouncementEditor(true)}
        onDeleteAnnouncement={(announcement) =>
          askDelete('announcement', announcement.id, announcement.title)
        }
      />
    );
  }

  function SettingsView() {
    return (
      <View style={s.stack}>
        <Heading
          title="Etkinlik Ayarları"
          subtitle="Etkinlik kimliği, takip aralığı ve otomatik bildirim tercihleri."
        />
        <View style={[s.columns, wide && s.columnsWide]}>
          <View style={s.large}>
            <SettingsEditor
              settings={store.settings}
              onSave={async (value) => {
                if (await store.saveSettings(value)) notify('Etkinlik ayarları kaydedildi.');
              }}
            />
          </View>
          <View style={[s.panel, s.small]}>
            <Text style={s.sectionTitle}>Otomasyon Tetikleyicileri</Text>
            {[
              {
                key: 'autoSessionReminders' as const,
                title: 'Oturum hatırlatmaları',
                body: 'Ajandaya eklenen oturumdan önce bildirim.',
              },
              {
                key: 'autoCapacityAlerts' as const,
                title: 'Kapasite uyarıları',
                body: 'Doluluk kritik sınıra geldiğinde uyarı.',
              },
              {
                key: 'autoMeetingReminders' as const,
                title: 'B2B görüşme hatırlatmaları',
                body: 'Görüşmeden önce iki tarafa bildirim.',
              },
            ].map((item) => (
              <View key={item.key} style={s.settingRow}>
                <View style={s.flex}>
                  <Text style={s.rowTitle}>{item.title}</Text>
                  <Text style={s.rowSub}>{item.body}</Text>
                </View>
                <Switch
                  value={store.settings.notificationTriggers[item.key]}
                  onValueChange={(value) => {
                    void store.saveSettings({
                      notificationTriggers: {
                        ...store.settings.notificationTriggers,
                        [item.key]: value,
                      },
                    });
                  }}
                  trackColor={{ true: colors.primary, false: colors.surfaceHigh }}
                />
              </View>
            ))}
            <View style={s.info}>
              <ShieldCheck size={18} color={colors.primary} />
              <Text style={s.infoText}>
                Değişiklikler gerçek Supabase veritabanına kaydedilir ve katılımcı uygulamasıyla
                aynı etkinlik verilerini kullanır.
              </Text>
            </View>
            <Pressable
              style={s.secondary}
              onPress={() => {
                void store.resetDemoData();
              }}
            >
              <RefreshCw size={15} color={colors.primary} />
              <Text style={s.secondaryText}>Veritabanından Yenile</Text>
            </Pressable>
          </View>
        </View>
      </View>
    );
  }

  function Content() {
    if (view === 'dashboard') return <Dashboard />;
    if (view === 'program') return <Program />;
    if (view === 'map_management') return <MapManager />;
    if (view === 'attendees') return <Attendees />;
    if (view === 'announcements') return <Announcements />;
    return <SettingsView />;
  }

  const sidebar = (
    <View
      style={[
        s.sidebar,
        collapsed && s.sidebarCollapsed,
        !desktop && s.mobileSidebar,
        !desktop && { paddingTop: Math.max(insets.top, 14) },
        !desktop && { paddingBottom: Math.max(insets.bottom + 12, 24) },
      ]}
    >
      <View style={s.brand}>
        <View style={s.brandIdentity}>
          {collapsed ? <TakeOffLogo variant="mark-only" size="md" /> : <TakeOffLogo size="md" />}
          {!collapsed ? <Text style={s.operationBadge}>OPERASYON</Text> : null}
        </View>
        <IconButton onPress={() => (desktop ? setCollapsed((x) => !x) : setDrawer(false))}>
          {desktop ? (
            collapsed ? (
              <PanelLeftOpen size={18} color={colors.textMuted} />
            ) : (
              <PanelLeftClose size={18} color={colors.textMuted} />
            )
          ) : (
            <X size={18} color={colors.text} />
          )}
        </IconButton>
      </View>
      <ScrollView contentContainerStyle={s.nav}>
        {NAV_GROUPS.map((group) => (
          <View key={group.label} style={s.navGroup}>
            {!collapsed ? <Text style={s.navGroupTitle}>{group.label}</Text> : null}
            {group.items.map((id) => {
              const item = NAV.find((entry) => entry.id === id);
              if (!item) return null;
              const Icon = item.icon;
              const active =
                view === item.id ||
                (item.id === 'venues_and_stands' && (view === 'stages' || view === 'booths'));
              return (
                <Pressable
                  key={item.id}
                  style={[s.navItem, collapsed && s.navCollapsed, active && s.navActive]}
                  onPress={() => navigate(item.id)}
                >
                  <Icon size={19} color={active ? colors.primary : colors.textMuted} />
                  {!collapsed ? (
                    <Text style={[s.navText, active && s.navTextActive]}>{item.label}</Text>
                  ) : null}
                </Pressable>
              );
            })}
          </View>
        ))}
      </ScrollView>
      {!collapsed ? (
        <>
          <Pressable style={s.preview} onPress={() => router.replace('/(tabs)/home')}>
            <Smartphone size={17} color={colors.secondaryDark} />
            <Text style={s.previewText}>Mobil Uygulamayı Önizle</Text>
          </Pressable>
          <View style={s.admin}>
            <View style={s.avatarSmall}>
              <ShieldCheck size={17} color={colors.primary} />
            </View>
            <View style={s.flex}>
              <Text style={s.adminName}>Etkinlik Koordinatörü</Text>
              <Text style={s.adminRole}>YÖNETİCİ</Text>
            </View>
            <IconButton onPress={logout}>
              <LogOut size={16} color={colors.danger} />
            </IconButton>
          </View>
        </>
      ) : (
        <IconButton onPress={logout}>
          <LogOut size={18} color={colors.danger} />
        </IconButton>
      )}
    </View>
  );

  return (
    <SafeAreaView style={s.safe} edges={['top']}>
      <View style={s.frame}>
        {desktop ? sidebar : null}
        <View style={s.main}>
          <View style={s.topbar}>
            {!desktop ? (
              <IconButton
                onPress={() => {
                  setGlobalSearch(false);
                  setNotifications(false);
                  setQuickAdd(false);
                  setDrawer(true);
                }}
              >
                <Menu size={20} color={colors.text} />
              </IconButton>
            ) : null}
            <View style={s.flex}>
              <Text style={s.topEyebrow}>TAKE OFF İSTANBUL 2026</Text>
              <Text style={s.topTitle}>{NAV.find((x) => x.id === view)?.label || 'Dashboard'}</Text>
            </View>
            {store.isMutating ? <ActivityIndicator size="small" color={colors.primary} /> : null}
            <Pressable
              style={[s.globalSearch, !desktop && s.globalSearchMobile]}
              onPress={() => {
                setDrawer(false);
                setNotifications(false);
                setQuickAdd(false);
                setGlobalSearch(true);
              }}
            >
              <Search size={16} color={colors.textMuted} />
              {desktop ? <Text style={s.globalSearchText}>Her yerde ara…</Text> : null}
            </Pressable>
            <Pressable
              style={s.iconButton}
              onPress={() => {
                setDrawer(false);
                setGlobalSearch(false);
                setQuickAdd(false);
                setNotifications(true);
              }}
            >
              <Bell size={19} color={colors.text} />
              {unreadNotificationCount > 0 ? (
                <View style={s.notificationBadge}>
                  <Text style={s.notificationBadgeText}>
                    {unreadNotificationCount > 9 ? '9+' : unreadNotificationCount}
                  </Text>
                </View>
              ) : null}
            </Pressable>
            <Pressable
              style={s.quickButton}
              onPress={() => {
                setDrawer(false);
                setGlobalSearch(false);
                setNotifications(false);
                setQuickAdd((x) => !x);
              }}
            >
              <Plus size={17} color={colors.white} />
              {desktop ? <Text style={s.primaryText}>Hızlı Ekle</Text> : null}
            </Pressable>
            {quickAdd ? (
              <View style={s.quickMenu}>
                <Text style={s.quickTitle}>HIZLI OLUŞTUR</Text>
                <QuickItem
                  icon={CalendarDays}
                  label="Yeni Oturum"
                  onPress={() => {
                    setQuickAdd(false);
                    setSessionEditor('new');
                  }}
                />
                <QuickItem
                  icon={Store}
                  label="Yeni Stand"
                  onPress={() => {
                    setQuickAdd(false);
                    setBoothEditor('new');
                  }}
                />
                <QuickItem
                  icon={Users}
                  label="Yeni Katılımcı"
                  onPress={() => {
                    setQuickAdd(false);
                    explainAttendeeInvite();
                  }}
                />
                <QuickItem
                  icon={Megaphone}
                  label="Yeni Duyuru"
                  onPress={() => {
                    setQuickAdd(false);
                    setAnnouncementEditor(true);
                  }}
                />
              </View>
            ) : null}
          </View>
          <ScrollView
            style={s.scroll}
            contentContainerStyle={s.content}
            keyboardShouldPersistTaps="handled"
          >
            {store.status === 'idle' || store.status === 'loading' ? (
              <View style={s.databaseState}>
                <ActivityIndicator size="large" color={colors.primary} />
                <Text style={s.databaseStateTitle}>Admin verileri yükleniyor</Text>
                <Text style={s.databaseStateBody}>Supabase tabloları ve yetkiler kontrol ediliyor.</Text>
              </View>
            ) : store.status === 'error' ? (
              <View style={s.databaseState}>
                <CircleAlert size={28} color={colors.danger} />
                <Text style={s.databaseStateTitle}>Veritabanı bağlantısı hazır değil</Text>
                <Text style={s.databaseStateBody}>{store.error}</Text>
                <Pressable style={s.primary} onPress={() => void store.hydrate()}>
                  <RefreshCw size={16} color={colors.white} />
                  <Text style={s.primaryText}>Yeniden Dene</Text>
                </Pressable>
              </View>
            ) : (
              <>
                {store.error ? (
                  <View style={s.databaseErrorBanner}>
                    <CircleAlert size={18} color={colors.danger} />
                    <Text style={s.databaseErrorText}>{store.error}</Text>
                    <Pressable onPress={store.clearError}>
                      <X size={16} color={colors.danger} />
                    </Pressable>
                  </View>
                ) : null}
                {view === 'venues_and_stands' || view === 'stages' || view === 'booths' ? (
                  Venues()
                ) : (
                  <Content />
                )}
              </>
            )}
          </ScrollView>
        </View>
      </View>
      {!desktop && drawer ? (
        <Modal
          visible
          transparent
          animationType="fade"
          statusBarTranslucent
          navigationBarTranslucent={Platform.OS === 'android'}
          onRequestClose={() => setDrawer(false)}
        >
          <View style={s.overlay}>
            <Pressable style={StyleSheet.absoluteFill} onPress={() => setDrawer(false)} />
            {sidebar}
          </View>
        </Modal>
      ) : null}
      <GlobalSearch
        visible={globalSearch}
        onClose={() => setGlobalSearch(false)}
        onNavigate={navigate}
      />
      <AdminNotificationsDrawer
        visible={notifications}
        onClose={() => setNotifications(false)}
        onNavigate={navigate}
        onUnreadCountChange={setUnreadNotificationCount}
      />
      <SessionEditorModal
        visible={sessionEditor !== null}
        session={sessionEditor === 'new' ? null : sessionEditor}
        stages={store.stages}
        onClose={() => setSessionEditor(null)}
        onSave={async (data, publish, id) => {
          if (await store.saveSession(data, publish, id)) {
            notify(
              id ? 'Oturum güncellendi.' : publish ? 'Oturum yayınlandı.' : 'Taslak oluşturuldu.',
            );
          }
        }}
        onDelete={(id) =>
          askDelete('session', id, store.sessions.find((x) => x.id === id)?.title || 'Oturum')
        }
      />
      <BoothEditorModal
        visible={boothEditor !== null}
        booth={boothEditor === 'new' ? null : boothEditor}
        onClose={() => setBoothEditor(null)}
        onSave={async (data, id) => {
          if (await store.saveBooth(data, id))
            notify(id ? 'Stand güncellendi.' : 'Yeni stand eklendi.');
        }}
        onDelete={(id) =>
          askDelete('booth', id, store.booths.find((x) => x.id === id)?.companyName || 'Stand')
        }
      />
      <StageEditorModal
        visible={stageEditor !== null}
        stage={stageEditor === 'new' ? null : stageEditor}
        onClose={() => setStageEditor(null)}
        onSave={async (data, id) => {
          if (await store.saveStage(data, id))
            notify(id ? 'Alan güncellendi.' : 'Yeni alan eklendi.');
        }}
        onDelete={(id) =>
          askDelete('stage', id, store.stages.find((x) => x.id === id)?.name || 'Alan')
        }
      />
      <AttendeeEditorModal
        visible={attendeeEditor !== null}
        attendee={attendeeEditor === 'new' ? null : attendeeEditor}
        saveError={store.error}
        onClose={() => setAttendeeEditor(null)}
        onClearError={store.clearError}
        onSave={async (data, id) => {
          const saved = await store.saveAttendee(data, id);
          if (saved)
            notify(id ? 'Katılımcı güncellendi.' : 'Yeni katılımcı eklendi.');
          return saved;
        }}
        onDelete={(id) =>
          askDelete('attendee', id, store.attendees.find((x) => x.id === id)?.name || 'Katılımcı')
        }
      />
      <AnnouncementEditorModal
        visible={announcementEditor}
        sessions={store.sessions}
        booths={store.booths}
        onClose={() => setAnnouncementEditor(false)}
        onSave={async (data, scheduled) => {
          if (await store.publishAnnouncement(data, scheduled))
            notify(scheduled ? 'Duyuru planlandı.' : 'Duyuru gönderildi.');
        }}
      />
      <QuickSessionModal
        visible={!!quickSession}
        session={quickSession}
        stages={store.stages}
        onClose={() => setQuickSessionId(null)}
        onDelay={async (minutes) => {
          if (quickSession && (await store.delaySession(quickSession.id, minutes)))
            notify('Oturuma +' + minutes + ' dk eklendi.');
        }}
        onStatus={async (status) => {
          if (quickSession && (await store.updateSessionStatus(quickSession.id, status)))
            notify('Durum güncellendi.');
        }}
        onStage={async (stageId) => {
          if (quickSession && (await store.changeSessionStage(quickSession.id, stageId)))
            notify('Salon değiştirildi.');
        }}
      />
      <ConfirmDeleteModal
        visible={!!deleteTarget}
        title={(deleteTarget?.name || 'Kayıt') + ' silinsin mi?'}
        body={
          deleteTarget?.kind === 'attendee'
            ? 'Yalnızca uygulama profil kaydı silinir. Supabase Authentication giriş hesabı silinmez. Devam etmek istediğinizden emin olun.'
            : 'Bu kayıt Supabase veritabanından kaldırılacak. Devam etmek istediğinizden emin olun.'
        }
        onCancel={() => setDeleteTarget(null)}
        onConfirm={removeTarget}
      />
      {toast ? (
        <View pointerEvents="none" style={[s.toast, { top: 80 }]}>
          <CheckCircle2 size={17} color={colors.white} />
          <Text style={s.toastText}>{toast}</Text>
        </View>
      ) : null}
    </SafeAreaView>
  );
}

function PanelHead({
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
    <View style={s.between}>
      <View>
        <Text style={s.sectionTitle}>{title}</Text>
        <Text style={s.rowSub}>{subtitle}</Text>
      </View>
      {action ? (
        <Pressable onPress={onAction}>
          <Text style={s.orangeText}>{action}</Text>
        </Pressable>
      ) : null}
    </View>
  );
}
function IconButton({ children, onPress }: { children: ReactNode; onPress: () => void }) {
  return (
    <Pressable style={s.iconButton} onPress={onPress}>
      {children}
    </Pressable>
  );
}
function FilterChip({
  label,
  active,
  onPress,
}: {
  label: string;
  active: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable style={[s.chip, active && s.chipActive]} onPress={onPress}>
      <Text style={[s.chipText, active && s.chipTextActive]}>{label}</Text>
    </Pressable>
  );
}
function QuickItem({
  icon: Icon,
  label,
  onPress,
}: {
  icon: IconType;
  label: string;
  onPress: () => void;
}) {
  return (
    <Pressable style={s.quickItem} onPress={onPress}>
      <Icon size={17} color={colors.primary} />
      <Text style={s.rowTitle}>{label}</Text>
    </Pressable>
  );
}

function GlobalSearch({
  visible,
  onClose,
  onNavigate,
}: {
  visible: boolean;
  onClose: () => void;
  onNavigate: (view: AdminViewType) => void;
}) {
  const store = useAdminStore();
  const insets = useSafeAreaInsets();
  const [query, setQuery] = useState('');
  useEffect(() => {
    if (visible) setQuery('');
  }, [visible]);
  const q = query.toLocaleLowerCase('tr');
  const results = useMemo(
    () =>
      q.length < 2
        ? []
        : [
            ...store.sessions
              .filter((x) => (x.title + x.stageName).toLocaleLowerCase('tr').includes(q))
              .slice(0, 4)
              .map((x) => ({
                id: x.id,
                title: x.title,
                sub: 'Oturum · ' + x.stageName,
                view: 'program' as AdminViewType,
                icon: CalendarDays,
              })),
            ...store.booths
              .filter((x) => (x.companyName + x.boothNo).toLocaleLowerCase('tr').includes(q))
              .slice(0, 4)
              .map((x) => ({
                id: x.id,
                title: x.companyName,
                sub: 'Stand · ' + x.boothNo,
                view: 'venues_and_stands' as AdminViewType,
                icon: Store,
              })),
            ...store.attendees
              .filter((x) => (x.name + x.email + x.company).toLocaleLowerCase('tr').includes(q))
              .slice(0, 4)
              .map((x) => ({
                id: x.id,
                title: x.name,
                sub: 'Katılımcı · ' + x.company,
                view: 'attendees' as AdminViewType,
                icon: Users,
              })),
          ],
    [q, store.sessions, store.booths, store.attendees],
  );
  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      statusBarTranslucent
      navigationBarTranslucent={Platform.OS === 'android'}
      onRequestClose={onClose}
    >
      <View
        style={[
          s.searchOverlay,
          {
            paddingTop: Math.max(insets.top, Platform.OS === 'web' ? 90 : 24),
            paddingBottom: Math.max(insets.bottom, 16),
          },
        ]}
      >
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />
        <View style={s.searchDialog}>
          <View style={s.searchDialogInput}>
            <Search size={20} color={colors.textMuted} />
            <TextInput
              autoFocus
              style={s.dialogTextInput}
              value={query}
              onChangeText={setQuery}
              placeholder="Oturum, stand veya katılımcı ara…"
              placeholderTextColor={colors.textFaint}
            />
            <IconButton onPress={onClose}>
              <X size={18} color={colors.text} />
            </IconButton>
          </View>
          <ScrollView contentContainerStyle={s.searchResults}>
            {query.length < 2 ? (
              <Text style={s.hint}>Aramak için en az 2 karakter yazın.</Text>
            ) : results.length ? (
              results.map((item) => (
                <Pressable
                  key={item.view + item.id}
                  style={s.searchResult}
                  onPress={() => {
                    onNavigate(item.view);
                    onClose();
                  }}
                >
                  <View style={s.iconBox}>
                    <item.icon size={17} color={colors.primary} />
                  </View>
                  <View style={s.flex}>
                    <Text style={s.rowTitle}>{item.title}</Text>
                    <Text style={s.rowSub}>{item.sub}</Text>
                  </View>
                  <ChevronRight size={16} color={colors.textMuted} />
                </Pressable>
              ))
            ) : (
              <Empty title="Sonuç bulunamadı" body="Farklı bir anahtar kelime deneyin." />
            )}
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  frame: { flex: 1, flexDirection: 'row' },
  main: { flex: 1, minWidth: 0 },
  scroll: { flex: 1 },
  content: { width: '100%', maxWidth: 1580, alignSelf: 'center', padding: 20, paddingBottom: 55 },
  stack: { gap: 18 },
  flex: { flex: 1, minWidth: 0 },
  sidebar: {
    width: 262,
    backgroundColor: colors.surface,
    borderRightWidth: 1,
    borderRightColor: colors.border,
    padding: 14,
  },
  sidebarCollapsed: { width: 78 },
  mobileSidebar: { width: 286, height: '100%' },
  brand: {
    height: 58,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  brandIdentity: { flexDirection: 'row', alignItems: 'center', flexShrink: 1, gap: 8 },
  operationBadge: {
    color: colors.primary,
    fontSize: 9,
    fontWeight: '900',
    letterSpacing: 0.2,
    paddingHorizontal: 7,
    paddingVertical: 4,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: colors.primary,
    backgroundColor: colors.primarySoft,
  },
  nav: { gap: 5, paddingVertical: 11 },
  navGroup: { gap: 5 },
  navGroupTitle: {
    color: colors.textMuted,
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 1.1,
    paddingHorizontal: 12,
    paddingTop: 10,
    paddingBottom: 2,
  },
  navItem: {
    minHeight: 44,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 12,
    borderRadius: 10,
  },
  navCollapsed: { justifyContent: 'center', paddingHorizontal: 0 },
  navActive: {
    backgroundColor: colors.primarySoft,
    borderLeftWidth: 3,
    borderLeftColor: colors.primary,
  },
  navText: { color: colors.textMuted, fontSize: 13, fontWeight: '600' },
  navTextActive: { color: colors.primary, fontWeight: '800' },
  preview: {
    minHeight: 42,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 11,
    borderRadius: 10,
    backgroundColor: colors.surfaceMuted,
    marginBottom: 10,
  },
  previewText: { color: colors.secondaryDark, fontSize: 11, fontWeight: '700' },
  admin: {
    minHeight: 50,
    flexDirection: 'row',
    gap: 8,
    alignItems: 'center',
    borderTopWidth: 1,
    borderTopColor: colors.border,
    paddingTop: 10,
  },
  avatarSmall: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.primarySoft,
  },
  adminName: { color: colors.text, fontSize: 11, fontWeight: '800' },
  adminRole: { color: colors.primary, fontSize: 8, fontWeight: '900' },
  topbar: {
    height: 68,
    zIndex: 20,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 18,
    backgroundColor: colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  topEyebrow: { color: colors.textFaint, fontSize: 8, fontWeight: '900', letterSpacing: 0.7 },
  topTitle: { color: colors.text, fontSize: 15, fontWeight: '800', marginTop: 2 },
  iconButton: {
    width: 36,
    height: 36,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.surfaceMuted,
  },
  globalSearch: {
    width: 260,
    height: 40,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 11,
    borderWidth: 1,
    borderColor: colors.borderStrong,
    borderRadius: 11,
  },
  globalSearchMobile: { width: 40, justifyContent: 'center', paddingHorizontal: 0 },
  globalSearchText: { color: colors.textFaint, fontSize: 11 },
  notificationBadge: {
    position: 'absolute',
    right: -4,
    top: -5,
    minWidth: 18,
    height: 18,
    paddingHorizontal: 4,
    borderRadius: 9,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.danger,
  },
  notificationBadgeText: { color: colors.white, fontSize: 8, fontWeight: '900' },
  quickButton: {
    minHeight: 40,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    paddingHorizontal: 13,
    borderRadius: 10,
    backgroundColor: colors.primary,
  },
  quickMenu: {
    position: 'absolute',
    right: 18,
    top: 60,
    width: 215,
    padding: 9,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 13,
    shadowColor: '#000',
    shadowOpacity: 0.15,
    shadowRadius: 14,
    elevation: 8,
  },
  quickTitle: {
    color: colors.textFaint,
    fontSize: 8,
    fontWeight: '900',
    letterSpacing: 0.7,
    padding: 8,
  },
  quickItem: {
    minHeight: 42,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 9,
  },
  heading: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 12 },
  headingCopy: { flex: 1, minWidth: 220 },
  title: { color: colors.text, fontSize: 25, fontWeight: '800' },
  subtitle: { color: colors.textMuted, fontSize: 13, lineHeight: 19, marginTop: 4 },
  primary: {
    minHeight: 40,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 7,
    paddingHorizontal: 14,
    borderRadius: 10,
    backgroundColor: colors.primary,
  },
  primaryText: { color: colors.white, fontSize: 12, fontWeight: '800' },
  secondary: {
    minHeight: 40,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 7,
    paddingHorizontal: 13,
    borderWidth: 1,
    borderColor: colors.primary,
    borderRadius: 10,
    backgroundColor: colors.surface,
  },
  secondaryActive: { backgroundColor: colors.primary },
  secondaryText: { color: colors.primary, fontSize: 11, fontWeight: '800' },
  danger: {
    minHeight: 40,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 7,
    borderRadius: 10,
    backgroundColor: colors.dangerBg,
  },
  dangerText: { color: colors.danger, fontSize: 11, fontWeight: '800' },
  hero: {
    minHeight: 160,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 20,
    padding: 23,
    borderRadius: 19,
    backgroundColor: '#142635',
  },
  live: {
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 9,
    paddingVertical: 5,
    borderRadius: 99,
    backgroundColor: 'rgba(73,212,157,0.13)',
  },
  liveText: { color: '#66e7b4', fontSize: 8, fontWeight: '900', letterSpacing: 0.7 },
  heroTitle: { color: colors.white, fontSize: 26, fontWeight: '800', marginTop: 9 },
  heroSub: { color: '#b8c7d2', fontSize: 11, marginTop: 5 },
  heroRight: { alignItems: 'flex-end' },
  heroNumber: { color: colors.white, fontSize: 28, fontWeight: '900' },
  heroButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    paddingHorizontal: 12,
    minHeight: 37,
    marginTop: 11,
    borderRadius: 9,
    backgroundColor: colors.primary,
  },
  metricGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  metric: {
    flexGrow: 1,
    flexBasis: 185,
    minWidth: 155,
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    padding: 13,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 14,
    backgroundColor: colors.surface,
  },
  metricIcon: {
    width: 38,
    height: 38,
    borderRadius: 11,
    alignItems: 'center',
    justifyContent: 'center',
  },
  metricValue: { color: colors.text, fontSize: 21, fontWeight: '800' },
  metricLabel: { color: colors.text, fontSize: 10, fontWeight: '800', marginTop: 2 },
  columns: { gap: 14 },
  columnsWide: { flexDirection: 'row', alignItems: 'flex-start' },
  large: { flex: 1.65 },
  small: { flex: 1 },
  panel: {
    padding: 16,
    gap: 11,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 15,
    backgroundColor: colors.surface,
  },
  sectionTitle: { color: colors.text, fontSize: 14, fontWeight: '800' },
  between: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 10 },
  listRow: {
    minHeight: 68,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 9,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  rowTitle: { color: colors.text, fontSize: 12, fontWeight: '800', flexShrink: 1 },
  rowSub: { color: colors.textMuted, fontSize: 10, lineHeight: 15, marginTop: 3 },
  desc: { color: colors.textMuted, fontSize: 11, lineHeight: 17, marginTop: 5 },
  micro: { color: colors.textFaint, fontSize: 9, lineHeight: 13, marginTop: 3 },
  titleLine: { flexDirection: 'row', alignItems: 'center', gap: 7, flexWrap: 'wrap' },
  timeBox: { width: 54 },
  time: { color: colors.text, fontSize: 14, fontWeight: '800' },
  pill: { alignSelf: 'flex-start', paddingHorizontal: 7, paddingVertical: 4, borderRadius: 99 },
  pillText: { fontSize: 8, fontWeight: '900', letterSpacing: 0.3 },
  orangeText: { color: colors.primary, fontSize: 10, fontWeight: '800' },
  alert: {
    minHeight: 55,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 9,
    padding: 10,
    borderRadius: 10,
    backgroundColor: colors.dangerBg,
  },
  success: {
    flexDirection: 'row',
    gap: 8,
    alignItems: 'center',
    padding: 11,
    borderRadius: 10,
    backgroundColor: colors.successBg,
  },
  miniRow: {
    minHeight: 45,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  dot: { width: 7, height: 7, borderRadius: 4, backgroundColor: colors.primary },
  logGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  log: {
    flexGrow: 1,
    flexBasis: 320,
    minHeight: 48,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    padding: 9,
    borderRadius: 10,
    backgroundColor: colors.surfaceMuted,
  },
  filterBar: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 10 },
  search: {
    flex: 1,
    minWidth: 240,
    maxWidth: 520,
    height: 43,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 11,
    borderWidth: 1,
    borderColor: colors.borderStrong,
    borderRadius: 11,
    backgroundColor: colors.surface,
  },
  searchInput: { flex: 1, color: colors.text, fontSize: 12 },
  chips: { gap: 7 },
  chip: {
    minHeight: 34,
    justifyContent: 'center',
    paddingHorizontal: 11,
    borderRadius: 99,
    borderWidth: 1,
    borderColor: colors.borderStrong,
    backgroundColor: colors.surface,
  },
  chipActive: { borderColor: colors.primary, backgroundColor: colors.primary },
  chipText: { color: colors.textMuted, fontSize: 10, fontWeight: '700' },
  chipTextActive: { color: colors.white },
  programRow: {
    minHeight: 80,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 10,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  dayBox: { width: 38, alignItems: 'center', borderRightWidth: 1, borderRightColor: colors.border },
  day: { color: colors.primary, fontSize: 16, fontWeight: '900' },
  progress: {
    height: 4,
    overflow: 'hidden',
    marginTop: 7,
    borderRadius: 99,
    backgroundColor: colors.surfaceHigh,
  },
  progressFill: { height: '100%', borderRadius: 99 },
  calendar: { gap: 10 },
  calendarColumn: {
    width: 270,
    gap: 9,
    padding: 11,
    borderRadius: 14,
    backgroundColor: colors.surfaceMuted,
  },
  calendarCard: {
    gap: 6,
    padding: 11,
    borderLeftWidth: 3,
    borderLeftColor: colors.primary,
    borderRadius: 10,
    backgroundColor: colors.surface,
  },
  liveCard: { borderLeftColor: colors.danger, backgroundColor: '#fff9f8' },
  cardGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  entityCard: {
    width: '100%',
    minHeight: 125,
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 11,
    padding: 14,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 14,
    backgroundColor: colors.surface,
  },
  half: { width: '49%' },
  logo: {
    width: 44,
    height: 44,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 12,
    backgroundColor: colors.primarySoft,
  },
  logoImage: { width: '100%', height: '100%' },
  logoText: { color: colors.primary, fontSize: 12, fontWeight: '900' },
  iconBox: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 11,
    backgroundColor: colors.primarySoft,
  },
  actions: { alignItems: 'center', gap: 7 },
  zoneCard: {
    width: '100%',
    gap: 8,
    padding: 15,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 14,
    backgroundColor: colors.surface,
  },
  zoneCode: { color: colors.primary, fontSize: 8, fontWeight: '900', letterSpacing: 0.8 },
  map: {
    height: 570,
    flex: 1.8,
    minWidth: 0,
    overflow: 'hidden',
    borderWidth: 2,
    borderColor: colors.borderStrong,
    borderRadius: 16,
    backgroundColor: '#e6e8e9',
  },
  mapMoving: { borderColor: colors.primary, borderStyle: 'dashed' },
  mapZone: {
    position: 'absolute',
    height: '40%',
    padding: 10,
    borderWidth: 1,
    borderColor: 'rgba(20,38,53,0.08)',
    borderRadius: 14,
  },
  mapZoneText: { color: 'rgba(20,38,53,0.25)', fontSize: 16, fontWeight: '900' },
  stagePin: {
    position: 'absolute',
    zIndex: 2,
    transform: [{ translateX: -8 }, { translateY: -8 }],
    minHeight: 26,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 7,
    borderRadius: 8,
    backgroundColor: '#263746',
  },
  stagePinText: { color: colors.white, fontSize: 8, fontWeight: '800' },
  boothPin: {
    position: 'absolute',
    zIndex: 3,
    transform: [{ translateX: -14 }, { translateY: -14 }],
    minWidth: 36,
    height: 29,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: colors.white,
    borderRadius: 9,
    backgroundColor: colors.primary,
  },
  boothPinSelected: {
    backgroundColor: '#142635',
    transform: [{ translateX: -16 }, { translateY: -16 }, { scale: 1.18 }],
  },
  boothPinText: { color: colors.white, fontSize: 8, fontWeight: '900' },
  mapHelp: {
    position: 'absolute',
    zIndex: 10,
    top: 14,
    alignSelf: 'center',
    minHeight: 34,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    paddingHorizontal: 13,
    borderRadius: 99,
    backgroundColor: colors.primary,
  },
  mapHelpText: { color: colors.white, fontSize: 10, fontWeight: '800' },
  mapSide: { flex: 1, minWidth: 270 },
  coordinate: { padding: 11, borderRadius: 10, backgroundColor: colors.surfaceMuted },
  coordinateValue: { color: colors.text, fontSize: 13, fontWeight: '800', marginTop: 4 },
  legend: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: 17,
    padding: 11,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 12,
    backgroundColor: colors.surface,
  },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  legendDot: { width: 9, height: 9, borderRadius: 3 },
  attendeeRow: {
    minHeight: 76,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 10,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  avatar: { width: 42, height: 42, borderRadius: 21 },
  avatarFallback: {
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.secondaryContainer,
  },
  avatarText: { color: colors.secondaryDark, fontSize: 12, fontWeight: '900' },
  stat: { width: 54, alignItems: 'center' },
  statValue: { color: colors.text, fontSize: 14, fontWeight: '800' },
  settingRow: {
    minHeight: 68,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 11,
    paddingVertical: 10,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  info: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 9,
    padding: 12,
    borderRadius: 11,
    backgroundColor: colors.primarySoft,
  },
  infoText: { flex: 1, color: colors.primaryDark, fontSize: 10, lineHeight: 16 },
  empty: { alignItems: 'center', gap: 7, padding: 28 },
  databaseState: {
    minHeight: 360,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
    padding: 28,
    backgroundColor: colors.white,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: colors.border,
  },
  databaseStateTitle: { color: colors.text, fontSize: 18, fontWeight: '900', textAlign: 'center' },
  databaseStateBody: {
    maxWidth: 620,
    color: colors.textMuted,
    fontSize: 13,
    lineHeight: 20,
    textAlign: 'center',
  },
  databaseErrorBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    padding: 12,
    marginBottom: 14,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.danger,
    backgroundColor: '#FFF4F4',
  },
  databaseErrorText: { flex: 1, color: colors.danger, fontSize: 12, lineHeight: 18, fontWeight: '700' },
  overlay: { flex: 1, alignItems: 'flex-start', backgroundColor: 'rgba(8,18,28,0.45)' },
  toast: {
    position: 'absolute',
    alignSelf: 'center',
    minHeight: 42,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 15,
    borderRadius: 99,
    backgroundColor: '#17392e',
  },
  toastText: { color: colors.white, fontSize: 12, fontWeight: '700' },
  searchOverlay: {
    flex: 1,
    alignItems: 'center',
    paddingHorizontal: 16,
    backgroundColor: 'rgba(8,18,28,0.5)',
  },
  searchDialog: {
    width: '100%',
    maxWidth: 650,
    maxHeight: '72%',
    overflow: 'hidden',
    borderRadius: 17,
    backgroundColor: colors.surface,
  },
  searchDialogInput: {
    minHeight: 62,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 15,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  dialogTextInput: { flex: 1, color: colors.text, fontSize: 14 },
  searchResults: { padding: 10 },
  hint: { color: colors.textMuted, textAlign: 'center', padding: 28, fontSize: 11 },
  searchResult: { minHeight: 58, flexDirection: 'row', alignItems: 'center', gap: 10, padding: 9 },
});
