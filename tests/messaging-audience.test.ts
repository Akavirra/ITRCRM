import { all } from '@/db';
import { getAudiencePreview } from '@/lib/messaging';

jest.mock('@/db', () => ({
  all: jest.fn(),
  get: jest.fn(),
  run: jest.fn(),
}));

const mockAll = all as jest.MockedFunction<typeof all>;

describe('messaging audience preview', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('keeps an empty manual audience empty', async () => {
    const preview = await getAudiencePreview({
      mode: 'manual',
      studentIds: [],
      studyStatuses: ['studying'],
      requireEmail: true,
    });

    expect(preview).toEqual({
      students: [],
      total: 0,
      deliverable: 0,
      missingEmail: 0,
      suppressed: 0,
    });
    expect(mockAll).not.toHaveBeenCalled();
  });

  it('includes a studying individual student without active groups', async () => {
    mockAll
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([
        {
          id: 7,
          public_id: 'STU-123',
          full_name: 'Індивідуальний Учень',
          email: 'student@example.com',
          parent_name: null,
          parent_phone: null,
          school: null,
          is_active: true,
          study_status: 'studying',
          groups_json: [],
        },
      ] as any);

    const preview = await getAudiencePreview({
      mode: 'all',
      studyStatuses: ['studying'],
      requireEmail: true,
    });

    expect(preview.total).toBe(1);
    expect(preview.deliverable).toBe(1);
    expect(preview.students[0].full_name).toBe('Індивідуальний Учень');
    expect(preview.students[0].groups).toEqual([]);
  });

  it('does not let empty manual mode suppress selected group filters', async () => {
    mockAll
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([
        {
          id: 9,
          public_id: 'STU-456',
          full_name: 'Груповий Учень',
          email: null,
          parent_name: null,
          parent_phone: null,
          school: null,
          is_active: true,
          study_status: 'studying',
          groups_json: [{ id: 3, title: 'Група Lego', course_id: 2, course_title: 'Робототехніка Lego' }],
        },
      ] as any);

    const preview = await getAudiencePreview({
      mode: 'manual',
      studentIds: [],
      groupIds: [3],
      studyStatuses: ['studying'],
      requireEmail: false,
    });

    expect(preview.total).toBe(1);
    expect(preview.deliverable).toBe(0);
    expect(preview.missingEmail).toBe(1);
    expect(preview.students[0].full_name).toBe('Груповий Учень');
  });
});
