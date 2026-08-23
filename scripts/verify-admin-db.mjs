import { randomUUID } from 'node:crypto';
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { createClient } from '@supabase/supabase-js';

const ENV_FILE = resolve(process.cwd(), '.env');
const MIGRATION_FILE = 'supabase_admin_workspace_migration.sql';

function loadLocalEnv() {
  if (!existsSync(ENV_FILE)) return;

  for (const rawLine of readFileSync(ENV_FILE, 'utf8').split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith('#')) continue;

    const match = line.match(/^([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)$/);
    if (!match) continue;

    const [, key, rawValue] = match;
    let value = rawValue.trim();
    if (
      value.length >= 2 &&
      ((value.startsWith('"') && value.endsWith('"')) ||
        (value.startsWith("'") && value.endsWith("'")))
    ) {
      value = value.slice(1, -1);
    }
    if (process.env[key] === undefined) process.env[key] = value;
  }
}

function requireEnv(name) {
  const value = process.env[name]?.trim();
  if (!value) {
    const hint = name.startsWith('ADMIN_TEST_')
      ? '.env dosyasına ADMIN_TEST_EMAIL ve ADMIN_TEST_PASSWORD satırlarını ekleyin; gerçek değerleri terminale veya kaynak koda yazmayın.'
      : `.env dosyasını .env.example üzerinden tamamlayın (${name}).`;
    throw new Error(`${name} eksik. ${hint}`);
  }
  return value;
}

