import { useTranslation } from 'react-i18next';

import { ScreenPlaceholder } from '../../components/ScreenPlaceholder';

// TODO: Gelen/giden toplantı talepleri listesi + kabul/red aksiyonları + ajandaya otomatik ekleme.
export default function MeetingsScreen() {
  const { t } = useTranslation();
  return <ScreenPlaceholder title={t('meetings.title')} />;
}
