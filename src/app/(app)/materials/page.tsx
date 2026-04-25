
'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import {
  FolderOpen, FileText, Image, Video, Music, File,
  Download, ExternalLink, Search, Trash2, LayoutGrid,
  LayoutList, MoreVertical, ChevronDown, ChevronRight, UserRound, Sparkles, BookOpen, Users,
} from 'lucide-react';
import { useUser } from '@/components/UserContext';
import {
  useMediaViewer,
  type MediaFile,
  isPreviewable, isAudioType, thumbUrl, formatSize, formatDate, effectiveCategory,
} from '@/components/MediaViewerProvider';
import StudentAvatarCropModal from '@/components/StudentAvatarCropModal';

interface KebabItem {
  label: string;
  icon: React.ReactNode;
  href?: string;
  onClick?: () => void;
  danger?: boolean;
}

type ViewMode = 'grid' | 'list';
type FilterType = 'all' | 'photo' | 'video' | 'document' | 'audio';
type SourceType = 'telegram' | 'lesson';
type SortType = 'newest' | 'oldest' | 'name' | 'size-desc' | 'size-asc';

interface Topic {
  id: number;
  thread_id: string;
  name: string;
  file_count: number;
}

interface LessonFolderNode {
  id: number;
  lessonDate: string | null;
  folderId: string;
  folderName: string;
  driveUrl: string;
  fileCount: number;
}

interface LessonGroupNode {
  id: number | null;
  title: string;
  fileCount: number;
  lessonCount: number;
  lessons: LessonFolderNode[];
}

interface LessonCourseNode {
  id: number | null;
  title: string;
  fileCount: number;
  lessonCount: number;
  groups: LessonGroupNode[];
}

interface StudentSearchOption {
  id: number;
  full_name: string;
  parent_name: string | null;
  parent_phone?: string | null;
  photo?: string | null;
  groups?: Array<{
    id: number;
    title: string;
    course_title?: string;
  }>;
}

interface CourseFilterOption {
  id: number;
  title: string;
}

interface GroupFilterOption {
  id: number;
  title: string;
  course_id: number;
  course_title: string;
}

type BrowserFile = MediaFile & {
  source?: SourceType;
  lesson_id?: number;
  course_id?: number | null;
  course_title?: string;
  group_id?: number | null;
  group_title?: string;
  folder_id?: string;
  folder_url?: string;
  thumbnail_url?: string;
};

const MATERIALS_SIDEBAR_WIDTH_KEY = 'materials_sidebar_width';
const MATERIALS_SIDEBAR_MIN = 250;
const MATERIALS_SIDEBAR_MAX = 520;

function KebabMenu({ items, counter }: { items: KebabItem[]; counter?: string }) {
  const [open, setOpen] = useState(false);
  const [dropPos, setDropPos] = useState({ top: 0, right: 0 });
  const btnRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (btnRef.current && !btnRef.current.closest('[data-kebab]')?.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    const scrollHandler = () => setOpen(false);
    document.addEventListener('mousedown', handler);
    document.addEventListener('scroll', scrollHandler, true);
    return () => {
      document.removeEventListener('mousedown', handler);
      document.removeEventListener('scroll', scrollHandler, true);
    };
  }, [open]);

  function handleOpen(e: React.MouseEvent) {
    e.stopPropagation();
    if (!btnRef.current) return;
    const rect = btnRef.current.getBoundingClientRect();
    setDropPos({ top: rect.bottom + 4, right: window.innerWidth - rect.right });
    setOpen((o) => !o);
  }

  return (
    <div data-kebab="" style={{ display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0 }}>
      {counter && <span style={{ fontSize: 12, color: '#94a3b8' }}>{counter}</span>}
      <button
        ref={btnRef}
        onClick={handleOpen}
        style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: 28, height: 28, borderRadius: 6, border: 'none', background: open ? '#e2e8f0' : 'transparent', color: '#64748b', cursor: 'pointer', flexShrink: 0 }}
      >
        <MoreVertical size={15} />
      </button>
      {open && (
        <div
          onClick={(e) => e.stopPropagation()}
          style={{ position: 'fixed', top: dropPos.top, right: dropPos.right, background: '#fff', borderRadius: 10, boxShadow: '0 8px 24px rgba(0,0,0,0.14), 0 0 0 1px rgba(0,0,0,0.06)', minWidth: 220, zIndex: 9000, overflow: 'hidden' }}
        >
          {items.map((item, i) => (
            item.href ? (
              <a key={i} href={item.href} target="_blank" rel="noopener noreferrer" onClick={() => setOpen(false)} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '9px 14px', textDecoration: 'none', color: item.danger ? '#ef4444' : '#1e293b', fontSize: 13, fontWeight: 500, borderBottom: i < items.length - 1 ? '1px solid #f1f5f9' : 'none' }}>
                {item.icon} {item.label}
              </a>
            ) : (
              <button key={i} onClick={() => { setOpen(false); item.onClick?.(); }} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '9px 14px', width: '100%', background: 'transparent', border: 'none', cursor: 'pointer', color: item.danger ? '#ef4444' : '#1e293b', fontSize: 13, fontWeight: 500, textAlign: 'left', borderBottom: i < items.length - 1 ? '1px solid #f1f5f9' : 'none' }}>
                {item.icon} {item.label}
              </button>
            )
          ))}
        </div>
      )}
    </div>
  );
}

function FileTypeIcon({ type, size = 18 }: { type: string; size?: number }) {
  const s = { width: size, height: size, flexShrink: 0 };
  if (type === 'photo' || type === 'animation') return <Image style={s} color="#3b82f6" />;
  if (type === 'video') return <Video style={s} color="#8b5cf6" />;
  if (type === 'audio' || type === 'voice') return <Music style={s} color="#f59e0b" />;
  if (type === 'document') return <FileText style={s} color="#64748b" />;
  return <File style={s} color="#64748b" />;
}

function TypeBadge({ type }: { type: string }) {
  const map: Record<string, { label: string; bg: string; color: string }> = {
    photo: { label: 'Фото', bg: '#eff6ff', color: '#3b82f6' },
    animation: { label: 'GIF', bg: '#eff6ff', color: '#3b82f6' },
    video: { label: 'Відео', bg: '#f5f3ff', color: '#8b5cf6' },
    document: { label: 'Документ', bg: '#f8fafc', color: '#64748b' },
    audio: { label: 'Аудіо', bg: '#fffbeb', color: '#f59e0b' },
    voice: { label: 'Голосове', bg: '#fffbeb', color: '#f59e0b' },
  };
  const s = map[type] ?? { label: type, bg: '#f8fafc', color: '#64748b' };
  return <span style={{ fontSize: 11, fontWeight: 600, padding: '2px 7px', borderRadius: 6, background: s.bg, color: s.color }}>{s.label}</span>;
}

function getFileThumb(file: BrowserFile, size = 400) {
  return file.thumbnail_url || thumbUrl(file.drive_file_id, size);
}

function findLessonSelection(courses: LessonCourseNode[], lessonId: number | null, groupId: number | null, courseId: number | null) {
  if (lessonId !== null) {
    for (const course of courses) {
      for (const group of course.groups) {
        const lesson = group.lessons.find((item) => item.id === lessonId);
        if (lesson) return { title: lesson.folderName, driveUrl: lesson.driveUrl };
      }
    }
  }
  if (groupId !== null) {
    for (const course of courses) {
      const group = course.groups.find((item) => item.id === groupId);
      if (group) return { title: group.title, driveUrl: undefined };
    }
  }
  if (courseId !== null) {
    const course = courses.find((item) => item.id === courseId);
    if (course) return { title: course.title, driveUrl: undefined };
  }
  return { title: 'Усі медіа занять', driveUrl: undefined };
}

