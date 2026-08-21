import { useTranslation } from 'react-i18next';

import { ScreenPlaceholder } from '../../components/ScreenPlaceholder';

// TODO (Faz 2): react-native-maps + stantlar + zon bazlı yoğunluk overlay + "yaklaşık konumum"
// + rota optimizasyonu (admin'in kesin stant koordinatlarına göre).
export default function MapScreen() {
  const { t } = useTranslation();
  return <ScreenPlaceholder title={t('map.title')} />;
}
