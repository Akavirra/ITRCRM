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
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface CourseWithStats extends Course {
  groups_count: number;
  students_count: number;
}

// Get all courses
export async function getCourses(includeInactive: boolean = false): Promise<Course[]> {
  const sql = includeInactive
    ? `SELECT * FROM courses ORDER BY created_at DESC`
    : `SELECT * FROM courses WHERE is_active = TRUE ORDER BY created_at DESC`;
  
  return await all<Course>(sql);
}

// Get courses with stats
export async function getCoursesWithStats(includeInactive: boolean = false): Promise<CourseWithStats[]> {
  const sql = includeInactive
    ? `SELECT c.*, 
        COUNT(DISTINCT g.id) as groups_count,
        COUNT(DISTINCT sg.student_id) as students_count
       FROM courses c
       LEFT JOIN groups g ON c.id = g.course_id
       LEFT JOIN student_groups sg ON g.id = sg.group_id AND sg.is_active = TRUE
       GROUP BY c.id
       ORDER BY c.created_at DESC`
    : `SELECT c.*, 
        COUNT(DISTINCT g.id) as groups_count,
        COUNT(DISTINCT sg.student_id) as students_count
       FROM courses c
       LEFT JOIN groups g ON c.id = g.course_id AND g.is_active = TRUE
       LEFT JOIN student_groups sg ON g.id = sg.group_id AND sg.is_active = TRUE
       WHERE c.is_active = TRUE
       GROUP BY c.id
       ORDER BY c.created_at DESC`;
  
  return await all<CourseWithStats>(sql);
}

// Get course by ID
export async function getCourseById(id: number): Promise<Course | null> {
  return (await get<Course>(`SELECT * FROM courses WHERE id = $1`, [id])) ?? null;
}

// Check if public_id is unique for courses
async function isPublicIdUnique(publicId: string): Promise<boolean> {
  const existing = await get<{ id: number }>(
    `SELECT id FROM courses WHERE public_id = $1`,
    [publicId]
  );
  return !existing;
}

// Create course
export async function createCourse(
  title: string,
  description?: string,
  ageMin?: number,
  durationMonths?: number,
  program?: string
): Promise<{ id: number; public_id: string }> {
  const publicId = await generateUniquePublicId('course', isPublicIdUnique);
  
  const result = await run(
    `INSERT INTO courses (public_id, title, description, age_min, duration_months, program) VALUES ($1, $2, $3, $4, $5, $6) RETURNING id`,
    [publicId, title, description || null, ageMin || 6, durationMonths || 1, program || null]
  );
  
  return { id: Number(result[0]?.id), public_id: publicId };
}

// Update course
export async function updateCourse(
  id: number,
  title: string,
  description?: string,
  ageMin?: number,
  durationMonths?: number,
  program?: string
): Promise<void> {
  await run(
    `UPDATE courses SET title = $1, description = $2, age_min = $3, duration_months = $4, program = $5, updated_at = NOW() WHERE id = $6`,
    [title, description || null, ageMin || 6, durationMonths || 1, program || null, id]
  );
}

// Archive course (soft delete)
export async function archiveCourse(id: number): Promise<void> {
  await run(`UPDATE courses SET is_active = FALSE, updated_at = NOW() WHERE id = $1`, [id]);
}

// Restore course
export async function restoreCourse(id: number): Promise<void> {
  await run(`UPDATE courses SET is_active = TRUE, updated_at = NOW() WHERE id = $1`, [id]);
}

// Delete course permanently (with cascade delete of groups)
export async function deleteCourse(id: number): Promise<boolean> {
  // First delete all groups for this course
  // This will cascade delete student_groups, lessons, payments, and pricing due to FK constraints
  await run(`DELETE FROM groups WHERE course_id = $1`, [id]);
  
  // Now delete the course
  await run(`DELETE FROM courses WHERE id = $1`, [id]);
  return true;
}

// Update course flyer path
export async function updateCourseFlyerPath(id: number, flyerPath: string | null): Promise<void> {
  await run(
    `UPDATE courses SET flyer_path = $1, updated_at = NOW() WHERE id = $2`,
    [flyerPath, id]
  );
}

// Get course flyer path
export async function getCourseFlyerPath(id: number): Promise<string | null> {
  const course = await get<{ flyer_path: string | null }>(
    `SELECT flyer_path FROM courses WHERE id = $1`,
    [id]
  );
  return course?.flyer_path ?? null;
}

// Search courses
export async function searchCourses(query: string, includeInactive: boolean = false): Promise<Course[]> {
  const searchTerm = `%${query}%`;
  const sql = includeInactive
    ? `SELECT * FROM courses WHERE title ILIKE $1 OR description ILIKE $2 ORDER BY created_at DESC`
    : `SELECT * FROM courses WHERE is_active = TRUE AND (title ILIKE $1 OR description ILIKE $2) ORDER BY created_at DESC`;
  
  return await all<Course>(sql, [searchTerm, searchTerm]);
}
