import type { ParticipantRole } from '../types';

// Rol kodları (DB) <-> görünen etiket çevirisi için i18n key'leri.
export const ROLE_LABEL_KEY: Record<ParticipantRole, string> = {
  girisimci: 'onboarding.roleGirisimci',
  yatirimci: 'onboarding.roleYatirimci',
  kurum: 'onboarding.roleKurum',
  ziyaretci: 'onboarding.roleZiyaretci',
};

export const ROLES: ParticipantRole[] = ['girisimci', 'yatirimci', 'kurum', 'ziyaretci'];
