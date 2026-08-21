import { useTranslation } from 'react-i18next';

import { ScreenPlaceholder } from '../../components/ScreenPlaceholder';

// TODO: Girişimci/Yatırımcı/Kurum/Ziyaretçi rol kartları + seçim sonrası profile yönlendirme.
export default function OnboardingRoleScreen() {
  const { t } = useTranslation();
  return <ScreenPlaceholder title={t('onboarding.roleTitle')} />;
}
