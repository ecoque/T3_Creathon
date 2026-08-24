import { Check, Clock3, Save, Trash2, X } from 'lucide-react-native';
import { useEffect, useRef, useState, type ReactNode } from 'react';
import {
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { colors } from '../../constants/theme';
import { isBoothPlaced } from '../../lib/boothGrid';
import type {
  AdminAnnouncement,
  AdminAttendee,
  AdminBooth,
  AdminSession,
  AdminStage,
  AttendeeRole,
  EventSettings,
  SessionCategory,
} from '../../types/admin';

type BaseModalProps = {
  visible: boolean;
  title: string;
  subtitle?: string;
  onClose: () => void;
  children: ReactNode;
  footer?: ReactNode;
};

function BaseModal({ visible, title, subtitle, onClose, children, footer }: BaseModalProps) {
  const insets = useSafeAreaInsets();
  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent
      statusBarTranslucent
      navigationBarTranslucent={Platform.OS === 'android'}
      onRequestClose={onClose}
    >
      <KeyboardAvoidingView
        style={styles.overlay}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />
        <View
          style={[
            styles.sheet,
            { paddingTop: Math.max(insets.top, 12), paddingBottom: Math.max(insets.bottom, 12) },
          ]}
        >
          <View style={styles.sheetHeader}>
            <View style={styles.headerCopy}>
              <Text style={styles.sheetTitle}>{title}</Text>
              {subtitle ? <Text style={styles.sheetSubtitle}>{subtitle}</Text> : null}
            </View>
            <Pressable accessibilityLabel="Kapat" style={styles.iconButton} onPress={onClose}>
              <X size={20} color={colors.text} />
            </Pressable>
          </View>
          <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={styles.form}>
            {children}
          </ScrollView>
          {footer ? <View style={styles.footer}>{footer}</View> : null}
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

function Field({
  label,
  value,
  onChangeText,
  placeholder,
  multiline,
  error,
  keyboardType = 'default',
}: {
  label: string;
  value: string;
  onChangeText: (value: string) => void;
  placeholder?: string;
  multiline?: boolean;
  error?: boolean;
  keyboardType?: 'default' | 'email-address' | 'numeric' | 'phone-pad' | 'url';
}) {
  return (
    <View style={styles.field}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <TextInput
        style={[styles.input, multiline && styles.textarea, error && styles.inputError]}
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={colors.textFaint}
        multiline={multiline}
        keyboardType={keyboardType}
        textAlignVertical={multiline ? 'top' : 'center'}
      />
    </View>
  );
}

function Choices<T extends string>({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: T;
  options: readonly T[];
  onChange: (value: T) => void;
}) {
  return (
    <View style={styles.field}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <View style={styles.choices}>
        {options.map((option) => (
          <Pressable
            key={option}
            style={[styles.choice, option === value && styles.choiceActive]}
            onPress={() => onChange(option)}
          >
            {option === value ? <Check size={13} color={colors.white} /> : null}
            <Text style={[styles.choiceText, option === value && styles.choiceTextActive]}>
              {option}
            </Text>
          </Pressable>
        ))}
      </View>
    </View>
  );
}

function FooterButtons({
  onClose,
  onSave,
  saveLabel = 'Kaydet',
  destructive,
  onDelete,
}: {
  onClose: () => void;
  onSave: () => void;
  saveLabel?: string;
  destructive?: boolean;
  onDelete?: () => void;
}) {
  return (
    <View style={styles.footerRow}>
      {destructive && onDelete ? (
        <Pressable style={styles.deleteButton} onPress={onDelete}>
          <Trash2 size={16} color={colors.danger} />
          <Text style={styles.deleteText}>Sil</Text>
        </Pressable>
      ) : null}
      <View style={styles.footerSpacer} />
      <Pressable style={styles.cancelButton} onPress={onClose}>
        <Text style={styles.cancelText}>Vazgeç</Text>
      </Pressable>
      <Pressable style={styles.saveButton} onPress={onSave}>
        <Save size={16} color={colors.white} />
        <Text style={styles.saveText}>{saveLabel}</Text>
      </Pressable>
    </View>
  );
}

const SESSION_CATEGORIES: SessionCategory[] = [
  'Keynote',
  'Panel',
  'Workshop',
  'Pitch',
  'Networking',
  'Demo',
  'Ara',
  'Yemek',
  'Açılış',
  'Fireside Chat',
  'Diğer',
];

export function SessionEditorModal({
  visible,
  session,
  stages,
  onClose,
  onSave,
  onDelete,
}: {
  visible: boolean;
  session: AdminSession | null;
  stages: AdminStage[];
  onClose: () => void;
  onSave: (data: Partial<AdminSession>, publish: boolean, id?: string) => void;
  onDelete?: (id: string) => void;
}) {
  const firstStage = stages[0];
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [day, setDay] = useState('24');
  const [time, setTime] = useState('10:00');
  const [endTime, setEndTime] = useState('10:45');
  const [category, setCategory] = useState<SessionCategory>('Panel');
  const [stageId, setStageId] = useState(firstStage?.id || '');
  const [capacity, setCapacity] = useState('400');
  const [speakers, setSpeakers] = useState('');
  const [tags, setTags] = useState('');
  const [coverImage, setCoverImage] = useState('');
  const initializedFormKey = useRef<string | null>(null);
  const formKey = visible ? (session?.id ?? 'new') : null;

  useEffect(() => {
    if (!formKey) {
      initializedFormKey.current = null;
      return;
    }
    if (initializedFormKey.current === formKey) return;
    initializedFormKey.current = formKey;
    setTitle(session?.title || '');
    setDescription(session?.description || '');
    setDay(session?.day || '24');
    setTime(session?.time || '10:00');
    setEndTime(session?.endTime || '10:45');
    setCategory(session?.category || 'Panel');
    setStageId(session?.stageId || firstStage?.id || '');
    setCapacity(String(session?.capacity || 400));
    setSpeakers(
      session?.speakers
        .map((item) => [item.name, item.company].filter(Boolean).join(' — '))
        .join(', ') || '',
    );
    setTags(session?.tags.join(', ') || '');
    setCoverImage(session?.coverImage || '');
  }, [formKey, session, firstStage?.id]);

  function submit(publish: boolean) {
    if (!title.trim()) return;
    const stage = stages.find((item) => item.id === stageId) || firstStage;
    onSave(
      {
        title: title.trim(),
        description: description.trim(),
        day,
        dayName: day === '25' ? 'Cmt' : day === '26' ? 'Paz' : day === '27' ? 'Pzt' : 'Cum',
        dateStr: day + ' Ekim 2026',
        time,
        endTime,
        duration: '45dk',
        category,
        stageId,
        stageName: stage?.name || '',
        capacity: Number(capacity) || 0,
        speakers: speakers
          .split(',')
          .map((name, index) => ({
            id: 'speaker-' + Date.now() + '-' + index,
            name: name.trim(),
            title: '',
            company: '',
          }))
          .filter((item) => item.name),
        tags: tags
          .split(',')
          .map((tag) => tag.trim())
          .filter(Boolean),
        coverImage: coverImage.trim() || undefined,
      },
      publish,
      session?.id,
    );
    onClose();
  }

  return (
    <BaseModal
      visible={visible}
      title={session ? 'Oturumu Düzenle' : 'Yeni Oturum'}
      subtitle="Program, sahne ve yayın durumunu yönetin."
      onClose={onClose}
      footer={
        <FooterButtons
          onClose={onClose}
          onSave={() => submit(true)}
          saveLabel={session ? 'Güncelle' : 'Yayınla'}
          destructive={!!session}
          onDelete={session && onDelete ? () => onDelete(session.id) : undefined}
        />
      }
    >
      <Field
        label="Oturum başlığı *"
        value={title}
        onChangeText={setTitle}
        placeholder="Örn. Yapay Zekanın Geleceği"
      />
      <Field label="Açıklama" value={description} onChangeText={setDescription} multiline />
      <Choices label="Gün" value={day} options={['24', '25', '26', '27']} onChange={setDay} />
      <View style={styles.twoCol}>
        <View style={styles.flex}>
          <Field label="Başlangıç" value={time} onChangeText={setTime} placeholder="10:00" />
        </View>
        <View style={styles.flex}>
          <Field label="Bitiş" value={endTime} onChangeText={setEndTime} placeholder="10:45" />
        </View>
      </View>
      <Choices
        label="Kategori"
        value={category}
        options={SESSION_CATEGORIES}
        onChange={setCategory}
      />
      <Choices
        label="Sahne / Alan"
        value={stageId}
        options={stages.map((item) => item.id)}
        onChange={setStageId}
      />
      <Text style={styles.helper}>
        {stages.find((item) => item.id === stageId)?.name || 'Sahne seçilmedi'}
      </Text>
      <Field
        label="Konuşmacılar (virgülle ayırın)"
        value={speakers}
        onChangeText={setSpeakers}
        placeholder="Ad Soyad, Ad Soyad"
      />
      <Field
        label="Etiketler"
        value={tags}
        onChangeText={setTags}
        placeholder="AI, Teknoloji, Global"
      />
      <Field
        label="Kapak görseli bağlantısı"
        value={coverImage}
        onChangeText={setCoverImage}
        placeholder="https://…"
        keyboardType="url"
      />
      <Field label="Kapasite" value={capacity} onChangeText={setCapacity} keyboardType="numeric" />
      {!session ? (
        <Pressable style={styles.draftButton} onPress={() => submit(false)}>
          <Text style={styles.draftText}>Taslak olarak kaydet</Text>
        </Pressable>
      ) : null}
    </BaseModal>
  );
}

const BOOTH_CATEGORIES: AdminBooth['category'][] = [
  'Yapay Zeka',
  'Fintech',
  'SaaS',
  'Sağlık Teknolojileri',
  'Oyun & Medya',
  'Sürdürülebilirlik',
  'Donanım & IoT',
  'Yatırım / VC',
];

export function BoothEditorModal({
  visible,
  booth,
  onClose,
  onSave,
  onDelete,
}: {
  visible: boolean;
  booth: AdminBooth | null;
  onClose: () => void;
  onSave: (data: Partial<AdminBooth>, id?: string) => void;
  onDelete?: (id: string) => void;
}) {
  const [form, setForm] = useState({
    companyName: '',
    description: '',
    category: 'Yapay Zeka' as AdminBooth['category'],
    sponsorTier: 'Startup' as AdminBooth['sponsorTier'],
    status: 'active' as AdminBooth['status'],
    contactPerson: '',
    contactEmail: '',
    logo: '',
    qrCodeUrl: '',
  });
  useEffect(
    () =>
      setForm({
        companyName: booth?.companyName || '',
        description: booth?.description || '',
        category: booth?.category || 'Yapay Zeka',
        sponsorTier: booth?.sponsorTier || 'Startup',
        status: booth?.status || 'active',
        contactPerson: booth?.contactPerson || '',
        contactEmail: booth?.contactEmail || '',
        logo: booth?.logo || '',
        qrCodeUrl: booth?.qrCodeUrl || '',
      }),
    [booth, visible],
  );
  const set = <K extends keyof typeof form>(key: K, value: (typeof form)[K]) =>
    setForm((current) => ({ ...current, [key]: value }));
  function submit() {
    if (!form.companyName.trim()) return;
    // Stand no, bölge ve kroki konumu burada değil, Harita Yönetimi > Kroki
    // ekranından atanıyor (bkz. AdminMapManagement). Bu formdan gelen veri
    // store'da mevcut stant kaydıyla birleştirildiği için (saveBooth), o
    // alanlar burada gönderilmese de korunuyor.
    onSave(form, booth?.id);
    onClose();
  }
  return (
    <BaseModal
      visible={visible}
      title={booth ? 'Standı Düzenle' : 'Yeni Stand'}
      subtitle="Firma ve iletişim bilgilerini yönetin."
      onClose={onClose}
      footer={
        <FooterButtons
          onClose={onClose}
          onSave={submit}
          destructive={!!booth}
          onDelete={booth && onDelete ? () => onDelete(booth.id) : undefined}
        />
      }
    >
      <View style={styles.placementNote}>
        <Text style={styles.placementNoteLabel}>KROKİ KONUMU</Text>
        <Text style={styles.placementNoteValue}>
          {booth && isBoothPlaced(booth)
            ? `${booth.boothNo} · ${booth.zone} · X %${booth.mapX} · Y %${booth.mapY}`
            : 'Henüz yerleştirilmedi'}
        </Text>
        <Text style={styles.placementNoteHint}>
          Stand no ve konum, Harita Yönetimi ekranındaki "Yerleştirilmemiş Öğeler" listesinden seçip
          krokiye getirdikten sonra sürükleyerek atanır — bölgeye göre otomatik numaralandırılır
          (örn. Zone A'daki ilk stant A101).
        </Text>
      </View>
      <Field
        label="Şirket adı *"
        value={form.companyName}
        onChangeText={(v) => set('companyName', v)}
      />
      <Field
        label="Açıklama"
        value={form.description}
        onChangeText={(v) => set('description', v)}
        multiline
      />
      <Choices
        label="Kategori"
        value={form.category}
        options={BOOTH_CATEGORIES}
        onChange={(v) => set('category', v)}
      />
      <Choices
        label="Sponsor seviyesi"
        value={form.sponsorTier}
        options={['Platinum', 'Gold', 'Silver', 'Startup', 'Partner']}
        onChange={(v) => set('sponsorTier', v)}
      />
      <Choices
        label="Stand durumu"
        value={form.status}
        options={['active', 'passive', 'reserved']}
        onChange={(v) => set('status', v)}
      />
      <Field
        label="İletişim kişisi"
        value={form.contactPerson}
        onChangeText={(v) => set('contactPerson', v)}
      />
      <Field
        label="İletişim e-postası"
        value={form.contactEmail}
        onChangeText={(v) => set('contactEmail', v)}
        keyboardType="email-address"
      />
      <Field
        label="Logo bağlantısı"
        value={form.logo}
        onChangeText={(v) => set('logo', v)}
        keyboardType="url"
      />
      <Field
        label="QR kod bağlantısı"
        value={form.qrCodeUrl}
        onChangeText={(v) => set('qrCodeUrl', v)}
        keyboardType="url"
      />
    </BaseModal>
  );
}

export function StageEditorModal({
  visible,
  stage,
  onClose,
  onSave,
  onDelete,
}: {
  visible: boolean;
  stage: AdminStage | null;
  onClose: () => void;
  onSave: (data: Partial<AdminStage>, id?: string) => void;
  onDelete?: (id: string) => void;
}) {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [type, setType] = useState<AdminStage['type']>('Main Stage');
  const [capacity, setCapacity] = useState('500');
  const [status, setStatus] = useState<AdminStage['status']>('active');
  useEffect(() => {
    setName(stage?.name || '');
    setDescription(stage?.description || '');
    setType(stage?.type || 'Main Stage');
    setCapacity(String(stage?.capacity || 500));
    setStatus(stage?.status || 'active');
  }, [stage, visible]);
  function submit() {
    if (!name.trim()) return;
    onSave(
      { name: name.trim(), description, type, capacity: Number(capacity) || 0, status },
      stage?.id,
    );
    onClose();
  }
  return (
    <BaseModal
      visible={visible}
      title={stage ? 'Alanı Düzenle' : 'Yeni Alan'}
      subtitle="Sahne kapasitesi, bölgesi ve operasyon durumu."
      onClose={onClose}
      footer={
        <FooterButtons
          onClose={onClose}
          onSave={submit}
          destructive={!!stage}
          onDelete={stage && onDelete ? () => onDelete(stage.id) : undefined}
        />
      }
    >
      <View style={styles.placementNote}>
        <Text style={styles.placementNoteLabel}>KROKİ KONUMU</Text>
        <Text style={styles.placementNoteValue}>
          {stage
            ? stage.zone
              ? `${stage.zone} · X %${stage.mapX} · Y %${stage.mapY}`
              : 'Henüz krokiye yerleştirilmedi'
            : 'Kaydedince "Yerleştirilmemiş Öğeler" listesine eklenir'}
        </Text>
        <Text style={styles.placementNoteHint}>
          Konum ve bölge, Harita Yönetimi ekranındaki "Yerleştirilmemiş Öğeler" listesinden seçip
          krokiye getirdikten sonra sürükleyerek ayarlanır — bölge, bırakılan noktaya göre otomatik
          belirlenir.
        </Text>
      </View>
      <Field label="Alan adı *" value={name} onChangeText={setName} />
      <Field label="Açıklama" value={description} onChangeText={setDescription} multiline />
      <Choices
        label="Alan tipi"
        value={type}
        options={[
          'Main Stage',
          'AI Stage',
          'Startup Stage',
          'Workshop Area',
          'Networking Area',
          'Meeting Area',
          'Food Area',
          'Diğer',
        ]}
        onChange={setType}
      />
      <Choices
        label="Durum"
        value={status}
        options={['active', 'maintenance', 'closed']}
        onChange={setStatus}
      />
      <Field label="Kapasite" value={capacity} onChangeText={setCapacity} keyboardType="numeric" />
    </BaseModal>
  );
}

// 'Görevli' burada admin'in bir katılımcıyı görevli yapabilmesi için kasıtlı
// olarak listede — onboarding rol seçim ekranında ASLA gösterilmiyor.
const ATTENDEE_ROLES: AttendeeRole[] = ['Girişimci', 'Yatırımcı', 'Kurum / Partner', 'Ziyaretçi', 'Görevli'];

export function AttendeeEditorModal({
  visible,
  attendee,
  saveError,
  onClose,
  onSave,
  onClearError,
  onDelete,
}: {
  visible: boolean;
  attendee: AdminAttendee | null;
  saveError?: string | null;
  onClose: () => void;
  onSave: (data: Partial<AdminAttendee>, id?: string) => Promise<boolean>;
  onClearError?: () => void;
  onDelete?: (id: string) => void;
}) {
  const [validationError, setValidationError] = useState('');
  const [form, setForm] = useState({
    firstName: '',
    lastName: '',
    title: '',
    position: '',
    company: '',
    role: 'Ziyaretçi' as AttendeeRole,
    sector: '',
    interests: '',
    email: '',
    phone: '',
    linkedin: '',
    notes: '',
    status: 'active' as AdminAttendee['status'],
  });
  useEffect(
    () => {
      setValidationError('');
      if (visible) onClearError?.();
      setForm({
        firstName: attendee?.firstName || '',
        lastName: attendee?.lastName || '',
        title: attendee?.title || '',
        position: attendee?.position || '',
        company: attendee?.company || '',
        role: attendee?.role || 'Ziyaretçi',
        sector: attendee?.sector || '',
        interests: attendee?.interests.join(', ') || '',
        email: attendee?.email || '',
        phone: attendee?.phone || '',
        linkedin: attendee?.linkedin || '',
        notes: attendee?.notes || '',
        status: attendee?.status || 'active',
      });
    },
    [attendee, visible, onClearError],
  );
  const set = <K extends keyof typeof form>(key: K, value: (typeof form)[K]) => {
    setValidationError('');
    onClearError?.();
    setForm((current) => ({ ...current, [key]: value }));
  };
  const requiresEntrepreneurIdentity = form.role === 'Girişimci' && form.status === 'active';
  async function submit() {
    if (!form.firstName.trim() || !form.lastName.trim()) {
      setValidationError('Ad ve soyad alanlarını doldurun.');
      return;
    }
    if (requiresEntrepreneurIdentity && (!form.title.trim() || !form.company.trim())) {
      setValidationError('Aktif girişimci profili için unvan ve şirket alanlarını doldurun.');
      return;
    }
    const saved = await onSave(
      {
        ...form,
        title: form.title.trim(),
        position: form.position.trim(),
        company: form.company.trim(),
        name: form.firstName.trim() + ' ' + form.lastName.trim(),
        interests: form.interests
          .split(',')
          .map((item) => item.trim())
          .filter(Boolean),
      },
      attendee?.id,
    );
    if (saved) onClose();
  }
  const displayedError = validationError || saveError;
  return (
    <BaseModal
      visible={visible}
      title={attendee ? 'Katılımcı Detayı' : 'Yeni Katılımcı'}
      subtitle="Profil, rol, iletişim ve etkinlik durumunu yönetin."
      onClose={onClose}
      footer={
        <FooterButtons
          onClose={onClose}
          onSave={submit}
          destructive={!!attendee}
          onDelete={attendee && onDelete ? () => onDelete(attendee.id) : undefined}
        />
      }
    >
      {displayedError ? (
        <View style={styles.validationBanner}>
          <Text style={styles.validationText}>{displayedError}</Text>
        </View>
      ) : null}
      <View style={styles.twoCol}>
        <View style={styles.flex}>
          <Field label="Ad *" value={form.firstName} onChangeText={(v) => set('firstName', v)} />
        </View>
        <View style={styles.flex}>
          <Field label="Soyad *" value={form.lastName} onChangeText={(v) => set('lastName', v)} />
        </View>
      </View>
      <Field
        label={`Unvan${requiresEntrepreneurIdentity ? ' *' : ''}`}
        value={form.title}
        onChangeText={(v) => set('title', v)}
        error={requiresEntrepreneurIdentity && !form.title.trim() && !!displayedError}
      />
      <Field label="Pozisyon" value={form.position} onChangeText={(v) => set('position', v)} />
      <Field
        label={`Şirket${requiresEntrepreneurIdentity ? ' *' : ''}`}
        value={form.company}
        onChangeText={(v) => set('company', v)}
        error={requiresEntrepreneurIdentity && !form.company.trim() && !!displayedError}
      />
      <Choices
        label="Rol"
        value={form.role}
        options={ATTENDEE_ROLES}
        onChange={(v) => set('role', v)}
      />
      <Field label="Sektör" value={form.sector} onChangeText={(v) => set('sector', v)} />
      <Field
        label="İlgi alanları"
        value={form.interests}
        onChangeText={(v) => set('interests', v)}
        placeholder="AI, Fintech, SaaS"
      />
      <Field
        label="E-posta"
        value={form.email}
        onChangeText={(v) => set('email', v)}
        keyboardType="email-address"
      />
      <Field
        label="Telefon"
        value={form.phone}
        onChangeText={(v) => set('phone', v)}
        keyboardType="phone-pad"
      />
      <Field
        label="LinkedIn"
        value={form.linkedin}
        onChangeText={(v) => set('linkedin', v)}
        keyboardType="url"
      />
      <Field
        label="Admin notları"
        value={form.notes}
        onChangeText={(v) => set('notes', v)}
        multiline
      />
      <View style={styles.attendeeStatusToggleRow}>
        <View style={styles.attendeeStatusToggleCopy}>
          <Text style={styles.fieldLabel}>Aktif hesap</Text>
          <Text style={styles.attendeeStatusHelper}>Pasif hesap uygulamaya erişemez.</Text>
        </View>
        <Switch
          style={styles.attendeeStatusSwitch}
          value={form.status === 'active'}
          onValueChange={(v) => set('status', v ? 'active' : 'passive')}
          trackColor={{ true: colors.primary, false: colors.surfaceHigh }}
        />
      </View>
    </BaseModal>
  );
}

export function AnnouncementEditorModal({
  visible,
  sessions,
  booths,
  onClose,
  onSave,
}: {
  visible: boolean;
  sessions: AdminSession[];
  booths: AdminBooth[];
  onClose: () => void;
  onSave: (data: Partial<AdminAnnouncement>, scheduled: boolean) => void;
}) {
  const [title, setTitle] = useState('');
  const [message, setMessage] = useState('');
  const [targetAudience, setAudience] =
    useState<AdminAnnouncement['targetAudience']>('Tüm Katılımcılar');
  const [ctaText, setCtaText] = useState('');
  const [ctaUrl, setCtaUrl] = useState('');
  const [targetZone, setTargetZone] = useState('Zone A');
  const [targetSessionId, setTargetSessionId] = useState(sessions[0]?.id || '');
  const [targetBoothId, setTargetBoothId] = useState(booths[0]?.id || '');
  const [scheduledFor, setScheduledFor] = useState('Bugün 18:00');
  const [scheduled, setScheduled] = useState(false);
  const wasVisible = useRef(false);
  useEffect(() => {
    if (visible && !wasVisible.current) {
      setTitle('');
      setMessage('');
      setAudience('Tüm Katılımcılar');
      setCtaText('');
      setCtaUrl('');
      setTargetZone('Zone A');
      setTargetSessionId(sessions[0]?.id || '');
      setTargetBoothId(booths[0]?.id || '');
      setScheduledFor('Bugün 18:00');
      setScheduled(false);
    }
    wasVisible.current = visible;
  }, [visible, sessions, booths]);
  function submit() {
    if (!title.trim() || !message.trim()) return;
    onSave(
      {
        title: title.trim(),
        message: message.trim(),
        targetAudience,
        ctaText: ctaText.trim() || undefined,
        ctaUrl: ctaUrl.trim() || undefined,
        targetZone: targetAudience === 'Zone Bazlı Kullanıcılar' ? targetZone : undefined,
        targetSessionId: targetAudience === 'Oturumu Kaydedenler' ? targetSessionId : undefined,
        targetBoothId: targetAudience === 'Zone Bazlı Kullanıcılar' ? targetBoothId : undefined,
        scheduledFor,
      },
      scheduled,
    );
    onClose();
  }
  return (
    <BaseModal
      visible={visible}
      title="Yeni Duyuru"
      subtitle="Hedef kitleye anlık veya planlanmış bildirim gönderin."
      onClose={onClose}
      footer={
        <FooterButtons
          onClose={onClose}
          onSave={submit}
          saveLabel={scheduled ? 'Planla' : 'Şimdi Gönder'}
        />
      }
    >
      <Field label="Başlık *" value={title} onChangeText={setTitle} />
      <Field label="Mesaj *" value={message} onChangeText={setMessage} multiline />
      <Choices
        label="Hedef kitle"
        value={targetAudience}
        options={[
          'Tüm Katılımcılar',
          'Girişimciler',
          'Yatırımcılar',
          'Kurum / Partner',
          'Ziyaretçiler',
          'Oturumu Kaydedenler',
          'Zone Bazlı Kullanıcılar',
        ]}
        onChange={setAudience}
      />
      {targetAudience === 'Zone Bazlı Kullanıcılar' ? (
        <>
          <Choices
            label="Hedef bölge"
            value={targetZone}
            options={['Zone A', 'Zone B', 'Zone C', 'Zone D']}
            onChange={setTargetZone}
          />
          <Choices
            label="İlgili stand"
            value={targetBoothId}
            options={booths.map((item) => item.id)}
            onChange={setTargetBoothId}
          />
          <Text style={styles.helper}>
            {booths.find((item) => item.id === targetBoothId)?.companyName || 'Stand seçilmedi'}
          </Text>
        </>
      ) : null}
      {targetAudience === 'Oturumu Kaydedenler' ? (
        <>
          <Choices
            label="Hedef oturum"
            value={targetSessionId}
            options={sessions.map((item) => item.id)}
            onChange={setTargetSessionId}
          />
          <Text style={styles.helper}>
            {sessions.find((item) => item.id === targetSessionId)?.title || 'Oturum seçilmedi'}
          </Text>
        </>
      ) : null}
      <View style={styles.twoCol}>
        <View style={styles.flex}>
          <Field
            label="CTA metni"
            value={ctaText}
            onChangeText={setCtaText}
            placeholder="Detayları Gör"
          />
        </View>
        <View style={styles.flex}>
          <Field
            label="CTA bağlantısı"
            value={ctaUrl}
            onChangeText={setCtaUrl}
            placeholder="/program"
          />
        </View>
      </View>
      <View style={styles.toggleRow}>
        <View style={styles.toggleCopy}>
          <Text style={styles.fieldLabel}>Gönderimi planla</Text>
          <Text style={styles.toggleHelper}>Kapalıysa hemen gönderilir.</Text>
        </View>
        <Switch
          value={scheduled}
          onValueChange={setScheduled}
          trackColor={{ true: colors.primary, false: colors.surfaceHigh }}
        />
      </View>
      {scheduled ? (
        <Field label="Planlanan zaman" value={scheduledFor} onChangeText={setScheduledFor} />
      ) : null}
      <View style={styles.phonePreview}>
        <Text style={styles.previewEyebrow}>BİLDİRİM ÖNİZLEMESİ</Text>
        <Text style={styles.previewTitle}>{title || 'Duyuru başlığı'}</Text>
        <Text style={styles.previewMessage}>
          {message || 'Katılımcılara gönderilecek mesaj burada görünür.'}
        </Text>
        {ctaText ? <Text style={styles.previewCta}>{ctaText} →</Text> : null}
      </View>
    </BaseModal>
  );
}

export function QuickSessionModal({
  visible,
  session,
  stages,
  onClose,
  onDelay,
  onStatus,
  onStage,
}: {
  visible: boolean;
  session: AdminSession | null;
  stages: AdminStage[];
  onClose: () => void;
  onDelay: (minutes: number) => void;
  onStatus: (status: AdminSession['status']) => void;
  onStage: (stageId: string) => void;
}) {
  if (!session) return null;
  return (
    <BaseModal
      visible={visible}
      title="Hızlı Oturum İşlemleri"
      subtitle={session.title}
      onClose={onClose}
    >
      <Text style={styles.sectionTitle}>Gecikme ekle</Text>
      <View style={styles.choices}>
        {[5, 10, 15].map((m) => (
          <Pressable key={m} style={styles.actionTile} onPress={() => onDelay(m)}>
            <Clock3 size={18} color={colors.primary} />
            <Text style={styles.actionTileText}>+{m} dk</Text>
          </Pressable>
        ))}
      </View>
      <Choices
        label="Yayın durumu"
        value={session.status}
        options={['published', 'live', 'completed', 'cancelled', 'delayed']}
        onChange={(status) => onStatus(status as AdminSession['status'])}
      />
      <Choices
        label="Salon değiştir"
        value={session.stageId}
        options={stages.map((item) => item.id)}
        onChange={onStage}
      />
    </BaseModal>
  );
}

export function SettingsEditor({
  settings,
  onSave,
}: {
  settings: EventSettings;
  onSave: (data: Partial<EventSettings>) => void;
}) {
  const [draft, setDraft] = useState(settings);
  useEffect(() => setDraft(settings), [settings]);
  const set = <K extends keyof EventSettings>(key: K, value: EventSettings[K]) =>
    setDraft((current) => ({ ...current, [key]: value }));
  return (
    <View style={styles.settingsCard}>
      <Text style={styles.sectionTitle}>Etkinlik bilgileri</Text>
      <Field
        label="Etkinlik adı"
        value={draft.eventName}
        onChangeText={(v) => set('eventName', v)}
      />
      <Field
        label="Etkinlik edisyonu"
        value={draft.edition || ''}
        onChangeText={(v) => set('edition', v)}
        placeholder="2026"
      />
      <Field label="Tarih" value={draft.eventDates} onChangeText={(v) => set('eventDates', v)} />
      <View style={styles.twoCol}>
        <View style={styles.flex}>
          <Field
            label="Başlangıç tarihi"
            value={draft.startDate || ''}
            onChangeText={(v) => set('startDate', v)}
            placeholder="2026-10-24"
          />
        </View>
        <View style={styles.flex}>
          <Field
            label="Bitiş tarihi"
            value={draft.endDate || ''}
            onChangeText={(v) => set('endDate', v)}
            placeholder="2026-10-27"
          />
        </View>
      </View>
      <Field label="Mekân" value={draft.venueName} onChangeText={(v) => set('venueName', v)} />
      <Field
        label="Adres"
        value={draft.venueAddress || ''}
        onChangeText={(v) => set('venueAddress', v)}
        multiline
      />
      <Field
        label="Etkinlik logosu bağlantısı"
        value={draft.logoUrl || ''}
        onChangeText={(v) => set('logoUrl', v)}
        keyboardType="url"
      />
      <View style={styles.twoCol}>
        <View style={styles.flex}>
          <Field
            label="Açılış"
            value={draft.openingTime}
            onChangeText={(v) => set('openingTime', v)}
          />
        </View>
        <View style={styles.flex}>
          <Field
            label="Kapanış"
            value={draft.closingTime}
            onChangeText={(v) => set('closingTime', v)}
          />
        </View>
      </View>
      <Text style={styles.sectionTitle}>Konum takibi</Text>
      <View style={styles.twoCol}>
        <View style={styles.flex}>
          <Field
            label="Takip başlangıcı"
            value={draft.locationTrackingStart}
            onChangeText={(v) => set('locationTrackingStart', v)}
          />
        </View>
        <View style={styles.flex}>
          <Field
            label="Takip bitişi"
            value={draft.locationTrackingEnd}
            onChangeText={(v) => set('locationTrackingEnd', v)}
          />
        </View>
      </View>
      <Field
        label="Konum takibi açıklaması"
        value={draft.trackingDisclaimer || ''}
        onChangeText={(v) => set('trackingDisclaimer', v)}
        multiline
      />
      <Choices
        label="Dil"
        value={draft.defaultLanguage}
        options={['tr', 'en']}
        onChange={(v) => set('defaultLanguage', v)}
      />
      <Field label="Saat dilimi" value={draft.timezone} onChangeText={(v) => set('timezone', v)} />
      <View style={styles.toggleRow}>
        <Text style={styles.fieldLabel}>Program değişikliklerini otomatik bildir</Text>
        <Switch
          value={!!draft.autoNotifyScheduleChanges}
          onValueChange={(v) => set('autoNotifyScheduleChanges', v)}
          trackColor={{ true: colors.primary, false: colors.surfaceHigh }}
        />
      </View>
      <View style={styles.toggleRow}>
        <Text style={styles.fieldLabel}>Anonim bölge yoğunluğu takibi</Text>
        <Switch
          value={!!draft.enableAnonymousZoneTracking}
          onValueChange={(v) => set('enableAnonymousZoneTracking', v)}
          trackColor={{ true: colors.primary, false: colors.surfaceHigh }}
        />
      </View>
      <View style={styles.toggleRow}>
        <Text style={styles.fieldLabel}>QR check-in zorunlu</Text>
        <Switch
          value={!!draft.requireCheckInQr}
          onValueChange={(v) => set('requireCheckInQr', v)}
          trackColor={{ true: colors.primary, false: colors.surfaceHigh }}
        />
      </View>
      <Pressable
        style={[styles.saveButton, { alignSelf: 'flex-end' }]}
        onPress={() => onSave(draft)}
      >
        <Save size={16} color={colors.white} />
        <Text style={styles.saveText}>Ayarları Kaydet</Text>
      </Pressable>
    </View>
  );
}

export function ConfirmDeleteModal({
  visible,
  title,
  body,
  onCancel,
  onConfirm,
}: {
  visible: boolean;
  title: string;
  body: string;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  const insets = useSafeAreaInsets();
  return (
    <Modal
      visible={visible}
      animationType="fade"
      transparent
      statusBarTranslucent
      navigationBarTranslucent={Platform.OS === 'android'}
      onRequestClose={onCancel}
    >
      <View
        style={[
          styles.confirmOverlay,
          { paddingTop: Math.max(insets.top, 20), paddingBottom: Math.max(insets.bottom, 20) },
        ]}
      >
        <View style={styles.confirmCard}>
          <View style={styles.dangerIcon}>
            <Trash2 size={22} color={colors.danger} />
          </View>
          <Text style={styles.sheetTitle}>{title}</Text>
          <Text style={styles.confirmBody}>{body}</Text>
          <View style={styles.footerRow}>
            <Pressable style={styles.cancelButton} onPress={onCancel}>
              <Text style={styles.cancelText}>Vazgeç</Text>
            </Pressable>
            <Pressable style={styles.confirmDelete} onPress={onConfirm}>
              <Trash2 size={16} color={colors.white} />
              <Text style={styles.saveText}>Kalıcı Olarak Sil</Text>
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: 'rgba(8,18,28,0.48)', alignItems: 'flex-end' },
  sheet: {
    width: Platform.OS === 'web' ? 620 : '100%',
    maxWidth: '100%',
    height: '100%',
    backgroundColor: colors.surface,
    borderLeftWidth: Platform.OS === 'web' ? 1 : 0,
    borderLeftColor: colors.border,
  },
  sheetHeader: {
    minHeight: 74,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 20,
    paddingBottom: 14,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  headerCopy: { flex: 1, gap: 3 },
  sheetTitle: { fontSize: 20, fontWeight: '800', color: colors.text },
  sheetSubtitle: { fontSize: 12, color: colors.textMuted },
  iconButton: {
    width: 38,
    height: 38,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 12,
    backgroundColor: colors.surfaceMuted,
  },
  form: { padding: 20, gap: 18, paddingBottom: 40 },
  footer: {
    padding: 16,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    backgroundColor: colors.surface,
  },
  footerRow: { flexDirection: 'row', gap: 10, alignItems: 'center' },
  footerSpacer: { flex: 1 },
  field: { gap: 7 },
  fieldLabel: { fontSize: 12, fontWeight: '700', color: colors.text },
  input: {
    minHeight: 44,
    borderWidth: 1,
    borderColor: colors.borderStrong,
    borderRadius: 10,
    paddingHorizontal: 12,
    color: colors.text,
    backgroundColor: colors.surface,
    fontSize: 14,
  },
  inputError: { borderColor: colors.danger },
  validationBanner: {
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.danger,
    backgroundColor: colors.dangerBg,
  },
  validationText: { color: colors.danger, fontSize: 12, fontWeight: '700', lineHeight: 18 },
  textarea: { minHeight: 94, paddingTop: 12 },
  choices: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  choice: {
    minHeight: 34,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 11,
    borderRadius: 99,
    borderWidth: 1,
    borderColor: colors.borderStrong,
    backgroundColor: colors.surface,
  },
  choiceActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  choiceText: { color: colors.textMuted, fontSize: 12, fontWeight: '700' },
  choiceTextActive: { color: colors.white },
  twoCol: { flexDirection: 'row', gap: 12, alignItems: 'flex-start' },
  flex: { flex: 1 },
  placementNote: {
    gap: 4,
    padding: 12,
    marginBottom: 4,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 12,
    backgroundColor: colors.surfaceMuted,
  },
  placementNoteLabel: { color: colors.textMuted, fontSize: 9, fontWeight: '900', letterSpacing: 0.5 },
  placementNoteValue: { color: colors.text, fontSize: 13, fontWeight: '800' },
  placementNoteHint: { color: colors.textFaint, fontSize: 10, lineHeight: 14, marginTop: 2 },
  helper: { marginTop: -10, color: colors.textFaint, fontSize: 11 },
  saveButton: {
    minHeight: 42,
    paddingHorizontal: 16,
    borderRadius: 10,
    backgroundColor: colors.primary,
    flexDirection: 'row',
    gap: 7,
    alignItems: 'center',
    justifyContent: 'center',
  },
  saveText: { color: colors.white, fontWeight: '800', fontSize: 13 },
  cancelButton: {
    minHeight: 42,
    paddingHorizontal: 15,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.borderStrong,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cancelText: { color: colors.text, fontWeight: '700', fontSize: 13 },
  deleteButton: {
    minHeight: 42,
    paddingHorizontal: 12,
    borderRadius: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: colors.dangerBg,
  },
  deleteText: { color: colors.danger, fontWeight: '800', fontSize: 13 },
  draftButton: {
    padding: 13,
    borderRadius: 10,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.primary,
  },
  draftText: { color: colors.primary, fontWeight: '800' },
  toggleRow: {
    minHeight: 54,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 14,
    paddingVertical: 8,
  },
  attendeeStatusToggleRow: {
    minHeight: 54,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 12,
    backgroundColor: colors.surfaceMuted,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  attendeeStatusToggleCopy: { flex: 1, minWidth: 0, flexShrink: 1 },
  attendeeStatusSwitch: { flexShrink: 0 },
  attendeeStatusHelper: { marginTop: 2, color: colors.textFaint, fontSize: 11, lineHeight: 15 },
  toggleCopy: { flex: 1, minWidth: 0, paddingRight: 4 },
  toggleHelper: { marginTop: 2, color: colors.textFaint, fontSize: 11, lineHeight: 15 },
  phonePreview: {
    alignSelf: 'center',
    width: '88%',
    minHeight: 145,
    borderRadius: 24,
    backgroundColor: '#152535',
    padding: 18,
    gap: 7,
  },
  previewEyebrow: { color: '#8fa5b8', fontSize: 9, fontWeight: '800', letterSpacing: 1 },
  previewTitle: { color: colors.white, fontSize: 16, fontWeight: '800' },
  previewMessage: { color: '#d9e2e9', fontSize: 12, lineHeight: 18 },
  previewCta: { color: '#ffad72', fontSize: 12, fontWeight: '800' },
  sectionTitle: { fontSize: 16, color: colors.text, fontWeight: '800' },
  actionTile: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    paddingHorizontal: 16,
    minHeight: 44,
    backgroundColor: colors.primarySoft,
    borderRadius: 11,
  },
  actionTileText: { color: colors.primary, fontWeight: '800' },
  settingsCard: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 16,
    padding: 18,
    gap: 18,
  },
  confirmOverlay: {
    flex: 1,
    backgroundColor: 'rgba(8,18,28,0.55)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  confirmCard: {
    width: '100%',
    maxWidth: 430,
    borderRadius: 18,
    backgroundColor: colors.surface,
    padding: 22,
    gap: 14,
  },
  dangerIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.dangerBg,
  },
  confirmBody: { color: colors.textMuted, fontSize: 14, lineHeight: 21 },
  confirmDelete: {
    minHeight: 42,
    paddingHorizontal: 14,
    borderRadius: 10,
    backgroundColor: colors.danger,
    flexDirection: 'row',
    gap: 7,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
