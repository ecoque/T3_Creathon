import { useTranslation } from 'react-i18next';

import { ScreenPlaceholder } from '../../components/ScreenPlaceholder';

// TODO: Kişiselleştirilmiş program + oturumlar + güncel aksiyonlar (akıllı ajanda).
export default function HomeScreen() {
  const { t } = useTranslation();
  return <ScreenPlaceholder title={t('home.title')} />;
}
