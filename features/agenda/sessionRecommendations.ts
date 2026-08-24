import type { Profile, Session } from '../../types';

export type SessionRecommendation = {
  session: Session;
  score: number;
  matchedTerms: string[];
};

function normalize(value: string): string {
  return value
    .toLocaleLowerCase('tr-TR')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/ı/g, 'i')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

function sessionText(session: Session): string {
  return normalize(
    [
      session.title,
      session.description,
      session.category,
      ...(session.tags ?? []),
    ]
      .filter(Boolean)
      .join(' '),
  );
}

function matchingTerms(terms: string[], haystack: string): string[] {
  const seen = new Set<string>();
  const boundedHaystack = ` ${haystack} `;
  return terms.filter((term) => {
    const normalized = normalize(term.trim());
    if (!normalized || seen.has(normalized) || !boundedHaystack.includes(` ${normalized} `)) return false;
    seen.add(normalized);
    return true;
  });
}

// Açıklanabilir ve deterministik MVP sıralaması: sektör en güçlü sinyal,
// ilgi alanları ikinci, etkinlik hedefleri destekleyici sinyaldir.
export function rankSessionsForProfile(
  profile: Profile,
  sessions: Session[],
): SessionRecommendation[] {
  return sessions
    .map((session) => {
      const text = sessionText(session);
      const sectorMatches = profile.sector ? matchingTerms([profile.sector], text) : [];
      const interestMatches = matchingTerms(profile.interests ?? [], text).slice(0, 3);
      const goalMatches = matchingTerms(profile.goals ?? [], text).slice(0, 2);
      const score = sectorMatches.length * 40 + interestMatches.length * 15 + goalMatches.length * 8;

      return {
        session,
        score,
        matchedTerms: [...sectorMatches, ...interestMatches, ...goalMatches],
      };
    })
    .sort((a, b) => b.score - a.score || new Date(a.session.start_time).getTime() - new Date(b.session.start_time).getTime());
}
