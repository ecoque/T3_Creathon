// Admin: hangi görevlinin hangi girişimci(ler)den/zon(lar)dan sorumlu
// olduğunu yönetme ekranı. Bir kullanıcıyı 'Görevli' YAPMAK bu ekranda değil
// — "Katılımcılar" bölümündeki mevcut katılımcı düzenleme modalının Rol
// seçicisinden yapılır (bkz. AdminWorkspaceModals.tsx > ATTENDEE_ROLES).
// Burada sadece zaten görevli olan kişilere sorumluluk atanır.
import { useQuery } from '@tanstack/react-query';
import { Building2, MapPin, Plus, ShieldCheck, Trash2, X } from 'lucide-react-native';
import { useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { colors } from '../../constants/theme';
import { supabase } from '../../lib/supabase';
import {
  useAllStaffAssignments,
  useCreateStaffAssignment,
  useDeleteStaffAssignment,
  useEntrepreneurProfiles,
  useStaffMembers,
} from '../../lib/useStaffAssignments';

type SimpleZone = { id: string; name: string };

async function fetchSimpleZones(): Promise<SimpleZone[]> {
  const { data, error } = await supabase.from('zones').select('id, name').order('name');
  if (error) throw error;
  return (data ?? []) as SimpleZone[];
}

function useSimpleZones() {
  return useQuery({ queryKey: ['zones', 'simple'], queryFn: fetchSimpleZones, staleTime: 30_000 });
}

function Chip({ label, active, onPress }: { label: string; active: boolean; onPress: () => void }) {
  return (
    <Pressable style={[s.chip, active && s.chipActive]} onPress={onPress}>
      <Text style={[s.chipText, active && s.chipTextActive]} numberOfLines={1}>
        {label}
      </Text>
    </Pressable>
  );
}

export function AdminStaffAssignments() {
  const staffQuery = useStaffMembers();
  const entrepreneurQuery = useEntrepreneurProfiles();
  const assignmentsQuery = useAllStaffAssignments();
  const zonesQuery = useSimpleZones();
  const createAssignment = useCreateStaffAssignment();
  const deleteAssignment = useDeleteStaffAssignment();

  const [activeStaffUserId, setActiveStaffUserId] = useState<string | null>(null);
  const [pendingEntrepreneurId, setPendingEntrepreneurId] = useState<string | null>(null);
  const [pendingZoneId, setPendingZoneId] = useState<string | null>(null);

  const staffMembers = staffQuery.data ?? [];
  const entrepreneurs = entrepreneurQuery.data ?? [];
  const zones = zonesQuery.data ?? [];
  const assignments = assignmentsQuery.data ?? [];

  const assignmentsByStaffUserId = useMemo(() => {
    const map = new Map<string, typeof assignments>();
    assignments.forEach((assignment) => {
      const list = map.get(assignment.staff_user_id) ?? [];
      list.push(assignment);
      map.set(assignment.staff_user_id, list);
    });
    return map;
  }, [assignments]);

  function openAddPanel(staffUserId: string) {
    setActiveStaffUserId(staffUserId);
    setPendingEntrepreneurId(null);
    setPendingZoneId(null);
  }

  async function commitAdd(staffUserId: string) {
    if (!pendingEntrepreneurId) return;
    await createAssignment.mutateAsync({
      staffUserId,
      entrepreneurProfileId: pendingEntrepreneurId,
      zoneId: pendingZoneId,
    });
    setActiveStaffUserId(null);
  }

  const loading = staffQuery.isLoading || entrepreneurQuery.isLoading || assignmentsQuery.isLoading;

  return (
    <View style={s.stack}>
      <View>
        <Text style={s.title}>Görevliler</Text>
        <Text style={s.subtitle}>
          Görevli rolündeki her kullanıcının hangi girişimci(ler)den ve/veya hangi zondan sorumlu
          olduğunu yönetin. Bir kullanıcıyı görevli yapmak için Katılımcılar bölümünden ilgili kişiyi
          düzenleyip rolünü &quot;Görevli&quot; olarak değiştirin.
        </Text>
      </View>

      {loading ? (
        <ActivityIndicator color={colors.primary} />
      ) : staffMembers.length === 0 ? (
        <View style={s.emptyCard}>
          <ShieldCheck size={20} color={colors.textMuted} />
          <Text style={s.emptyText}>
            Henüz görevli rolünde bir katılımcı yok. Katılımcılar bölümünden birinin rolünü &quot;Görevli&quot;
            yapın.
          </Text>
        </View>
      ) : (
        staffMembers.map((staff) => {
          const staffAssignments = assignmentsByStaffUserId.get(staff.user_id) ?? [];
          const panelOpen = activeStaffUserId === staff.user_id;
          return (
            <View key={staff.id} style={s.staffCard}>
              <View style={s.staffHeader}>
                <View style={s.staffIcon}>
                  <ShieldCheck size={16} color={colors.primary} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={s.staffName}>{staff.full_name}</Text>
                  <Text style={s.staffMeta}>{staffAssignments.length} sorumluluk</Text>
                </View>
                {!panelOpen ? (
                  <Pressable style={s.addBtn} onPress={() => openAddPanel(staff.user_id)}>
                    <Plus size={13} color={colors.primary} />
                    <Text style={s.addBtnText}>Ata</Text>
                  </Pressable>
                ) : null}
              </View>

              {staffAssignments.length > 0 ? (
                <View style={s.assignmentList}>
                  {staffAssignments.map((assignment) => (
                    <View key={assignment.id} style={s.assignmentRow}>
                      <Building2 size={14} color={colors.textMuted} />
                      <Text style={s.assignmentText} numberOfLines={1}>
                        {assignment.entrepreneurProfile?.full_name ?? 'Bilinmeyen profil'}
                      </Text>
                      {assignment.zone ? (
                        <View style={s.zoneTag}>
                          <MapPin size={10} color={colors.primary} />
                          <Text style={s.zoneTagText}>{assignment.zone.name}</Text>
                        </View>
                      ) : null}
                      <Pressable
                        style={s.removeBtn}
                        onPress={() => deleteAssignment.mutate(assignment.id)}
                        hitSlop={6}
                      >
                        <Trash2 size={13} color={colors.danger} />
                      </Pressable>
                    </View>
                  ))}
                </View>
              ) : !panelOpen ? (
                <Text style={s.emptyInline}>Henüz sorumluluk atanmadı.</Text>
              ) : null}

              {panelOpen ? (
                <View style={s.addPanel}>
                  <View style={s.addPanelHeader}>
                    <Text style={s.addPanelTitle}>Yeni Sorumluluk</Text>
                    <Pressable onPress={() => setActiveStaffUserId(null)} hitSlop={6}>
                      <X size={15} color={colors.textMuted} />
                    </Pressable>
                  </View>

                  <Text style={s.label}>Girişimci</Text>
                  <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.chipRow}>
                    {entrepreneurs.length === 0 ? (
                      <Text style={s.emptyInline}>Kayıtlı girişimci profili yok.</Text>
                    ) : (
                      entrepreneurs.map((entrepreneur) => (
                        <Chip
                          key={entrepreneur.id}
                          label={entrepreneur.full_name}
                          active={pendingEntrepreneurId === entrepreneur.id}
                          onPress={() => setPendingEntrepreneurId(entrepreneur.id)}
                        />
                      ))
                    )}
                  </ScrollView>

                  <Text style={s.label}>Zon (opsiyonel)</Text>
                  <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.chipRow}>
                    <Chip label="Zon Yok" active={pendingZoneId === null} onPress={() => setPendingZoneId(null)} />
                    {zones.map((zone) => (
                      <Chip
                        key={zone.id}
                        label={zone.name}
                        active={pendingZoneId === zone.id}
                        onPress={() => setPendingZoneId(zone.id)}
                      />
                    ))}
                  </ScrollView>

                  <Pressable
                    style={[s.commitBtn, !pendingEntrepreneurId && s.commitBtnDisabled]}
                    disabled={!pendingEntrepreneurId || createAssignment.isPending}
                    onPress={() => commitAdd(staff.user_id)}
                  >
                    {createAssignment.isPending ? (
                      <ActivityIndicator size="small" color={colors.white} />
                    ) : (
                      <Text style={s.commitBtnText}>Sorumluluğu Ekle</Text>
                    )}
                  </Pressable>
                </View>
              ) : null}
            </View>
          );
        })
      )}
    </View>
  );
}

