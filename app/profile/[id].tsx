import { useLocalSearchParams } from 'expo-router';

import { ScreenPlaceholder } from '../../components/ScreenPlaceholder';

// TODO: Belirli bir katılımcının profil detayını Supabase'den çekip göster.
export default function ProfileDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  return <ScreenPlaceholder title="Profil Detay" description={`user_id: ${id}`} />;
}
