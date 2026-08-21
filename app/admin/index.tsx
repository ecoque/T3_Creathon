import { useTranslation } from 'react-i18next';

import { ScreenPlaceholder } from '../../components/ScreenPlaceholder';

// TODO (Faz 2): Haritaya dokunarak stant pin ekleme/düzenleme (isim/kategori/sponsor -> stands tablosu).
export default function AdminScreen() {
  const { t } = useTranslation();
  return <ScreenPlaceholder title={t('admin.title')} />;
}
