import type { Profile } from '../../types';

export type MatchResult = {
  score: number;
  reasons: string[];
};

// Girişimci ↔ yatırımcı/kurum eşleşmesi öncelikli; aynı rol (ör. girişimci-girişimci)
// networking için hâlâ anlamlı olabilir ama daha düşük ağırlıklı.
const COMPLEMENTARY_ROLES: Record<Profile['role'], Profile['role'][]> = {
  girisimci: ['yatirimci', 'kurum'],
  yatirimci: ['girisimci'],
  kurum: ['girisimci'],
  ziyaretci: ['girisimci', 'yatirimci', 'kurum', 'ziyaretci'],
};

const SECTOR_MATCH_POINTS = 40;
const INTEREST_POINTS = 10;
const GOAL_POINTS = 5;
const ROLE_COMPLEMENT_POINTS = 20;

function sharedItems(a: string[], b: string[]): string[] {
  const bLower = new Set(b.map((item) => item.toLowerCase()));
  return a.filter((item) => bLower.has(item.toLowerCase()));
}

// İlk taslak: basit, açıklanabilir bir puanlama. Daha sonra ağırlıklar
// gerçek kullanım verisine göre ayarlanabilir.
export function computeMatchScore(a: Profile, b: Profile): MatchResult {
  let score = 0;
  const reasons: string[] = [];

  if (COMPLEMENTARY_ROLES[a.role]?.includes(b.role)) {
    score += ROLE_COMPLEMENT_POINTS;
    reasons.push(`${a.role} ↔ ${b.role} eşleşmesi`);
  }

  if (a.sector && b.sector && a.sector.toLowerCase() === b.sector.toLowerCase()) {
    score += SECTOR_MATCH_POINTS;
    reasons.push(`Aynı sektör: ${a.sector}`);
  }

  const commonInterests = sharedItems(a.interests, b.interests);
  if (commonInterests.length > 0) {
    score += commonInterests.length * INTEREST_POINTS;
    reasons.push(`Ortak ilgi alanları: ${commonInterests.join(', ')}`);
  }

  const commonGoals = sharedItems(a.goals, b.goals);
  if (commonGoals.length > 0) {
    score += commonGoals.length * GOAL_POINTS;
    reasons.push(`Ortak hedefler: ${commonGoals.join(', ')}`);
  }

  return { score, reasons };
}

// Bir kullanıcı için diğer tüm profilleri skora göre sıralar (en yüksek skor önce).
export function rankMatches(user: Profile, candidates: Profile[]): (MatchResult & { profile: Profile })[] {
  return candidates
    .filter((candidate) => candidate.user_id !== user.user_id)
    .map((candidate) => ({ profile: candidate, ...computeMatchScore(user, candidate) }))
    .sort((x, y) => y.score - x.score);
}
