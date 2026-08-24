import { Calendar, Check, LockKeyhole, X } from 'lucide-react-native';
import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

import { colors } from '../../constants/theme';
import type {
  CorporateOpportunityInput,
  CorporateOpportunityItem,
} from '../../lib/corporateOpportunitiesRepository';
import type { MeetingRequestItem } from '../../lib/useMeetingRequests';
import type { CorporateOpportunityStage, Profile } from '../../types';

const STAGES: CorporateOpportunityStage[] = [
  'identified',
  'contacted',
  'meeting_scheduled',
  'meeting_completed',
  'evaluation',
  'pilot',
  'won',
  'closed',
];

const MEETING_REQUIRED_STAGES = new Set<CorporateOpportunityStage>([
  'meeting_scheduled',
  'meeting_completed',
  'evaluation',
  'pilot',
  'won',
]);

const PAST_MEETING_REQUIRED_STAGES = new Set<CorporateOpportunityStage>([
  'meeting_completed',
  'evaluation',
  'pilot',
  'won',
]);

function toDateTimeInput(iso?: string | null) {
  if (!iso) return '';
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '';
  const pad = (value: number) => String(value).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

function parseDateTimeInput(value: string): string | null | undefined {
  if (!value.trim()) return null;
  const match = value.trim().match(/^(\d{4})-(\d{2})-(\d{2})[ T](\d{2}):(\d{2})$/);
  if (!match) return undefined;
  const [, year, month, day, hour, minute] = match.map(Number);
  const date = new Date(year, month - 1, day, hour, minute);
  if (
    Number.isNaN(date.getTime()) ||
    date.getFullYear() !== year ||
    date.getMonth() !== month - 1 ||
    date.getDate() !== day ||
    date.getHours() !== hour ||
    date.getMinutes() !== minute
  )
    return undefined;
  return date.toISOString();
}

function defaultTitle(profile: Profile | null | undefined, suffix: string) {
  if (!profile) return '';
  return `${profile.company || profile.full_name} ${suffix}`;
}

type CorporateOpportunityModalProps = {
  visible: boolean;
  opportunity: CorporateOpportunityItem | null;
  targetProfiles: Profile[];
  acceptedMeetings: MeetingRequestItem[];
  initialTargetProfileId?: string;
  initialMeetingRequestId?: string;
  saving: boolean;
  onClose: () => void;
  onSave: (input: CorporateOpportunityInput & { id?: string }) => Promise<void>;
};

export function CorporateOpportunityModal({
  visible,
  opportunity,
  targetProfiles,
  acceptedMeetings,
  initialTargetProfileId,
  initialMeetingRequestId,
  saving,
  onClose,
  onSave,
}: CorporateOpportunityModalProps) {
  const { t, i18n } = useTranslation();
  const [targetProfileId, setTargetProfileId] = useState('');
  const [meetingRequestId, setMeetingRequestId] = useState<string | null>(null);
  const [title, setTitle] = useState('');
  const [stage, setStage] = useState<CorporateOpportunityStage>('identified');
  const [nextAction, setNextAction] = useState('');
  const [nextActionAt, setNextActionAt] = useState('');
  const [privateNotes, setPrivateNotes] = useState('');
  const [validationError, setValidationError] = useState<string | null>(null);

  const selectedTarget = useMemo(
    () =>
      targetProfiles.find((profile) => profile.id === targetProfileId) ??
      opportunity?.targetProfile ??
      null,
    [opportunity?.targetProfile, targetProfileId, targetProfiles],
  );
  const meetingsForTarget = useMemo(
    () => acceptedMeetings.filter((meeting) => meeting.otherProfile?.id === targetProfileId),
    [acceptedMeetings, targetProfileId],
  );
  const selectedMeeting =
    meetingsForTarget.find((meeting) => meeting.id === meetingRequestId) ?? null;
  const dateLocale = i18n.language?.toLowerCase().startsWith('en') ? 'en-US' : 'tr-TR';
  // A card/accepted-meeting entry point already identifies the intended
  // participant. Do not turn that focused action back into a people picker.
  const targetLocked = Boolean(opportunity || initialTargetProfileId);

  useEffect(() => {
    if (!visible) return;
    const nextTargetId = opportunity?.target_profile_id ?? initialTargetProfileId ?? '';
    const nextMeetingId = opportunity?.meeting_request_id ?? initialMeetingRequestId ?? null;
    const target =
      targetProfiles.find((profile) => profile.id === nextTargetId) ?? opportunity?.targetProfile;
    const meeting = acceptedMeetings.find((item) => item.id === nextMeetingId);
    const defaultStage: CorporateOpportunityStage = nextMeetingId
      ? meeting?.proposed_time && new Date(meeting.proposed_time).getTime() > Date.now()
        ? 'meeting_scheduled'
        : 'contacted'
      : 'identified';
    setTargetProfileId(nextTargetId);
    setMeetingRequestId(nextMeetingId);
    setTitle(
      opportunity?.title ?? defaultTitle(target, t('corporate.opportunityDefaultTitleSuffix')),
    );
    setStage(opportunity?.stage ?? defaultStage);
    setNextAction(opportunity?.next_action ?? '');
    setNextActionAt(toDateTimeInput(opportunity?.next_action_at));
    setPrivateNotes(opportunity?.private_notes ?? '');
    setValidationError(null);
  }, [
    acceptedMeetings,
    initialMeetingRequestId,
    initialTargetProfileId,
    opportunity,
    t,
    targetProfiles,
    visible,
  ]);

  function stageDisabled(candidate: CorporateOpportunityStage) {
    if (MEETING_REQUIRED_STAGES.has(candidate) && !selectedMeeting) return true;
    if (
      PAST_MEETING_REQUIRED_STAGES.has(candidate) &&
      selectedMeeting?.proposed_time &&
      new Date(selectedMeeting.proposed_time).getTime() > Date.now()
    )
      return true;
    if (
      candidate === 'meeting_scheduled' &&
      selectedMeeting?.proposed_time &&
      new Date(selectedMeeting.proposed_time).getTime() <= Date.now()
    )
      return true;
    return false;
  }

  function selectTarget(profile: Profile) {
    setTargetProfileId(profile.id);
    setMeetingRequestId(null);
    setStage('identified');
    const suffix = t('corporate.opportunityDefaultTitleSuffix');
    if (!title.trim() || title === defaultTitle(selectedTarget, suffix))
      setTitle(defaultTitle(profile, suffix));
  }

  async function submit() {
    setValidationError(null);
    if (!targetProfileId) {
      setValidationError(t('corporate.opportunityTargetRequired'));
      return;
    }
    if (!title.trim()) {
      setValidationError(t('corporate.opportunityTitleRequired'));
      return;
    }
    const parsedNextActionAt = parseDateTimeInput(nextActionAt);
    if (parsedNextActionAt === undefined) {
      setValidationError(t('corporate.opportunityDateInvalid'));
      return;
    }
    if (parsedNextActionAt && !nextAction.trim()) {
      setValidationError(t('corporate.opportunityActionRequired'));
      return;
    }
    if (stageDisabled(stage)) {
      setValidationError(t('corporate.opportunityStageMeetingRequired'));
      return;
    }

    await onSave({
      id: opportunity?.id,
      targetProfileId,
      meetingRequestId,
      title: title.trim(),
      stage,
      nextAction: nextAction.trim() || null,
      nextActionAt: parsedNextActionAt,
      privateNotes: privateNotes.trim() || null,
    });
  }

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <KeyboardAvoidingView
        style={styles.overlay}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <View style={styles.overlayInner}>
          <View style={styles.sheet}>
            <View style={styles.header}>
              <View style={{ flex: 1 }}>
                <Text style={styles.title}>
                  {t(
                    opportunity
                      ? 'corporate.opportunityEditTitle'
                      : 'corporate.opportunityCreateTitle',
                  )}
                </Text>
                <Text style={styles.subtitle}>{t('corporate.opportunityPrivateHint')}</Text>
              </View>
              <Pressable onPress={onClose} style={styles.closeButton} hitSlop={8}>
                <X size={22} color={colors.textMuted} />
              </Pressable>
            </View>

            <ScrollView
              style={styles.formScroll}
              keyboardShouldPersistTaps="handled"
              keyboardDismissMode="on-drag"
              contentContainerStyle={styles.form}
              showsVerticalScrollIndicator={false}
            >
              <View style={styles.privateBanner}>
                <LockKeyhole size={15} color={colors.primary} />
                <Text style={styles.privateBannerText}>{t('corporate.opportunityOwnerOnly')}</Text>
              </View>

              <Text style={styles.label}>{t('corporate.opportunityTarget')}</Text>
              {targetLocked ? (
                <View style={styles.lockedTarget}>
                  <Text style={styles.lockedTargetText}>{selectedTarget?.full_name ?? '—'}</Text>
                  <Text style={styles.lockedTargetSub}>
                    {selectedTarget?.company ?? selectedTarget?.sector ?? ''}
                  </Text>
                </View>
              ) : (
                <View style={styles.chipWrap}>
                  {targetProfiles.map((profile) => {
                    const selected = profile.id === targetProfileId;
                    return (
                      <Pressable
                        key={profile.id}
                        style={[styles.chip, selected && styles.chipSelected]}
                        onPress={() => selectTarget(profile)}
                      >
                        <Text style={[styles.chipText, selected && styles.chipTextSelected]}>
                          {profile.full_name}
                        </Text>
                      </Pressable>
                    );
                  })}
                </View>
              )}

              <Text style={styles.label}>{t('corporate.opportunityTitleLabel')}</Text>
              <TextInput
                value={title}
                onChangeText={setTitle}
                style={styles.input}
                maxLength={160}
                placeholder={t('corporate.opportunityTitlePlaceholder')}
                placeholderTextColor={colors.textFaint}
              />

              <Text style={styles.label}>{t('corporate.opportunityMeetingLabel')}</Text>
              <View style={styles.chipWrap}>
                <Pressable
                  style={[styles.chip, meetingRequestId === null && styles.chipSelected]}
                  onPress={() => {
                    setMeetingRequestId(null);
                    if (MEETING_REQUIRED_STAGES.has(stage)) setStage('identified');
                  }}
                >
                  <Text
                    style={[styles.chipText, meetingRequestId === null && styles.chipTextSelected]}
                  >
                    {t('corporate.opportunityNoMeeting')}
                  </Text>
                </Pressable>
                {meetingsForTarget.map((meeting) => {
                  const selected = meeting.id === meetingRequestId;
                  const label = meeting.proposed_time
                    ? new Date(meeting.proposed_time).toLocaleString(dateLocale, {
                        day: '2-digit',
                        month: 'short',
                        hour: '2-digit',
                        minute: '2-digit',
                      })
                    : t('meetings.statusAccepted');
                  return (
                    <Pressable
                      key={meeting.id}
                      style={[styles.chip, selected && styles.chipSelected]}
                      onPress={() => setMeetingRequestId(meeting.id)}
                    >
                      <Calendar size={13} color={selected ? colors.white : colors.primary} />
                      <Text style={[styles.chipText, selected && styles.chipTextSelected]}>
                        {label}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
              {meetingsForTarget.length === 0 ? (
                <Text style={styles.hint}>{t('corporate.opportunityNoAcceptedMeeting')}</Text>
              ) : null}

              <Text style={styles.label}>{t('corporate.opportunityStageLabel')}</Text>
              <View style={styles.chipWrap}>
                {STAGES.map((candidate) => {
                  const selected = candidate === stage;
                  const disabled = stageDisabled(candidate);
                  return (
                    <Pressable
                      key={candidate}
                      style={[
                        styles.chip,
                        selected && styles.chipSelected,
                        disabled && styles.chipDisabled,
                      ]}
                      onPress={() => setStage(candidate)}
                      disabled={disabled}
                    >
                      {selected ? <Check size={13} color={colors.white} /> : null}
                      <Text style={[styles.chipText, selected && styles.chipTextSelected]}>
                        {t(`corporate.opportunityStages.${candidate}`)}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
              <Text style={styles.hint}>{t('corporate.opportunityStageHint')}</Text>

              <Text style={styles.label}>{t('corporate.opportunityNextActionLabel')}</Text>
              <TextInput
                value={nextAction}
                onChangeText={setNextAction}
                style={styles.input}
                maxLength={500}
                placeholder={t('corporate.opportunityNextActionPlaceholder')}
                placeholderTextColor={colors.textFaint}
              />

              <Text style={styles.label}>{t('corporate.opportunityNextActionDateLabel')}</Text>
              <TextInput
                value={nextActionAt}
                onChangeText={setNextActionAt}
                style={styles.input}
                autoCapitalize="none"
                keyboardType="numbers-and-punctuation"
                placeholder="2026-10-25 14:00"
                placeholderTextColor={colors.textFaint}
              />

              <Text style={styles.label}>{t('corporate.opportunityPrivateNotesLabel')}</Text>
              <TextInput
                value={privateNotes}
                onChangeText={setPrivateNotes}
                style={[styles.input, styles.notesInput]}
                multiline
                maxLength={4000}
                textAlignVertical="top"
                placeholder={t('corporate.opportunityPrivateNotesPlaceholder')}
                placeholderTextColor={colors.textFaint}
              />

              {validationError ? <Text style={styles.error}>{validationError}</Text> : null}

              <Pressable
                style={[styles.saveButton, saving && styles.saveButtonDisabled]}
                onPress={() => void submit()}
                disabled={saving}
              >
                <Text style={styles.saveButtonText}>
                  {t(saving ? 'common.loading' : 'common.save')}
                </Text>
              </Pressable>
            </ScrollView>
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: 'rgba(25,28,29,0.5)' },
  overlayInner: { flex: 1, justifyContent: 'flex-end' },
  sheet: {
    height: '92%',
    backgroundColor: colors.white,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    overflow: 'hidden',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    padding: 18,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  title: { color: colors.text, fontSize: 19, fontWeight: '800' },
  subtitle: { color: colors.textMuted, fontSize: 12, marginTop: 3 },
  closeButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.background,
  },
  formScroll: { flex: 1 },
  form: { padding: 18, paddingBottom: 36, gap: 10 },
  privateBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    padding: 10,
    borderRadius: 10,
    backgroundColor: colors.primarySoft,
  },
  privateBannerText: {
    flex: 1,
    color: colors.primaryDark,
    fontSize: 11,
    lineHeight: 16,
    fontWeight: '700',
  },
  label: { color: colors.text, fontSize: 12, fontWeight: '800', marginTop: 4 },
  hint: { color: colors.textFaint, fontSize: 10, lineHeight: 15 },
  input: {
    borderWidth: 1,
    borderColor: colors.borderStrong,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 11,
    color: colors.text,
    backgroundColor: colors.white,
    fontSize: 13,
  },
  notesInput: { minHeight: 105 },
  chipWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 7 },
  chip: {
    minHeight: 34,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    borderRadius: 17,
    paddingHorizontal: 11,
    paddingVertical: 7,
    borderWidth: 1,
    borderColor: colors.borderStrong,
    backgroundColor: colors.white,
  },
  chipSelected: { backgroundColor: colors.primary, borderColor: colors.primary },
  chipDisabled: { opacity: 0.38 },
  chipText: { color: colors.textMuted, fontSize: 11, fontWeight: '700' },
  chipTextSelected: { color: colors.white },
  lockedTarget: {
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.background,
    padding: 12,
  },
  lockedTargetText: { color: colors.text, fontSize: 13, fontWeight: '800' },
  lockedTargetSub: { color: colors.textMuted, fontSize: 11, marginTop: 2 },
  error: {
    color: colors.danger,
    fontSize: 11,
    lineHeight: 16,
    padding: 10,
    borderRadius: 10,
    backgroundColor: colors.dangerBg,
  },
  saveButton: {
    marginTop: 4,
    borderRadius: 13,
    backgroundColor: colors.primary,
    minHeight: 48,
    alignItems: 'center',
    justifyContent: 'center',
  },
  saveButtonDisabled: { opacity: 0.55 },
  saveButtonText: { color: colors.white, fontSize: 14, fontWeight: '800' },
});
