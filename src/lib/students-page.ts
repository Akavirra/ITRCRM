import { getCourses } from '@/lib/courses';
import { getGroupFilterOptions } from '@/lib/groups';
import { getStudentAgeOptions, getStudentSchoolOptions } from '@/lib/students';
import { getOrSetServerCache } from '@/lib/server-cache';

export interface StudentsFilterBootstrap {
  courses: Array<{
    id: number;
    title: string;
    public_id: string;
  }>;
  groups: Array<{
    id: number;
    title: string;
    course_id: number;
    course_title: string;
  }>;
  ages: number[];
  schools: string[];
}

export async function getStudentsFilterBootstrap(): Promise<StudentsFilterBootstrap> {
  const [courses, groups, ages, schools] = await Promise.all([
    getOrSetServerCache('students:filters:courses', 5 * 60 * 1000, async () => {
      const rows = await getCourses(false);
      return rows.map((course) => ({
        id: course.id,
        title: course.title,
        public_id: course.public_id,
      }));
    }),
    getOrSetServerCache('students:filters:groups', 5 * 60 * 1000, () => getGroupFilterOptions(true)),
    getOrSetServerCache('students:filters:ages', 5 * 60 * 1000, () => getStudentAgeOptions(false)),
    getOrSetServerCache('students:filters:schools', 5 * 60 * 1000, () => getStudentSchoolOptions(false)),
  ]);

  return { courses, groups, ages, schools };
}