function resultError(context, error) {
  if (!error) return;
  throw new Error(`${context}: ${error.message}`);
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function compactRunId() {
  const timestamp = new Date()
    .toISOString()
    .replace(/[-:.TZ]/g, '')
    .slice(0, 14);
  return `${timestamp}_${randomUUID().slice(0, 8)}`;
}

loadLocalEnv();

let supabase;
let adminEmail;
let adminPassword;

const runId = compactRunId();
const prefix = `TEST_ADMIN_DB_${runId}`;
const created = {
  zone: null,
  stage: null,
  stand: null,
  session: null,
  announcement: null,
};
let settingsState = null;

const preflightQueries = [
  ['zones', 'id,name,polygon,code,capacity,description,updated_at'],
  ['stages', 'id,name,type,zone_id,capacity,current_occupancy,status,updated_at'],
  ['stands', 'id,name,lat,lng,type,zone_id,booth_no,company_name,status,updated_at'],
  ['sessions', 'id,title,start_time,end_time,stage_id,category,status,updated_at'],
  ['announcements', 'id,title,message,status,target_session_id,target_booth_id,updated_at'],
  ['event_settings', 'id,settings_key,event_name,edition,updated_at'],
  ['admin_logs', 'id,admin_user_id,action,target,type,created_at'],
  ['admin_attendee_details', 'profile_id,phone,notes,badge_scanned,updated_at'],
];

async function authenticateAdmin() {
  const { data, error } = await supabase.auth.signInWithPassword({
    email: adminEmail,
    password: adminPassword,
  });
  resultError('Admin test hesabıyla giriş başarısız', error);
  assert(data.user, 'Giriş başarılı görünse de kullanıcı oturumu oluşmadı.');

  const adminResult = await supabase
    .from('users')
    .select('id,is_admin')
    .eq('id', data.user.id)
    .single();
  resultError('Admin yetkisi doğrulanamadı', adminResult.error);
  assert(adminResult.data?.is_admin === true, 'Test hesabında public.users.is_admin = true değil.');
}

async function verifySchema() {
  for (const [table, columns] of preflightQueries) {
    const { error } = await supabase.from(table).select(columns).limit(1);
    if (error) {
      throw new Error(
        `Şema ön kontrolü başarısız (${table}): ${error.message}. ` +
          `${MIGRATION_FILE} dosyasının Supabase SQL Editor'da çalıştırıldığını doğrulayın.`,
      );
    }
  }
}

async function testZone() {
  created.zone = randomUUID();
  const insert = await supabase
    .from('zones')
    .insert({
      id: created.zone,
      name: `${prefix}_ZONE`,
      polygon: { type: 'Polygon', coordinates: [] },
      code: 'TEST',
      capacity: 10,
      active_attendees: 0,
      peak_attendees: 0,
      avg_attendees: 0,
      description: `${prefix}_CREATE`,
      color: '#0F766E',
    })
    .select('id,name,description')
    .single();
  resultError('Zone oluşturma başarısız', insert.error);
  assert(insert.data.id === created.zone, 'Oluşturulan zone kimliği doğrulanamadı.');

  const read = await supabase.from('zones').select('id,name').eq('id', created.zone).single();
  resultError('Zone okuma başarısız', read.error);
  assert(read.data.name === `${prefix}_ZONE`, 'Zone okuma doğrulaması eşleşmedi.');

  const update = await supabase
    .from('zones')
    .update({ description: `${prefix}_UPDATED`, updated_at: new Date().toISOString() })
    .eq('id', created.zone)
    .select('description')
    .single();
  resultError('Zone güncelleme başarısız', update.error);
  assert(update.data.description === `${prefix}_UPDATED`, 'Zone güncellemesi doğrulanamadı.');
}

async function testStage() {
  created.stage = randomUUID();
  const insert = await supabase
    .from('stages')
    .insert({
      id: created.stage,
      name: `${prefix}_STAGE`,
      type: 'Other',
      zone_id: created.zone,
      capacity: 10,
      current_occupancy: 0,
      map_x: 50,
      map_y: 50,
      status: 'active',
      description: `${prefix}_CREATE`,
    })
    .select('id,name,description')
    .single();
  resultError('Stage oluşturma başarısız', insert.error);
  assert(insert.data.id === created.stage, 'Oluşturulan stage kimliği doğrulanamadı.');

  const read = await supabase.from('stages').select('id,name').eq('id', created.stage).single();
  resultError('Stage okuma başarısız', read.error);
  assert(read.data.name === `${prefix}_STAGE`, 'Stage okuma doğrulaması eşleşmedi.');

  const update = await supabase
    .from('stages')
    .update({ description: `${prefix}_UPDATED`, current_occupancy: 1 })
    .eq('id', created.stage)
    .select('description,current_occupancy')
    .single();
  resultError('Stage güncelleme başarısız', update.error);
  assert(
    update.data.description === `${prefix}_UPDATED` && update.data.current_occupancy === 1,
    'Stage güncellemesi doğrulanamadı.',
  );
}

async function testStand() {
  created.stand = randomUUID();
  const insert = await supabase
    .from('stands')
    .insert({
      id: created.stand,
      name: `${prefix}_STAND`,
      lat: 0,
      lng: 0,
      type: 'Stand',
      sponsor: null,
      zone_id: created.zone,
      booth_no: `${prefix}_B01`,
      company_name: `${prefix}_COMPANY`,
      category: 'Test',
      description: `${prefix}_CREATE`,
      map_x: 50,
      map_y: 50,
      status: 'active',
      total_visits: 0,
    })
    .select('id,name,description')
    .single();
  resultError('Stand oluşturma başarısız', insert.error);
  assert(insert.data.id === created.stand, 'Oluşturulan stand kimliği doğrulanamadı.');

  const read = await supabase.from('stands').select('id,name').eq('id', created.stand).single();
  resultError('Stand okuma başarısız', read.error);
  assert(read.data.name === `${prefix}_STAND`, 'Stand okuma doğrulaması eşleşmedi.');

  const update = await supabase
    .from('stands')
    .update({ description: `${prefix}_UPDATED`, total_visits: 1 })
    .eq('id', created.stand)
    .select('description,total_visits')
    .single();
  resultError('Stand güncelleme başarısız', update.error);
  assert(
    update.data.description === `${prefix}_UPDATED` && update.data.total_visits === 1,
    'Stand güncellemesi doğrulanamadı.',
  );
}

async function testSession() {
  const startTime = new Date(Date.now() + 86_400_000);
  const endTime = new Date(startTime.getTime() + 45 * 60_000);
  created.session = randomUUID();
  const insert = await supabase
    .from('sessions')
    .insert({
      id: created.session,
      title: `${prefix}_SESSION`,
      description: `${prefix}_CREATE`,
      start_time: startTime.toISOString(),
      end_time: endTime.toISOString(),
      location: `${prefix}_STAGE`,
      stage_id: created.stage,
      category: 'Panel',
      status: 'draft',
      delay_minutes: 0,
      capacity: 10,
      bookmarked_count: 0,
      checked_in_count: 0,
      speakers: [],
      tags: ['TEST'],
    })
    .select('id,title,description')
    .single();
  resultError('Oturum oluşturma başarısız', insert.error);
  assert(insert.data.id === created.session, 'Oluşturulan oturum kimliği doğrulanamadı.');

  const read = await supabase
    .from('sessions')
    .select('id,title')
    .eq('id', created.session)
    .single();
  resultError('Oturum okuma başarısız', read.error);
  assert(read.data.title === `${prefix}_SESSION`, 'Oturum okuma doğrulaması eşleşmedi.');

  const update = await supabase
    .from('sessions')
    .update({ description: `${prefix}_UPDATED`, delay_minutes: 5, status: 'delayed' })
    .eq('id', created.session)
    .select('description,delay_minutes,status')
    .single();
  resultError('Oturum güncelleme başarısız', update.error);
  assert(
    update.data.description === `${prefix}_UPDATED` &&
      update.data.delay_minutes === 5 &&
      update.data.status === 'delayed',
    'Oturum güncellemesi doğrulanamadı.',
  );
}

async function testAnnouncement() {
  created.announcement = randomUUID();
  const insert = await supabase
    .from('announcements')
    .insert({
      id: created.announcement,
      title: `${prefix}_ANNOUNCEMENT`,
      message: `${prefix}_CREATE`,
      target_audience: 'TEST',
      target_session_id: created.session,
      target_booth_id: created.stand,
      status: 'draft',
      recipient_count: 0,
      read_count: 0,
      click_count: 0,
    })
    .select('id,title,message')
    .single();
  resultError('Duyuru oluşturma başarısız', insert.error);
  assert(insert.data.id === created.announcement, 'Oluşturulan duyuru kimliği doğrulanamadı.');

  const read = await supabase
    .from('announcements')
    .select('id,title')
    .eq('id', created.announcement)
    .single();
  resultError('Duyuru okuma başarısız', read.error);
  assert(read.data.title === `${prefix}_ANNOUNCEMENT`, 'Duyuru okuma doğrulaması eşleşmedi.');

  const update = await supabase
    .from('announcements')
    .update({ message: `${prefix}_UPDATED` })
    .eq('id', created.announcement)
    .select('message')
    .single();
  resultError('Duyuru güncelleme başarısız', update.error);
  assert(update.data.message === `${prefix}_UPDATED`, 'Duyuru güncellemesi doğrulanamadı.');
}

async function testEventSettings() {
  const current = await supabase.from('event_settings').select('*').limit(1).maybeSingle();
  resultError('Etkinlik ayarları okunamadı', current.error);
  assert(
    current.data,
    'event_settings tablosunda ayar satırı yok. Önce admin panelinden etkinlik ayarlarını bir kez kaydedin.',
  );

  // Canlı singleton ayarı TEST değeriyle değiştirilmez. Aynı değerle UPDATE göndererek
  // admin yazma RLS'i doğrulanır; process çökse bile gerçek ayar değişmeden kalır.
  settingsState = {
    id: current.data.id,
    edition: current.data.edition,
    updatedAt: current.data.updated_at,
  };
  const update = await supabase
    .from('event_settings')
    .update({ edition: current.data.edition })
    .eq('id', current.data.id)
    .eq('updated_at', current.data.updated_at)
    .select('id,edition,updated_at')
    .single();
  resultError('Etkinlik ayarları yazma yetkisi doğrulanamadı', update.error);
  assert(
    update.data.edition === settingsState.edition &&
      update.data.updated_at === settingsState.updatedAt,
    'Etkinlik ayarları no-op güncelleme sırasında beklenmedik biçimde değişti.',
  );
}

async function verifyEventSettingsUnchanged() {
  if (!settingsState) return;
  const current = await supabase
    .from('event_settings')
    .select('id,edition,updated_at')
    .eq('id', settingsState.id)
    .single();
  resultError('Etkinlik ayarlarının son durumu doğrulanamadı', current.error);
  assert(
    current.data.edition === settingsState.edition &&
      current.data.updated_at === settingsState.updatedAt,
    'Etkinlik ayarları test öncesindeki değerlerle eşleşmiyor.',
  );
  settingsState = null;
}

const cleanupTargets = [
  ['announcement', 'announcements', 'title', `${prefix}_ANNOUNCEMENT`],
  ['session', 'sessions', 'title', `${prefix}_SESSION`],
  ['stand', 'stands', 'name', `${prefix}_STAND`],
  ['stage', 'stages', 'name', `${prefix}_STAGE`],
  ['zone', 'zones', 'name', `${prefix}_ZONE`],
];

async function cleanupCreatedRecords() {
  const errors = [];
  for (const [key, table, markerColumn, expectedMarker] of cleanupTargets) {
    const id = created[key];
    if (!id) continue;
    try {
      const remove = await supabase
        .from(table)
        .delete()
        .eq('id', id)
        .eq(markerColumn, expectedMarker)
        .select('id');
      resultError(`${table} test kaydı silinemedi`, remove.error);
      if (remove.data?.length !== 1) {
        const remaining = await supabase.from(table).select('id').eq('id', id).maybeSingle();
        resultError(`${table} test kaydının temizleme durumu doğrulanamadı`, remaining.error);
        assert(!remaining.data, `${table} test kaydı güvenli biçimde temizlenemedi.`);
      }
      created[key] = null;
    } catch (error) {
      errors.push(error);
    }
  }
  return errors;
}

async function main() {
  const supabaseUrl = requireEnv('EXPO_PUBLIC_SUPABASE_URL');
  const supabaseAnonKey = requireEnv('EXPO_PUBLIC_SUPABASE_ANON_KEY');
  adminEmail = requireEnv('ADMIN_TEST_EMAIL');
  adminPassword = requireEnv('ADMIN_TEST_PASSWORD');
  supabase = createClient(supabaseUrl, supabaseAnonKey, {
    auth: {
      autoRefreshToken: false,
      detectSessionInUrl: false,
      persistSession: false,
    },
  });

  let testError = null;
  const cleanupErrors = [];

  try {
    console.log('1/4 Admin oturumu ve is_admin yetkisi doğrulanıyor...');
    await authenticateAdmin();
    console.log('2/4 Admin workspace tablo ve kolon şeması doğrulanıyor...');
    await verifySchema();
    console.log(
      '3/4 Zone, stage, stand, session, announcement CRUD ve event settings yazma testi çalışıyor...',
    );
    await testZone();
    await testStage();
    await testStand();
    await testSession();
    await testAnnouncement();
    await testEventSettings();
  } catch (error) {
    testError = error;
  } finally {
    console.log('4/4 TEST kayıtları temizleniyor ve event settings değişmezliği doğrulanıyor...');
    try {
      await verifyEventSettingsUnchanged();
    } catch (error) {
      cleanupErrors.push(error);
    }
    cleanupErrors.push(...(await cleanupCreatedRecords()));
    try {
      const { error: signOutError } = await supabase.auth.signOut();
      if (signOutError)
        cleanupErrors.push(new Error(`Test oturumu kapatılamadı: ${signOutError.message}`));
    } catch (error) {
      cleanupErrors.push(
        new Error(
          `Test oturumu kapatılırken beklenmeyen hata: ${error instanceof Error ? error.message : String(error)}`,
        ),
      );
    }
  }

  if (testError || cleanupErrors.length) {
    const failures = [testError, ...cleanupErrors].filter(Boolean);
    throw new AggregateError(
      failures,
      'Admin veritabanı doğrulaması başarısız. Ayrıntılar aşağıda.',
    );
  }

  console.log('BAŞARILI: Gerçek RLS üzerinden CRUD doğrulandı ve tüm TEST kayıtları temizlendi.');
}

main().catch((error) => {
  console.error(error.message);
  if (error instanceof AggregateError) {
    for (const [index, failure] of error.errors.entries()) {
      console.error(
        `  ${index + 1}. ${failure instanceof Error ? failure.message : String(failure)}`,
      );
    }
  }
  process.exitCode = 1;
});
