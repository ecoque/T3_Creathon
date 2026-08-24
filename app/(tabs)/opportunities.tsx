import { router, useLocalSearchParams } from 'expo-router';
import {
  ArrowLeft,
  CalendarClock,
  CheckCircle2,
  ChevronRight,
  Clock3,
  FolderKanban,
  History,
  Plus,
} from 'lucide-react-native';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ActivityIndicator, Alert, FlatList, Pressable, StyleSheet, Text, View } from 'react-native';

import { AppHeader } from '../../components/AppHeader';
import { CorporateOpportunityModal } from '../../components/modals/CorporateOpportunityModal';
import { NotificationsModal } from '../../components/modals/NotificationsModal';
import { colors } from '../../constants/theme';
import { isCorporateSchemaMissing } from '../../features/corporate/schema';
import {
  CorporateOpportunityConflictError,
  type CorporateOpportunityInput,
  type CorporateOpportunityItem,
} from '../../lib/corporateOpportunitiesRepository';
import { useCorporateOpportunities } from '../../lib/useCorporateOpportunities';
import { useCurrentProfile } from '../../lib/useCurrentProfile';
import { useMeetingRequests } from '../../lib/useMeetingRequests';
import { useOtherProfiles } from '../../lib/useOtherProfiles';

function firstParam(value?: string | string[]) {
  return Array.isArray(value) ? value[0] : value;
}

