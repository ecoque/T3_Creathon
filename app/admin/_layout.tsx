import { Redirect, Slot } from 'expo-router';

// TODO: Gerçek is_admin kontrolü Supabase auth/profile verisinden yapılacak.
// Bu route grubu, 4 katılımcı rolünden (girisimci/yatirimci/kurum/ziyaretci) tamamen
// ayrı bir yetki kontrolüyle korunur; admin olmayan kullanıcılar buraya giremez.
const isAdmin = false;

export default function AdminLayout() {
  if (!isAdmin) {
    return <Redirect href="/" />;
  }
  return <Slot />;
}
