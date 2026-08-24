import { router } from 'expo-router';
import { useEffect } from 'react';

import { VisitorEventsScreen } from '../../features/visitor/VisitorEventsScreen';
import { useCurrentProfile } from '../../lib/useCurrentProfile';

export default function EventsRoute() {
  const { data: meResult } = useCurrentProfile();
  const isVisitor = meResult?.profile?.role === 'ziyaretci';

  useEffect(() => {
    if (meResult?.profile && !isVisitor) {
      router.replace('/(tabs)/home');
    }
  }, [isVisitor, meResult?.profile]);

  if (!isVisitor) return null;
  return <VisitorEventsScreen />;
}
