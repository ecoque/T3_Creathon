import type { Profile } from '../../types';

export type MatchResult = {
  score: number;
  reasons: string[];
  reasonDetails?: { key: string; params?: Record<string, string | number> }[];
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

const INVESTOR_TOKENS_STOPLIST = new Set([
  'acaba', 'alan', 'alanlar', 'arayan', 'bizim', 'icin', 'ile', 'olan', 'olarak',
  'odak', 'odakli', 'erken', 'asama', 'cozum', 'cozumler', 'girişim', 'girisim',
  'girisimler', 'sirket', 'sirketler', 'teknoloji', 'teknolojiler', 'yatirim',
  'yatirimci', 'uzere', 'veya', 'daha', 'gibi', 'this', 'that', 'with', 'from',
  'into', 'focus', 'focused', 'startup', 'startups', 'company', 'companies',
  'technology', 'technologies', 'investment', 'solutions', 'stage',
]);

function normalizedTokens(value: string): string[] {
  return value
    .toLocaleLowerCase('tr-TR')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/ı/g, 'i')
    .replace(/[^a-z0-9]+/g, ' ')
    .split(' ')
    .filter((token) => token.length >= 4 && !INVESTOR_TOKENS_STOPLIST.has(token));
}

function computeInvestorPriorityScore(investor: Profile, candidate: Profile): MatchResult {
  if (!['girisimci', 'kurum'].includes(candidate.role)) return { score: 0, reasons: [] };

  let score = 20;
  const reasonDetails: NonNullable<MatchResult['reasonDetails']> = [
    { key: 'investor.reasonCandidate' },
  ];
  const primary = investor.sector?.trim();
  const secondary = investor.investment_focuses ?? [];

  if (primary && candidate.sector && primary.toLocaleLowerCase('tr-TR') === candidate.sector.toLocaleLowerCase('tr-TR')) {
    score += 44;
    reasonDetails.push({ key: 'investor.reasonPrimary', params: { focus: primary } });
  } else {
    const secondaryMatch = secondary.find(
      (focus) => candidate.sector && focus.toLocaleLowerCase('tr-TR') === candidate.sector.toLocaleLowerCase('tr-TR'),
    );
    if (secondaryMatch) {
      score += 18;
      reasonDetails.push({ key: 'investor.reasonSecondary', params: { focus: secondaryMatch } });
    }
  }

  const commonPreferences = sharedItems(investor.interests ?? [], candidate.interests ?? []).slice(0, 2);
  if (commonPreferences.length > 0) {
    score += commonPreferences.length * 8;
    reasonDetails.push({ key: 'investor.reasonPreference', params: { items: commonPreferences.join(', ') } });
  }

  const commonGoals = sharedItems(investor.goals ?? [], candidate.goals ?? []).slice(0, 2);
  if (commonGoals.length > 0) {
    score += commonGoals.length * 4;
    reasonDetails.push({ key: 'investor.reasonGoal', params: { items: commonGoals.join(', ') } });
  }

  const thesis = investor.investment_thesis?.trim() ?? '';
  if (thesis) {
    const focusTokens = new Set(normalizedTokens([primary, ...secondary].filter(Boolean).join(' ')));
    const thesisTokens = new Set(normalizedTokens(thesis).filter((token) => !focusTokens.has(token)));
    const candidateTokens = new Set(normalizedTokens([
      candidate.sector,
      candidate.company,
      candidate.title,
      ...(candidate.interests ?? []),
      ...(candidate.goals ?? []),
    ].filter(Boolean).join(' ')));
    const matches = [...thesisTokens].filter((token) => candidateTokens.has(token)).slice(0, 3);
    if (matches.length > 0) {
      score += matches.length * 3;
      reasonDetails.push({ key: 'investor.reasonThesis', params: { items: matches.join(', ') } });
    }
  }

  return { score: Math.min(100, score), reasons: [], reasonDetails };
}

export function localizeMatchReasons(
  result: MatchResult,
  translate: (key: string, params?: Record<string, string | number>) => string,
): string[] {
  return result.reasonDetails?.map(({ key, params }) => translate(key, params)) ?? result.reasons;
}

// İlk taslak: basit, açıklanabilir bir puanlama. Daha sonra ağırlıklar
// gerçek kullanım verisine göre ayarlanabilir.
export function computeMatchScore(a: Profile, b: Profile): MatchResult {
  if (a.role === 'yatirimci') return computeInvestorPriorityScore(a, b);

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