const s = StyleSheet.create({
  stack: { gap: 16 },
  title: { color: colors.text, fontSize: 22, fontWeight: '800' },
  subtitle: { color: colors.textMuted, fontSize: 12, lineHeight: 18, marginTop: 4, maxWidth: 640 },
  emptyCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    padding: 16,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  emptyText: { flex: 1, color: colors.textMuted, fontSize: 12, lineHeight: 17 },
  emptyInline: { color: colors.textFaint, fontSize: 11, fontStyle: 'italic', marginTop: 4 },
  staffCard: {
    gap: 10,
    padding: 14,
    borderRadius: 15,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  staffHeader: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  staffIcon: {
    width: 36,
    height: 36,
    borderRadius: 11,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.primarySoft,
  },
  staffName: { color: colors.text, fontSize: 13, fontWeight: '800' },
  staffMeta: { color: colors.textMuted, fontSize: 10, marginTop: 2 },
  addBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    minHeight: 32,
    paddingHorizontal: 10,
    borderRadius: 9,
    borderWidth: 1,
    borderColor: colors.primary,
    backgroundColor: colors.primarySoft,
  },
  addBtnText: { color: colors.primary, fontSize: 11, fontWeight: '800' },
  assignmentList: { gap: 6 },
  assignmentRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    padding: 9,
    borderRadius: 10,
    backgroundColor: colors.surfaceMuted,
  },
  assignmentText: { flex: 1, color: colors.text, fontSize: 11, fontWeight: '700' },
  zoneTag: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderRadius: 99,
    backgroundColor: colors.primarySoft,
  },
  zoneTagText: { color: colors.primary, fontSize: 9, fontWeight: '800' },
  removeBtn: { width: 26, height: 26, alignItems: 'center', justifyContent: 'center' },
  addPanel: {
    gap: 6,
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.borderStrong,
    backgroundColor: colors.surfaceMuted,
  },
  addPanelHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  addPanelTitle: { color: colors.text, fontSize: 12, fontWeight: '800' },
  label: { color: colors.textMuted, fontSize: 10, fontWeight: '800', marginTop: 6 },
  chipRow: { gap: 7, paddingVertical: 4 },
  chip: {
    minHeight: 32,
    justifyContent: 'center',
    paddingHorizontal: 11,
    borderRadius: 9,
    borderWidth: 1,
    borderColor: colors.borderStrong,
    backgroundColor: colors.surface,
  },
  chipActive: { borderColor: colors.primary, backgroundColor: colors.primary },
  chipText: { color: colors.textMuted, fontSize: 10, fontWeight: '700' },
  chipTextActive: { color: colors.white },
  commitBtn: {
    marginTop: 8,
    minHeight: 38,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 10,
    backgroundColor: colors.primary,
  },
  commitBtnDisabled: { opacity: 0.5 },
  commitBtnText: { color: colors.white, fontSize: 12, fontWeight: '800' },
});
