/**
 * Data access layer for PenDrops Мугалим.
 *
 * Each repository function wraps a Supabase query and validates the result
 * through Zod schemas before returning. This ensures that:
 *
 * 1. Runtime data matches the expected shape (defensive programming)
 * 2. TypeScript types are always accurate via `z.infer<...>`
 * 3. Errors are typed and actionable at the call site
 *
 * Usage:
 * ```ts
 * import { groupRepository } from '@/models';
 * const groups = await groupRepository.list();
 * ```
 */
import { supabase } from '../lib/supabaseClient.ts';
import { z } from 'zod';
import type {
  Group,
  Student,
  Homework,
  Submission,
  Attendance,
  Grade,
  HomeworkWithAttachments,
  SubmissionWithStudent,
  StudentsWithAttendance,
} from '../types/schemas.ts';
import {
  GroupSchema,
  StudentSchema,
  HomeworkSchema,
  SubmissionSchema,
  AttendanceSchema,
  GradeSchema,
  HomeworkWithAttachmentsSchema,
  SubmissionWithStudentSchema,
  StudentsWithAttendanceSchema,
} from '../types/schemas.ts';

// ---------------------------------------------------------------------------
// Error type
// ---------------------------------------------------------------------------

export class DataError extends Error {
  constructor(
    message: string,
    public readonly code: string,
    public readonly original?: unknown
  ) {
    super(message);
    this.name = 'DataError';
  }
}

/**
 * Helper: await a Supabase promise, check for errors, and validate with Zod.
 * Uses Promise<any> internally because the Supabase client's fluent builder
 * types (PostgrestBuilder) are complex and don't match standard Promise<T>.
 */
async function resolveSupabase<T>(
  promise: Promise<any>,
  schema: z.ZodType<T>,
  context: string
): Promise<T> {
  const { data, error } = await promise;

  if (error) {
    throw new DataError(`${context}: ${error.message}`, error.code || 'UNKNOWN_ERROR', error);
  }

  if (!data) {
    throw new DataError(`${context}: no data returned`, 'NO_DATA');
  }

  try {
    return schema.parse(data);
  } catch (e) {
    throw new DataError(`${context}: data validation failed`, 'VALIDATION_ERROR', e);
  }
}

// ---------------------------------------------------------------------------
// Group Repository
// ---------------------------------------------------------------------------

export const groupRepository = {
  async list(teacherId: string): Promise<Group[]> {
    const { data, error } = await (supabase as any)
      .from('teacher_groups')
      .select('*')
      .eq('teacher_id', teacherId)
      .order('name');

    if (error) {
      throw new DataError(`Failed to fetch groups: ${error.message}`, error.code || 'FETCH_ERROR');
    }

    if (!data) return [];

    return data.map((row: any) => GroupSchema.parse(row));
  },

  async create(teacherId: string, name: string, description?: string | null): Promise<Group> {
    const result = await (supabase as any)
      .from('teacher_groups')
      .insert({ teacher_id: teacherId, name, description: description ?? null })
      .select()
      .single();

    return resolveSupabase(Promise.resolve(result), GroupSchema, 'Failed to create group');
  },

  async update(id: string, updates: Partial<Pick<Group, 'name' | 'description'>>): Promise<Group> {
    const result = await (supabase as any)
      .from('teacher_groups')
      .update(updates)
      .eq('id', id)
      .select()
      .single();

    return resolveSupabase(Promise.resolve(result), GroupSchema, 'Failed to update group');
  },

  async delete(id: string): Promise<void> {
    const { error } = await (supabase as any).from('teacher_groups').delete().eq('id', id);
    if (error) {
      throw new DataError(`Failed to delete group: ${error.message}`, error.code || 'DELETE_ERROR');
    }
  },
};

// ---------------------------------------------------------------------------
// Student Repository
// ---------------------------------------------------------------------------

