/**
 * Tests for PenDrops Мугалим data layer.
 *
 * Tests the repositories with mocked Supabase responses to verify
 * validation, error handling, and business logic.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

// Helper: real UUIDs for testing
const TEST_UUID_1 = 'a955025a-334d-4760-881e-4256cae10702';
const TEST_UUID_2 = 'f47ac10b-58cc-4372-a567-0e02dc59515e';
const TEST_UUID_3 = '123e4567-e89b-12d3-a456-426614174000';

// Mock the supabase module before imports
const mockSupabase = {
  from: vi.fn(),
  storage: {
    from: vi.fn(),
  },
  auth: {
    signInWithPassword: vi.fn(),
    signOut: vi.fn(),
    getUser: vi.fn(),
    onAuthStateChange: vi.fn(),
  },
};

vi.mock('../src/lib/supabaseClient.ts', () => ({
  supabase: mockSupabase,
}));

// Import after mock is set up
const { groupRepository, studentRepository, homeworkRepository } =
  await import('../src/models/index.ts');

describe('GroupRepository', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should list groups for a teacher', async () => {
    const mockGroups = [
      {
        id: TEST_UUID_1,
        teacher_id: TEST_UUID_2,
        name: '1К-2ж',
        description: 'Test group',
        created_at: '2026-09-01T00:00:00.000Z',
      },
    ];

    mockSupabase.from.mockReturnValue({
      select: vi.fn(() => ({
        eq: vi.fn(() => ({
          order: vi.fn(() =>
            Promise.resolve({
              data: mockGroups,
              error: null,
              status: 200,
            })
          ),
        })),
      })),
    });

    const groups = await groupRepository.list(TEST_UUID_2);
    expect(groups).toHaveLength(1);
    expect(groups[0]!.name).toBe('1К-2ж');
  });

  it('should handle empty results', async () => {
    mockSupabase.from.mockReturnValue({
      select: vi.fn(() => ({
        eq: vi.fn(() => ({
          order: vi.fn(() =>
            Promise.resolve({
              data: [],
              error: null,
              status: 200,
            })
          ),
        })),
      })),
    });

    const groups = await groupRepository.list(TEST_UUID_2);
    expect(groups).toHaveLength(0);
  });

  it('should handle errors', async () => {
    mockSupabase.from.mockReturnValue({
      select: vi.fn(() => ({
        eq: vi.fn(() => ({
          order: vi.fn(() =>
            Promise.resolve({
              data: null,
              error: { message: 'DB error', code: 'PGRST_ERROR' },
              status: 400,
            })
          ),
        })),
      })),
    });

    await expect(groupRepository.list(TEST_UUID_2)).rejects.toThrow('Failed to fetch groups');
  });

  it('should create a group', async () => {
    const newGroup = {
      id: TEST_UUID_1,
      teacher_id: TEST_UUID_2,
      name: 'New Group',
      description: null,
      created_at: '2026-09-01T00:00:00.000Z',
    };

    mockSupabase.from.mockReturnValue({
      insert: vi.fn(() => ({
        select: vi.fn(() => ({
          single: vi.fn(() =>
            Promise.resolve({
              data: newGroup,
              error: null,
              status: 200,
            })
          ),
        })),
      })),
    });

    const result = await groupRepository.create(TEST_UUID_2, 'New Group', null);
    expect(result.name).toBe('New Group');
    expect(result.teacher_id).toBe(TEST_UUID_2);
  });

  it('should delete a group', async () => {
    mockSupabase.from.mockReturnValue({
      delete: vi.fn(() => ({
        eq: vi.fn(() => Promise.resolve({ error: null })),
      })),
    });

    await expect(groupRepository.delete(TEST_UUID_1)).resolves.not.toThrow();
  });
});

describe('StudentRepository', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should list students by group', async () => {
    const mockStudents = [
      {
        id: TEST_UUID_3,
        group_id: TEST_UUID_1,
        full_name: 'Иванов Иван',
        avatar_url: null,
        phone: null,
        birth_date: null,
        created_at: '2026-09-01T00:00:00.000Z',
      },
    ];

    mockSupabase.from.mockReturnValue({
      select: vi.fn(() => ({
        eq: vi.fn(() => ({
          order: vi.fn(() =>
            Promise.resolve({
              data: mockStudents,
              error: null,
              status: 200,
            })
          ),
        })),
      })),
    });

    const students = await studentRepository.listByGroup(TEST_UUID_1);
    expect(students).toHaveLength(1);
    expect(students[0]!.full_name).toBe('Иванов Иван');
  });

  it('should create a student', async () => {
    const newStudent = {
      id: TEST_UUID_3,
      group_id: TEST_UUID_1,
      full_name: 'Петров Петр',
      avatar_url: null,
      phone: null,
      birth_date: null,
      created_at: '2026-09-01T00:00:00.000Z',
    };

    mockSupabase.from.mockReturnValue({
      insert: vi.fn(() => ({
        select: vi.fn(() => ({
          single: vi.fn(() =>
            Promise.resolve({
              data: newStudent,
              error: null,
              status: 200,
            })
          ),
        })),
      })),
    });

    const result = await studentRepository.create({
      group_id: TEST_UUID_1,
      full_name: 'Петров Петр',
      avatar_url: null,
      phone: null,
      birth_date: null,
    });

    expect(result.full_name).toBe('Петров Петр');
  });
});

describe('HomeworkRepository', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should list homework for a teacher', async () => {
    const mockHomework = [
      {
        id: TEST_UUID_1,
        teacher_id: TEST_UUID_2,
        group_id: TEST_UUID_3,
        title: 'Math Homework',
        description: 'Solve problems 1-10',
        due_date: '2026-09-15T23:59:59.000Z',
        created_at: '2026-09-01T00:00:00.000Z',
        updated_at: '2026-09-01T00:00:00.000Z',
        status: 'published',
      },
    ];

    mockSupabase.from.mockReturnValue({
      select: vi.fn(() => ({
        eq: vi.fn(() => ({
          order: vi.fn(() => ({
            limit: vi.fn(() =>
              Promise.resolve({
                data: mockHomework,
                error: null,
                status: 200,
              })
            ),
          })),
        })),
      })),
    });

    const homeworks = await homeworkRepository.list(TEST_UUID_2, { limit: 50 });
    expect(homeworks).toHaveLength(1);
    expect(homeworks[0]!.title).toBe('Math Homework');
    expect(homeworks[0]!.status).toBe('published');
  });

  it('should handle errors gracefully', async () => {
    mockSupabase.from.mockReturnValue({
      select: vi.fn(() => ({
        eq: vi.fn(() => ({
          order: vi.fn(() => ({
            limit: vi.fn(() =>
              Promise.resolve({
                data: null,
                error: { message: 'Auth required', code: 'AUTH_ERROR' },
                status: 401,
              })
            ),
          })),
        })),
      })),
    });

    await expect(homeworkRepository.list(TEST_UUID_2, { limit: 50 })).rejects.toThrow(
      'Failed to fetch homework'
    );
  });
});
