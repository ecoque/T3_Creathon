import { useTranslation } from 'react-i18next';

import { ScreenPlaceholder } from '../../components/ScreenPlaceholder';

// TODO: Filtreleme ekranı + eşleşme listesi + "neden eşleştik" kartı.
export default function DiscoverScreen() {
  const { t } = useTranslation();
  return <ScreenPlaceholder title={t('matching.title')} description={t('matching.whyMatched')} />;
}
