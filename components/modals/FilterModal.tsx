import { X } from 'lucide-react-native';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { ROLES, ROLE_LABEL_KEY } from '../../constants/roles';
import { colors } from '../../constants/theme';
import type { ParticipantRole } from '../../types';

export type FilterOptions = {
  roles: ParticipantRole[];
  sector: string;
  interests: string[];
};

type FilterModalProps = {
  visible: boolean;
  onClose: () => void;
  initialFilter: FilterOptions;
  sectorOptions: string[];
  interestOptions: string[];
  roleOptions?: ParticipantRole[];
  onApply: (filter: FilterOptions) => void;
};

export function FilterModal({
  visible,
  onClose,
  initialFilter,
  sectorOptions,
  interestOptions,
  roleOptions = ROLES,
  onApply,
}: FilterModalProps) {
  const { t } = useTranslation();
  const [roles, setRoles] = useState<ParticipantRole[]>(initialFilter.roles);
  const [sector, setSector] = useState(initialFilter.sector);
  const [interests, setInterests] = useState<string[]>(initialFilter.interests);

  useEffect(() => {
    if (visible) {
      setRoles(initialFilter.roles);
      setSector(initialFilter.sector);
      setInterests(initialFilter.interests);
    }
  }, [visible, initialFilter]);

  const toggleRole = (role: ParticipantRole) => {
    setRoles((prev) => (prev.includes(role) ? prev.filter((r) => r !== role) : [...prev, role]));
  };

  const toggleInterest = (item: string) => {
    setInterests((prev) => (prev.includes(item) ? prev.filter((i) => i !== item) : [...prev, item]));
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.overlay}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />
        <View style={styles.card}>
          <View style={styles.headerRow}>
            <Text style={styles.title}>{t('modals.filterTitle')}</Text>
            <Pressable onPress={onClose} hitSlop={8} style={styles.closeBtn}>
              <X size={20} color={colors.textMuted} />
            </Pressable>
          </View>

          <ScrollView style={styles.body} contentContainerStyle={{ gap: 20 }}>
            <View style={{ gap: 10 }}>
              <Text style={styles.sectionLabel}>{t('modals.filterRole')}</Text>
              <View style={styles.chipRow}>
                {roleOptions.map((role) => {
                  const selected = roles.includes(role);
                  return (
                    <Pressable
                      key={role}
                      onPress={() => toggleRole(role)}
                      style={[styles.chip, selected && styles.chipSelected]}
                    >
                      <Text style={[styles.chipText, selected && styles.chipTextSelected]}>
                        {t(ROLE_LABEL_KEY[role])}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
            </View>

            <View style={{ gap: 10 }}>
              <Text style={styles.sectionLabel}>{t('modals.filterSector')}</Text>
              <View style={styles.chipRow}>
                <Pressable
                  onPress={() => setSector('')}
                  style={[styles.chip, sector === '' && styles.chipSelected]}
                >
                  <Text style={[styles.chipText, sector === '' && styles.chipTextSelected]}>
                    {t('modals.filterAllSectors')}
                  </Text>
                </Pressable>
                {sectorOptions.map((s) => {
                  const selected = sector === s;
                  return (
                    <Pressable key={s} onPress={() => setSector(s)} style={[styles.chip, selected && styles.chipSelected]}>
                      <Text style={[styles.chipText, selected && styles.chipTextSelected]}>{s}</Text>
                    </Pressable>
                  );
                })}
              </View>
            </View>

            <View style={{ gap: 10 }}>
              <Text style={styles.sectionLabel}>{t('modals.filterInterests')}</Text>
              <View style={styles.chipRow}>
                {interestOptions.map((interest) => {
                  const selected = interests.includes(interest);
                  return (
                    <Pressable
                      key={interest}
                      onPress={() => toggleInterest(interest)}
                      style={[styles.chip, selected && styles.chipSelected]}
                    >
                      <Text style={[styles.chipText, selected && styles.chipTextSelected]}>{interest}</Text>
                    </Pressable>
                  );
                })}
              </View>
            </View>
          </ScrollView>

          <View style={styles.footerRow}>
            <Pressable
              style={styles.clearBtn}
              onPress={() => {
                setRoles([]);
                setSector('');
                setInterests([]);
              }}
            >
              <Text style={styles.clearBtnText}>{t('common.clear')}</Text>
            </Pressable>
            <Pressable
              style={styles.applyBtn}
              onPress={() => {
                onApply({ roles, sector, interests });
                onClose();
              }}
            >
              <Text style={styles.applyBtnText}>{t('common.apply')}</Text>
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: 'rgba(25,28,29,0.5)', justifyContent: 'center', padding: 16 },
  card: {
    backgroundColor: colors.white,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: colors.border,
    maxHeight: '85%',
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
  title: { fontSize: 18, fontWeight: '800', color: colors.text },
  closeBtn: { padding: 6 },
  body: { padding: 20 },
  sectionLabel: { fontSize: 11, fontWeight: '800', color: colors.textFaint, textTransform: 'uppercase', letterSpacing: 0.5 },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: {
    paddingHorizontal: 14,
    paddingVertical: 9,
    borderRadius: 999,
    backgroundColor: colors.background,
    borderWidth: 1,
    borderColor: colors.border,
  },
  chipSelected: { backgroundColor: colors.primarySoft, borderColor: colors.primary },
  chipText: { fontSize: 12, fontWeight: '600', color: colors.textMuted },
  chipTextSelected: { color: colors.primary },
  footerRow: {
    flexDirection: 'row',
    gap: 12,
    padding: 18,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  clearBtn: {
    flex: 1,
    paddingVertical: 13,
    borderRadius: 14,
    backgroundColor: colors.surfaceMuted,
    alignItems: 'center',
  },
  clearBtnText: { fontWeight: '700', fontSize: 13, color: colors.text },
  applyBtn: {
    flex: 2,
    paddingVertical: 13,
    borderRadius: 14,
    backgroundColor: colors.primary,
    alignItems: 'center',
  },
  applyBtnText: { fontWeight: '700', fontSize: 13, color: colors.white },
});
