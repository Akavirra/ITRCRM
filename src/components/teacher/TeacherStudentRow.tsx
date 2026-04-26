/**
 * TeacherStudentRow — server-component для рядка учня в списку групи.
 *
 * Показує: фото / ім'я / контакт батьків / дата народження.
 * Натиск → /students/[id] (поки не реалізовано — буде у E.1.5+).
 */

import Link from 'next/link';

interface Student {
  id: number;
  full_name: string;
  photo: string | null;
  birth_date: string | null;
  parent_name: string | null;
  parent_phone: string | null;
  is_active: boolean;
}

interface Props {
  student: Student;
}

function ageFromBirthDate(birthDate: string | null): number | null {
  if (!birthDate) return null;
  const dob = new Date(birthDate);
  if (Number.isNaN(dob.getTime())) return null;
  const now = new Date();
  let age = now.getFullYear() - dob.getFullYear();
  const m = now.getMonth() - dob.getMonth();
  if (m < 0 || (m === 0 && now.getDate() < dob.getDate())) age--;
  return age >= 0 && age < 100 ? age : null;
}

function avatarLetter(name: string): string {
  const t = (name || '').trim();
  return t ? t.charAt(0).toUpperCase() : '?';
}

export default function TeacherStudentRow({ student }: Props) {
  const age = ageFromBirthDate(student.birth_date);

  return (
    <Link href={`/students/${student.id}`} className="teacher-student-row">
      <div className="teacher-student-row__avatar">
        {student.photo ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={student.photo} alt={student.full_name} />
        ) : (
          <span>{avatarLetter(student.full_name)}</span>
        )}
      </div>
      <div className="teacher-student-row__main">
        <div className="teacher-student-row__name">{student.full_name}</div>
        <div className="teacher-student-row__meta">
          {age !== null && <span>{age} років</span>}
          {student.parent_name && <span>· Батько/мати: {student.parent_name}</span>}
        </div>
      </div>
      {student.parent_phone ? (
        <a
          href={`tel:${student.parent_phone}`}
          className="teacher-student-row__phone"
          onClick={(e) => e.stopPropagation()}
          aria-label={`Подзвонити ${student.parent_name || 'батькам'}`}
        >
          📞 {student.parent_phone}
        </a>
      ) : (
        <span className="teacher-student-row__phone teacher-student-row__phone--missing">
          Без контакту
        </span>
      )}
    </Link>
  );
}
