import { run, get, all } from '@/db';
import { StudyStatus } from './students';
import { generateUniquePublicId } from './public-id';

export interface Course {
  id: number;
  public_id: string;
  title: string;
  description: string | null;
  age_min: number;
  duration_months: number;
  program: string | null;
  flyer_path: string | null;
  is_active: number;
  created_at: string;
  updated_at: string;
}

export interface CourseWithStats extends Course {
  groups_count: number;
  students_count: number;
}

// Get all courses
export function getCourses(includeInactive: boolean = false): Course[] {
  const sql = includeInactive
    ? `SELECT * FROM courses ORDER BY created_at DESC`
    : `SELECT * FROM courses WHERE is_active = 1 ORDER BY created_at DESC`;
  
  return all<Course>(sql);
}

// Get courses with stats
export function getCoursesWithStats(includeInactive: boolean = false): CourseWithStats[] {
  const sql = includeInactive
    ? `SELECT c.*, 
        COUNT(DISTINCT g.id) as groups_count,
        COUNT(DISTINCT sg.student_id) as students_count
       FROM courses c
       LEFT JOIN groups g ON c.id = g.course_id
       LEFT JOIN student_groups sg ON g.id = sg.group_id AND sg.is_active = 1
       GROUP BY c.id
       ORDER BY c.created_at DESC`
    : `SELECT c.*, 
        COUNT(DISTINCT g.id) as groups_count,
        COUNT(DISTINCT sg.student_id) as students_count
       FROM courses c
       LEFT JOIN groups g ON c.id = g.course_id AND g.is_active = 1
       LEFT JOIN student_groups sg ON g.id = sg.group_id AND sg.is_active = 1
       WHERE c.is_active = 1
       GROUP BY c.id
       ORDER BY c.created_at DESC`;
  
  return all<CourseWithStats>(sql);
}

// Get course by ID
export function getCourseById(id: number): Course | null {
  return get<Course>(`SELECT * FROM courses WHERE id = ?`, [id]) ?? null;
}

// Check if public_id is unique for courses
function isPublicIdUnique(publicId: string): boolean {
  const existing = get<{ id: number }>(
    `SELECT id FROM courses WHERE public_id = ?`,
    [publicId]
  );
  return !existing;
}

// Create course
export function createCourse(
  title: string,
  description?: string,
  ageMin?: number,
  durationMonths?: number,
  program?: string
): { id: number; public_id: string } {
  const publicId = generateUniquePublicId('course', isPublicIdUnique);
  
  const result = run(
    `INSERT INTO courses (public_id, title, description, age_min, duration_months, program) VALUES (?, ?, ?, ?, ?, ?)`,
    [publicId, title, description || null, ageMin || 6, durationMonths || 1, program || null]
  );
  
  return { id: Number(result.lastInsertRowid), public_id: publicId };
}

// Update course
export function updateCourse(
  id: number,
  title: string,
  description?: string,
  ageMin?: number,
  durationMonths?: number,
  program?: string
): void {
  run(
    `UPDATE courses SET title = ?, description = ?, age_min = ?, duration_months = ?, program = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?`,
    [title, description || null, ageMin || 6, durationMonths || 1, program || null, id]
  );
}

// Archive course (soft delete)
export function archiveCourse(id: number): void {
  run(`UPDATE courses SET is_active = 0, updated_at = CURRENT_TIMESTAMP WHERE id = ?`, [id]);
}

// Restore course
export function restoreCourse(id: number): void {
  run(`UPDATE courses SET is_active = 1, updated_at = CURRENT_TIMESTAMP WHERE id = ?`, [id]);
}

// Delete course permanently (only if no groups)
export function deleteCourse(id: number): boolean {
  const groups = all<{ id: number }>(`SELECT id FROM groups WHERE course_id = ?`, [id]);
  
  if (groups.length > 0) {
    return false;
  }
  
  run(`DELETE FROM courses WHERE id = ?`, [id]);
  return true;
}

// Update course flyer path
export function updateCourseFlyerPath(id: number, flyerPath: string | null): void {
  run(
    `UPDATE courses SET flyer_path = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?`,
    [flyerPath, id]
  );
}

// Get course flyer path
export function getCourseFlyerPath(id: number): string | null {
  const course = get<{ flyer_path: string | null }>(
    `SELECT flyer_path FROM courses WHERE id = ?`,
    [id]
  );
  return course?.flyer_path ?? null;
}

// Search courses
export function searchCourses(query: string, includeInactive: boolean = false): Course[] {
  const searchTerm = `%${query}%`;
  const sql = includeInactive
    ? `SELECT * FROM courses WHERE title LIKE ? OR description LIKE ? ORDER BY created_at DESC`
    : `SELECT * FROM courses WHERE is_active = 1 AND (title LIKE ? OR description LIKE ?) ORDER BY created_at DESC`;
  
  return all<Course>(sql, [searchTerm, searchTerm]);
}