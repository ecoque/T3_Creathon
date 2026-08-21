import { Redirect } from 'expo-router';

// TODO: Auth/onboarding durumu Supabase'den okunup buna göre yönlendirme yapılacak.
export default function Index() {
  return <Redirect href="/onboarding" />;
}
