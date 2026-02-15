'use client';

import { useState, useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';
import Layout from '@/components/Layout';
import { uk } from '@/i18n/uk';

interface User {
  id: number;
  name: string;
  email: string;
  role: 'admin' | 'teacher';
}

interface Course {
  id: number;
  title: string;
}

interface Teacher {
  id: number;
  name: string;
}

interface Group {
  id: number;
  public_id: string;
  title: string;
  course_id: number;
  teacher_id: number;
  weekly_day: number;
  start_time: string;
  duration_minutes: number;
  monthly_price: number;
  status: 'active' | 'graduate' | 'inactive';
  note: string | null;
  photos_folder_url: string | null;
}

export default function EditGroupPage() {
  const router = useRouter();
  const params = useParams();
  const groupId = params.id as string;
  
  const [user, setUser] = useState<User | null>(null);
  const [group, setGroup] = useState<Group | null>(null);
  const [courses, setCourses] = useState<Course[]>([]);
  const [teachers, setTeachers] = useState<Teacher[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Form state
  const [courseId, setCourseId] = useState('');
  const [teacherId, setTeacherId] = useState('');
  const [weeklyDay, setWeeklyDay] = useState('');
  const [startTime, setStartTime] = useState('');
  const [status, setStatus] = useState('active');
  const [note, setNote] = useState('');
  const [photosFolderUrl, setPhotosFolderUrl] = useState('');

  // Generated title preview
  const [titlePreview, setTitlePreview] = useState('');

  useEffect(() => {
    const fetchData = async () => {
      try {
        const authRes = await fetch('/api/auth/me');
        if (!authRes.ok) {
          router.push('/login');
          return;
        }
        const authData = await authRes.json();
        setUser(authData.user);

        // Only admin can edit groups
        if (authData.user.role !== 'admin') {
          router.push('/groups');
          return;
        }

        // Fetch group data
        const groupRes = await fetch(`/api/groups/${groupId}`);
        if (!groupRes.ok) {
          router.push('/groups');
          return;
        }
        const groupData = await groupRes.json();
        setGroup(groupData.group);

        // Set form values
        setCourseId(String(groupData.group.course_id));
        setTeacherId(String(groupData.group.teacher_id));
        setWeeklyDay(String(groupData.group.weekly_day));
        setStartTime(groupData.group.start_time);
        setStatus(groupData.group.status || 'active');
        setNote(groupData.group.note || '');
        setPhotosFolderUrl(groupData.group.photos_folder_url || '');

        // Fetch courses
        const coursesRes = await fetch('/api/courses');
        const coursesData = await coursesRes.json();
        setCourses(coursesData.courses || []);

        // Fetch teachers
        const usersRes = await fetch('/api/users');
        const usersData = await usersRes.json();
        setTeachers((usersData.users || []).filter((u: User) => u.role === 'teacher'));
      } catch (error) {
        console.error('Failed to fetch data:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [router, groupId]);

  // Update title preview when form changes
  useEffect(() => {
    if (courseId && weeklyDay && startTime) {
      const course = courses.find(c => c.id === parseInt(courseId));
      const dayShort = uk.daysShort[parseInt(weeklyDay) as keyof typeof uk.daysShort];
      if (course && dayShort) {
        setTitlePreview(`${dayShort} ${startTime} ${course.title}`);
      }
    } else {
      setTitlePreview('');
    }
  }, [courseId, weeklyDay, startTime, courses]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    // Validation
    if (!courseId) {
      setError(uk.validation.selectCourse);
      return;
    }
    if (!weeklyDay) {
      setError(uk.validation.selectDay);
      return;
    }
    if (!startTime) {
      setError(uk.validation.selectTime);
      return;
    }
    if (!teacherId) {
      setError(uk.validation.selectTeacher);
      return;
    }

    // Validate time format
    const timeRegex = /^([01]?[0-9]|2[0-3]):([0-5][0-9])$/;
    if (!timeRegex.test(startTime)) {
      setError(uk.validation.invalidTime);
      return;
    }

    // Validate URL if provided
    if (photosFolderUrl) {
      try {
        new URL(photosFolderUrl);
      } catch {
        setError(uk.validation.invalidUrl);
        return;
      }
    }

    setSaving(true);

    try {
      const res = await fetch(`/api/groups/${groupId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          course_id: parseInt(courseId),
          teacher_id: parseInt(teacherId),
          weekly_day: parseInt(weeklyDay),
          start_time: startTime,
          status,
          note: note || null,
          photos_folder_url: photosFolderUrl || null,
        }),
      });

      const data = await res.json();

      if (res.ok) {
        router.push(`/groups/${groupId}`);
      } else {
        setError(data.error || uk.toasts.error);
      }
    } catch (error) {
      console.error('Failed to update group:', error);
      setError(uk.toasts.error);
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return <div style={{ padding: '2rem', textAlign: 'center' }}>{uk.common.loading}</div>;
  }

  if (!user || user.role !== 'admin' || !group) return null;

  return (
    <Layout user={user}>
      <div className="card">
        <div className="card-header">
          <div>
            <h1 style={{ fontSize: '1.5rem', fontWeight: '600', margin: 0 }}>
              {uk.modals.editGroup}
            </h1>
            {group.public_id && (
              <p style={{ fontFamily: 'monospace', fontSize: '0.875rem', color: '#6b7280', margin: '0.25rem 0 0 0' }}>
                ID: {group.public_id}
              </p>
            )}
          </div>
        </div>

        <form onSubmit={handleSubmit} style={{ padding: '1.5rem' }}>
          {error && (
            <div style={{ 
              padding: '0.75rem 1rem', 
              marginBottom: '1rem', 
              backgroundColor: '#fef2f2', 
              color: '#dc2626', 
              borderRadius: '0.5rem',
              border: '1px solid #fecaca'
            }}>
              {error}
            </div>
          )}

          {/* Title Preview */}
          {titlePreview && (
            <div style={{ 
              padding: '1rem', 
              marginBottom: '1.5rem', 
              backgroundColor: '#f0f9ff', 
              borderRadius: '0.5rem',
              border: '1px solid #bae6fd'
            }}>
              <p style={{ margin: 0, fontSize: '0.875rem', color: '#0369a1', fontWeight: '500' }}>
                {uk.forms.groupTitle}:
              </p>
              <p style={{ margin: '0.5rem 0 0 0', fontSize: '1.125rem', fontWeight: '600' }}>
                {titlePreview}
              </p>
            </div>
          )}

          {/* Step 1: Select Course */}
          <div style={{ marginBottom: '1.5rem' }}>
            <label className="form-label" style={{ display: 'block', marginBottom: '0.5rem', fontWeight: '500' }}>
              {uk.forms.course} *
            </label>
            <select
              className="form-input"
              value={courseId}
              onChange={(e) => setCourseId(e.target.value)}
              required
            >
              <option value="">{uk.forms.selectCourse}</option>
              {courses.map((course) => (
                <option key={course.id} value={course.id}>
                  {course.title}
                </option>
              ))}
            </select>
          </div>

          {/* Step 2: Day, Time, Teacher, Status */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem', marginBottom: '1.5rem' }}>
            <div>
              <label className="form-label" style={{ display: 'block', marginBottom: '0.5rem', fontWeight: '500' }}>
                {uk.forms.dayOfWeek} *
              </label>
              <select
                className="form-input"
                value={weeklyDay}
                onChange={(e) => setWeeklyDay(e.target.value)}
                required
              >
                <option value="">{uk.forms.selectDay}</option>
                {Object.entries(uk.days).map(([key, value]) => (
                  <option key={key} value={key}>
                    {value}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="form-label" style={{ display: 'block', marginBottom: '0.5rem', fontWeight: '500' }}>
                {uk.forms.startTime} *
              </label>
              <input
                type="time"
                className="form-input"
                value={startTime}
                onChange={(e) => setStartTime(e.target.value)}
                required
              />
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem', marginBottom: '1.5rem' }}>
            <div>
              <label className="form-label" style={{ display: 'block', marginBottom: '0.5rem', fontWeight: '500' }}>
                {uk.forms.teacher} *
              </label>
              <select
                className="form-input"
                value={teacherId}
                onChange={(e) => setTeacherId(e.target.value)}
                required
              >
                <option value="">{uk.forms.selectTeacher}</option>
                {teachers.map((teacher) => (
                  <option key={teacher.id} value={teacher.id}>
                    {teacher.name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="form-label" style={{ display: 'block', marginBottom: '0.5rem', fontWeight: '500' }}>
                {uk.common.status} *
              </label>
              <select
                className="form-input"
                value={status}
                onChange={(e) => setStatus(e.target.value)}
                required
              >
                <option value="active">{uk.groupStatus.active}</option>
                <option value="graduate">{uk.groupStatus.graduate}</option>
                <option value="inactive">{uk.groupStatus.inactive}</option>
              </select>
            </div>
          </div>

          {/* Optional fields */}
          <div style={{ marginBottom: '1.5rem' }}>
            <label className="form-label" style={{ display: 'block', marginBottom: '0.5rem', fontWeight: '500' }}>
              {uk.forms.note}
            </label>
            <textarea
              className="form-input"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              rows={3}
              placeholder={uk.common.note}
            />
          </div>

          <div style={{ marginBottom: '1.5rem' }}>
            <label className="form-label" style={{ display: 'block', marginBottom: '0.5rem', fontWeight: '500' }}>
              {uk.forms.photosFolderUrl}
            </label>
            <input
              type="url"
              className="form-input"
              value={photosFolderUrl}
              onChange={(e) => setPhotosFolderUrl(e.target.value)}
              placeholder={uk.forms.photosFolderPlaceholder}
            />
          </div>

          {/* Actions */}
          <div style={{ display: 'flex', gap: '1rem', justifyContent: 'flex-end' }}>
            <button
              type="button"
              className="btn btn-secondary"
              onClick={() => router.push(`/groups/${groupId}`)}
              disabled={saving}
            >
              {uk.actions.cancel}
            </button>
            <button
              type="submit"
              className="btn btn-primary"
              disabled={saving}
            >
              {saving ? uk.common.saving : uk.actions.save}
            </button>
          </div>
        </form>
      </div>
    </Layout>
  );
}
