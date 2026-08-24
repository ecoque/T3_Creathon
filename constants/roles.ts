import type { ParticipantRole } from '../types';

// Rol kodları (DB) <-> görünen etiket çevirisi için i18n key'leri. Record<string,...>
// (ParticipantRole yerine) kasıtlı: 'gorevli' (görevli/staff) profiles.role'de var
// olabilen ama ParticipantRole birleşimine (ve onboarding rol seçimine) hiç
// dahil edilmeyen bir değer — bkz. supabase_staff_migration.sql ve
// constants/roles.ts > isStaffRole.
export const ROLE_LABEL_KEY: Record<string, string> = {
  girisimci: 'onboarding.roleGirisimci',
  yatirimci: 'onboarding.roleYatirimci',
  kurum: 'onboarding.roleKurum',
  ziyaretci: 'onboarding.roleZiyaretci',
  gorevli: 'staff.roleLabel',
};

export const ROLES: ParticipantRole[] = ['girisimci', 'yatirimci', 'kurum', 'ziyaretci'];

// Staff ("gorevli") is a profiles.role value assigned only from the admin
// panel; it is intentionally not part of ParticipantRole/ROLES above so it
// never appears in the onboarding role picker or in ParticipantRole-typed
// matching/filter logic.
export function isStaffRole(role?: string | null): boolean {
  return role === 'gorevli';
}
