import { Calendar, Clock, Send, X } from 'lucide-react-native';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  ActivityIndicator,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import { ROLE_LABEL_KEY } from '../../constants/roles';
import { colors } from '../../constants/theme';
import { supabase } from '../../lib/supabase';
import type { Profile } from '../../types';

type ScheduleMeetingModalProps = {
  visible: boolean;
  onClose: () => void;
  participants: Profile[];
  preSelectedUserId?: string | null;
  onCreated: () => void;
};

const DATES = ['24 Ekim', '25 Ekim', '26 Ekim', '27 Ekim'];
const TIMES = ['09:30', '11:00', '14:00', '15:30', '16:45', '17:30'];

function proposedDate(dateLabel: string, time: string) {
  const day = Number(dateLabel.split(' ')[0]);
  const eventDay = String(day).padStart(2, '0');
  // Event slots are canonical Istanbul times; device timezone must not shift
  // the request sent to another participant.
  return new Date(`2026-10-${eventDay}T${time}:00+03:00`);
}

export function ScheduleMeetingModal({
  visible,
  onClose,
  participants,
  preSelectedUserId,
  onCreated,
}: ScheduleMeetingModalProps) {
  const { t } = useTranslation();
  const [selectedUserId, setSelectedUserId] = useState<string>('');
  const [selectedDate, setSelectedDate] = useState(DATES[0]);
  const [selectedTime, setSelectedTime] = useState(TIMES[0]);
  const [availableTimes, setAvailableTimes] = useState<string[]>([]);
  const [availabilityLoading, setAvailabilityLoading] = useState(false);
  const [availabilityError, setAvailabilityError] = useState(false);
  const [availabilityRefreshKey, setAvailabilityRefreshKey] = useState(0);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const selectedParticipant =
    participants.find((participant) => participant.user_id === selectedUserId) ?? null;
  const participantLocked = !!preSelectedUserId;

  useEffect(() => {
    if (visible) {
      setSelectedUserId(preSelectedUserId || participants[0]?.user_id || '');
      setSelectedDate(DATES[0]);
      setSelectedTime(TIMES[0]);
      setAvailableTimes([]);
      setAvailabilityError(false);
      setError(null);
    }
  }, [visible, preSelectedUserId, participants]);

  useEffect(() => {
    if (!visible || !selectedUserId) {
      setAvailableTimes([]);
      setAvailabilityLoading(false);
      return;
    }

    let cancelled = false;
    const candidateSlots = TIMES.map((time) => proposedDate(selectedDate, time));

    setAvailabilityLoading(true);
    setAvailabilityError(false);
    setAvailableTimes([]);

    async function loadAvailability() {
      try {
        const { data, error: availabilityQueryError } = await supabase.rpc(
          'get_meeting_available_slots',
          {
            target_user_id: selectedUserId,
            candidate_slots: candidateSlots.map((slot) => slot.toISOString()),
          },
        );

        if (cancelled) return;
        setAvailabilityLoading(false);

        if (availabilityQueryError) {
          setAvailabilityError(true);
          setSelectedTime('');
          return;
        }

        const availableIsoSlots = new Set(
          ((data ?? []) as { slot: string }[]).map((row) => new Date(row.slot).toISOString()),
        );
        const nextAvailableTimes = TIMES.filter((_, index) =>
          availableIsoSlots.has(candidateSlots[index].toISOString()),
        );

        setAvailableTimes(nextAvailableTimes);
        setSelectedTime((current) =>
          nextAvailableTimes.includes(current) ? current : (nextAvailableTimes[0] ?? ''),
        );
      } catch {
        if (cancelled) return;
        setAvailabilityLoading(false);
        setAvailabilityError(true);
        setSelectedTime('');
      }
    }

    void loadAvailability();

    return () => {
      cancelled = true;
    };
  }, [availabilityRefreshKey, selectedDate, selectedUserId, visible]);

  async function handleSubmit() {
    if (!selectedUserId || !selectedTime || !availableTimes.includes(selectedTime)) return;
    setSubmitting(true);
    setError(null);

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      setSubmitting(false);
      setError(t('auth.error'));
      return;
    }

    const proposedTime = proposedDate(selectedDate, selectedTime);

    const { error: insertError } = await supabase.from('meeting_requests').insert({
      from_user_id: user.id,
      to_user_id: selectedUserId,
      status: 'pending',
      proposed_time: proposedTime.toISOString(),
    });

    setSubmitting(false);

    if (insertError) {
      const slotUnavailable =
        insertError.message.includes('no longer available')
        || insertError.message.includes('conflicts with a saved session');
      const pendingExists = insertError.message.includes('already a pending request');
      const pendingLimitReached = insertError.message.includes('Resolve existing pending requests');
      setError(
        slotUnavailable
          ? t('modals.scheduleSlotUnavailable')
          : pendingExists
            ? t('modals.schedulePendingExists')
            : pendingLimitReached
              ? t('modals.schedulePendingLimit')
              : insertError.message,
      );
      if (slotUnavailable) setAvailabilityRefreshKey((current) => current + 1);
      return;
    }

    onCreated();
    onClose();
  }

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.overlay}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />
        <View style={styles.card}>
          <View style={styles.headerRow}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              <View style={styles.headerIcon}>
                <Calendar size={16} color={colors.primary} />
              </View>
              <Text style={styles.title}>{t('modals.scheduleTitle')}</Text>
            </View>
            <Pressable onPress={onClose} hitSlop={8}>
              <X size={20} color={colors.textMuted} />
            </Pressable>
          </View>

          <ScrollView style={styles.body} contentContainerStyle={{ gap: 18 }}>
            {participantLocked && selectedParticipant ? (
              <View style={{ gap: 8 }}>
                <Text style={styles.label}>{t('modals.scheduleWith')}</Text>
                <View style={styles.selectedPersonCard}>
                  <View style={styles.selectedPersonAvatar}>
                    <Text style={styles.selectedPersonAvatarText}>
                      {selectedParticipant.full_name
                        .split(' ')
                        .filter(Boolean)
                        .slice(0, 2)
                        .map((part) => part[0]?.toUpperCase())
                        .join('')}
                    </Text>
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.selectedPersonName} numberOfLines={1}>
                      {selectedParticipant.full_name}
                    </Text>
                    <Text style={styles.selectedPersonMeta} numberOfLines={1}>
                      {[t(ROLE_LABEL_KEY[selectedParticipant.role]), selectedParticipant.company]
                        .filter(Boolean)
                        .join(' | ')}
                    </Text>
                  </View>
                </View>
              </View>
            ) : (
              <View style={{ gap: 8 }}>
                <Text style={styles.label}>{t('modals.scheduleParticipant')}</Text>
                <View style={styles.chipRow}>
                  {participants.map((p) => {
                    const selected = selectedUserId === p.user_id;
                    return (
                      <Pressable
                        key={p.user_id}
                        onPress={() => setSelectedUserId(p.user_id)}
                        style={[styles.personChip, selected && styles.chipSelected]}
                      >
                        <Text
                          style={[styles.chipText, selected && styles.chipTextSelected]}
                          numberOfLines={1}
                        >
                          {p.full_name}
                        </Text>
                      </Pressable>
                    );
                  })}
                </View>
              </View>
            )}

            <View style={{ gap: 8 }}>
              <Text style={styles.label}>{t('modals.scheduleDate')}</Text>
              <View style={styles.chipRow}>
                {DATES.map((d) => {
                  const selected = selectedDate === d;
                  return (
                    <Pressable
                      key={d}
                      onPress={() => setSelectedDate(d)}
                      style={[styles.chip, selected && styles.chipSelected]}
                    >
                      <Text style={[styles.chipText, selected && styles.chipTextSelected]}>
                        {d}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
            </View>

            <View style={{ gap: 8 }}>
              <Text style={styles.label}>{t('modals.scheduleTime')}</Text>
              <Text style={styles.availabilityHint}>{t('modals.scheduleAvailabilityHint')}</Text>
              {availabilityLoading ? (
                <View style={styles.availabilityState}>
                  <ActivityIndicator size="small" color={colors.primary} />
                  <Text style={styles.availabilityStateText}>
                    {t('modals.scheduleCheckingAvailability')}
                  </Text>
                </View>
              ) : availabilityError ? (
                <Text style={styles.availabilityError}>
                  {t('modals.scheduleAvailabilityError')}
                </Text>
              ) : availableTimes.length === 0 ? (
                <Text style={styles.availabilityEmpty}>{t('modals.scheduleNoAvailability')}</Text>
              ) : (
                <View style={styles.chipRow}>
                  {availableTimes.map((time) => {
                    const selected = selectedTime === time;
                    return (
                      <Pressable
                        key={time}
                        onPress={() => setSelectedTime(time)}
                        style={[styles.chip, selected && styles.chipSelectedDark]}
                      >
                        <Clock size={12} color={selected ? colors.white : colors.textMuted} />
                        <Text style={[styles.chipText, selected && { color: colors.white }]}>
                          {time}
                        </Text>
                      </Pressable>
                    );
                  })}
                </View>
              )}
            </View>

            {error ? <Text style={styles.error}>{error}</Text> : null}
          </ScrollView>

          <View style={styles.footer}>
            <Pressable
              style={[
                styles.submitBtn,
                (submitting || availabilityLoading || !selectedUserId || !selectedTime) &&
                  styles.submitBtnDisabled,
              ]}
              onPress={handleSubmit}
              disabled={submitting || availabilityLoading || !selectedUserId || !selectedTime}
            >
              <Send size={16} color={colors.white} />
              <Text style={styles.submitBtnText}>
                {submitting ? t('common.loading') : t('modals.scheduleSubmit')}
              </Text>
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(25,28,29,0.6)',
    justifyContent: 'center',
    padding: 16,
  },
  card: {
    backgroundColor: colors.white,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: colors.border,
    maxHeight: '90%',
    overflow: 'hidden',
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 18,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  headerIcon: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: colors.primarySoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: { fontSize: 16, fontWeight: '800', color: colors.text },
  body: { padding: 20 },
  label: { fontSize: 13, fontWeight: '700', color: colors.text },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 12,
    paddingVertical: 9,
    borderRadius: 12,
    backgroundColor: colors.background,
    borderWidth: 1,
    borderColor: colors.border,
  },
  personChip: {
    paddingHorizontal: 12,
    paddingVertical: 9,
    borderRadius: 12,
    backgroundColor: colors.background,
    borderWidth: 1,
    borderColor: colors.border,
    maxWidth: '100%',
  },
  selectedPersonCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    padding: 12,
    borderRadius: 14,
    backgroundColor: colors.primarySoft,
    borderWidth: 1,
    borderColor: colors.primary,
  },
  selectedPersonAvatar: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: colors.white,
    alignItems: 'center',
    justifyContent: 'center',
  },
  selectedPersonAvatarText: { color: colors.primary, fontSize: 13, fontWeight: '800' },
  selectedPersonName: { color: colors.text, fontSize: 14, fontWeight: '800' },
  selectedPersonMeta: { color: colors.textMuted, fontSize: 11, marginTop: 2 },
  chipSelected: { backgroundColor: colors.primarySoft, borderColor: colors.primary },
  chipSelectedDark: { backgroundColor: colors.primary, borderColor: colors.primary },
  chipText: { fontSize: 12, fontWeight: '600', color: colors.textMuted },
  chipTextSelected: { color: colors.primary },
  availabilityHint: { color: colors.textMuted, fontSize: 11, lineHeight: 16 },
  availabilityState: { flexDirection: 'row', alignItems: 'center', gap: 8, minHeight: 40 },
  availabilityStateText: { color: colors.textMuted, fontSize: 12 },
  availabilityError: { color: colors.danger, fontSize: 12, lineHeight: 17 },
  availabilityEmpty: {
    color: colors.textMuted,
    fontSize: 12,
    lineHeight: 17,
    padding: 12,
    borderRadius: 12,
    backgroundColor: colors.surfaceMuted,
  },
  error: { color: colors.danger, fontSize: 12, textAlign: 'center' },
  footer: { padding: 18, borderTopWidth: 1, borderTopColor: colors.border },
  submitBtn: {
    flexDirection: 'row',
    gap: 8,
    backgroundColor: colors.primary,
    borderRadius: 14,
    paddingVertical: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  submitBtnText: { color: colors.white, fontWeight: '700', fontSize: 14 },
  submitBtnDisabled: { opacity: 0.55 },
});
