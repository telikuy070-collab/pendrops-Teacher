/**
 * Zod schema definitions for PenDrops Мугалим.
 *
 * Zod is already a project dependency (^4.5.4) and provides zero-runtime-cost
 * type inference alongside runtime validation. Every fetch from Supabase is
 * validated through these schemas before entering the application layer.
 */
import { z } from 'zod';

// Reusable primitives
const UUIDSchema = z.string().uuid();
const ISODateSchema = z.string().datetime({ offset: true });
const TimestampSchema = z.string().datetime({ offset: true }).nullable();

// Enum schemas
const GroupStatusSchema = z.enum(['published', 'draft', 'archived']);
const AttendanceStatusSchema = z.enum(['present', 'absent', 'late']);
const GradeValueSchema = z.number().int().min(1).max(5);

/**
 * Teacher profile schema.
 */
export const TeacherSchema = z.object({
  id: UUIDSchema,
  email: z.string().email(),
  full_name: z.string().min(1),
  avatar_url: z.string().nullable(),
  created_at: TimestampSchema,
  updated_at: TimestampSchema,
});

/**
 * Student group schema.
 */
export const GroupSchema = z.object({
  id: UUIDSchema,
  teacher_id: UUIDSchema,
  name: z.string().min(1),
  description: z.string().nullable(),
  created_at: TimestampSchema,
});

/**
 * Student schema.
 */
export const StudentSchema = z.object({
  id: UUIDSchema,
  group_id: UUIDSchema,
  full_name: z.string().min(1),
  avatar_url: z.string().nullable(),
  phone: z.string().nullable(),
  birth_date: ISODateSchema.nullable(),
  created_at: TimestampSchema,
});

/**
 * Homework assignment schema.
 */
export const HomeworkSchema = z.object({
  id: UUIDSchema,
  teacher_id: UUIDSchema,
  group_id: UUIDSchema.nullable(),
  title: z.string().min(1),
  description: z.string().nullable(),
  due_date: ISODateSchema,
  created_at: TimestampSchema,
  updated_at: TimestampSchema,
  status: GroupStatusSchema,
});

/**
 * Homework attachment schema.
 */
export const HomeworkAttachmentSchema = z.object({
  id: UUIDSchema,
  homework_id: UUIDSchema,
  file_name: z.string().min(1),
  file_size: z.number().int().positive(),
  mime_type: z.string().min(1),
  storage_path: z.string().min(1),
  created_at: TimestampSchema,
});

/**
 * Student submission schema.
 */
export const SubmissionSchema = z.object({
  id: UUIDSchema,
  homework_id: UUIDSchema,
  student_id: UUIDSchema,
  file_name: z.string().min(1),
  file_size: z.number().int().positive(),
  mime_type: z.string().min(1),
  storage_path: z.string().min(1),
  submitted_at: ISODateSchema,
  is_late: z.boolean(),
});

/**
 * Attendance record schema.
 */
export const AttendanceSchema = z.object({
  id: UUIDSchema,
  student_id: UUIDSchema,
  date: ISODateSchema,
  status: AttendanceStatusSchema,
  note: z.string().nullable(),
  created_at: TimestampSchema,
});

/**
 * Grade schema.
 */
export const GradeSchema = z.object({
  id: UUIDSchema,
  submission_id: UUIDSchema.nullable(),
  student_id: UUIDSchema,
  homework_id: UUIDSchema.nullable(),
  teacher_id: UUIDSchema,
  value: GradeValueSchema,
  comment: z.string().nullable(),
  created_at: TimestampSchema,
  updated_at: TimestampSchema,
});

// Composite types for API responses
export const StudentsWithAttendanceSchema = StudentSchema.extend({
  latest_attendance: AttendanceSchema.omit({ id: true }).nullable(),
});

export const HomeworkWithAttachmentsSchema = HomeworkSchema.extend({
  attachments: HomeworkAttachmentSchema.array(),
  group: GroupSchema.nullable(),
  submission_count: z.number().int().nonnegative(),
});

export const SubmissionWithStudentSchema = SubmissionSchema.extend({
  student: StudentSchema.omit({ group_id: true }),
  homework: HomeworkSchema.omit({ teacher_id: true }),
});

export const GradeWithDetailsSchema = GradeSchema.extend({
  student: StudentSchema.omit({ group_id: true }),
  homework: HomeworkSchema.omit({ teacher_id: true }).nullable(),
});

// Export inferred TypeScript types
export type Teacher = z.infer<typeof TeacherSchema>;
export type Group = z.infer<typeof GroupSchema>;
export type Student = z.infer<typeof StudentSchema>;
export type Homework = z.infer<typeof HomeworkSchema>;
export type HomeworkAttachment = z.infer<typeof HomeworkAttachmentSchema>;
export type Submission = z.infer<typeof SubmissionSchema>;
export type Attendance = z.infer<typeof AttendanceSchema>;
export type Grade = z.infer<typeof GradeSchema>;

export type StudentsWithAttendance = z.infer<typeof StudentsWithAttendanceSchema>;
export type HomeworkWithAttachments = z.infer<typeof HomeworkWithAttachmentsSchema>;
export type SubmissionWithStudent = z.infer<typeof SubmissionWithStudentSchema>;
export type GradeWithDetails = z.infer<typeof GradeWithDetailsSchema>;

// For backward compatibility with .js consumers
export const schemas = {
  TeacherSchema,
  GroupSchema,
  StudentSchema,
  HomeworkSchema,
  HomeworkAttachmentSchema,
  SubmissionSchema,
  AttendanceSchema,
  GradeSchema,
};
