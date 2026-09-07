/**
 * Type definitions for PenDrops Мугалим data models.
 *
 * These types correspond to the Supabase tables created for the teacher app.
 * All IDs use UUID v4 format. Timestamps are ISO 8601 strings.
 */

/** @typedef {string} UUID - UUID v4 identifier */
/** @typedef {string} ISODate - ISO 8601 date string */

/**
 * Teacher profile model.
 * Maps to the `teacher_teachers` table.
 * @typedef {Object} Teacher
 * @property {UUID} id - Primary key
 * @property {string} email - Teacher email (unique, used for auth)
 * @property {string} full_name - Display name
 * @property {string|null} avatar_url - URL to avatar in storage
 * @property {ISODate|null} created_at - Creation timestamp
 * @property {ISODate|null} updated_at - Last update timestamp
 */

/**
 * Student group model.
 * Maps to the `teacher_groups` table.
 * @typedef {Object} Group
 * @property {UUID} id - Primary key
 * @property {UUID} teacher_id - FK to teacher_teachers
 * @property {string} name - Group name (e.g., "1К-2ж")
 * @property {string|null} description - Optional description
 * @property {ISODate|null} created_at - Creation timestamp
 */

/**
 * Student model.
 * Maps to the `teacher_students` table.
 * @typedef {Object} Student
 * @property {UUID} id - Primary key
 * @property {UUID} group_id - FK to teacher_groups
 * @property {string} full_name - Student full name
 * @property {string|null} avatar_url - Optional photo URL
 * @property {string|null} phone - Optional contact phone
 * @property {ISODate|null} birth_date - Birth date (for sorting)
 * @property {ISODate|null} created_at - Creation timestamp
 */

/**
 * Homework assignment model.
 * Maps to the `teacher_homework` table.
 * @typedef {Object} Homework
 * @property {UUID} id - Primary key
 * @property {UUID} teacher_id - FK to teacher_teachers
 * @property {UUID|null} group_id - FK to teacher_groups (null = all groups)
 * @property {string} title - Assignment title
 * @property {string|null} description - Long description (HTML-safe)
 * @property {ISODate} due_date - Deadline
 * @property {ISODate|null} created_at - Creation timestamp
 * @property {ISODate|null} updated_at - Last update
 * @property {'published'|'draft'|'archived'} status - Current status
 */

/**
 * Homework attachment model.
 * Maps to the `teacher_homework_attachments` table.
 * @typedef {Object} HomeworkAttachment
 * @property {UUID} id - Primary key
 * @property {UUID} homework_id - FK to teacher_homework
 * @property {string} file_name - Original filename
 * @property {number} file_size - File size in bytes
 * @property {string} mime_type - MIME type
 * @property {string} storage_path - Path in Supabase Storage
 * @property {ISODate|null} created_at - Upload timestamp
 */

/**
 * Student submission model.
 * Maps to the `teacher_submissions` table.
 * @typedef {Object} Submission
 * @property {UUID} id - Primary key
 * @property {UUID} homework_id - FK to teacher_homework
 * @property {UUID} student_id - FK to teacher_students
 * @property {string} file_name - Original filename
 * @property {number} file_size - File size in bytes
 * @property {string} mime_type - MIME type
 * @property {string} storage_path - Path in Supabase Storage
 * @property {ISODate} submitted_at - Submission timestamp
 * @property {boolean} is_late - True if submitted after deadline
 */

/**
 * Attendance record model.
 * Maps to the `teacher_attestance` table.
 * @typedef {Object} Attendance
 * @property {UUID} id - Primary key
 * @property {UUID} student_id - FK to teacher_students
 * @property {ISODate} date - The date of the class
 * @property {'present'|'absent'|'late'} status - Attendance status
 * @property {string|null} note - Optional note (e.g., "Болеет")
 * @property {ISODate|null} created_at - Record creation time
 */

/**
 * Grade model.
 * Maps to the `teacher_grades` table.
 * @typedef {Object} Grade
 * @property {UUID} id - Primary key
 * @property {UUID} submission_id - FK to teacher_submissions (nullable for manual grades)
 * @property {UUID} student_id - FK to teacher_students
 * @property {UUID|null} homework_id - FK to teacher_homework (nullable)
 * @property {UUID} teacher_id - FK to teacher_teachers
 * @property {number} value - Numeric grade value (1-5 scale in Kazakh/European system)
 * @property {string|null} comment - Optional comment
 * @property {ISODate|null} created_at - Grade timestamp
 * @property {ISODate|null} updated_at - Last update
 */

export {};