export const studentRepository = {
  async listByGroup(groupId: string): Promise<StudentsWithAttendance[]> {
    const { data, error } = await (supabase as any)
      .from('teacher_students')
      .select(
        `
        *,
        latest_attendance:date!inner(*)
      `
      )
      .eq('group_id', groupId)
      .order('full_name');

    if (error) {
      throw new DataError(
        `Failed to fetch students: ${error.message}`,
        error.code || 'FETCH_ERROR'
      );
    }

    if (!data) return [];

    // The RPC-style join returns an array of student objects with latest_attendance
    return data.map((row: any) => {
      try {
        return StudentsWithAttendanceSchema.parse(row);
      } catch (_e) {
        // Fallback: parse without the nested attendance if it's not present

        void _e;
        return StudentSchema.parse(row as any) as unknown as StudentsWithAttendance;
      }
    });
  },

  async create(
    student: Omit<Student, 'id' | 'created_at'> & { group_id: string }
  ): Promise<Student> {
    const result = await (supabase as any)
      .from('teacher_students')
      .insert(student)
      .select()
      .single();

    return resolveSupabase(Promise.resolve(result), StudentSchema, 'Failed to create student');
  },

  async update(
    id: string,
    updates: Partial<
      Pick<Student, 'full_name' | 'avatar_url' | 'phone' | 'birth_date' | 'group_id'>
    >
  ): Promise<Student> {
    const result = await (supabase as any)
      .from('teacher_students')
      .update(updates)
      .eq('id', id)
      .select()
      .single();

    return resolveSupabase(Promise.resolve(result), StudentSchema, 'Failed to update student');
  },

  async delete(id: string): Promise<void> {
    const { error } = await (supabase as any).from('teacher_students').delete().eq('id', id);
    if (error) {
      throw new DataError(
        `Failed to delete student: ${error.message}`,
        error.code || 'DELETE_ERROR'
      );
    }
  },
};

// ---------------------------------------------------------------------------
// Homework Repository
// ---------------------------------------------------------------------------

export const homeworkRepository = {
  async list(
    teacherId: string,
    options?: { status?: string; limit?: number }
  ): Promise<Homework[]> {
    let query = (supabase as any)
      .from('teacher_homework')
      .select('*')
      .eq('teacher_id', teacherId)
      .order('due_date', { ascending: false });

    if (options?.status) {
      query = query.eq('status', options.status);
    }

    if (options?.limit) {
      query = query.limit(options.limit);
    }

    const { data, error } = await query;

    if (error) {
      throw new DataError(
        `Failed to fetch homework: ${error.message}`,
        error.code || 'FETCH_ERROR'
      );
    }

    if (!data) return [];

    return data.map((row: any) => HomeworkSchema.parse(row));
  },

  async getWithAttachments(id: string): Promise<HomeworkWithAttachments> {
    const { data, error } = await (supabase as any)
      .from('teacher_homework')
      .select(
        `
        *,
        attachments:teacher_homework_attachments(*),
        group:teacher_groups(*),
        submission_count:teacher_submissions(count)
      `
      )
      .eq('id', id)
      .single();

    if (error) {
      throw new DataError(
        `Failed to fetch homework: ${error.message}`,
        error.code || 'FETCH_ERROR'
      );
    }

    return HomeworkWithAttachmentsSchema.parse(data);
  },

  async create(
    teacherId: string,
    payload: Omit<Homework, 'id' | 'teacher_id' | 'created_at' | 'updated_at'>
  ): Promise<Homework> {
    const result = await (supabase as any)
      .from('teacher_homework')
      .insert({ ...payload, teacher_id: teacherId })
      .select()
      .single();

    return resolveSupabase(Promise.resolve(result), HomeworkSchema, 'Failed to create homework');
  },

  async update(
    id: string,
    updates: Partial<Omit<Homework, 'id' | 'teacher_id'>>
  ): Promise<Homework> {
    const result = await (supabase as any)
      .from('teacher_homework')
      .update({ ...updates, updated_at: new Date().toISOString() })
      .eq('id', id)
      .select()
      .single();

    return resolveSupabase(Promise.resolve(result), HomeworkSchema, 'Failed to update homework');
  },

  async delete(id: string): Promise<void> {
    const { error } = await (supabase as any).from('teacher_homework').delete().eq('id', id);
    if (error) {
      throw new DataError(
        `Failed to delete homework: ${error.message}`,
        error.code || 'DELETE_ERROR'
      );
    }
  },
};

// ---------------------------------------------------------------------------
// Submission Repository
// ---------------------------------------------------------------------------

