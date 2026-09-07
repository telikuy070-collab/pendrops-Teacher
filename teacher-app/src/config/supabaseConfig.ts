/**
 * Centralized configuration for PenDrops Мугалим (Teacher PWA).
 *
 * Reads sensitive values from environment variables (via Vite's `import.meta.env`
 * at build time, or process.env in Node/test contexts) and provides sensible
 * dev fallbacks. The Supabase anon key is safe to expose in client-side code —
 * RLS policies control what data teachers can actually read/write.
 */

declare global {
  interface ImportMetaEnv {
    VITE_SUPABASE_URL?: string;
    VITE_SUPABASE_ANON_KEY?: string;
    VITE_TEACHER_BUCKET?: string;
    VITE_SUBMISSIONS_BUCKET?: string;
    VITE_PROFILES_BUCKET?: string;
    VITE_STUDENT_PHOTOS_BUCKET?: string;
    MODE?: string;
    DEV?: boolean;
    PROD?: boolean;
  }

  interface ImportMeta {
    readonly env: ImportMetaEnv;
  }
}

const _env: Record<string, string | undefined> =
  typeof import.meta !== 'undefined' && import.meta.env
    ? (import.meta.env as Record<string, string | undefined>)
    : typeof process !== 'undefined' && process.env
      ? (process.env as Record<string, string | undefined>)
      : {};

function getEnv(key: string, fallback: string): string {
  const val = _env[key];
  if (val !== undefined && val !== '') return val;
  return fallback;
}

export const TEACHER_CONFIG = Object.freeze({
  /** Supabase project URL */
  supabaseUrl: getEnv('VITE_SUPABASE_URL', 'https://bnzcfhtmzvxxiwfkdryn.supabase.co'),

  /** Supabase anonymous (public) key — safe for client-side use */
  supabaseAnonKey: getEnv(
    'VITE_SUPABASE_ANON_KEY',
    'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJuemNmaHRvenZ4eGl3ZmtkcnluIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODg3MTAzNzgsImV4cCI6MjEwNDI4NjM3OH0.aGrhaK5G7rM-p_bMDUZyGm-uvWSosvpe7GjfuWHXHX8'
  ),

  /** Storage bucket for teacher homework attachments */
  teacherBucket: getEnv('VITE_TEACHER_BUCKET', 'teacher_homework'),

  /** Storage bucket for student submissions */
  submissionsBucket: getEnv('VITE_SUBMISSIONS_BUCKET', 'teacher_submissions'),

  /** Storage bucket for teacher profile avatars */
  profilesBucket: getEnv('VITE_PROFILES_BUCKET', 'teacher_profiles'),

  /** Storage bucket for student profile photos (optional) */
  studentPhotosBucket: getEnv('VITE_STUDENT_PHOTOS_BUCKET', 'student_photos'),
});
