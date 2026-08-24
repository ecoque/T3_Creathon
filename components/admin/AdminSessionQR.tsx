// Admin/konuşmacı: bir oturumun QR kodunu ekranda gösterme. QR içeriği
// 'takeoff:session:<session_id>' — katılımcı tarafı bunu app/profile/scan-badge.tsx
// ile okutup rozet kazanır (bkz. lib/useMyBadges.ts). react-native-qrcode-svg
// saf JS + react-native-svg üzerine kurulu (bu projede zaten kullanılan bir
// native modül) — bu yüzden AdminMapManagement.tsx'teki uyarının aksine
// burada STATİK import güvenli.
import QRCode from 'react-native-qrcode-svg';
import { CalendarDays, QrCode, Search } from 'lucide-react-native';
import { useMemo, useState } from 'react';
import { ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';

import { colors } from '../../constants/theme';
import { buildSessionQrValue } from '../../lib/useMyBadges';
import type { AdminSession } from '../../types/admin';

export function AdminSessionQR({ sessions }: { sessions: AdminSession[] }) {
  const [search, setSearch] = useState('');
  const [selectedId, setSelectedId] = useState<string | null>(sessions[0]?.id ?? null);

  const filtered = useMemo(() => {
    const q = search.trim().toLocaleLowerCase('tr');
    if (!q) return sessions;
    return sessions.filter((session) => session.title.toLocaleLowerCase('tr').includes(q));
  }, [sessions, search]);

  const selected = sessions.find((session) => session.id === selectedId) ?? null;

  return (
    <View style={s.stack}>
      <View>
        <Text style={s.title}>Oturum QR&apos;ı</Text>
        <Text style={s.subtitle}>
          Bir oturum seçip QR kodunu ekranda gösterin. Katılımcılar profil ekranındaki &quot;QR Tara&quot;
          ile bunu okutarak o oturuma ait rozeti kazanır.
        </Text>
      </View>

      <View style={s.columns}>
        <View style={s.listCard}>
          <View style={s.searchBox}>
            <Search size={14} color={colors.textMuted} />
            <TextInput
              style={s.searchInput}
              value={search}
              onChangeText={setSearch}
              placeholder="Oturum ara..."
              placeholderTextColor={colors.textFaint}
            />
          </View>
          <ScrollView style={{ maxHeight: 460 }} contentContainerStyle={{ gap: 6 }}>
            {filtered.length === 0 ? (
              <Text style={s.emptyText}>Oturum bulunamadı.</Text>
            ) : (
              filtered.map((session) => {
                const active = session.id === selectedId;
                return (
                  <Text
                    key={session.id}
                    onPress={() => setSelectedId(session.id)}
                    style={[s.sessionRow, active && s.sessionRowActive]}
                    numberOfLines={1}
                  >
                    {session.title}
                  </Text>
                );
              })
            )}
          </ScrollView>
        </View>

        <View style={s.qrCard}>
          {selected ? (
            <>
              <View style={s.qrWrap}>
                <QRCode value={buildSessionQrValue(selected.id)} size={200} />
              </View>
              <Text style={s.qrTitle}>{selected.title}</Text>
              <View style={s.qrMetaRow}>
                <CalendarDays size={13} color={colors.textMuted} />
                <Text style={s.qrMeta}>
                  {selected.dateStr} · {selected.time}-{selected.endTime} · {selected.stageName}
                </Text>
              </View>
            </>
          ) : (
            <View style={s.emptyState}>
              <QrCode size={26} color={colors.textMuted} />
              <Text style={s.emptyText}>Soldan bir oturum seçin.</Text>
            </View>
          )}
        </View>
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  stack: { gap: 16 },
  title: { color: colors.text, fontSize: 22, fontWeight: '800' },
  subtitle: { color: colors.textMuted, fontSize: 12, lineHeight: 18, marginTop: 4, maxWidth: 640 },
  columns: { flexDirection: 'row', flexWrap: 'wrap', gap: 14 },
  listCard: {
    flexGrow: 1,
    flexBasis: 300,
    gap: 10,
    padding: 14,
    borderRadius: 15,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  searchBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    height: 40,
    paddingHorizontal: 11,
    borderWidth: 1,
    borderColor: colors.borderStrong,
    borderRadius: 10,
    backgroundColor: colors.surfaceMuted,
  },
  searchInput: { flex: 1, color: colors.text, fontSize: 12 },
  sessionRow: {
    padding: 10,
    borderRadius: 10,
    backgroundColor: colors.surfaceMuted,
    color: colors.text,
    fontSize: 12,
    fontWeight: '700',
  },
  sessionRowActive: { backgroundColor: colors.primarySoft, color: colors.primary },
  emptyText: { color: colors.textMuted, fontSize: 12, padding: 8 },
  qrCard: {
    flexGrow: 1,
    flexBasis: 300,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    padding: 24,
    borderRadius: 15,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  qrWrap: {
    padding: 16,
    borderRadius: 16,
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: colors.border,
  },
  qrTitle: { color: colors.text, fontSize: 15, fontWeight: '800', textAlign: 'center', marginTop: 6 },
  qrMetaRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  qrMeta: { color: colors.textMuted, fontSize: 11 },
  emptyState: { alignItems: 'center', gap: 8 },
});
