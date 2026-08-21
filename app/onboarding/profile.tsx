import { useTranslation } from 'react-i18next';

import { ScreenPlaceholder } from '../../components/ScreenPlaceholder';

// TODO: Zorunlu profil formu (ad, foto, LinkedIn, sektör, ilgi alanları, hedefler).
export default function OnboardingProfileScreen() {
  const { t } = useTranslation();
  return <ScreenPlaceholder title={t('profile.formTitle')} />;
}
