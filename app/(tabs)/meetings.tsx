import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Calendar, Check, Clock, FileText, MapPin, Plus, X } from 'lucide-react-native';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { FlatList, Image, Pressable, StyleSheet, Text, View } from 'react-native';

import { AppHeader } from '../../components/AppHeader';
import { MeetingNoteModal } from '../../components/modals/MeetingNoteModal';
import { NotificationsModal } from '../../components/modals/NotificationsModal';
import { ScheduleMeetingModal } from '../../components/modals/ScheduleMeetingModal';
import { colors } from '../../constants/theme';
import { supabase } from '../../lib/supabase';
import { useCurrentProfile } from '../../lib/useCurrentProfile';
import { useMeetingNotes } from '../../lib/useMeetingNotes';
import { useMeetingRequests, type MeetingRequestItem } from '../../lib/useMeetingRequests';
import type { MeetingStatus, Profile } from '../../types';

async function fetchAllProfiles(myUserId: string): Promise<Profile[]> {
  const { data, error } = await supabase.from('profiles').select('*').neq('user_id', myUserId);
  if (error) throw error;
  return (data ?? []) as Profile[];
}

function initialsFor(name?: string) {
  if (!name) return '?';
  return name.split(' ').filter(Boolean).slice(0, 2).map((p) => p[0]?.toUpperCase()).join('');
}

function StatusBadge({ status }: { status: MeetingStatus }) {
  const { t } = useTranslation();
  const map: Record<MeetingStatus, { bg: string; border: string; color: string; icon: any; label: string }> = {
    pending: { bg: colors.surfaceMuted, border: colors.surfaceHigh, color: colors.textFaint, icon: Clock, label: t('meetings.statusPending') },
    accepted: { bg: colors.successBg, border: colors.successBorder, color: colors.success, icon: Check, label: t('meetings.statusAccepted') },
    rejected: { bg: colors.dangerBg, border: colors.dangerBorder, color: colors.danger, icon: X, label: t('meetings.statusRejected') },
  };
  const cfg = map[status];
  const Icon = cfg.icon;
  return (
    <View style={[styles.statusBadge, { backgroundColor: cfg.bg, borderColor: cfg.border }]}>
      <Icon size={11} color={cfg.color} />
      <Text style={[styles.statusBadgeText, { color: cfg.color }]}>{cfg.label}</Text>
    </View>
  );
}