export const submissionRepository = {
  async listByHomework(homeworkId: string): Promise<SubmissionWithStudent[]> {
    const { data, error } = await (supabase as any)
      .from('teacher_submissions')
      .select(
        `
        *,
        student:teacher_students(*),
        homework:teacher_homework(*)
      `
      )
      .eq('homework_id', homeworkId)
      .order('submitted_at', { ascending: false });

    if (error) {
      throw new DataError(
        `Failed to fetch submissions: ${error.message}`,
        error.code || 'FETCH_ERROR'
      );
    }

    if (!data) return [];

    return data.map((row: any) => SubmissionWithStudentSchema.parse(row));
  },

  async create(
    homeworkId: string,
    studentId: string,
    file: { name: string; size: number; mimeType: string; storagePath: string },
    dueDate: string
  ): Promise<Submission> {
    const submittedAt = new Date().toISOString();
    const isLate = submittedAt > dueDate;

    const result = await (supabase as any)
      .from('teacher_submissions')
      .insert({
        homework_id: homeworkId,
        student_id: studentId,
        file_name: file.name,
        file_size: file.size,
        mime_type: file.mimeType,
        storage_path: file.storagePath,
        submitted_at: submittedAt,
        is_late: isLate,
      })
      .select()
      .single();

    return resolveSupabase(
      Promise.resolve(result),
      SubmissionSchema,
      'Failed to create submission'
    );
  },

  async download(storagePath: string): Promise<string> {
    const { data, error } = await (supabase as any).storage
      .from('teacher_submissions')
      .download(storagePath);

    if (error) {
      throw new DataError(
        `Failed to download submission: ${error.message}`,
        error.code || 'DOWNLOAD_ERROR'
      );
    }

    return URL.createObjectURL(data as Blob);
  },
};

// ---------------------------------------------------------------------------
// Attendance Repository
// ---------------------------------------------------------------------------

export const attendanceRepository = {
  async listByStudentAndDate(
    studentId: string,
    startDate: string,
    endDate: string
  ): Promise<Attendance[]> {
    const { data, error } = await (supabase as any)
      .from('teacher_attestance')
      .select('*')
      .eq('student_id', studentId)
      .gte('date', startDate)
      .lte('date', endDate);

    if (error) {
      throw new DataError(
        `Failed to fetch attendance: ${error.message}`,
        error.code || 'FETCH_ERROR'
      );
    }

    if (!data) return [];

    return data.map((row: any) => AttendanceSchema.parse(row));
  },

  async upsert(attendance: Omit<Attendance, 'id'> & { id?: string }): Promise<Attendance> {
    const result = await (supabase as any)
      .from('teacher_attestance')
      .upsert(attendance, { onConflict: 'student_id,date' })
      .select()
      .single();

    return resolveSupabase(
      Promise.resolve(result),
      AttendanceSchema,
      'Failed to upsert attendance'
    );
  },

  async bulkUpsert(records: Omit<Attendance, 'id'>[]): Promise<void> {
    const { error } = await (supabase as any)
      .from('teacher_attestance')
      .upsert(records, { onConflict: 'student_id,date' });

    if (error) {
      throw new DataError(
        `Failed to bulk upsert attendance: ${error.message}`,
        error.code || 'BULK_ERROR'
      );
    }
  },
};

// ---------------------------------------------------------------------------
// Grade Repository
// ---------------------------------------------------------------------------

