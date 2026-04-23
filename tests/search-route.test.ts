jest.mock('@/lib/api-utils', () => ({
  getAuthUser: jest.fn(),
  unauthorized: jest.fn(() => ({ status: 401 })),
}));

jest.mock('@/db', () => ({
  all: jest.fn(),
}));

jest.mock('@/lib/server-cache', () => ({
  getOrSetServerCache: jest.fn(async (_key, _ttl, factory) => factory()),
}));

import { NextRequest } from 'next/server';
import { getAuthUser } from '@/lib/api-utils';
import { all } from '@/db';
import { GET } from '@/app/api/search/route';

const mockGetAuthUser = getAuthUser as jest.MockedFunction<typeof getAuthUser>;
const mockAll = all as jest.MockedFunction<typeof all>;

describe('GET /api/search', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockGetAuthUser.mockResolvedValue({ id: 1, role: 'admin', name: 'Admin' } as any);
    mockAll
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([]);
  });

  test('uses matching placeholder indexes in student search SQL', async () => {
    const request = new NextRequest('http://localhost:3000/api/search?q=Іван');

    const response = await GET(request);
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload.results).toEqual([]);

    const [studentSql, studentParams] = mockAll.mock.calls[0];
    expect(typeof studentSql).toBe('string');
    expect(studentSql).toContain('WHEN full_name ILIKE $4 THEN 0');
    expect(studentSql).not.toContain('WHEN full_name ILIKE $5 THEN 0');
    expect(studentParams).toEqual(['%Іван%', '%Іван%', '%Іван%', 'Іван%']);
  });
});
