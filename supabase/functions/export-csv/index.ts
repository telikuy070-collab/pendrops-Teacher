/**
 * Edge Function: Export Attendance CSV
 *
 * Exports attendance records for a specific group as a CSV file.
 * Protected endpoint — requires a valid Supabase JWT from an authenticated teacher.
 *
 * @param {Request} req - HTTP request with query params:
 *   - groupId (required): UUID of the group
 *   - startDate (optional): ISO date string for range start
 *   - endDate (optional): ISO date string for range end
 * @returns {Response} CSV file as plain text
 */
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.50.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req: Request) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get('authorization');
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'Missing authorization header' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      {
        auth: {
          persistSession: false,
          autoRefreshToken: false,
        },
      }
    );

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();
    if (authError || !user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const url = new URL(req.url);
    const groupId = url.searchParams.get('groupId');
    const startDate = url.searchParams.get('startDate') ?? '';
    const endDate = url.searchParams.get('endDate') ?? new Date().toISOString().split('T')[0];

    if (!groupId) {
      return new Response(JSON.stringify({ error: 'groupId is required' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Fetch attendance records with student and group info
    const { data: attendance, error } = await supabase
      .from('teacher_attestance')
      .select(
        `
        date,
        status,
        note,
        student:teacher_students(full_name)
      `
      )
      .eq('group_id', groupId)
      .gte('date', startDate)
      .lte('date', endDate)
      .order('date', { ascending: true });

    if (error) throw error;

    // Generate CSV
    const csv = generateCSV(attendance ?? []);

    return new Response(csv, {
      status: 200,
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': `attachment; filename="attendance-${groupId}.csv"`,
        'Cache-Control': 'no-store, max-age=0',
      },
    });
  } catch (error) {
    console.error('[Edge Function: export-csv] Error:', error);
    return new Response(JSON.stringify({ error: (error as Error).message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});

function generateCSV(records: any[]): string {
  const header = 'Дата,Статус,Примечание,Ученик';
  const rows = records.map((r) => {
    const date = r.date.split('T')[0];
    const status =
      r.status === 'present'
        ? 'Присутствует'
        : r.status === 'absent'
          ? 'Отсутствует'
          : r.status === 'late'
            ? 'Опоздал'
            : r.status;
    const note = r.note ?? '';
    const student = r.student?.full_name ?? '';
    return [date, status, note, student].map((field) => `"${field.replace(/"/g, '""')}"`).join(',');
  });

  return [header, ...rows].join('\n');
}
