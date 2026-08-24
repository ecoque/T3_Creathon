import { FileText, LockKeyhole, Save, X } from 'lucide-react-native';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Keyboard,
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

type MeetingNoteModalProps = {
  visible: boolean;
  participantName: string;
  initialNote?: string;
  saving: boolean;
  onClose: () => void;
  onSave: (note: string) => Promise<void>;
};

export function MeetingNoteModal({
  visible,
  participantName,
  initialNote = '',
  saving,
  onClose,
  onSave,
}: MeetingNoteModalProps) {
  const { t } = useTranslation();
  const [note, setNote] = useState(initialNote);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (visible) {
      setNote(initialNote);
      setError(null);
    }
  }, [initialNote, visible]);

  function handleClose() {
    Keyboard.dismiss();
    onClose();
  }

  async function handleSave() {
    Keyboard.dismiss();
    const trimmed = note.trim();
    if (!trimmed) {
      setError(t('entrepreneur.noteRequired'));
      return;
    }
    try {
      setError(null);
      await onSave(trimmed);
      handleClose();
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : t('entrepreneur.noteSaveError'));
    }
  }

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={handleClose}>
      <KeyboardAvoidingView
        style={styles.keyboardAvoiding}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 12 : 0}
      >
        <View style={styles.overlay}>
          <Pressable style={StyleSheet.absoluteFill} onPress={handleClose} />
          <View style={styles.card}>
            <View style={styles.header}>
              <View style={styles.titleRow}>
                <View style={styles.iconCircle}>
                  <FileText size={17} color={colors.primary} />
                </View>
                <View style={styles.titleCopy}>
                  <Text style={styles.title}>{t('entrepreneur.noteTitle')}</Text>
                  <Text style={styles.subtitle} numberOfLines={1}>
                    {participantName}
                  </Text>
                </View>
              </View>
              <Pressable
                onPress={handleClose}
                hitSlop={12}
                accessibilityRole="button"
                accessibilityLabel={t('common.close')}
              >
                <X size={20} color={colors.textMuted} />
              </Pressable>
            </View>

            <ScrollView
              style={styles.bodyScroll}
              contentContainerStyle={styles.body}
              keyboardShouldPersistTaps="handled"
              keyboardDismissMode={Platform.OS === 'ios' ? 'interactive' : 'on-drag'}
            >
              <View style={styles.privacyRow}>
                <LockKeyhole size={13} color={colors.textMuted} />
                <Text style={styles.privacyText}>{t('entrepreneur.notePrivateHint')}</Text>
              </View>
              <TextInput
                style={styles.input}
                value={note}
                onChangeText={(value) => setNote(value.slice(0, 2000))}
                placeholder={t('entrepreneur.notePlaceholder')}
                placeholderTextColor={colors.textFaint}
                multiline
                maxLength={2000}
                textAlignVertical="top"
                autoFocus
              />
              <Text style={styles.count}>{note.length}/2000</Text>
              {error ? <Text style={styles.error}>{error}</Text> : null}
            </ScrollView>

            <View style={styles.footer}>
              <Pressable style={styles.cancelBtn} onPress={handleClose} disabled={saving}>
                <Text style={styles.cancelText}>{t('common.cancel')}</Text>
              </Pressable>
              <Pressable
                style={[styles.saveBtn, saving && styles.disabled]}
                onPress={() => void handleSave()}
                disabled={saving}
              >
                <Save size={16} color={colors.white} />
                <Text style={styles.saveText}>
                  {saving ? t('common.loading') : t('common.save')}
                </Text>
              </Pressable>
            </View>
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  keyboardAvoiding: { flex: 1 },
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(25,28,29,0.6)',
    justifyContent: 'center',
    padding: 16,
  },
  card: {
    maxHeight: '92%',
    backgroundColor: colors.white,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: colors.border,
    overflow: 'hidden',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 18,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: 10, flex: 1 },
  iconCircle: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: colors.primarySoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  titleCopy: { flex: 1 },
  title: { color: colors.text, fontSize: 16, fontWeight: '800' },
  subtitle: { color: colors.textMuted, fontSize: 12, marginTop: 2 },
  bodyScroll: { flexShrink: 1 },
  body: { padding: 18, gap: 10 },
  privacyRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  privacyText: { color: colors.textMuted, fontSize: 11, flex: 1 },
  input: {
    minHeight: 150,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.borderStrong,
    backgroundColor: colors.background,
    color: colors.text,
    padding: 14,
    fontSize: 14,
    lineHeight: 20,
  },
  count: { alignSelf: 'flex-end', color: colors.textFaint, fontSize: 10 },
  error: { color: colors.danger, fontSize: 11, lineHeight: 16 },
  footer: {
    flexDirection: 'row',
    gap: 10,
    padding: 18,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  cancelBtn: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 13,
    borderWidth: 1,
    borderColor: colors.border,
    paddingVertical: 12,
  },
  cancelText: { color: colors.textMuted, fontSize: 13, fontWeight: '700' },
  saveBtn: {
    flex: 1,
    flexDirection: 'row',
    gap: 7,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 13,
    backgroundColor: colors.primary,
    paddingVertical: 12,
  },
  saveText: { color: colors.white, fontSize: 13, fontWeight: '800' },
  disabled: { opacity: 0.6 },
});