function sortFiles(files: BrowserFile[], sortType: SortType) {
  const next = [...files];
  next.sort((a, b) => {
    if (sortType === 'name') return a.file_name.localeCompare(b.file_name, 'uk');
    if (sortType === 'size-asc') return (a.file_size || 0) - (b.file_size || 0);
    if (sortType === 'size-desc') return (b.file_size || 0) - (a.file_size || 0);
    const aTime = new Date(a.created_at).getTime();
    const bTime = new Date(b.created_at).getTime();
    return sortType === 'oldest' ? aTime - bTime : bTime - aTime;
  });
  return next;
}

const RECENT_AVATAR_STUDENTS_KEY = 'recent_avatar_students';

function canAssignAvatar(file: BrowserFile) {
  return file.source === 'lesson' && effectiveCategory(file) === 'photo';
}

async function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      if (typeof reader.result === 'string') {
        resolve(reader.result);
        return;
      }
      reject(new Error('Не вдалося підготувати зображення'));
    };
    reader.onerror = () => reject(reader.error ?? new Error('Не вдалося підготувати зображення'));
    reader.readAsDataURL(blob);
  });
}

function StudentAvatarPickerModal({
  isOpen,
  search,
  onSearchChange,
  selectedCourseId,
  onCourseChange,
  courseOptions,
  selectedGroupId,
  onGroupChange,
  groupOptions,
  searchResults,
  recentStudents,
  loading,
  preparingStudentId,
  onClose,
  onSelect,
}: {
  isOpen: boolean;
  search: string;
  onSearchChange: (value: string) => void;
  selectedCourseId: number | null;
  onCourseChange: (value: number | null) => void;
  courseOptions: CourseFilterOption[];
  selectedGroupId: number | null;
  onGroupChange: (value: number | null) => void;
  groupOptions: GroupFilterOption[];
  searchResults: StudentSearchOption[];
  recentStudents: StudentSearchOption[];
  loading: boolean;
  preparingStudentId: number | null;
  onClose: () => void;
  onSelect: (student: StudentSearchOption) => void;
}) {
  if (!isOpen) {
    return null;
  }

  const normalizedSearch = search.trim();
  const hasFilters = selectedCourseId !== null || selectedGroupId !== null;
  const studentsToShow = normalizedSearch || hasFilters ? searchResults : recentStudents;
  const visibleGroups = selectedCourseId === null
    ? groupOptions
    : groupOptions.filter((group) => group.course_id === selectedCourseId);

  return (
    <div
      onClick={onClose}
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(15, 23, 42, 0.55)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 10040,
        padding: '1.5rem',
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          width: 'min(92vw, 560px)',
          maxHeight: '78vh',
          background: '#fff',
          borderRadius: 20,
          boxShadow: '0 24px 60px rgba(15, 23, 42, 0.22)',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
        }}
      >
        <div style={{ padding: '1.25rem 1.5rem 1rem', borderBottom: '1px solid #e5e7eb' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{ width: 40, height: 40, borderRadius: 12, background: '#eff6ff', color: '#2563eb', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <UserRound size={18} />
            </div>
            <div>
              <div style={{ fontSize: '1.1rem', fontWeight: 700, color: '#111827' }}>Оберіть учня для аватарки</div>
              <div style={{ fontSize: '0.925rem', color: '#6b7280', marginTop: 2 }}>
                Знайдіть потрібного учня, а далі обріжете фото під аватар.
              </div>
            </div>
          </div>

          <div style={{ position: 'relative', marginTop: '1rem' }}>
            <Search size={16} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: '#94a3b8' }} />
            <input
              autoFocus
              value={search}
              onChange={(e) => onSearchChange(e.target.value)}
              placeholder="Пошук за іменем, прізвищем або телефоном..."
              style={{
                width: '100%',
                padding: '0.8rem 0.9rem 0.8rem 2.3rem',
                borderRadius: 14,
                border: '1px solid #dbe3ee',
                fontSize: '0.95rem',
                outline: 'none',
              }}
            />
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginTop: '0.75rem' }}>
            <select
              value={selectedCourseId ?? ''}
              onChange={(e) => onCourseChange(e.target.value ? Number(e.target.value) : null)}
              style={{
                width: '100%',
                padding: '0.78rem 0.85rem',
                borderRadius: 12,
                border: '1px solid #dbe3ee',
                fontSize: '0.92rem',
                outline: 'none',
                background: '#fff',
              }}
            >
              <option value="">Усі курси</option>
              {courseOptions.map((course) => (
                <option key={course.id} value={course.id}>{course.title}</option>
              ))}
            </select>

            <select
              value={selectedGroupId ?? ''}
              onChange={(e) => onGroupChange(e.target.value ? Number(e.target.value) : null)}
              style={{
                width: '100%',
                padding: '0.78rem 0.85rem',
                borderRadius: 12,
                border: '1px solid #dbe3ee',
                fontSize: '0.92rem',
                outline: 'none',
                background: '#fff',
              }}
            >
              <option value="">Усі групи</option>
              {visibleGroups.map((group) => (
                <option key={group.id} value={group.id}>{group.title}</option>
              ))}
            </select>
          </div>
        </div>

        <div style={{ padding: '0.875rem 1rem 1rem', overflowY: 'auto' }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: '#94a3b8', letterSpacing: '0.08em', textTransform: 'uppercase', padding: '0 0.5rem 0.65rem' }}>
            {normalizedSearch || hasFilters ? 'Результати пошуку' : 'Нещодавно обрані'}
          </div>

          {loading ? (
            <div style={{ padding: '1.5rem 0.5rem', color: '#64748b', fontSize: '0.95rem' }}>Пошук учнів...</div>
          ) : studentsToShow.length === 0 ? (
            <div style={{ padding: '1.5rem 0.5rem', color: '#94a3b8', fontSize: '0.95rem' }}>
              {normalizedSearch || hasFilters ? 'Учнів не знайдено. Спробуйте змінити запит або фільтри.' : 'Ще немає нещодавно обраних учнів.'}
            </div>
          ) : (
            <div style={{ display: 'grid', gap: 8 }}>
              {studentsToShow.map((student) => (
                <button
                  key={student.id}
                  type="button"
                  onClick={() => onSelect(student)}
                  disabled={preparingStudentId === student.id}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 12,
                    width: '100%',
                    padding: '0.9rem 1rem',
                    borderRadius: 14,
                    border: '1px solid #e5e7eb',
                    background: '#fff',
                    cursor: preparingStudentId === student.id ? 'wait' : 'pointer',
                    textAlign: 'left',
                  }}
                >
                  <div
                    style={{
                      width: 42,
                      height: 42,
                      borderRadius: '50%',
                      background: student.photo ? 'transparent' : '#dbeafe',
                      color: '#2563eb',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      flexShrink: 0,
                      fontWeight: 700,
                      overflow: 'hidden',
                    }}
                  >
                    {student.photo ? (
                      <img
                        src={student.photo}
                        alt={student.full_name}
                        style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                      />
                    ) : (
                      student.full_name.trim().charAt(0).toUpperCase()
                    )}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: '0.95rem', fontWeight: 600, color: '#111827', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {student.full_name}
                    </div>
                    <div style={{ fontSize: '0.82rem', color: '#6b7280', marginTop: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {student.parent_phone || student.parent_name || 'Без додаткових даних'}
                    </div>
                    {!!student.groups?.length && (
                      <div style={{ fontSize: '0.77rem', color: '#94a3b8', marginTop: 4, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {student.groups.slice(0, 2).map((group) => group.title).join(' · ')}
                        {student.groups.length > 2 ? ` +${student.groups.length - 2}` : ''}
                      </div>
                    )}
                  </div>
                  <div style={{ fontSize: '0.82rem', color: '#2563eb', fontWeight: 600, flexShrink: 0 }}>
                    {preparingStudentId === student.id ? 'Підготовка...' : 'Обрати'}
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>

        <div style={{ display: 'flex', justifyContent: 'flex-end', padding: '0 1rem 1rem' }}>
          <button type="button" className="btn btn-secondary" onClick={onClose}>
            Скасувати
          </button>
        </div>
      </div>
    </div>
  );
}
export default function MaterialsPage() {
  const { openMediaViewer } = useMediaViewer();
  const { user } = useUser();
  const [topics, setTopics] = useState<Topic[]>([]);
  const [lessonCourses, setLessonCourses] = useState<LessonCourseNode[]>([]);
  const [files, setFiles] = useState<BrowserFile[]>([]);
  const [source, setSource] = useState<SourceType>('telegram');
  const [selectedTopicId, setSelectedTopicId] = useState<number | null>(null);
  const [selectedLessonId, setSelectedLessonId] = useState<number | null>(null);
  const [selectedLessonGroupId, setSelectedLessonGroupId] = useState<number | null>(null);
  const [selectedLessonCourseId, setSelectedLessonCourseId] = useState<number | null>(null);
  const [expandedNodes, setExpandedNodes] = useState<Record<string, boolean>>({});
  const [search, setSearch] = useState('');
  const [searchInput, setSearchInput] = useState('');
  const [filterType, setFilterType] = useState<FilterType>('all');
  const [viewMode, setViewMode] = useState<ViewMode>('grid');
  const [sortType, setSortType] = useState<SortType>('newest');
  const [loading, setLoading] = useState(false);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const sentinelRef = useRef<HTMLDivElement>(null);
  const [editingTopicId, setEditingTopicId] = useState<number | null>(null);
  const [editingName, setEditingName] = useState('');
  const [deletingId, setDeletingId] = useState<number | null>(null);
  const [toast, setToast] = useState<{ type: 'success' | 'error'; message: string } | null>(null);
  const [avatarSourceFile, setAvatarSourceFile] = useState<BrowserFile | null>(null);
  const [avatarPickerOpen, setAvatarPickerOpen] = useState(false);
  const [avatarCropOpen, setAvatarCropOpen] = useState(false);
  const [avatarCropSrc, setAvatarCropSrc] = useState<string | null>(null);
  const [avatarSelectedStudent, setAvatarSelectedStudent] = useState<StudentSearchOption | null>(null);
  const [avatarStudentSearch, setAvatarStudentSearch] = useState('');
  const [avatarSearchResults, setAvatarSearchResults] = useState<StudentSearchOption[]>([]);
  const [avatarSearchLoading, setAvatarSearchLoading] = useState(false);
  const [avatarPreparingStudentId, setAvatarPreparingStudentId] = useState<number | null>(null);
  const [avatarSaving, setAvatarSaving] = useState(false);
  const [recentAvatarStudents, setRecentAvatarStudents] = useState<StudentSearchOption[]>([]);
  const [avatarCourseOptions, setAvatarCourseOptions] = useState<CourseFilterOption[]>([]);
  const [avatarGroupOptions, setAvatarGroupOptions] = useState<GroupFilterOption[]>([]);
  const [avatarSelectedCourseId, setAvatarSelectedCourseId] = useState<number | null>(null);
  const [avatarSelectedGroupId, setAvatarSelectedGroupId] = useState<number | null>(null);
  const [sidebarWidth, setSidebarWidth] = useState(MATERIALS_SIDEBAR_MIN);
  const [isResizingSidebar, setIsResizingSidebar] = useState(false);
  const searchTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const avatarSearchTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const sidebarResizeStartRef = useRef<{ startX: number; startWidth: number } | null>(null);

  const loadTopics = useCallback(async () => {
    const res = await fetch('/api/media/topics');
    if (res.ok) setTopics(await res.json());
  }, []);

  const loadLessonFolders = useCallback(async () => {
    const res = await fetch('/api/media/lesson-folders');
    if (!res.ok) return;
    const data = await res.json();
    const courses: LessonCourseNode[] = data.courses || [];
    setLessonCourses(courses);
    setExpandedNodes((prev) => {
      const next = { ...prev };
      for (const course of courses) {
        const courseKey = String(course.id ?? course.title);
        if (typeof next[courseKey] === 'undefined') next[courseKey] = true;
        for (const group of course.groups) {
          const groupKey = `${courseKey}:${String(group.id ?? group.title)}`;
          if (typeof next[groupKey] === 'undefined') next[groupKey] = false;
        }
      }
      return next;
    });
  }, []);

  const loadFiles = useCallback(async (targetPage = 1) => {
    if (targetPage === 1) setLoading(true);
    else setLoadingMore(true);
    try {
      if (source === 'telegram') {
        const params = new URLSearchParams();
        params.set('page', String(targetPage));
        if (selectedTopicId) params.set('topic_id', String(selectedTopicId));
        if (search) params.set('search', search);
        const res = await fetch(`/api/media/files?${params.toString()}`);
        if (!res.ok) return;
        const data = await res.json();
        const newFiles = (data.files || []).map((file: BrowserFile) => ({ ...file, source: 'telegram' as const }));
        setFiles((prev) => targetPage === 1 ? newFiles : [...prev, ...newFiles]);
        setHasMore(newFiles.length === 50);
      } else {
        const params = new URLSearchParams();
        params.set('page', String(targetPage));
        if (selectedLessonId) params.set('lesson_id', String(selectedLessonId));
        else if (selectedLessonGroupId) params.set('group_id', String(selectedLessonGroupId));
        else if (selectedLessonCourseId) params.set('course_id', String(selectedLessonCourseId));
        if (search) params.set('search', search);
        const res = await fetch(`/api/media/lesson-files?${params.toString()}`);
        if (!res.ok) return;
        const data = await res.json();
        const newFiles = data.files || [];
        setFiles((prev) => targetPage === 1 ? newFiles : [...prev, ...newFiles]);
        setHasMore(newFiles.length === 50);
      }
    } finally {
      if (targetPage === 1) setLoading(false);
      else setLoadingMore(false);
    }
  }, [source, search, selectedTopicId, selectedLessonId, selectedLessonGroupId, selectedLessonCourseId]);

  useEffect(() => {
    loadTopics();
    loadLessonFolders();
  }, [loadLessonFolders, loadTopics]);

  useEffect(() => {
    if (typeof window === 'undefined') return;

    const stored = window.localStorage.getItem(MATERIALS_SIDEBAR_WIDTH_KEY);
    if (!stored) return;

    const parsed = Number(stored);
    if (!Number.isNaN(parsed)) {
      setSidebarWidth(Math.max(MATERIALS_SIDEBAR_MIN, Math.min(MATERIALS_SIDEBAR_MAX, parsed)));
    }
  }, []);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    window.localStorage.setItem(MATERIALS_SIDEBAR_WIDTH_KEY, String(sidebarWidth));
  }, [sidebarWidth]);

  useEffect(() => {
    if (!avatarPickerOpen) {
      return;
    }

    const loadPickerFilters = async () => {
      try {
        const [coursesRes, groupsRes] = await Promise.all([
          fetch('/api/courses?simple=true'),
          fetch('/api/groups?basic=true'),
        ]);

        if (coursesRes.ok) {
          const data = await coursesRes.json();
          setAvatarCourseOptions(data.courses || []);
        }

        if (groupsRes.ok) {
          const data = await groupsRes.json();
          setAvatarGroupOptions(data.groups || []);
        }
      } catch (error) {
        console.error('Failed to load avatar picker filters:', error);
      }
    };

    if (avatarCourseOptions.length === 0 || avatarGroupOptions.length === 0) {
      loadPickerFilters();
    }
  }, [avatarCourseOptions.length, avatarGroupOptions.length, avatarPickerOpen]);

  useEffect(() => {
    if (avatarSelectedCourseId === null) {
      return;
    }

    const stillValid = avatarGroupOptions.some(
      (group) => group.id === avatarSelectedGroupId && group.course_id === avatarSelectedCourseId
    );

    if (!stillValid && avatarSelectedGroupId !== null) {
      setAvatarSelectedGroupId(null);
    }
  }, [avatarGroupOptions, avatarSelectedCourseId, avatarSelectedGroupId]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    try {
      const raw = window.localStorage.getItem(RECENT_AVATAR_STUDENTS_KEY);
      if (!raw) return;
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) {
        const normalized = parsed
          .slice(0, 6)
          .filter((student: any) => student && typeof student.id === 'number' && typeof student.full_name === 'string')
          .map((student: any) => ({
            id: student.id,
            full_name: student.full_name,
            parent_phone: student.parent_phone || null,
            parent_name: student.parent_name || null,
            photo: student.photo || null,
            groups: Array.isArray(student.groups) ? student.groups : [],
          }));
        setRecentAvatarStudents(normalized);
      }
    } catch (error) {
      console.warn('Failed to parse recent avatar students:', error);
    }
  }, []);

  useEffect(() => {
    if (!avatarPickerOpen || recentAvatarStudents.length === 0) {
      return;
    }

    const missingPhotoIds = recentAvatarStudents
      .filter((student) => !student.photo)
      .map((student) => student.id);

    if (missingPhotoIds.length === 0) {
      return;
    }

    let cancelled = false;

    const hydrateRecentStudents = async () => {
      try {
        const hydrated = await Promise.all(
          missingPhotoIds.map(async (studentId) => {
            const response = await fetch(`/api/students/${studentId}?withGroups=true`);
            if (!response.ok) {
              return null;
            }
            const data = await response.json();
            const student = data?.student;
            if (!student) {
              return null;
            }
            return {
              id: student.id,
              full_name: student.full_name,
              parent_phone: student.parent_phone || null,
              parent_name: student.parent_name || null,
              photo: student.photo || null,
              groups: student.groups || [],
            } satisfies StudentSearchOption;
          })
        );

        if (cancelled) {
          return;
        }

        const nextById = new Map(hydrated.filter(Boolean).map((student) => [student!.id, student!]));
        if (nextById.size === 0) {
          return;
        }

        setRecentAvatarStudents((prev) =>
          prev.map((student) => nextById.get(student.id) ?? student)
        );
      } catch (error) {
        console.warn('Failed to hydrate recent avatar students:', error);
      }
    };

    hydrateRecentStudents();

    return () => {
      cancelled = true;
    };
  }, [avatarPickerOpen, recentAvatarStudents]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    window.localStorage.setItem(RECENT_AVATAR_STUDENTS_KEY, JSON.stringify(recentAvatarStudents.slice(0, 6)));
  }, [recentAvatarStudents]);

  useEffect(() => {
    if (!toast) return;
    const timer = window.setTimeout(() => setToast(null), 2600);
    return () => window.clearTimeout(timer);
  }, [toast]);

  useEffect(() => {
    if (!avatarPickerOpen) {
      setAvatarSearchLoading(false);
      return;
    }

    const query = avatarStudentSearch.trim();
    const hasFilters = avatarSelectedCourseId !== null || avatarSelectedGroupId !== null;
    if (avatarSearchTimer.current) {
      clearTimeout(avatarSearchTimer.current);
    }

    if (query.length < 2 && !hasFilters) {
      setAvatarSearchResults([]);
      setAvatarSearchLoading(false);
      return;
    }

    avatarSearchTimer.current = setTimeout(async () => {
      setAvatarSearchLoading(true);
      try {
        const params = new URLSearchParams({
          withGroups: 'true',
          limit: '24',
        });
        if (query.length >= 2) {
          params.set('search', query);
        }
        if (avatarSelectedCourseId !== null) {
          params.set('courseId', String(avatarSelectedCourseId));
        }
        if (avatarSelectedGroupId !== null) {
          params.set('groupId', String(avatarSelectedGroupId));
        }

        const res = await fetch(`/api/students?${params.toString()}`);
        if (!res.ok) {
          throw new Error('Failed to search students');
        }
        const data = await res.json();
        setAvatarSearchResults((data.students || []).map((student: any) => ({
          id: student.id,
          full_name: student.full_name,
          parent_phone: student.parent_phone || null,
          parent_name: student.parent_name || null,
          photo: student.photo || null,
          groups: student.groups || [],
        })));
      } catch (error) {
        console.error('Failed to search students for avatar:', error);
        setAvatarSearchResults([]);
      } finally {
        setAvatarSearchLoading(false);
      }
    }, 220);

    return () => {
      if (avatarSearchTimer.current) {
        clearTimeout(avatarSearchTimer.current);
      }
    };
  }, [avatarPickerOpen, avatarSelectedCourseId, avatarSelectedGroupId, avatarStudentSearch]);

  useEffect(() => {
    if (!isResizingSidebar) return;

    const handleMouseMove = (event: MouseEvent) => {
      const start = sidebarResizeStartRef.current;
      if (!start) return;

      const nextWidth = start.startWidth + (event.clientX - start.startX);
      setSidebarWidth(Math.max(MATERIALS_SIDEBAR_MIN, Math.min(MATERIALS_SIDEBAR_MAX, nextWidth)));
    };

    const stopResize = () => {
      setIsResizingSidebar(false);
      sidebarResizeStartRef.current = null;
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
    };

    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';
    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', stopResize);

    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', stopResize);
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
    };
  }, [isResizingSidebar]);

  useEffect(() => {
    setPage(1);
    setFiles([]);
    setHasMore(true);
    loadFiles(1);
  }, [loadFiles]);

  useEffect(() => {
    if (page === 1) return;
    loadFiles(page);
  }, [page, loadFiles]);

  useEffect(() => {
    if (!sentinelRef.current || loading || loadingMore || !hasMore) return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting) {
          setPage((prev) => prev + 1);
        }
      },
      { rootMargin: '200px' }
    );
    observer.observe(sentinelRef.current);
    return () => observer.disconnect();
  }, [loading, loadingMore, hasMore]);

  function handleSearchInput(value: string) {
    setSearchInput(value);
    if (searchTimer.current) clearTimeout(searchTimer.current);
    searchTimer.current = setTimeout(() => setSearch(value), 350);
  }

  function startSidebarResize(event: React.MouseEvent<HTMLDivElement>) {
    sidebarResizeStartRef.current = {
      startX: event.clientX,
      startWidth: sidebarWidth,
    };
    setIsResizingSidebar(true);
  }

  async function renameTopic(id: number, name: string) {
    await fetch('/api/media/topics', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, name }),
    });
    setEditingTopicId(null);
    loadTopics();
    loadFiles(1);
  }

  async function deleteFile(file: BrowserFile) {
    const isLessonMedia = file.source === 'lesson';
    const message = isLessonMedia
      ? 'Видалити це медіа заняття? Воно буде видалене і з CRM, і з Google Drive.'
      : 'Видалити файл? Він буде видалений з Google Drive.';

    if (!confirm(message)) return;

    setDeletingId(file.id);
    await fetch(isLessonMedia ? `/api/media/lesson-files/${file.id}` : `/api/media/files/${file.id}`, { method: 'DELETE' });
    setDeletingId(null);

    if (isLessonMedia) {
      loadFiles(1);
      loadLessonFolders();
    } else {
      loadFiles(1);
      loadTopics();
    }
  }

  function closeAvatarFlow() {
    setAvatarPickerOpen(false);
    setAvatarCropOpen(false);
    setAvatarCropSrc(null);
    setAvatarSourceFile(null);
    setAvatarSelectedStudent(null);
    setAvatarPreparingStudentId(null);
    setAvatarSaving(false);
    setAvatarStudentSearch('');
    setAvatarSelectedCourseId(null);
    setAvatarSelectedGroupId(null);
    setAvatarSearchResults([]);
  }

  function startAvatarFlow(file: BrowserFile) {
    if (!canAssignAvatar(file)) {
      return;
    }

    setAvatarSourceFile(file);
    setAvatarSelectedStudent(null);
    setAvatarStudentSearch('');
    setAvatarSelectedCourseId(null);
    setAvatarSelectedGroupId(null);
    setAvatarSearchResults([]);
    setAvatarPickerOpen(true);
  }

  async function prepareAvatarCrop(student: StudentSearchOption) {
    if (!avatarSourceFile) {
      return;
    }

    setAvatarPreparingStudentId(student.id);
    try {
      const response = await fetch(`/api/lesson-media/${encodeURIComponent(avatarSourceFile.drive_file_id)}`);
      if (!response.ok) {
        throw new Error('Failed to load lesson image');
      }
      const blob = await response.blob();
      const dataUrl = await blobToDataUrl(blob);
      setAvatarSelectedStudent(student);
      setAvatarCropSrc(dataUrl);
      setAvatarPickerOpen(false);
      setAvatarCropOpen(true);
    } catch (error) {
      console.error('Failed to prepare avatar crop source:', error);
      setToast({ type: 'error', message: 'Не вдалося підготувати фото для аватарки' });
    } finally {
      setAvatarPreparingStudentId(null);
    }
  }

  async function applyStudentAvatar(croppedDataUrl: string) {
    if (!avatarSelectedStudent) {
      return;
    }

    setAvatarSaving(true);
    try {
      const response = await fetch(`/api/students/${avatarSelectedStudent.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ photo: croppedDataUrl }),
      });

      if (!response.ok) {
        const data = await response.json().catch(() => ({ error: 'Не вдалося оновити аватарку' }));
        throw new Error(data.error || 'Не вдалося оновити аватарку');
      }

      setRecentAvatarStudents((prev) => {
        const nextStudent = {
          ...avatarSelectedStudent,
          photo: croppedDataUrl,
        };
        const next = [nextStudent, ...prev.filter((item) => item.id !== avatarSelectedStudent.id)];
        return next.slice(0, 6);
      });

      setToast({ type: 'success', message: `Аватарку оновлено для ${avatarSelectedStudent.full_name}` });
      closeAvatarFlow();
    } catch (error) {
      console.error('Failed to save student avatar from lesson photo:', error);
      setToast({
        type: 'error',
        message: error instanceof Error ? error.message : 'Не вдалося зберегти аватарку',
      });
    } finally {
      setAvatarSaving(false);
    }
  }

  function openLightbox(file: BrowserFile) {
    const visualFiles = filteredFiles.filter((item) => isPreviewable(item.file_type, item.file_name));
    const idx = visualFiles.findIndex((item) => item.id === file.id);
    if (idx !== -1) {
      openMediaViewer(visualFiles, idx, {
        renderHeaderActions: (viewerFile) => {
          const currentFile = viewerFile as BrowserFile;
          if (!canAssignAvatar(currentFile)) {
            return null;
          }

          return (
            <button
              type="button"
              onClick={() => startAvatarFlow(currentFile)}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 6,
                height: 28,
                padding: '0 10px',
                borderRadius: 8,
                border: '1px solid #dbeafe',
                background: '#eff6ff',
                color: '#2563eb',
                fontSize: 12,
                fontWeight: 600,
                cursor: 'pointer',
                flexShrink: 0,
              }}
            >
              <Sparkles size={13} />
              Зробити аватар
            </button>
          );
        },
      });
    }
  }

  const totalTelegramFiles = topics.reduce((sum, topic) => sum + topic.file_count, 0);
  const totalLessonFiles = lessonCourses.reduce((sum, course) => sum + course.fileCount, 0);
  const selectedTopic = topics.find((topic) => topic.id === selectedTopicId);
  const selectedLessonScope = findLessonSelection(lessonCourses, selectedLessonId, selectedLessonGroupId, selectedLessonCourseId);
  const filteredFiles = sortFiles(files.filter((file) => filterType === 'all' || effectiveCategory(file) === filterType), sortType);

  const filterTabs: { key: FilterType; label: string; icon: React.ReactNode }[] = [
    { key: 'all', label: 'Усі', icon: <File size={14} /> },
    { key: 'photo', label: 'Фото', icon: <Image size={14} /> },
    { key: 'video', label: 'Відео', icon: <Video size={14} /> },
    { key: 'document', label: 'Документи', icon: <FileText size={14} /> },
    { key: 'audio', label: 'Аудіо', icon: <Music size={14} /> },
  ];

  if (!user) return null;

  return (
    <div>
      <StudentAvatarPickerModal
        isOpen={avatarPickerOpen}
        search={avatarStudentSearch}
        onSearchChange={setAvatarStudentSearch}
        selectedCourseId={avatarSelectedCourseId}
        onCourseChange={setAvatarSelectedCourseId}
        courseOptions={avatarCourseOptions}
        selectedGroupId={avatarSelectedGroupId}
        onGroupChange={setAvatarSelectedGroupId}
        groupOptions={avatarGroupOptions}
        searchResults={avatarSearchResults}
        recentStudents={recentAvatarStudents}
        loading={avatarSearchLoading}
        preparingStudentId={avatarPreparingStudentId}
        onClose={closeAvatarFlow}
        onSelect={prepareAvatarCrop}
      />

      <StudentAvatarCropModal
        isOpen={avatarCropOpen}
        imageSrc={avatarCropSrc}
        fileName={avatarSourceFile?.file_name || 'lesson-photo'}
        title={avatarSelectedStudent ? `Аватарка для ${avatarSelectedStudent.full_name}` : 'Обрізати фото учня'}
        description="Обріжте фото так, як воно має виглядати в аватарці учня."
        onCancel={() => {
          setAvatarCropOpen(false);
          setAvatarCropSrc(null);
          setAvatarPickerOpen(true);
        }}
        onApply={(croppedDataUrl) => void applyStudentAvatar(croppedDataUrl)}
      />

      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 24, flexWrap: 'wrap' }}>
        <FolderOpen size={26} color="#3b82f6" />
        <h1 style={{ fontSize: 22, fontWeight: 700, color: '#1e293b', margin: 0 }}>Файли</h1>
        <span style={{ fontSize: 13, color: '#94a3b8', marginLeft: 4 }}>{source === 'telegram' ? totalTelegramFiles : totalLessonFiles} файлів</span>
      </div>

      <div style={{ display: 'flex', gap: 12, background: '#f8fafc', borderRadius: 14, padding: 4, width: 'fit-content', marginBottom: 20 }}>
        <button type="button" onClick={() => setSource('telegram')} style={{ padding: '8px 14px', border: 'none', borderRadius: 10, cursor: 'pointer', background: source === 'telegram' ? '#fff' : 'transparent', color: source === 'telegram' ? '#1e293b' : '#64748b', fontWeight: 600, boxShadow: source === 'telegram' ? '0 1px 4px rgba(0,0,0,0.08)' : 'none' }}>Файли з Telegram</button>
        <button type="button" onClick={() => setSource('lesson')} style={{ padding: '8px 14px', border: 'none', borderRadius: 10, cursor: 'pointer', background: source === 'lesson' ? '#fff' : 'transparent', color: source === 'lesson' ? '#1e293b' : '#64748b', fontWeight: 600, boxShadow: source === 'lesson' ? '0 1px 4px rgba(0,0,0,0.08)' : 'none' }}>Медіа занять</button>
      </div>
      <div style={{ display: 'flex', gap: 0, alignItems: 'stretch' }}>
        <div style={{ width: sidebarWidth, minWidth: sidebarWidth, flexShrink: 0, background: '#fff', borderRadius: 16, border: '1px solid #f0f0f0', padding: '10px 8px', boxShadow: '0 1px 4px rgba(0,0,0,0.04)', overflow: 'hidden' }}>
          {source === 'telegram' ? (
            <>
              <div style={{ fontSize: 11, fontWeight: 700, color: '#94a3b8', padding: '4px 12px 8px', letterSpacing: '0.08em', textTransform: 'uppercase' }}>Теми</div>
              <button onClick={() => setSelectedTopicId(null)} style={{ display: 'flex', alignItems: 'center', gap: 8, width: '100%', padding: '9px 12px', borderRadius: 10, border: 'none', cursor: 'pointer', textAlign: 'left', background: selectedTopicId === null ? '#e3f2fd' : 'transparent', color: selectedTopicId === null ? '#1565c0' : '#374151', fontWeight: selectedTopicId === null ? 600 : 400, fontSize: 13 }}>
                <FolderOpen size={15} />
                Усі файли
                <span style={{ marginLeft: 'auto', fontSize: 12, color: '#94a3b8' }}>{totalTelegramFiles}</span>
              </button>
              {topics.map((topic) => (
                <div key={topic.id}>
                  {editingTopicId === topic.id ? (
                    <form onSubmit={(e) => { e.preventDefault(); renameTopic(topic.id, editingName); }} style={{ padding: '4px 8px' }}>
                      <input autoFocus value={editingName} onChange={(e) => setEditingName(e.target.value)} onBlur={() => setEditingTopicId(null)} style={{ width: '100%', padding: '6px 8px', borderRadius: 8, border: '1px solid #3b82f6', fontSize: 13, outline: 'none' }} />
                    </form>
                  ) : (
                    <button onClick={() => setSelectedTopicId(topic.id)} onDoubleClick={() => { setEditingTopicId(topic.id); setEditingName(topic.name); }} title="Двічі клікніть, щоб перейменувати" style={{ display: 'flex', alignItems: 'center', gap: 8, width: '100%', padding: '9px 12px', borderRadius: 10, border: 'none', cursor: 'pointer', textAlign: 'left', background: selectedTopicId === topic.id ? '#e3f2fd' : 'transparent', color: selectedTopicId === topic.id ? '#1565c0' : '#374151', fontWeight: selectedTopicId === topic.id ? 600 : 400, fontSize: 13 }}>
                      <FolderOpen size={15} />
                      <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{topic.name}</span>
                      <span style={{ fontSize: 11, color: '#94a3b8', flexShrink: 0, background: '#f1f5f9', padding: '1px 6px', borderRadius: 10 }}>{topic.file_count}</span>
                    </button>
                  )}
                </div>
              ))}
            </>
          ) : (
            <>
              <div style={{ fontSize: 11, fontWeight: 700, color: '#94a3b8', padding: '4px 12px 8px', letterSpacing: '0.08em', textTransform: 'uppercase' }}>Фото занять</div>
              <button onClick={() => { setSelectedLessonId(null); setSelectedLessonGroupId(null); setSelectedLessonCourseId(null); }} style={{ display: 'flex', alignItems: 'center', gap: 8, width: '100%', padding: '9px 12px', borderRadius: 10, border: 'none', cursor: 'pointer', textAlign: 'left', background: selectedLessonId === null && selectedLessonGroupId === null && selectedLessonCourseId === null ? '#e3f2fd' : 'transparent', color: selectedLessonId === null && selectedLessonGroupId === null && selectedLessonCourseId === null ? '#1565c0' : '#374151', fontWeight: selectedLessonId === null && selectedLessonGroupId === null && selectedLessonCourseId === null ? 600 : 400, fontSize: 13 }}>
                <FolderOpen size={15} />
                Усі медіа занять
                <span style={{ marginLeft: 'auto', fontSize: 12, color: '#94a3b8' }}>{totalLessonFiles}</span>
              </button>
              {lessonCourses.map((course) => {
                const courseKey = String(course.id ?? course.title);
                const courseExpanded = expandedNodes[courseKey] ?? true;
                const courseSelected = selectedLessonCourseId === course.id && selectedLessonGroupId === null && selectedLessonId === null;
                return (
                  <div key={courseKey}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '3px 4px' }}>
                      <button
                        type="button"
                        onClick={() => setExpandedNodes((prev) => ({ ...prev, [courseKey]: !courseExpanded }))}
                        aria-label={courseExpanded ? 'Згорнути курс' : 'Розгорнути курс'}
                        style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: 24, height: 24, border: 'none', borderRadius: 6, background: 'transparent', cursor: 'pointer', color: '#475569', flexShrink: 0 }}
                      >
                        {courseExpanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                      </button>
                      <button
                        type="button"
                        onClick={() => { setSelectedLessonCourseId(course.id); setSelectedLessonGroupId(null); setSelectedLessonId(null); }}
                        style={{ display: 'flex', alignItems: 'center', gap: 8, width: '100%', minWidth: 0, padding: '7px 8px', borderRadius: 10, border: 'none', background: courseSelected ? '#e3f2fd' : 'transparent', color: courseSelected ? '#1565c0' : '#1e293b', cursor: 'pointer', textAlign: 'left', fontSize: 13, fontWeight: 600 }}
                        title={course.title}
                      >
                        <BookOpen size={15} />
                        <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{course.title}</span>
                        <span style={{ fontSize: 11, color: '#94a3b8', flexShrink: 0 }}>{course.fileCount}</span>
                      </button>
                    </div>
                    {courseExpanded && (
                      <div style={{ paddingLeft: 10 }}>
                        {course.groups.map((group) => {
                          const groupKey = `${courseKey}:${String(group.id ?? group.title)}`;
                          const groupExpanded = expandedNodes[groupKey] ?? false;
                          const groupSelected = selectedLessonGroupId === group.id && selectedLessonId === null;
                          return (
                            <div key={groupKey}>
                              <div style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '2px 4px' }}>
                                <button
                                  type="button"
                                  onClick={() => setExpandedNodes((prev) => ({ ...prev, [groupKey]: !groupExpanded }))}
                                  aria-label={groupExpanded ? 'Згорнути групу' : 'Розгорнути групу'}
                                  style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: 22, height: 22, border: 'none', borderRadius: 6, background: 'transparent', cursor: 'pointer', color: '#64748b', flexShrink: 0 }}
                                >
                                  {groupExpanded ? <ChevronDown size={13} /> : <ChevronRight size={13} />}
                                </button>
                                <button
                                  type="button"
                                  onClick={() => { setSelectedLessonCourseId(course.id); setSelectedLessonGroupId(group.id); setSelectedLessonId(null); }}
                                  style={{ display: 'flex', alignItems: 'center', gap: 8, width: '100%', minWidth: 0, padding: '7px 8px', borderRadius: 10, border: 'none', background: groupSelected ? '#e3f2fd' : 'transparent', color: groupSelected ? '#1565c0' : '#334155', cursor: 'pointer', textAlign: 'left', fontSize: 12.5, fontWeight: groupSelected ? 600 : 500 }}
                                  title={group.title}
                                >
                                  <Users size={14} />
                                  <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{group.title}</span>
                                  <span style={{ fontSize: 11, color: '#94a3b8', flexShrink: 0 }}>{group.fileCount}</span>
                                </button>
                              </div>
                              {groupExpanded && (
                                <div style={{ paddingLeft: 14 }}>
                                  {group.lessons.map((lesson) => (
                                    <button key={lesson.id} type="button" onClick={() => { setSelectedLessonCourseId(course.id); setSelectedLessonGroupId(group.id); setSelectedLessonId(lesson.id); }} style={{ display: 'flex', alignItems: 'center', gap: 8, width: '100%', padding: '7px 12px', borderRadius: 10, border: 'none', background: selectedLessonId === lesson.id ? '#e3f2fd' : 'transparent', color: selectedLessonId === lesson.id ? '#1565c0' : '#475569', cursor: 'pointer', textAlign: 'left', fontSize: 12, fontWeight: selectedLessonId === lesson.id ? 600 : 400 }} title={lesson.folderName}>
                                      <FolderOpen size={12} />
                                      <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{lesson.folderName}</span>
                                      <span style={{ fontSize: 11, color: '#94a3b8' }}>{lesson.fileCount}</span>
                                    </button>
                                  ))}
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                );
              })}
            </>
          )}
        </div>
        <div
          role="separator"
          aria-orientation="vertical"
          aria-label="Змінити ширину панелі папок"
          onMouseDown={startSidebarResize}
          style={{
            width: 18,
            margin: '0 10px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            cursor: 'col-resize',
            flexShrink: 0,
          }}
        >
          <div
            style={{
              width: 4,
              height: '100%',
              maxHeight: 420,
              borderRadius: 999,
              background: isResizingSidebar ? '#3b82f6' : '#e2e8f0',
              transition: 'background 0.15s ease',
            }}
          />
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14, flexWrap: 'wrap' }}>
            <span style={{ fontSize: 15, fontWeight: 600, color: '#1e293b', marginRight: 4 }}>
              {source === 'telegram' ? (selectedTopic ? selectedTopic.name : 'Усі файли') : selectedLessonScope.title}
            </span>

            {source === 'lesson' && selectedLessonScope.driveUrl && (
              <a
                href={selectedLessonScope.driveUrl}
                target="_blank"
                rel="noopener noreferrer"
                title="Відкрити папку на Drive"
                aria-label="Відкрити папку на Drive"
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  width: 28,
                  height: 28,
                  borderRadius: 8,
                  color: '#2563eb',
                  textDecoration: 'none',
                  flexShrink: 0,
                }}
              >
                <ExternalLink size={16} />
              </a>
            )}

            <div style={{ display: 'flex', gap: 4, background: '#f8fafc', borderRadius: 10, padding: 4 }}>
              {filterTabs.map((tab) => (
                <button key={tab.key} onClick={() => setFilterType(tab.key)} style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '5px 10px', borderRadius: 7, border: 'none', cursor: 'pointer', fontSize: 13, fontWeight: filterType === tab.key ? 600 : 400, background: filterType === tab.key ? '#fff' : 'transparent', color: filterType === tab.key ? '#1e293b' : '#64748b', boxShadow: filterType === tab.key ? '0 1px 3px rgba(0,0,0,0.08)' : 'none', transition: 'all 0.15s' }}>
                  {tab.icon}
                  {tab.label}
                </button>
              ))}
            </div>

            <div style={{ flex: 1 }} />

            <div style={{ position: 'relative' }}>
              <Search size={15} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: '#94a3b8' }} />
              <input placeholder="Пошук..." value={searchInput} onChange={(e) => handleSearchInput(e.target.value)} style={{ paddingLeft: 32, paddingRight: 12, paddingTop: 7, paddingBottom: 7, borderRadius: 10, border: '1px solid #e5e7eb', fontSize: 13, outline: 'none', width: 180 }} />
            </div>

            <select value={sortType} onChange={(e) => setSortType(e.target.value as SortType)} style={{ padding: '7px 12px', borderRadius: 10, border: '1px solid #e5e7eb', fontSize: 13, color: '#334155', background: '#fff', outline: 'none' }}>
              <option value="newest">Спочатку новіші</option>
              <option value="oldest">Спочатку старіші</option>
              <option value="name">За назвою</option>
              <option value="size-desc">Розмір: більші</option>
              <option value="size-asc">Розмір: менші</option>
            </select>

            <div style={{ display: 'flex', background: '#f8fafc', borderRadius: 10, padding: 3, gap: 2 }}>
              <button onClick={() => setViewMode('grid')} style={{ padding: '5px 8px', borderRadius: 7, border: 'none', cursor: 'pointer', background: viewMode === 'grid' ? '#fff' : 'transparent', color: viewMode === 'grid' ? '#1e293b' : '#94a3b8', boxShadow: viewMode === 'grid' ? '0 1px 3px rgba(0,0,0,0.08)' : 'none' }}>
                <LayoutGrid size={16} />
              </button>
              <button onClick={() => setViewMode('list')} style={{ padding: '5px 8px', borderRadius: 7, border: 'none', cursor: 'pointer', background: viewMode === 'list' ? '#fff' : 'transparent', color: viewMode === 'list' ? '#1e293b' : '#94a3b8', boxShadow: viewMode === 'list' ? '0 1px 3px rgba(0,0,0,0.08)' : 'none' }}>
                <LayoutList size={16} />
              </button>
            </div>
          </div>

          {!loading && filteredFiles.length > 0 && (
            <div style={{ fontSize: 12, color: '#94a3b8', marginBottom: 10 }}>
              {filteredFiles.length} файлів
            </div>
          )}

          {loading ? (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))', gap: 12 }}>
              {[...Array(8)].map((_, i) => (
                <div key={i} style={{ borderRadius: 12, background: '#f1f5f9', aspectRatio: '1', animation: 'pulse 1.5s ease-in-out infinite' }} />
              ))}
            </div>
          ) : filteredFiles.length === 0 ? (
            <div style={{ padding: '60px 0', textAlign: 'center', color: '#94a3b8' }}>
              <FolderOpen size={44} style={{ margin: '0 auto 12px', display: 'block', opacity: 0.25 }} />
              <div style={{ fontSize: 15, fontWeight: 500 }}>Файлів немає</div>
              {search && <div style={{ fontSize: 13, marginTop: 4 }}>Спробуйте змінити пошуковий запит</div>}
            </div>
          ) : viewMode === 'grid' ? (
            <GridView files={filteredFiles} showContextLabel={source === 'telegram' ? !selectedTopicId : selectedLessonId === null} onOpenLightbox={openLightbox} onDelete={deleteFile} onMakeAvatar={startAvatarFlow} deletingId={deletingId} />
          ) : (
            <ListView files={filteredFiles} showContextLabel={source === 'telegram' ? !selectedTopicId : selectedLessonId === null} onOpenLightbox={openLightbox} onDelete={deleteFile} onMakeAvatar={startAvatarFlow} deletingId={deletingId} />
          )}

          {loadingMore && (
            <div style={{ padding: '16px', textAlign: 'center', color: '#94a3b8', fontSize: '13px' }}>
              Завантажуємо ще…
            </div>
          )}
          <div ref={sentinelRef} style={{ height: '1px' }} />
        </div>
      </div>

      {toast && (
        <div
          style={{
            position: 'fixed',
            right: 24,
            bottom: 24,
            zIndex: 10060,
            padding: '0.85rem 1rem',
            borderRadius: 14,
            background: toast.type === 'success' ? '#059669' : '#dc2626',
            color: '#fff',
            fontSize: '0.95rem',
            fontWeight: 600,
            boxShadow: '0 18px 36px rgba(15, 23, 42, 0.18)',
          }}
        >
          {toast.message}
        </div>
      )}
    </div>
  );
}

function GridView({ files, showContextLabel, onOpenLightbox, onDelete, onMakeAvatar, deletingId }: {
  files: BrowserFile[];
  showContextLabel: boolean;
  onOpenLightbox: (f: BrowserFile) => void;
  onDelete: (file: BrowserFile) => void;
  onMakeAvatar: (file: BrowserFile) => void;
  deletingId: number | null;
}) {
  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(170px, 1fr))', gap: 12 }}>
      {files.map((file) => (
        <GridCard key={`${file.source || 'telegram'}-${file.id}`} file={file} showContextLabel={showContextLabel} onOpenLightbox={onOpenLightbox} onDelete={onDelete} onMakeAvatar={onMakeAvatar} deletingId={deletingId} />
      ))}
    </div>
  );
}

function GridCard({ file, showContextLabel, onOpenLightbox, onDelete, onMakeAvatar, deletingId }: {
  file: BrowserFile;
  showContextLabel: boolean;
  onOpenLightbox: (f: BrowserFile) => void;
  onDelete: (file: BrowserFile) => void;
  onMakeAvatar: (file: BrowserFile) => void;
  deletingId: number | null;
}) {
  const [hovered, setHovered] = useState(false);
  const visual = isPreviewable(file.file_type, file.file_name);

  return (
    <div onMouseEnter={() => setHovered(true)} onMouseLeave={() => setHovered(false)} style={{ borderRadius: 14, background: '#fff', border: '1px solid #f0f0f0', overflow: 'hidden', boxShadow: hovered ? '0 4px 16px rgba(0,0,0,0.1)' : '0 1px 4px rgba(0,0,0,0.04)', transition: 'all 0.2s', cursor: visual ? 'pointer' : 'default', position: 'relative' }}>
      <div onClick={() => visual && onOpenLightbox(file)} style={{ aspectRatio: '1', overflow: 'hidden', background: '#f8fafc', display: 'flex', alignItems: 'center', justifyContent: 'center', position: 'relative' }}>
        {visual ? (
          <>
            {isAudioType(file.file_type, file.file_name) ? (
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8, padding: 16 }}><div style={{ width: 52, height: 52, borderRadius: '50%', background: '#fffbeb', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Music size={26} color="#f59e0b" /></div><TypeBadge type={file.file_type} /></div>
            ) : (
              <>
                <img src={getFileThumb(file)} alt={file.file_name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }} />
                {file.file_type === 'video' && <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(0,0,0,0.2)' }}><div style={{ width: 36, height: 36, borderRadius: '50%', background: 'rgba(255,255,255,0.9)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Video size={18} color="#8b5cf6" /></div></div>}
              </>
            )}
            {hovered && <div style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.18)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><div style={{ width: 38, height: 38, borderRadius: '50%', background: 'rgba(255,255,255,0.92)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>{isAudioType(file.file_type, file.file_name) ? <Music size={18} color="#f59e0b" /> : <ExternalLink size={18} color="#3b82f6" />}</div></div>}
          </>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8, padding: 16 }}><FileTypeIcon type={file.file_type} size={36} /><TypeBadge type={file.file_type} /></div>
        )}
      </div>
      <div style={{ padding: '10px 12px 12px' }}>
        <div style={{ fontSize: 12, fontWeight: 500, color: '#1e293b', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', marginBottom: 4 }} title={file.file_name}>{file.file_name}</div>
        {showContextLabel && <div style={{ fontSize: 11, color: '#94a3b8', marginBottom: 4, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{file.source === 'lesson' ? `${file.group_title || ''}${file.group_title ? ' · ' : ''}${file.topic_name}` : file.topic_name}</div>}
        <div style={{ fontSize: 11, color: '#94a3b8' }}>{new Date(file.created_at).toLocaleDateString('uk-UA', { day: '2-digit', month: '2-digit', year: '2-digit' })}{file.file_size > 0 && ` · ${formatSize(file.file_size)}`}</div>
        <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 8 }}>
          <KebabMenu items={[
            ...(file.folder_url ? [{ label: 'Відкрити папку на Drive', icon: <FolderOpen size={14} />, href: file.folder_url }] : []),
            ...(canAssignAvatar(file) ? [{ label: 'Зробити аватар учня', icon: <Sparkles size={14} />, onClick: () => onMakeAvatar(file) }] : []),
            { label: 'Відкрити в Google Drive', icon: <ExternalLink size={14} />, href: file.drive_view_url },
            { label: 'Завантажити', icon: <Download size={14} />, href: file.drive_download_url },
            { label: deletingId === file.id ? 'Видалення...' : 'Видалити', icon: <Trash2 size={14} />, onClick: () => onDelete(file), danger: true },
          ]} />
        </div>
      </div>
    </div>
  );
}

function ListView({ files, showContextLabel, onOpenLightbox, onDelete, onMakeAvatar, deletingId }: {
  files: BrowserFile[];
  showContextLabel: boolean;
  onOpenLightbox: (f: BrowserFile) => void;
  onDelete: (file: BrowserFile) => void;
  onMakeAvatar: (file: BrowserFile) => void;
  deletingId: number | null;
}) {
  return (
    <div style={{ background: '#fff', borderRadius: 16, border: '1px solid #f0f0f0', overflow: 'hidden', boxShadow: '0 1px 4px rgba(0,0,0,0.04)' }}>
      {files.map((file, i) => {
        const visual = isPreviewable(file.file_type, file.file_name);
        return (
          <div key={`${file.source || 'telegram'}-${file.id}`} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 16px', borderBottom: i < files.length - 1 ? '1px solid #f8f9fa' : 'none' }}>
            <div onClick={() => visual && onOpenLightbox(file)} style={{ width: 44, height: 44, borderRadius: 10, overflow: 'hidden', background: '#f8fafc', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: visual ? 'pointer' : 'default', position: 'relative' }}>
              {isAudioType(file.file_type, file.file_name) ? (
                <Music size={22} color="#f59e0b" />
              ) : visual ? (
                <img src={getFileThumb(file, 100)} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }} />
              ) : (
                <FileTypeIcon type={file.file_type} size={22} />
              )}
              {file.file_type === 'video' && <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(0,0,0,0.2)' }}><Video size={14} color="#fff" /></div>}
        </div>

            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 14, fontWeight: 500, color: '#1e293b', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{file.file_name}</div>
              <div style={{ fontSize: 12, color: '#94a3b8', marginTop: 2, display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                <TypeBadge type={file.file_type} />
                {showContextLabel && <span>{file.source === 'lesson' ? `${file.group_title || ''}${file.group_title ? ' · ' : ''}${file.topic_name}` : `${file.topic_name} ·`}</span>}
                {file.uploaded_by_name && <span>{file.uploaded_by_name} ·</span>}
                <span>{formatDate(file.created_at)}</span>
                {file.file_size > 0 && <span>· {formatSize(file.file_size)}</span>}
              </div>
            </div>

            <KebabMenu items={[
              ...(file.folder_url ? [{ label: 'Відкрити папку на Drive', icon: <FolderOpen size={14} />, href: file.folder_url }] : []),
              ...(canAssignAvatar(file) ? [{ label: 'Зробити аватар учня', icon: <Sparkles size={14} />, onClick: () => onMakeAvatar(file) }] : []),
              { label: 'Відкрити в Google Drive', icon: <ExternalLink size={14} />, href: file.drive_view_url },
              { label: 'Завантажити', icon: <Download size={14} />, href: file.drive_download_url },
              { label: deletingId === file.id ? 'Видалення...' : 'Видалити', icon: <Trash2 size={14} />, onClick: () => onDelete(file), danger: true },
            ]} />
          </div>
        );
      })}
    </div>
  );
}
