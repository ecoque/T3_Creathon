import { useTranslation } from 'react-i18next';

import { ScreenPlaceholder } from '../../components/ScreenPlaceholder';

// TODO (Faz 2): Konum toplama açıklaması, "Etkinlik boyunca konumumu paylaş" toggle'ı,
// ve etkinlik sonu veri silme bilgisi. expo-location + expo-task-manager entegrasyonu burada.
export default function LocationPrivacyScreen() {
  const { t } = useTranslation();
  return <ScreenPlaceholder title={t('locationPrivacy.title')} />;
}
