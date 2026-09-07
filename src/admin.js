/**
 * Админка PenDrops.
 *
 * Активируется long-press на логотипе (1.5 секунды).
 *
 * Flow:
 *  1. Юзер открывает админку → вводит PIN (6137 по умолчанию)
 *  2. PenDrops качает зашифрованный admin_credential.enc из Supabase Storage → расшифровывает PBKDF2+AES-GCM
 *  3. Получает временный Supabase service role key
 *  4. Юзер перетаскивает .xls
 *  5. PenDrops заливает schedule.xls в Supabase Storage и обновляет таблицу app_version
 *  6. Ключ сервисной роли сразу забывается (GC)
 *
 * Если admin_credential.enc отсутствует — показываем инструкцию «как создать токен».
 */

import { createClient } from '@supabase/supabase-js';
import { ADMIN_CONFIG } from './config/admin.js';
import { decryptBlob, verifyPin } from './utils/crypto.js';

/** @constant {string} Supabase client using the anonymous key (read‑only access) */
const supabaseAnon = createClient(ADMIN_CONFIG.supabaseUrl, ADMIN_CONFIG.supabaseAnonKey);

/**
 * Creates a Supabase client authenticated with the service role key.
 * Used for privileged operations (uploading files, updating version metadata).
 * @param {string} serviceRoleKey
 * @returns {ReturnType<typeof createClient>}
 */
function createServiceClient(serviceRoleKey) {
  return createClient(ADMIN_CONFIG.supabaseUrl, serviceRoleKey);
}

/**
 * Fetches the encrypted admin credential blob from Supabase Storage.
 * The file must be publicly readable (it's encrypted with AES‑256‑GCM anyway).
 * @returns {Promise<string|null>}
 */
async function fetchEncryptedCredential() {
  try {
    const { data, error } = await supabaseAnon.storage
      .from(ADMIN_CONFIG.supabaseBucket)
      .download(ADMIN_CONFIG.adminCredentialPath);
    if (error) {
      console.error('Failed to download admin credential:', error.message);
      return null;
    }
    const text = await data.text();
    return text.trim() || null;
  } catch {
    /* fetch failed — admin credential unavailable */
    return null;
  }
}

/**
 * Uploads a file (ArrayBuffer) to the Supabase Storage bucket.
 * @param {ReturnType<typeof createClient>} serviceClient
 * @param {string} path — destination path in the bucket (e.g. "schedule.xls")
 * @param {ArrayBuffer} content — file content
 * @returns {Promise<{ path: string; size: number }>}
 */
async function uploadFile(serviceClient, path, content) {
  const { data, error } = await serviceClient.storage
    .from(ADMIN_CONFIG.supabaseBucket)
    .upload(path, content, {
      contentType: 'application/vnd.ms-excel',
      upsert: true,
    });
  if (error) {
    throw new Error(`Upload ${path}: ${error.message}`);
  }
  return { path: data.path, size: data.metadata?.size ?? 0 };
}

/**
 * Upserts a single row in the `app_version` table.
 * @param {ReturnType<typeof createClient>} serviceClient
 * @param {{version:string; dateStamp:string; fileName:string; size:number; uuid:string}} meta
 */
async function upsertVersionRow(serviceClient, meta) {
  const { error } = await serviceClient.from('app_version').upsert({
    version: meta.version,
    updated_at: new Date().toISOString(),
    file_name: meta.fileName,
    size: meta.size,
    uuid: meta.uuid,
  });
  if (error) {
    throw new Error(`Failed to update app_version table: ${error.message}`);
  }
}

/**
 * Публикует .xls и обновляет таблицу app_version.
 * @param {File} file
 * @returns {Promise<{version: string, dateStamp: string, scheduleUrl: string}>}
 */
export async function publishSchedule(file) {
  // 1. Fetch encrypted credential
  const encrypted = await fetchEncryptedCredential();
  if (!encrypted) {
    throw new Error(
      'admin_credential.enc not found in Supabase Storage. Run scripts/encryptCredential.js to create it.'
    );
  }

  // 2. Decrypt to get service role key
  const serviceRoleKey = await decryptBlob(encrypted, ADMIN_CONFIG.pin);
  if (!serviceRoleKey.startsWith('service_role')) {
    // Supabase service role keys start with 'service_role_'
    // Fallback: accept any non-empty key as legacy support (e.g., anon key with rights)
    if (!serviceRoleKey || serviceRoleKey.length < 10) {
      throw new Error('Расшифровано, но это не похоже на сервисный ключ. Неверный PIN?');
    }
  }

  // 3. Create service role client
  const serviceClient = createServiceClient(serviceRoleKey);

  try {
    const now = new Date();
    const week = getISOWeek(now);
    const version = `W${week}`;
    const dateStamp = now.toISOString().slice(0, 10);
    const fileName = file.name || 'schedule.xls';

    // 4. Upload Excel file
    const buf = await file.arrayBuffer();
    await uploadFile(serviceClient, fileName, buf);

    // 5. Upsert version metadata
    const uuid = crypto.randomUUID();
    await upsertVersionRow(serviceClient, {
      version,
      dateStamp,
      fileName,
      size: buf.byteLength,
      uuid,
    });

    // 6. Construct public URL for the uploaded file
    const publicUrl = `${ADMIN_CONFIG.supabaseUrl}/storage/v1/object/public/${ADMIN_CONFIG.supabaseBucket}/${fileName}`;

    return {
      version,
      dateStamp,
      scheduleUrl: publicUrl,
    };
  } finally {
    // Service role key is kept only in this local scope and will be GC'd
    // We can't force GC in JS, but avoiding global assignment helps.
  }
}

/**
 * Gets the ISO week number of a given date.
 * @param {Date} d
 * @returns {number}
 */
function getISOWeek(d) {
  const date = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
  const day = date.getUTCDay() || 7;
  date.setUTCDate(date.getUTCDate() + 4 - day);
  const yearStart = new Date(Date.UTC(date.getUTCFullYear(), 0, 1));
  return Math.ceil(((date - yearStart) / 86400000 + 1) / 7);
}

/**
 * Проверяет, настроена ли админка (существует ли admin_credential.enc в бакете).
 */
export async function isAdminConfigured() {
  const encrypted = await fetchEncryptedCredential();
  return encrypted !== null;
}

/**
 * Verifies the admin PIN entered by the user.
 * Uses a constant-time comparison to mitigate timing attacks.
 *
 * @param {string} pin — user-supplied PIN
 * @returns {boolean}
 */
export function verifyAdminPin(pin) {
  return verifyPin(pin, ADMIN_CONFIG.pin);
}

// Re-export config for consumers that need it (e.g. admin UI)
export { ADMIN_CONFIG };
