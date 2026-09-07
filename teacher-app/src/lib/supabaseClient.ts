/**
 * Supabase client singleton for PenDrops Мугалим.
 *
 * Creates a single Supabase client instance using the anonymous key.
 * This client is used throughout the teacher app for all data operations.
 *
 * Row-level security (RLS) is enabled on all teacher tables, so even though
 * the anon key is used in the browser, the user can only access data they
 * own or are authorized to see.
 */
import { createClient } from '@supabase/supabase-js';
import { TEACHER_CONFIG } from '../config/supabaseConfig.ts';

class SupabaseClient {
  private client: ReturnType<typeof createClient> | null = null;

  getClient() {
    if (!this.client) {
      this.client = createClient(TEACHER_CONFIG.supabaseUrl, TEACHER_CONFIG.supabaseAnonKey, {
        auth: {
          autoRefreshToken: true,
        },
        realtime: {
          params: {
            events: ['INSERT', 'UPDATE', 'DELETE'],
          },
        },
      });
    }
    return this.client;
  }

  get anon() {
    return this.getClient();
  }

  /**
   * Creates a service-role client (admin).
   * In the browser this should never be called directly — use Supabase Edge Functions
   * for privileged server-side operations.
   */
  getServiceRoleClient(serviceRoleKey: string) {
    return createClient(TEACHER_CONFIG.supabaseUrl, serviceRoleKey);
  }
}

export const supabaseClient = new SupabaseClient();
export const supabase = supabaseClient.anon;
