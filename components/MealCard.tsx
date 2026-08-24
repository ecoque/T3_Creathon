// Ajanda/ana sayfa ekranlarında gösterilen günlük yemek menüsü + kullanıcıya
// atanmış kişisel yemek saati kartı. app/(tabs)/home.tsx (girişimci/yatırımcı/
// kurum/görevli) ve features/visitor/VisitorEventsScreen.tsx (ziyaretçi) aynı
// kartı kullanır — bkz. lib/useMeals.ts.
import { UtensilsCrossed } from 'lucide-react-native';
import { useTranslation } from 'react-i18next';
import { StyleSheet, Text, View } from 'react-native';

import { colors } from '../constants/theme';
import { useMyMealAssignment, useTodayMeal } from '../lib/useMeals';

function formatTime(iso: string) {
  return new Date(iso).toLocaleTimeString('tr-TR', {
    hour: '2-digit',
    minute: '2-digit',
    timeZone: 'Europe/Istanbul',
  });
}

export function MealCard() {
  const { t } = useTranslation();
  const mealQuery = useTodayMeal();
  const assignmentQuery = useMyMealAssignment();

  // Admin o gün için henüz bir menü girmediyse kart hiç gösterilmez — boş bir
  // "menü yok" kartıyla ekranı kirletmemek için.
  if (mealQuery.isLoading || !mealQuery.data) return null;

  const meal = mealQuery.data;
  const assignment = assignmentQuery.data;

  return (
    <View style={styles.card}>
      <View style={styles.iconWrap}>
        <UtensilsCrossed size={18} color={colors.primary} />
      </View>
      <View style={styles.copy}>
        <Text style={styles.title}>{t('meals.cardTitle')}</Text>
        <Text style={styles.menu} numberOfLines={2}>
          {meal.title}
        </Text>
        {meal.description ? (
          <Text style={styles.description} numberOfLines={2}>
            {meal.description}
          </Text>
        ) : null}
        {assignment ? (
          <Text style={styles.slot}>
            {t('meals.yourSlot', { start: formatTime(assignment.slot_start), end: formatTime(assignment.slot_end) })}
          </Text>
        ) : assignmentQuery.isLoading ? (
          <Text style={styles.slotLoading}>{t('meals.slotLoading')}</Text>
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    gap: 12,
    padding: 14,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.white,
  },
  iconWrap: {
    width: 38,
    height: 38,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.primarySoft,
  },
  copy: { flex: 1, gap: 2 },
  title: { fontSize: 11, fontWeight: '800', color: colors.textFaint, textTransform: 'uppercase', letterSpacing: 0.4 },
  menu: { fontSize: 14, fontWeight: '800', color: colors.text, marginTop: 2 },
  description: { fontSize: 12, color: colors.textMuted, marginTop: 2 },
  slot: { fontSize: 12, fontWeight: '800', color: colors.primary, marginTop: 6 },
  slotLoading: { fontSize: 11, color: colors.textFaint, marginTop: 6 },
});
