import { Calendar, Clock, Send, X } from 'lucide-react-native';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

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
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (visible) {
      setSelectedUserId(preSelectedUserId || participants[0]?.user_id || '');
      setSelectedDate(DATES[0]);
      setSelectedTime(TIMES[0]);
      setError(null);
    }
  }, [visible, preSelectedUserId, participants]);

  async function handleSubmit() {
    if (!selectedUserId) return;
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

    const currentYear = new Date().getFullYear();
    const [day, monthName] = selectedDate.split(' ');
    const monthIndex = ['Ocak', 'Şubat', 'Mart', 'Nisan', 'Mayıs', 'Haziran', 'Temmuz', 'Ağustos', 'Eylül', 'Ekim', 'Kasım', 'Aralık'].indexOf(monthName);
    const [hours, minutes] = selectedTime.split(':').map(Number);
    const proposedTime = new Date(currentYear, monthIndex >= 0 ? monthIndex : 9, Number(day), hours, minutes);

    const { error: insertError } = await supabase.from('meeting_requests').insert({
      from_user_id: user.id,
      to_user_id: selectedUserId,
      status: 'pending',
      proposed_time: proposedTime.toISOString(),
    });

    setSubmitting(false);

    if (insertError) {
      setError(insertError.message);
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
                      <Text style={[styles.chipText, selected && styles.chipTextSelected]} numberOfLines={1}>
                        {p.full_name}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
            </View>

            <View style={{ gap: 8 }}>
              <Text style={styles.label}>{t('modals.scheduleDate')}</Text>
              <View style={styles.chipRow}>
                {DATES.map((d) => {
                  const selected = selectedDate === d;
                  return (
                    <Pressable key={d} onPress={() => setSelectedDate(d)} style={[styles.chip, selected && styles.chipSelected]}>
                      <Text style={[styles.chipText, selected && styles.chipTextSelected]}>{d}</Text>
                    </Pressable>
                  );
                })}
              </View>
            </View>

            <View style={{ gap: 8 }}>
              <Text style={styles.label}>{t('modals.scheduleTime')}</Text>
              <View style={styles.chipRow}>
                {TIMES.map((time) => {
                  const selected = selectedTime === time;
                  return (
                    <Pressable
                      key={time}
                      onPress={() => setSelectedTime(time)}
                      style={[styles.chip, selected && styles.chipSelectedDark]}
                    >
                      <Clock size={12} color={selected ? colors.white : colors.textMuted} />
                      <Text style={[styles.chipText, selected && { color: colors.white }]}>{time}</Text>
                    </Pressable>
                  );
                })}
              </View>
            </View>

            {error ? <Text style={styles.error}>{error}</Text> : null}
          </ScrollView>

          <View style={styles.footer}>
            <Pressable style={styles.submitBtn} onPress={handleSubmit} disabled={submitting || !selectedUserId}>
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
  overlay: { flex: 1, backgroundColor: 'rgba(25,28,29,0.6)', justifyContent: 'center', padding: 16 },
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
  chipSelected: { backgroundColor: colors.primarySoft, borderColor: colors.primary },
  chipSelectedDark: { backgroundColor: colors.primary, borderColor: colors.primary },
  chipText: { fontSize: 12, fontWeight: '600', color: colors.textMuted },
  chipTextSelected: { color: colors.primary },
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
});
