/**
 * Supabase client initialization.
 *
 * Creates a Supabase client instance using the anonymous (public) key.
 * For privileged admin operations (uploading files, writing version metadata),
 * a separate client is instantiated at runtime with the decrypted service role
 * key. See `src/admin.js` for details.
 *
 * @module supabaseClient
 */
import { createClient } from '@supabase/supabase-js';
import { ADMIN_CONFIG } from './config/admin.js';

/** Singleton Supabase client (anon key). */
export const supabase = createClient(ADMIN_CONFIG.supabaseUrl, ADMIN_CONFIG.supabaseAnonKey);