export default function MeetingsScreen() {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const { data: meResult } = useCurrentProfile();
  const { data } = useMeetingRequests();
  const items = data?.items ?? [];

  const { data: allParticipants = [] } = useQuery({
    queryKey: ['profiles', 'others', meResult?.userId],
    queryFn: () => fetchAllProfiles(meResult!.userId),
    enabled: !!meResult?.userId,
  });

  const [tab, setTab] = useState<'incoming' | 'outgoing'>('incoming');
  const [scheduleOpen, setScheduleOpen] = useState(false);
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [noteTarget, setNoteTarget] = useState<MeetingRequestItem | null>(null);
  const notes = useMeetingNotes(meResult?.userId);

  const incoming = items.filter((m) => m.direction === 'incoming');
  const outgoing = items.filter((m) => m.direction === 'outgoing');
  const currentList = tab === 'incoming' ? incoming : outgoing;

  async function updateStatus(id: string, status: 'accepted' | 'rejected') {
    await supabase.from('meeting_requests').update({ status }).eq('id', id);
    queryClient.invalidateQueries({ queryKey: ['meeting_requests'] });
  }

  function formatProposedTime(iso?: string | null) {
    if (!iso) return '';
    const date = new Date(iso);
    return `${date.toLocaleDateString('tr-TR', { day: '2-digit', month: 'short' })}, ${date.toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' })}`;
  }

  return (
    <View style={styles.screen}>
      <AppHeader
        activeTab="toplantilar"
        profile={meResult?.profile}
        onOpenNotifications={() => setNotificationsOpen(true)}
      />

      <FlatList
        data={currentList}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.listContent}
        ListHeaderComponent={
          <View style={{ gap: 16 }}>
            <View style={styles.titleRow}>
              <View style={{ flex: 1 }}>
                <Text style={styles.title}>{t('meetings.title')}</Text>
                <Text style={styles.subtitle}>{t('meetings.subtitle')}</Text>
              </View>
              <Pressable style={styles.newRequestBtn} onPress={() => setScheduleOpen(true)}>
                <Plus size={15} color={colors.white} />
                <Text style={styles.newRequestBtnText}>{t('meetings.newRequest')}</Text>
              </Pressable>
            </View>

            <View style={styles.segmentRow}>
              <Pressable
                style={[styles.segment, tab === 'incoming' && styles.segmentActive]}
                onPress={() => setTab('incoming')}
              >
                <Text style={[styles.segmentText, tab === 'incoming' && styles.segmentTextActive]}>
                  {t('meetings.incoming')} ({incoming.length})
                </Text>
              </Pressable>
              <Pressable
                style={[styles.segment, tab === 'outgoing' && styles.segmentActive]}
                onPress={() => setTab('outgoing')}
              >
                <Text style={[styles.segmentText, tab === 'outgoing' && styles.segmentTextActive]}>
                  {t('meetings.outgoing')} ({outgoing.length})
                </Text>
              </Pressable>
            </View>
          </View>
        }
        ListEmptyComponent={
          <View style={styles.emptyState}>
            <Calendar size={22} color={colors.textMuted} />
            <Text style={styles.emptyTitle}>
              {tab === 'incoming' ? t('meetings.emptyIncoming') : t('meetings.emptyOutgoing')}
            </Text>
            <Text style={styles.emptyBody}>{t('meetings.emptyHint')}</Text>
          </View>
        }
        renderItem={({ item }: { item: MeetingRequestItem }) => (
          <View style={styles.card}>
            <View style={styles.cardHeader}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, flex: 1 }}>
                {item.otherProfile?.photo_url ? (
                  <Image source={{ uri: item.otherProfile.photo_url }} style={styles.avatar} />
                ) : (
                  <View style={[styles.avatar, styles.avatarFallback]}>
                    <Text style={styles.avatarFallbackText}>{initialsFor(item.otherProfile?.full_name)}</Text>
                  </View>
                )}
                <View style={{ flex: 1 }}>
                  <Text style={styles.personName} numberOfLines={1}>
                    {item.otherProfile?.full_name ?? '—'}
                  </Text>
                  <Text style={styles.personSub} numberOfLines={1}>
                    {item.otherProfile?.sector ?? ''}
                  </Text>
                </View>
              </View>
              <StatusBadge status={item.status} />
            </View>

            {item.proposed_time ? (
              <View style={styles.dateBox}>
                <Calendar size={14} color={colors.primary} />
                <Text style={styles.dateText}>{formatProposedTime(item.proposed_time)}</Text>
                <MapPin size={13} color={colors.textFaint} style={{ marginLeft: 'auto' }} />
              </View>
            ) : null}

            {tab === 'incoming' && item.status === 'pending' ? (
              <View style={styles.actionRow}>
                <Pressable style={styles.declineBtn} onPress={() => updateStatus(item.id, 'rejected')}>
                  <X size={15} color={colors.danger} />
                  <Text style={styles.declineBtnText}>{t('meetings.reject')}</Text>
                </Pressable>
                <Pressable style={styles.acceptBtn} onPress={() => updateStatus(item.id, 'accepted')}>
                  <Check size={15} color={colors.white} />
                  <Text style={styles.acceptBtnText}>{t('meetings.accept')}</Text>
                </Pressable>
              </View>
            ) : null}

            {item.status === 'accepted' ? (
              <View style={styles.acceptedRow}>
                <Check size={13} color={colors.success} />
                <Text style={styles.acceptedText}>{t('meetings.acceptedNote')}</Text>
                <Pressable
                  style={styles.noteBtn}
                  onPress={() => setNoteTarget(item)}
                  hitSlop={8}
                >
                  <FileText size={13} color={colors.primary} />
                  <Text style={styles.noteBtnText}>
                    {notes.byMeetingId.has(item.id) ? t('entrepreneur.editNote') : t('entrepreneur.addNote')}
                  </Text>
                </Pressable>
              </View>
            ) : null}
          </View>
        )}
      />

      <ScheduleMeetingModal
        visible={scheduleOpen}
        onClose={() => setScheduleOpen(false)}
        participants={allParticipants}
        onCreated={() => queryClient.invalidateQueries({ queryKey: ['meeting_requests'] })}
      />

      <NotificationsModal visible={notificationsOpen} onClose={() => setNotificationsOpen(false)} />

      <MeetingNoteModal
        visible={noteTarget !== null}
        participantName={noteTarget?.otherProfile?.full_name ?? ''}
        initialNote={noteTarget ? notes.byMeetingId.get(noteTarget.id)?.note ?? '' : ''}
        saving={notes.isSaving}
        onClose={() => setNoteTarget(null)}
        onSave={async (note) => {
          if (!noteTarget) return;
          await notes.save({ meetingRequestId: noteTarget.id, note });
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  listContent: { padding: 16, paddingBottom: 32, gap: 14 },
  titleRow: { flexDirection: 'row', alignItems: 'flex-start' },
  title: { fontSize: 24, fontWeight: '800', color: colors.text },
  subtitle: { fontSize: 13, color: colors.textMuted, marginTop: 2 },
  newRequestBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: colors.primary,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 9,
  },
  newRequestBtnText: { color: colors.white, fontSize: 12, fontWeight: '700' },
  segmentRow: {
    flexDirection: 'row',
    backgroundColor: colors.surfaceMuted,
    borderRadius: 12,
    padding: 4,
    borderWidth: 1,
    borderColor: colors.border,
  },
  segment: { flex: 1, paddingVertical: 10, borderRadius: 9, alignItems: 'center' },
  segmentActive: { backgroundColor: colors.white },
  segmentText: { fontSize: 13, fontWeight: '700', color: colors.textFaint },
  segmentTextActive: { color: colors.primary },
  emptyState: {
    backgroundColor: colors.white,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 28,
    alignItems: 'center',
    gap: 8,
  },
  emptyTitle: { fontSize: 14, fontWeight: '700', color: colors.text, textAlign: 'center' },
  emptyBody: { fontSize: 12, color: colors.textMuted, textAlign: 'center' },
  card: {
    backgroundColor: colors.white,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 14,
    gap: 12,
    marginBottom: 12,
  },
  cardHeader: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  avatar: { width: 46, height: 46, borderRadius: 23 },
  avatarFallback: { backgroundColor: colors.secondaryContainer, alignItems: 'center', justifyContent: 'center' },
  avatarFallbackText: { fontSize: 14, fontWeight: '800', color: colors.secondaryDark },
  personName: { fontSize: 14, fontWeight: '700', color: colors.text },
  personSub: { fontSize: 12, color: colors.textFaint, marginTop: 2 },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    borderRadius: 999,
    borderWidth: 1,
    paddingHorizontal: 9,
    paddingVertical: 4,
  },
  statusBadgeText: { fontSize: 10, fontWeight: '700' },
  dateBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: colors.background,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  dateText: { fontSize: 13, fontWeight: '700', color: colors.text },
  actionRow: { flexDirection: 'row', gap: 10, paddingTop: 8, borderTopWidth: 1, borderTopColor: colors.background },
  declineBtn: {
    flex: 1,
    flexDirection: 'row',
    gap: 6,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 11,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.dangerBorder,
  },
  declineBtnText: { fontSize: 12, fontWeight: '700', color: colors.danger },
  acceptBtn: {
    flex: 1,
    flexDirection: 'row',
    gap: 6,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 11,
    borderRadius: 12,
    backgroundColor: colors.success,
  },
  acceptBtnText: { fontSize: 12, fontWeight: '700', color: colors.white },
  acceptedRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: colors.background,
  },
  acceptedText: { fontSize: 12, fontWeight: '700', color: colors.success },
  noteBtn: {
    marginLeft: 'auto',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  noteBtnText: { fontSize: 11, fontWeight: '700', color: colors.primary },
});
