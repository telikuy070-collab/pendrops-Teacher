/**
 * Client for calling Supabase Edge Functions.
 *
 * Provides type-safe wrappers around the Edge Functions HTTP endpoints.
 * Handles authentication headers automatically using the current session.
 */
import { supabase } from '../lib/supabaseClient.ts';
import { toast } from '../utils/toast.ts';
import { TEACHER_CONFIG } from '../config/supabaseConfig.ts';

class EdgeFunctionClient {
  private baseUrl: string;

  constructor() {
    // Use the teacher config for the URL
    this.baseUrl = `${TEACHER_CONFIG.supabaseUrl}/functions/v1`;
  }

  async call<T>(functionName: string, params?: Record<string, string>): Promise<T> {
    // Get the current session to include the JWT
    const {
      data: { session },
    } = await supabase.auth.getSession();

    if (!session) {
      throw new Error('Authentication required');
    }

    const url = new URL(`${this.baseUrl}/${functionName}`);
    if (params) {
      Object.entries(params).forEach(([key, value]) => {
        url.searchParams.set(key, value);
      });
    }

    const response = await fetch(url.toString(), {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${session.access_token}`,
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Edge Function ${functionName} failed: ${response.status} ${errorText}`);
    }

    try {
      return (await response.json()) as T;
    } catch {
      // If response is not JSON (e.g., CSV), return raw text
      return (await response.text()) as unknown as T;
    }
  }

  /**
   * Fetch class statistics for a group.
   */
  async getClassStats(
    groupId: string,
    options?: { startDate?: string; endDate?: string }
  ): Promise<any> {
    try {
      return await this.call('student-stats', {
        groupId,
        startDate: options?.startDate ?? '',
        endDate: options?.endDate ?? new Date().toISOString().split('T')[0] ?? '',
      });
    } catch (error: any) {
      toast.show(error.message || 'Ошибка загрузки статистики', 'bad');
      throw error;
    }
  }

  /**
   * Export attendance records as CSV.
   */
  async exportAttendanceCsv(
    groupId: string,
    options?: { startDate?: string; endDate?: string }
  ): Promise<Blob> {
    const {
      data: { session },
    } = await supabase.auth.getSession();

    if (!session) {
      throw new Error('Authentication required');
    }

    const url = new URL(`${this.baseUrl}/export-csv`);
    url.searchParams.set('groupId', groupId);
    if (options?.startDate) url.searchParams.set('startDate', options.startDate);
    if (options?.endDate) url.searchParams.set('endDate', options.endDate);

    const response = await fetch(url.toString(), {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${session.access_token}`,
      },
    });

    if (!response.ok) {
      throw new Error(`Export failed: ${response.status}`);
    }

    const csvText = await response.text();
    return new Blob([csvText], { type: 'text/csv;charset=utf-8' });
  }
}

export const edgeClient = new EdgeFunctionClient();
