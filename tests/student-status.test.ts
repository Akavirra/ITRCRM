import { all, get } from '@/db';
import {
  STUDY_STATUS,
  computeStudyStatus,
  getStudentById,
  getStudents,
  getStudentsWithGroupCount,
} from '@/lib/students';

jest.mock('@/db', () => ({
  all: jest.fn(),
  get: jest.fn(),
  run: jest.fn(),
}));

const mockAll = all as jest.MockedFunction<typeof all>;
const mockGet = get as jest.MockedFunction<typeof get>;

describe('Student Study Status Logic', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('computeStudyStatus', () => {
    it('returns "studying" when groups count is greater than zero', () => {
      expect(computeStudyStatus(1)).toBe(STUDY_STATUS.STUDYING);
      expect(computeStudyStatus(5)).toBe(STUDY_STATUS.STUDYING);
    });

    it('returns "not_studying" when groups count is zero', () => {
      expect(computeStudyStatus(0)).toBe(STUDY_STATUS.NOT_STUDYING);
    });
  });

  describe('getStudents', () => {
    it('queries only active students by default', async () => {
      mockAll.mockResolvedValue([
        { id: 1, full_name: 'Test Student', study_status: 'not_studying', is_active: true },
      ] as any);

      const students = await getStudents();

      expect(students).toHaveLength(1);
      expect(students[0].study_status).toBe('not_studying');
      expect(mockAll).toHaveBeenCalledWith(expect.stringContaining('WHERE is_active = TRUE'));
    });

    it('includes inactive students when requested', async () => {
      mockAll.mockResolvedValue([
        { id: 1, full_name: 'Active Student', study_status: 'studying', is_active: true },
        { id: 2, full_name: 'Inactive Student', study_status: 'not_studying', is_active: false },
      ] as any);

      const students = await getStudents(true);

      expect(students).toHaveLength(2);
      expect(mockAll).toHaveBeenCalledWith(expect.not.stringContaining('WHERE is_active = TRUE'));
    });
  });

  describe('getStudentsWithGroupCount', () => {
    it('returns group counts with derived study status', async () => {
      mockAll.mockResolvedValue([
        { id: 1, full_name: 'Student A', groups_count: 1, study_status: 'studying' },
        { id: 2, full_name: 'Student B', groups_count: 0, study_status: 'not_studying' },
      ] as any);

      const students = await getStudentsWithGroupCount();

      expect(students[0].groups_count).toBe(1);
      expect(students[0].study_status).toBe('studying');
      expect(students[1].groups_count).toBe(0);
      expect(students[1].study_status).toBe('not_studying');
      expect(mockAll).toHaveBeenCalledWith(expect.stringContaining('COUNT(DISTINCT sg.id) as groups_count'));
    });
  });

  describe('getStudentById', () => {
    it('returns the student when found', async () => {
      mockGet.mockResolvedValue({
        id: 7,
        full_name: 'Student Seven',
        study_status: 'studying',
      } as any);

      const student = await getStudentById(7);

      expect(student?.id).toBe(7);
      expect(student?.study_status).toBe('studying');
      expect(mockGet).toHaveBeenCalledWith(expect.stringContaining('FROM students WHERE students.id = $1'), [7]);
    });

    it('returns null when the student does not exist', async () => {
      mockGet.mockResolvedValue(undefined);

      const student = await getStudentById(999);

      expect(student).toBeNull();
    });
  });
});