export const gradeRepository = {
  async listByStudent(studentId: string): Promise<Grade[]> {
    const { data, error } = await (supabase as any)
      .from('teacher_grades')
      .select('*')
      .eq('student_id', studentId)
      .order('created_at', { ascending: false });

    if (error) {
      throw new DataError(`Failed to fetch grades: ${error.message}`, error.code || 'FETCH_ERROR');
    }

    if (!data) return [];

    return data.map((row: any) => GradeSchema.parse(row));
  },

  async listBySubmission(submissionId: string): Promise<Grade[]> {
    const { data, error } = await (supabase as any)
      .from('teacher_grades')
      .select('*')
      .eq('submission_id', submissionId)
      .order('created_at', { ascending: false });

    if (error) {
      throw new DataError(
        `Failed to fetch grades for submission: ${error.message}`,
        error.code || 'FETCH_ERROR'
      );
    }

    if (!data) return [];

    return data.map((row: any) => GradeSchema.parse(row));
  },

  async create(
    teacherId: string,
    payload: Omit<Grade, 'id' | 'teacher_id' | 'created_at' | 'updated_at'>
  ): Promise<Grade> {
    const result = await (supabase as any)
      .from('teacher_grades')
      .insert({ ...payload, teacher_id: teacherId })
      .select()
      .single();

    return resolveSupabase(Promise.resolve(result), GradeSchema, 'Failed to create grade');
  },

  async update(id: string, updates: { value?: number; comment?: string | null }): Promise<Grade> {
    const result = await (supabase as any)
      .from('teacher_grades')
      .update({ ...updates, updated_at: new Date().toISOString() })
      .eq('id', id)
      .select()
      .single();

    return resolveSupabase(Promise.resolve(result), GradeSchema, 'Failed to update grade');
  },

  async delete(id: string): Promise<void> {
    const { error } = await (supabase as any).from('teacher_grades').delete().eq('id', id);
    if (error) {
      throw new DataError(`Failed to delete grade: ${error.message}`, error.code || 'DELETE_ERROR');
    }
  },
};

// ---------------------------------------------------------------------------
// Storage Repository (file uploads/downloads)
// ---------------------------------------------------------------------------

export const storageRepository = {
  async uploadHomeworkAttachment(
    teacherId: string,
    homeworkId: string,
    file: File
  ): Promise<{ path: string; size: number }> {
    const extension = file.name.split('.').pop()?.toLowerCase() ?? 'bin';
    const storagePath = `${teacherId}/${homeworkId}/${crypto.randomUUID()}.${extension}`;

    const { data, error } = await (supabase as any).storage
      .from('teacher_homework')
      .upload(storagePath, file, {
        contentType: file.type || 'application/octet-stream',
        upsert: false,
      });

    if (error) {
      throw new DataError(
        `Failed to upload attachment: ${error.message}`,
        (error as any).code || 'UPLOAD_ERROR'
      );
    }

    return { path: data.path, size: file.size };
  },

  async downloadAttachment(bucket: string, path: string): Promise<Blob> {
    const { data, error } = await (supabase as any).storage.from(bucket).download(path);

    if (error) {
      throw new DataError(
        `Failed to download file: ${error.message}`,
        error.code || 'DOWNLOAD_ERROR'
      );
    }

    return data as Blob;
  },

  getPublicUrl(bucket: string, path: string): string {
    const { data } = (supabase as any).storage.from(bucket).getPublicUrl(path);
    return data.publicUrl;
  },
};

// ---------------------------------------------------------------------------
// Auth Repository (Supabase Auth)
// ---------------------------------------------------------------------------

export const authRepository = {
  async signIn(email: string, password: string) {
    const { data, error } = await (supabase as any).auth.signInWithPassword({
      email,
      password,
    });

    if (error) {
      throw new DataError(`Failed to sign in: ${error.message}`, error.code || 'AUTH_ERROR');
    }

    return data;
  },

  async signOut() {
    const { error } = await (supabase as any).auth.signOut();
    if (error) {
      throw new DataError(`Failed to sign out: ${error.message}`, error.code || 'AUTH_ERROR');
    }
  },

  async getCurrentUser() {
    const {
      data: { user },
      error,
    } = await (supabase as any).auth.getUser();

    if (error) {
      throw new DataError(`Failed to get user: ${error.message}`, error.code || 'AUTH_ERROR');
    }

    return user;
  },

  onAuthStateChange(callback: (event: string, session: any) => void): any {
    return (supabase as any).auth.onAuthStateChange(callback);
  },
};

// Re-export for convenience
export type {
  Group,
  Student,
  Homework,
  Submission,
  Attendance,
  Grade,
  HomeworkWithAttachments,
  SubmissionWithStudent,
  StudentsWithAttendance,
} from '../types/schemas.ts';

export {
  GroupSchema,
  StudentSchema,
  HomeworkSchema,
  SubmissionSchema,
  AttendanceSchema,
  GradeSchema,
} from '../types/schemas.ts';
