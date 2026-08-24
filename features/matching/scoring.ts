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

function computeEntrepreneurPriorityScore(entrepreneur: Profile, candidate: Profile): MatchResult {
  if (!['girisimci', 'kurum', 'yatirimci'].includes(candidate.role)) return { score: 0, reasons: [] };

  const rolePoints: Record<'girisimci' | 'kurum' | 'yatirimci', number> = {
    yatirimci: 26,
    kurum: 24,
    girisimci: 14,
  };
  const roleReason: Record<'girisimci' | 'kurum' | 'yatirimci', string> = {
    yatirimci: 'entrepreneur.reasonInvestor',
    kurum: 'entrepreneur.reasonOrganization',
    girisimci: 'entrepreneur.reasonFounder',
  };
  const targetRole = candidate.role as 'girisimci' | 'kurum' | 'yatirimci';
  let score = rolePoints[targetRole];
  const reasonDetails: NonNullable<MatchResult['reasonDetails']> = [{ key: roleReason[targetRole] }];

  if (
    entrepreneur.sector
    && candidate.sector
    && entrepreneur.sector.toLocaleLowerCase('tr-TR') === candidate.sector.toLocaleLowerCase('tr-TR')
  ) {
    score += 36;
    reasonDetails.push({ key: 'entrepreneur.reasonSector', params: { sector: entrepreneur.sector } });
  }

  const commonInterests = sharedItems(entrepreneur.interests ?? [], candidate.interests ?? []).slice(0, 3);
  if (commonInterests.length > 0) {
    score += commonInterests.length * 8;
    reasonDetails.push({ key: 'entrepreneur.reasonInterest', params: { items: commonInterests.join(', ') } });
  }

  const commonGoals = sharedItems(entrepreneur.goals ?? [], candidate.goals ?? []).slice(0, 2);
  if (commonGoals.length > 0) {
    score += commonGoals.length * 5;
    reasonDetails.push({ key: 'entrepreneur.reasonGoal', params: { items: commonGoals.join(', ') } });
  }

  return { score: Math.min(100, score), reasons: [], reasonDetails };
}

function normalizedLabel(value: string): string {
  return value
    .toLocaleLowerCase('tr-TR')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/ı/g, 'i')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

function computeCorporatePriorityScore(corporate: Profile, candidate: Profile): MatchResult {
  if (!['girisimci', 'kurum'].includes(candidate.role)) return { score: 0, reasons: [] };

  const candidateRole = candidate.role as 'girisimci' | 'kurum';
  let score = candidateRole === 'girisimci' ? 24 : 14;
  const reasonDetails: NonNullable<MatchResult['reasonDetails']> = [{
    key: candidateRole === 'girisimci'
      ? 'corporate.reasonStartupCandidate'
      : 'corporate.reasonOrganizationCandidate',
  }];

  const candidateLabels = [
    candidate.sector,
    ...(candidate.interests ?? []),
    ...(candidate.goals ?? []),
  ].filter((value): value is string => !!value?.trim());
  const normalizedCandidateLabels = new Set(candidateLabels.map(normalizedLabel));
  const needAreaMatches = (corporate.technology_need_areas ?? [])
    .filter((area) => {
      const normalizedArea = normalizedLabel(area);
      return normalizedArea.length > 0 && normalizedCandidateLabels.has(normalizedArea);
    })
    .slice(0, 3);

  if (needAreaMatches.length > 0) {
    score += needAreaMatches.length * 16;
    reasonDetails.push({
      key: 'corporate.reasonNeedArea',
      params: { items: needAreaMatches.join(', ') },
    });
  }

  if (
    corporate.sector
    && candidate.sector
    && normalizedLabel(corporate.sector) === normalizedLabel(candidate.sector)
  ) {
    score += 14;
    reasonDetails.push({ key: 'corporate.reasonSector', params: { sector: corporate.sector } });
  }

  const commonInterests = sharedItems(corporate.interests ?? [], candidate.interests ?? []).slice(0, 2);
  if (commonInterests.length > 0) {
    score += commonInterests.length * 6;
    reasonDetails.push({
      key: 'corporate.reasonInterest',
      params: { items: commonInterests.join(', ') },
    });
  }

  const needSummary = corporate.technology_need_summary?.trim() ?? '';
  if (needSummary) {
    const explicitNeedTokens = new Set(normalizedTokens((corporate.technology_need_areas ?? []).join(' ')));
    const needTokens = new Set(normalizedTokens(needSummary).filter((token) => !explicitNeedTokens.has(token)));
    const candidateTokens = new Set(normalizedTokens([
      candidate.sector,
      candidate.company,
      candidate.title,
      ...(candidate.interests ?? []),
      ...(candidate.goals ?? []),
    ].filter(Boolean).join(' ')));
    const summaryMatches = [...needTokens].filter((token) => candidateTokens.has(token)).slice(0, 3);
    if (summaryMatches.length > 0) {
      score += summaryMatches.length * 4;
      reasonDetails.push({
        key: 'corporate.reasonNeedSummary',
        params: { items: summaryMatches.join(', ') },
      });
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
  if (a.role === 'girisimci') return computeEntrepreneurPriorityScore(a, b);
  if (a.role === 'kurum') return computeCorporatePriorityScore(a, b);

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
