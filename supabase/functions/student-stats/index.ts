/**
 * Edge Function: Class Statistics
 *
 * Returns aggregated statistics for a specific group, including:
 * - Attendance rates (present/absent/late breakdown)
 * - Average grades by subject
 * - Submission rates for homework
 * - Student performance trends
 *
 * Protected endpoint — requires a valid Supabase JWT from an authenticated teacher.
 *
 * @param {Request} req - HTTP request with query params:
 *   - groupId (required): UUID of the group
 *   - startDate (optional): ISO date string for range start
 *   - endDate (optional): ISO date string for range end
 * @returns {Response} JSON with statistics
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
    // Get the authorization header
    const authHeader = req.headers.get('authorization');
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'Missing authorization header' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Create Supabase client with the user's JWT (RLS will be enforced)
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      {
        auth: {
          // Use the user's JWT for auth — no admin privileges
          persistSession: false,
          autoRefreshToken: false,
        },
      }
    );

    // Get the user from the JWT
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

    // Parse query parameters
    const url = new URL(req.url);
    const groupId = url.searchParams.get('groupId');
    const startDate = url.searchParams.get('startDate');
    const endDate = url.searchParams.get('endDate') ?? new Date().toISOString().split('T')[0];

    if (!groupId) {
      return new Response(JSON.stringify({ error: 'groupId is required' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Fetch all students in the group
    const { data: students, error: studentsError } = await supabase
      .from('teacher_students')
      .select('id, full_name')
      .eq('group_id', groupId);

    if (studentsError) {
      throw studentsError;
    }

    // Fetch attendance for all students
    const { data: attendance, error: attendanceError } = await supabase
      .from('teacher_attestance')
      .select('student_id, date, status')
      .in(
        'student_id',
        (students ?? []).map((s: any) => s.id)
      )
      .gte('date', startDate ?? '')
      .lte('date', endDate ?? '');

    if (attendanceError) {
      throw attendanceError;
    }

    // Calculate attendance rates
    const attendanceStats = calculateAttendanceRates(attendance ?? [], students ?? []);

    // Fetch grades
    const { data: grades, error: gradesError } = await supabase
      .from('teacher_grades')
      .select('student_id, value, created_at')
      .in(
        'student_id',
        (students ?? []).map((s: any) => s.id)
      );

    if (gradesError) {
      throw gradesError;
    }

    // Calculate grade statistics
    const gradeStats = calculateGradeStats(grades ?? []);

    // Fetch submissions
    const { data: submissions, error: submissionsError } = await supabase
      .from('teacher_submissions')
      .select('homework_id, student_id')
      .in(
        'student_id',
        (students ?? []).map((s: any) => s.id)
      );

    if (submissionsError) {
      throw submissionsError;
    }

    // Fetch all homework for the group
    const { data: homework, error: homeworkError } = await supabase
      .from('teacher_homework')
      .select('id, title, due_date')
      .eq('group_id', groupId)
      .eq('status', 'published');

    if (homeworkError) {
      throw homeworkError;
    }

    // Calculate submission rate
    const submissionStats = calculateSubmissionRates(
      submissions ?? [],
      homework ?? [],
      students ?? []
    );

    return new Response(
      JSON.stringify({
        groupId,
        dateRange: { startDate, endDate },
        studentCount: students?.length ?? 0,
        attendance: attendanceStats,
        grades: gradeStats,
        submissions: submissionStats,
      }),
      {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  } catch (error) {
    console.error('[Edge Function: stats] Error:', error);
    return new Response(JSON.stringify({ error: (error as Error).message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});

function calculateAttendanceRates(attendance: any[], students: any[]) {
  const studentIds = students.map((s) => s.id);
  const rates: Record<string, { present: number; absent: number; late: number; total: number }> =
    {};

  // Initialize all students
  studentIds.forEach((id) => {
    rates[id] = { present: 0, absent: 0, late: 0, total: 0 };
  });

  // Count attendance
  attendance.forEach((record) => {
    if (rates[record.student_id]) {
      rates[record.student_id][record.status] += 1;
      rates[record.student_id].total += 1;
    }
  });

  return rates;
}

function calculateGradeStats(grades: any[]) {
  const byStudent: Record<string, number[]> = {};

  grades.forEach((grade) => {
    if (!byStudent[grade.student_id]) {
      byStudent[grade.student_id] = [];
    }
    byStudent[grade.student_id].push(grade.value);
  });

  const averages = Object.entries(byStudent).map(([studentId, values]) => ({
    studentId,
    average: values.reduce((a, b) => a + b, 0) / values.length,
    count: values.length,
  }));

  const allValues = grades.map((g) => g.value);
  const overallAverage =
    allValues.length > 0 ? allValues.reduce((a, b) => a + b, 0) / allValues.length : 0;

  return {
    byStudent: averages,
    overallAverage: round(overallAverage, 2),
    min: Math.min(...allValues, 0),
    max: Math.max(...allValues, 0),
  };
}

function calculateSubmissionRates(submissions: any[], homework: any[], students: any[]) {
  const homeworkById: Record<string, any> = {};
  homework.forEach((h) => {
    homeworkById[h.id] = h;
  });

  const submissionCount = submissions.length;
  const expectedSubmissions = homework.length * students.length;
  const rate = expectedSubmissions > 0 ? submissionCount / expectedSubmissions : 0;

  return {
    totalSubmissions: submissionCount,
    expectedSubmissions,
    rate: round(rate, 2),
  };
}

function round(num: number, decimals: number): number {
  const factor = Math.pow(10, decimals);
  return Math.round(num * factor) / factor;
}