export default function CorporateOpportunitiesScreen() {
  const { t, i18n } = useTranslation();
  const params = useLocalSearchParams<{
    targetProfileId?: string | string[];
    meetingRequestId?: string | string[];
    openKey?: string | string[];
  }>();
  const { data: meResult } = useCurrentProfile();
  const myProfile = meResult?.profile ?? null;
  const isCorporate = myProfile?.role === 'kurum';
  const opportunities = useCorporateOpportunities(meResult?.userId, isCorporate);
  const { data: otherProfiles = [] } = useOtherProfiles();
  const { data: meetingResult } = useMeetingRequests();
  const [editorOpen, setEditorOpen] = useState(false);
  const [editing, setEditing] = useState<CorporateOpportunityItem | null>(null);
  const [editorTargetProfileId, setEditorTargetProfileId] = useState<string | undefined>();
  const [editorMeetingRequestId, setEditorMeetingRequestId] = useState<string | undefined>();
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const handledRouteKey = useRef<string | null>(null);
  const dateLocale = i18n.language?.toLowerCase().startsWith('en') ? 'en-US' : 'tr-TR';

  const targetProfiles = useMemo(
    () => otherProfiles
      .filter((profile) => ['girisimci', 'kurum'].includes(profile.role) && profile.status === 'active')
      .sort((a, b) => a.full_name.localeCompare(b.full_name, dateLocale)),
    [dateLocale, otherProfiles],
  );
  const acceptedMeetings = useMemo(
    () => (meetingResult?.items ?? []).filter(
      (meeting) => meeting.status === 'accepted'
        && !!meeting.proposed_time
        && !!meeting.otherProfile
        && ['girisimci', 'kurum'].includes(meeting.otherProfile.role),
    ),
    [meetingResult?.items],
  );

  const routeTargetProfileId = firstParam(params.targetProfileId);
  const routeMeetingRequestId = firstParam(params.meetingRequestId);
  const routeOpenKey = firstParam(params.openKey);

  useEffect(() => {
    if (!isCorporate || opportunities.isLoading || !routeTargetProfileId) return;
    const existing = opportunities.items.find((item) => item.target_profile_id === routeTargetProfileId) ?? null;
    if (!existing && !targetProfiles.some((profile) => profile.id === routeTargetProfileId)) return;
    const routeKey = `${routeTargetProfileId}:${routeMeetingRequestId ?? ''}:${routeOpenKey ?? ''}`;
    if (handledRouteKey.current === routeKey) return;
    handledRouteKey.current = routeKey;
    setEditing(existing);
    setEditorTargetProfileId(routeTargetProfileId);
    setEditorMeetingRequestId(routeMeetingRequestId);
    setEditorOpen(true);
  }, [
    isCorporate,
    opportunities.isLoading,
    opportunities.items,
    routeMeetingRequestId,
    routeOpenKey,
    routeTargetProfileId,
    targetProfiles,
  ]);

  function openNew() {
    opportunities.clearSaveError();
    setEditing(null);
    setEditorTargetProfileId(undefined);
    setEditorMeetingRequestId(undefined);
    setEditorOpen(true);
  }

  function openEdit(item: CorporateOpportunityItem) {
    opportunities.clearSaveError();
    setEditing(item);
    setEditorTargetProfileId(item.target_profile_id);
    setEditorMeetingRequestId(item.meeting_request_id ?? undefined);
    setEditorOpen(true);
  }

  async function saveOpportunity(input: CorporateOpportunityInput & { id?: string }) {
    try {
      await opportunities.save(input);
      setEditorOpen(false);
      setEditing(null);
    } catch (error) {
      const message = error instanceof CorporateOpportunityConflictError
        ? t('corporate.opportunityDuplicate')
        : isCorporateSchemaMissing(error)
          ? t('corporate.migrationRequired')
          : t('corporate.opportunitySaveError');
      Alert.alert(t('corporate.opportunitySaveErrorTitle'), message);
    }
  }

  function formatDate(iso?: string | null) {
    if (!iso) return '';
    return new Date(iso).toLocaleString(dateLocale, {
      day: '2-digit',
      month: 'short',
      hour: '2-digit',
      minute: '2-digit',
    });
  }

  const activeCount = opportunities.items.filter((item) => !['won', 'closed'].includes(item.stage)).length;
  const nextActionCount = opportunities.items.filter((item) => item.next_action).length;
  const queryErrorMessage = opportunities.queryError
    ? isCorporateSchemaMissing(opportunities.queryError)
      ? t('corporate.migrationRequired')
      : t('corporate.opportunityLoadError')
    : null;

  if (meResult && !isCorporate) {
    return (
      <View style={styles.screen}>
        <AppHeader activeTab="toplantilar" profile={myProfile} onOpenNotifications={() => setNotificationsOpen(true)} />
        <View style={styles.restrictedState}>
          <FolderKanban size={28} color={colors.textMuted} />
          <Text style={styles.emptyTitle}>{t('corporate.opportunityCorporateOnly')}</Text>
          <Pressable style={styles.secondaryButton} onPress={() => router.replace('/(tabs)/home')}>
            <Text style={styles.secondaryButtonText}>{t('home.title')}</Text>
          </Pressable>
        </View>
        <NotificationsModal visible={notificationsOpen} onClose={() => setNotificationsOpen(false)} />
      </View>
    );
  }

  return (
    <View style={styles.screen}>
      <AppHeader activeTab="toplantilar" profile={myProfile} onOpenNotifications={() => setNotificationsOpen(true)} />
      <FlatList
        data={opportunities.items}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.listContent}
        onRefresh={() => void opportunities.refetch()}
        refreshing={opportunities.isLoading}
        ListHeaderComponent={
          <View style={styles.headerContent}>
            <View style={styles.titleRow}>
              <Pressable style={styles.backButton} onPress={() => router.back()} hitSlop={8}>
                <ArrowLeft size={20} color={colors.textMuted} />
              </Pressable>
              <View style={{ flex: 1 }}>
                <Text style={styles.title}>{t('corporate.opportunitiesTitle')}</Text>
                <Text style={styles.subtitle}>{t('corporate.opportunitiesSubtitle')}</Text>
              </View>
            </View>

            <View style={styles.summaryRow}>
              <View style={styles.summaryCard}>
                <FolderKanban size={18} color={colors.primary} />
                <Text style={styles.summaryValue}>{activeCount}</Text>
                <Text style={styles.summaryLabel}>{t('corporate.opportunityActiveCount')}</Text>
              </View>
              <View style={styles.summaryCard}>
                <CalendarClock size={18} color={colors.secondaryDark} />
                <Text style={styles.summaryValue}>{nextActionCount}</Text>
                <Text style={styles.summaryLabel}>{t('corporate.opportunityActionCount')}</Text>
              </View>
            </View>

            <Pressable style={styles.newButton} onPress={openNew} disabled={!isCorporate || targetProfiles.length === 0}>
              <Plus size={17} color={colors.white} />
              <Text style={styles.newButtonText}>{t('corporate.opportunityNew')}</Text>
            </Pressable>

            {opportunities.isLoading ? <ActivityIndicator color={colors.primary} /> : null}
            {queryErrorMessage ? (
              <View style={styles.errorBox}>
                <Text style={styles.errorText}>{queryErrorMessage}</Text>
                <Pressable onPress={() => void opportunities.refetch()}>
                  <Text style={styles.retryText}>{t('corporate.opportunityRetry')}</Text>
                </Pressable>
              </View>
            ) : null}

            <Text style={styles.sectionTitle}>{t('corporate.opportunityPipeline')}</Text>
          </View>
        }
        ListEmptyComponent={
          !opportunities.isLoading && !queryErrorMessage ? (
            <View style={styles.emptyState}>
              <FolderKanban size={24} color={colors.textMuted} />
              <Text style={styles.emptyTitle}>{t('corporate.opportunityEmptyTitle')}</Text>
              <Text style={styles.emptyBody}>{t('corporate.opportunityEmptyBody')}</Text>
            </View>
          ) : null
        }
        renderItem={({ item }) => {
          const itemHistory = opportunities.history.filter((row) => row.opportunity_id === item.id).slice(0, 3);
          return (
            <Pressable style={styles.card} onPress={() => openEdit(item)}>
              <View style={styles.cardHeader}>
                <View style={{ flex: 1, gap: 3 }}>
                  <Text style={styles.cardTitle}>{item.title}</Text>
                  <Text style={styles.cardTarget}>{item.targetProfile?.full_name ?? t('corporate.opportunityUnavailableTarget')}</Text>
                  {item.targetProfile?.company ? <Text style={styles.cardCompany}>{item.targetProfile.company}</Text> : null}
                </View>
                <View style={styles.stageBadge}>
                  <Text style={styles.stageBadgeText}>{t(`corporate.opportunityStages.${item.stage}`)}</Text>
                </View>
              </View>

              {item.next_action ? (
                <View style={styles.nextActionBox}>
                  <Clock3 size={14} color={colors.primary} />
                  <View style={{ flex: 1 }}>
                    <Text style={styles.nextActionText}>{item.next_action}</Text>
                    {item.next_action_at ? <Text style={styles.nextActionDate}>{formatDate(item.next_action_at)}</Text> : null}
                  </View>
                </View>
              ) : null}

              {item.meeting_request_id ? (
                <View style={styles.metaRow}>
                  <CheckCircle2 size={13} color={colors.success} />
                  <Text style={styles.metaText}>{t('corporate.opportunityMeetingLinked')}</Text>
                </View>
              ) : null}

              {itemHistory.length > 0 ? (
                <View style={styles.historyBox}>
                  <View style={styles.metaRow}>
                    <History size={13} color={colors.textMuted} />
                    <Text style={styles.historyTitle}>{t('corporate.opportunityRecentHistory')}</Text>
                  </View>
                  {itemHistory.map((row) => (
                    <Text key={row.id} style={styles.historyText}>
                      {t(`corporate.opportunityStages.${row.to_stage}`)} · {formatDate(row.changed_at)}
                    </Text>
                  ))}
                </View>
              ) : null}

              <View style={styles.cardFooter}>
                <Text style={styles.editText}>{t('corporate.opportunityEdit')}</Text>
                <ChevronRight size={17} color={colors.primary} />
              </View>
            </Pressable>
          );
        }}
      />

      <CorporateOpportunityModal
        visible={editorOpen}
        opportunity={editing}
        targetProfiles={targetProfiles}
        acceptedMeetings={acceptedMeetings}
        initialTargetProfileId={editorTargetProfileId}
        initialMeetingRequestId={editorMeetingRequestId}
        saving={opportunities.isSaving}
        onClose={() => {
          setEditorOpen(false);
          setEditing(null);
        }}
        onSave={saveOpportunity}
      />
      <NotificationsModal visible={notificationsOpen} onClose={() => setNotificationsOpen(false)} />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  listContent: { padding: 16, paddingBottom: 36, gap: 12 },
  headerContent: { gap: 16, marginBottom: 4 },
  titleRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
  backButton: { width: 38, height: 38, borderRadius: 19, backgroundColor: colors.white, borderWidth: 1, borderColor: colors.border, alignItems: 'center', justifyContent: 'center' },
  title: { color: colors.text, fontSize: 23, fontWeight: '800' },
  subtitle: { color: colors.textMuted, fontSize: 12, lineHeight: 17, marginTop: 2 },
  summaryRow: { flexDirection: 'row', gap: 10 },
  summaryCard: { flex: 1, minHeight: 94, borderRadius: 16, padding: 13, backgroundColor: colors.white, borderWidth: 1, borderColor: colors.border, gap: 3 },
  summaryValue: { color: colors.text, fontSize: 21, fontWeight: '800' },
  summaryLabel: { color: colors.textMuted, fontSize: 10, fontWeight: '700' },
  newButton: { minHeight: 46, borderRadius: 13, backgroundColor: colors.primary, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 7 },
  newButtonText: { color: colors.white, fontSize: 13, fontWeight: '800' },
  sectionTitle: { color: colors.text, fontSize: 16, fontWeight: '800' },
  card: { borderRadius: 17, padding: 14, backgroundColor: colors.white, borderWidth: 1, borderColor: colors.border, gap: 11, marginBottom: 2 },
  cardHeader: { flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
  cardTitle: { color: colors.text, fontSize: 15, fontWeight: '800' },
  cardTarget: { color: colors.textMuted, fontSize: 12, fontWeight: '700' },
  cardCompany: { color: colors.textFaint, fontSize: 10 },
  stageBadge: { maxWidth: 128, borderRadius: 999, paddingHorizontal: 9, paddingVertical: 5, backgroundColor: colors.primarySoft },
  stageBadgeText: { color: colors.primaryDark, fontSize: 9, fontWeight: '800', textAlign: 'center' },
  nextActionBox: { flexDirection: 'row', alignItems: 'flex-start', gap: 8, borderRadius: 11, backgroundColor: colors.background, padding: 10 },
  nextActionText: { color: colors.text, fontSize: 11, fontWeight: '700' },
  nextActionDate: { color: colors.textMuted, fontSize: 10, marginTop: 2 },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  metaText: { color: colors.success, fontSize: 10, fontWeight: '700' },
  historyBox: { gap: 5, borderTopWidth: 1, borderTopColor: colors.border, paddingTop: 9 },
  historyTitle: { color: colors.textMuted, fontSize: 10, fontWeight: '800' },
  historyText: { color: colors.textFaint, fontSize: 9, marginLeft: 19 },
  cardFooter: { flexDirection: 'row', justifyContent: 'flex-end', alignItems: 'center', gap: 3 },
  editText: { color: colors.primary, fontSize: 11, fontWeight: '800' },
  emptyState: { alignItems: 'center', gap: 7, borderRadius: 16, padding: 28, backgroundColor: colors.white, borderWidth: 1, borderColor: colors.border },
  restrictedState: { margin: 16, alignItems: 'center', gap: 10, borderRadius: 16, padding: 28, backgroundColor: colors.white, borderWidth: 1, borderColor: colors.border },
  emptyTitle: { color: colors.text, fontSize: 14, fontWeight: '800', textAlign: 'center' },
  emptyBody: { color: colors.textMuted, fontSize: 11, lineHeight: 16, textAlign: 'center' },
  secondaryButton: { borderRadius: 10, borderWidth: 1, borderColor: colors.primaryLight, backgroundColor: colors.primarySoft, paddingHorizontal: 14, paddingVertical: 9 },
  secondaryButtonText: { color: colors.primary, fontSize: 11, fontWeight: '800' },
  errorBox: { gap: 7, borderRadius: 11, padding: 11, backgroundColor: colors.dangerBg, borderWidth: 1, borderColor: colors.dangerBorder },
  errorText: { color: colors.danger, fontSize: 11, lineHeight: 16 },
  retryText: { color: colors.danger, fontSize: 11, fontWeight: '800' },
});
