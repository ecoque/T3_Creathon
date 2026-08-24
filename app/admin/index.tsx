import { AdminWorkspace } from '../../components/admin/AdminWorkspace';

// Gerçek admin paneli: stant/venue yönetimi, program, katılımcılar, duyurular,
// rota planlayıcı ve kroki (bkz. components/admin/AdminWorkspace.tsx). Bu
// bileşenin kendi yan menüsünde "Mobil Uygulamayı Önizle" (katılımcı görünümünü
// önizleme) ve çıkış yap seçenekleri zaten yer alır.
export default function AdminScreen() {
  return <AdminWorkspace />;
}
