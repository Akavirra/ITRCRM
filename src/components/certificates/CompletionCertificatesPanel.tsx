'use client';

import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import {
} from 'lucide-react';
import CompletionCertificateCanvas from '@/components/certificates/CompletionCertificateCanvas';
import CertificateEditorFooterActions from '@/components/certificates/CertificateEditorFooterActions';
import CertificateEditorLoadingNotice from '@/components/certificates/CertificateEditorLoadingNotice';
import CertificateEditorModalShell from '@/components/certificates/CertificateEditorModalShell';
import CompletionCertificateEditorSidebar from '@/components/certificates/CompletionCertificateEditorSidebar';
import CompletionCertificatesList from '@/components/certificates/CompletionCertificatesList';

import CertificatesSectionHeader from '@/components/certificates/CertificatesSectionHeader';
import { useUser } from '@/components/UserContext';
import { t } from '@/i18n/t';
import { formatDateKyiv } from '@/lib/date-utils';
import s from '@/components/certificates/certificates-editor.module.css';

interface CompletionCertificateData {
  id: number;
  student_id: number;
  student_name: string;
  course_id: number | null;
  course_title: string | null;
  group_id: number | null;
  group_title?: string | null;
  issue_date: string;
  gender: 'male' | 'female';
  creator_name: string | null;
  created_at: string;
}

interface CompletionCertificateListResponse {
  items: CompletionCertificateData[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

interface StudentOption {
  id: number;
  full_name: string;
  gender: 'male' | 'female' | null;
}

interface GroupStudentDraft {
  gender: 'male' | 'female' | '';
  previewTexts: Record<string, string>;
}

interface CourseOption {
  id: number;
  title: string;
}

interface GroupOption {
  id: number;
  title: string;
  course_id: number;
  course_title: string;
}

interface CompletionCertificateSettings {
  templateUrl: string | null;
  blocks: BlockSetting[];
  courseBlockOverrides?: Record<string, BlockSetting>;
}

interface BlockSetting {
  key: string;
  size: number;
  xPercent: number;
  yPercent: number;
  color: string;
  align: 'left' | 'center' | 'right';
  weight: 'normal' | 'bold';
  style: 'normal' | 'italic';
  wrap: boolean;
}

const DEFAULT_BLOCKS: BlockSetting[] = [
  { key: 'student_name', size: 42, xPercent: 50, yPercent: 45, color: '#1a237e', align: 'center', weight: 'normal', style: 'normal', wrap: false },
  { key: 'verb', size: 18, xPercent: 50, yPercent: 38, color: '#1a237e', align: 'center', weight: 'normal', style: 'normal', wrap: true },
  { key: 'course_name', size: 20, xPercent: 50, yPercent: 28, color: '#1565c0', align: 'center', weight: 'normal', style: 'normal', wrap: true },
  { key: 'issue_date', size: 14, xPercent: 80, yPercent: 8, color: '#1a237e', align: 'left', weight: 'normal', style: 'normal', wrap: false },
];

const BLOCK_LABELS: Record<string, string> = {
  student_name: "Ім'я учня",
  verb: 'Текст завершення',
  course_name: 'Назва курсу',
  issue_date: 'Дата видачі',
};

type AccordionKey = 'data' | 'blocks' | 'template';
type SelectionMode = 'single' | 'group';

interface EditorSnapshot {
  blocks: BlockSetting[];
  courseBlockOverrides: Record<string, BlockSetting>;
  previewTexts: Record<string, string>;
  pan: { x: number; y: number };
  scale: number;
  selectedBlock: number | null;
}

const MALE_NAME_EXCEPTIONS = new Set([
  '\u041c\u0438\u043a\u043e\u043b\u0430',
  '\u0406\u043b\u043b\u044f',
  '\u041b\u0443\u043a\u0430',
  '\u041a\u0443\u0437\u044c\u043c\u0430',
  '\u0421\u0430\u0432\u0430',
  '\u0424\u043e\u043c\u0430',
  '\u0416\u043e\u0440\u0430',
]);

const getFallbackCourseLabel = (title?: string | null) => (
  title ? `«${title}»` : ''
);

const inferGenderFromName = (fullName?: string | null): 'male' | 'female' | '' => {
  const nameParts = fullName?.trim().split(/\s+/).filter(Boolean) || [];
  const candidates = Array.from(new Set([nameParts[1], nameParts[0], nameParts[nameParts.length - 1]].filter(Boolean)));

  if (!candidates.length) return '';

  const detectByToken = (token?: string) => {
    if (!token) return '' as const;
    if (MALE_NAME_EXCEPTIONS.has(token)) return 'male' as const;
    const normalized = token.toLowerCase();
    if (normalized.endsWith('\u0430') || normalized.endsWith('\u044f')) return 'female' as const;
    return 'male' as const;
  };

  const explicitFemale = candidates.find((token) => {
    const normalized = token.toLowerCase();
    return normalized.endsWith('\u0430') || normalized.endsWith('\u044f');
  });

  if (explicitFemale) {
    return MALE_NAME_EXCEPTIONS.has(explicitFemale) ? 'male' : 'female';
  }

  return detectByToken(candidates[0]);
};

export default function CompletionCertificatesPanel({
}: {} = {}) {
  const router = useRouter();
  const pathname = usePathname() ?? '/certificates';
  const searchParams = useSearchParams();
  const safeSearchParams = searchParams ?? new URLSearchParams();
  const { user } = useUser();
  const initialCompletionSearch = safeSearchParams.get('completion_search') || '';
  const initialCompletionCourse = safeSearchParams.get('completion_course') || '';
  const initialCompletionGroup = safeSearchParams.get('completion_group') || '';
  const initialCompletionPage = Number.parseInt(safeSearchParams.get('completion_page') || '1', 10);

  const [certificates, setCertificates] = useState<CompletionCertificateData[]>([]);
  const [students, setStudents] = useState<StudentOption[]>([]);
  const [courses, setCourses] = useState<CourseOption[]>([]);
  const [groups, setGroups] = useState<GroupOption[]>([]);
  const [loadingGroupStudents, setLoadingGroupStudents] = useState(false);
  const [loadingStudentOptions, setLoadingStudentOptions] = useState(false);
  const [selectionMode, setSelectionMode] = useState<SelectionMode>('single');
  const [selectedGroupStudentIds, setSelectedGroupStudentIds] = useState<string[]>([]);
  const [activeGroupStudentId, setActiveGroupStudentId] = useState('');
  const [groupStudentDrafts, setGroupStudentDrafts] = useState<Record<string, GroupStudentDraft>>({});
  const [studentSearch, setStudentSearch] = useState('');
  const [listLoading, setListLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [saving, setSaving] = useState(false);
  const [templateUrl, setTemplateUrl] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [blocks, setBlocks] = useState<BlockSetting[]>(DEFAULT_BLOCKS);
  const [savingSettings, setSavingSettings] = useState(false);
  const [deleteConfirmId, setDeleteConfirmId] = useState<number | null>(null);
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [editorBootstrapLoading, setEditorBootstrapLoading] = useState(false);
  const [editorBootstrapReady, setEditorBootstrapReady] = useState(false);
  const [searchInput, setSearchInput] = useState(initialCompletionSearch);
  const [searchQuery, setSearchQuery] = useState(initialCompletionSearch);
  const [courseFilter, setCourseFilter] = useState(initialCompletionCourse);
  const [groupFilter, setGroupFilter] = useState(initialCompletionGroup);
  const [filterOptionsLoading, setFilterOptionsLoading] = useState(false);
  const [page, setPage] = useState(Number.isFinite(initialCompletionPage) && initialCompletionPage > 0 ? initialCompletionPage : 1);
  const [pagination, setPagination] = useState({ page: 1, limit: 20, total: 0, totalPages: 1 });
  const [dragging, setDragging] = useState<{ index: number; offsetX: number; offsetY: number } | null>(null);
  const [openAccordion, setOpenAccordion] = useState<AccordionKey | null>('data');
  const [resizing, setResizing] = useState<{ index: number; startSize: number; startY: number; directionY: 1 | -1 } | null>(null);
  const [selectedBlock, setSelectedBlock] = useState<number | null>(null);
  const [imageDimensions, setImageDimensions] = useState({ width: 842, height: 595 });
  const [viewportSize, setViewportSize] = useState({ width: 0, height: 0 });
  const [scale, setScale] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [isPanning, setIsPanning] = useState(false);
  const [panStart, setPanStart] = useState({ x: 0, y: 0 });
  const [previewTexts, setPreviewTexts] = useState<Record<string, string>>({});
  const [courseBlockOverrides, setCourseBlockOverrides] = useState<Record<string, BlockSetting>>({});
  const [formData, setFormData] = useState({
    student_id: '',
    course_id: '',
    group_id: '',
    issue_date: new Date().toISOString().slice(0, 10),
    gender: '' as 'male' | 'female' | '',
  });

  const viewportRef = useRef<HTMLDivElement>(null);
  const previewRef = useRef<HTMLDivElement>(null);
  const historyRef = useRef<EditorSnapshot[]>([]);
  const sentinelRef = useRef<HTMLDivElement>(null);

  const renderedBlocks = blocks.map((block) => {
    if (block.key !== 'course_name' || !formData.course_id) return block;
    return courseBlockOverrides[formData.course_id] || block;
  });
  const activeBlock = renderedBlocks[selectedBlock ?? 0];
  const activeBlockIndex = selectedBlock ?? 0;
  const effectiveStudentId = selectionMode === 'group' ? activeGroupStudentId : formData.student_id;
  const selectedStudent = students.find((student) => String(student.id) === effectiveStudentId) || null;
  const selectedCourse = courses.find((course) => String(course.id) === formData.course_id) || null;
  const filteredGroups = formData.course_id
    ? groups.filter((group) => String(group.course_id) === formData.course_id)
    : groups;
  const selectedGroup = groups.find((group) => String(group.id) === formData.group_id) || null;
  const selectedCourseLabel = getFallbackCourseLabel(selectedCourse?.title);
  const activeGroupDraft = activeGroupStudentId ? groupStudentDrafts[activeGroupStudentId] : undefined;
  const effectiveGender = selectionMode === 'group'
    ? (activeGroupDraft?.gender || formData.gender)
    : formData.gender;
  const groupedCertificates = certificates.reduce<Record<string, CompletionCertificateData[]>>((acc, certificate) => {
    const key = certificate.group_title || 'Без групи';
    if (!acc[key]) {
      acc[key] = [];
    }
    acc[key].push(certificate);
    return acc;
  }, {});
  const canCreate = selectionMode === 'group'
    ? !saving && !!formData.group_id && !!formData.issue_date && selectedGroupStudentIds.length > 0
    : !saving && !!formData.student_id && !!formData.issue_date && !!formData.gender;
  const toolbarScale = 1 / scale;
  const scaledWidth = imageDimensions.width * scale;
  const scaledHeight = imageDimensions.height * scale;
  const panBounds = {
    x: Math.max(0, Math.round((scaledWidth - viewportSize.width) / 2)),
    y: Math.max(0, Math.round((scaledHeight - viewportSize.height) / 2)),
  };
  const canUndo = historyRef.current.length > 0;

  const fetchCertificates = async (targetPage = page) => {
    if (!user || user.role !== 'admin') return;

    setListLoading(true);
    try {
      const params = new URLSearchParams({
        page: String(targetPage),
        limit: String(pagination.limit),
      });

      if (searchQuery) {
        params.set('search', searchQuery);
      }

      if (courseFilter) {
        params.set('courseId', courseFilter);
      }

      if (groupFilter) {
        params.set('groupId', groupFilter);
      }

      const response = await fetch(`/api/completion-certificates?${params.toString()}`);
      const data = await response.json() as CompletionCertificateListResponse;

      const items = Array.isArray(data.items) ? data.items : [];
      setCertificates((prev) => (targetPage === 1 ? items : [...prev, ...items]));
      setPagination({
        page: typeof data.page === 'number' ? data.page : targetPage,
        limit: typeof data.limit === 'number' ? data.limit : 20,
        total: typeof data.total === 'number' ? data.total : 0,
        totalPages: typeof data.totalPages === 'number' ? data.totalPages : 1,
      });
    } catch (error) {
      console.error('Failed to fetch completion certificates:', error);
      if (targetPage === 1) setCertificates([]);
      setPagination((prev) => ({ ...prev, page: targetPage, total: 0, totalPages: 1 }));
    } finally {
      setListLoading(false);
    }
  };

  const bootstrapEditor = async (force = false) => {
    if (editorBootstrapReady && !force) return true;

    setEditorBootstrapLoading(true);
    try {
      const [courseRes, groupRes, templateRes, settingsRes] = await Promise.all([
        fetch('/api/courses?simple=true'),
        fetch('/api/groups?basic=true'),
        fetch('/api/completion-certificates/template'),
        fetch('/api/completion-certificates/settings'),
      ]);

      const courseData = await courseRes.json();
      setCourses(
        Array.isArray(courseData.courses)
          ? courseData.courses.map((course: any) => ({
              id: course.id,
              title: course.title,
            }))
          : []
      );

      const groupData = await groupRes.json();
      setGroups(
        Array.isArray(groupData.groups)
          ? groupData.groups.map((group: any) => ({
              id: group.id,
              title: group.title,
              course_id: group.course_id,
              course_title: group.course_title,
            }))
          : []
      );

      const templateData = await templateRes.json();
      setTemplateUrl(templateData?.url || null);

      const settingsData = await settingsRes.json() as CompletionCertificateSettings & { error?: string };
      if (settingsData && !settingsData.error && Array.isArray(settingsData.blocks)) {
        setBlocks(settingsData.blocks);
        setCourseBlockOverrides(settingsData.courseBlockOverrides || {});
      }

      setEditorBootstrapReady(true);
      return true;
    } catch (error) {
      console.error('Failed to bootstrap completion certificate editor:', error);
      return false;
    } finally {
      setEditorBootstrapLoading(false);
    }
  };

  const createSnapshot = (): EditorSnapshot => ({
    blocks: blocks.map((block) => ({ ...block })),
    courseBlockOverrides: Object.fromEntries(
      Object.entries(courseBlockOverrides).map(([courseId, block]) => [courseId, { ...block }])
    ),
    previewTexts: { ...previewTexts },
    pan: { ...pan },
    scale,
    selectedBlock,
  });

  const applySnapshot = (snapshot: EditorSnapshot) => {
    setBlocks(snapshot.blocks.map((block) => ({ ...block })));
    setCourseBlockOverrides(
      Object.fromEntries(
        Object.entries(snapshot.courseBlockOverrides || {}).map(([courseId, block]) => [courseId, { ...block }])
      )
    );
    setPreviewTexts({ ...snapshot.previewTexts });
    setPan({ ...snapshot.pan });
    setScale(snapshot.scale);
    setSelectedBlock(snapshot.selectedBlock);
  };

  const pushHistory = (snapshot = createSnapshot()) => {
    const lastSnapshot = historyRef.current[historyRef.current.length - 1];
    const serializedSnapshot = JSON.stringify(snapshot);
    if (lastSnapshot && JSON.stringify(lastSnapshot) === serializedSnapshot) return;
    historyRef.current.push(snapshot);
    if (historyRef.current.length > 100) {
      historyRef.current.shift();
    }
  };

  const undoLastChange = () => {
    const previous = historyRef.current.pop();
    if (!previous) return;
    applySnapshot(previous);
  };

  const nudgeSelectedBlock = (deltaX: number, deltaY: number) => {
    if (selectedBlock === null) return;
    const current = renderedBlocks[selectedBlock];
    if (!current) return;

    const xStep = 100 / imageDimensions.width;
    const yStep = 100 / imageDimensions.height;

    updateBlock(selectedBlock, {
      xPercent: Number(Math.max(0, Math.min(100, current.xPercent + deltaX * xStep)).toFixed(3)),
      yPercent: Number(Math.max(0, Math.min(100, current.yPercent + deltaY * yStep)).toFixed(3)),
    });
  };

  const toggleAccordion = (key: AccordionKey) => {
    setOpenAccordion((prev) => (prev === key ? null : key));
  };

  useEffect(() => {
    if (user && user.role !== 'admin') {
      router.push('/dashboard');
    }
  }, [router, user]);

  useEffect(() => {
    if (!user || user.role !== 'admin') return;
    setCertificates([]);
    setPage(1);
    fetchCertificates(1);
  }, [courseFilter, groupFilter, searchQuery, user]);

  useEffect(() => {
    if (!user || user.role !== 'admin') return;
    if (page === 1) return;
    fetchCertificates(page);
  }, [page, user]);

  useEffect(() => {
    if (!sentinelRef.current || listLoading) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && page < pagination.totalPages) {
          setPage((prev) => prev + 1);
        }
      },
      { rootMargin: '200px' }
    );

    observer.observe(sentinelRef.current);
    return () => observer.disconnect();
  }, [listLoading, page, pagination.totalPages]);

  useEffect(() => {
    const currentQuery = safeSearchParams.toString();
    const nextParams = new URLSearchParams(currentQuery);

    if (searchQuery) {
      nextParams.set('completion_search', searchQuery);
    } else {
      nextParams.delete('completion_search');
    }

    if (courseFilter) {
      nextParams.set('completion_course', courseFilter);
    } else {
      nextParams.delete('completion_course');
    }

    if (groupFilter) {
      nextParams.set('completion_group', groupFilter);
    } else {
      nextParams.delete('completion_group');
    }

    if (page > 1) {
      nextParams.set('completion_page', String(page));
    } else {
      nextParams.delete('completion_page');
    }

    const nextQuery = nextParams.toString();

    if (nextQuery !== currentQuery) {
      router.replace(nextQuery ? `${pathname}?${nextQuery}` : pathname, { scroll: false });
    }
  }, [courseFilter, groupFilter, page, pathname, router, safeSearchParams, searchQuery]);

  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      setPage(1);
      setSearchQuery(searchInput.trim());
    }, 250);

    return () => window.clearTimeout(timeoutId);
  }, [searchInput]);

  useEffect(() => {
    if (!user || user.role !== 'admin') return;
    if (courses.length > 0 && groups.length > 0) return;

    let cancelled = false;

    const fetchFilterOptions = async () => {
      setFilterOptionsLoading(true);
      try {
        const [courseRes, groupRes] = await Promise.all([
          fetch('/api/courses?simple=true'),
          fetch('/api/groups?basic=true'),
        ]);

        const courseData = await courseRes.json();
        const groupData = await groupRes.json();
        if (cancelled) return;

        setCourses(
          Array.isArray(courseData.courses)
            ? courseData.courses.map((course: any) => ({
                id: course.id,
                title: course.title,
              }))
            : []
        );

        setGroups(
          Array.isArray(groupData.groups)
            ? groupData.groups.map((group: any) => ({
                id: group.id,
                title: group.title,
                course_id: group.course_id,
                course_title: group.course_title,
              }))
            : []
        );
      } catch (error) {
        console.error('Failed to fetch certificate filter options:', error);
      } finally {
        if (!cancelled) {
          setFilterOptionsLoading(false);
        }
      }
    };

    fetchFilterOptions();

    return () => {
      cancelled = true;
    };
  }, [courses.length, groups.length, user]);

  useEffect(() => {
    if (!courseFilter) {
      if (groupFilter) {
        setGroupFilter('');
      }
      return;
    }

    if (groupFilter && !groups.some((group) => String(group.id) === groupFilter && String(group.course_id) === courseFilter)) {
      setGroupFilter('');
    }
  }, [courseFilter, groupFilter, groups]);

  useEffect(() => {
    const fitPreview = () => {
      if (!viewportRef.current || !imageDimensions.width || !imageDimensions.height) return;

      const viewportWidth = viewportRef.current.clientWidth - 40;
      const viewportHeight = viewportRef.current.clientHeight - 40;
      if (!viewportWidth || !viewportHeight) return;
      setViewportSize({ width: viewportWidth, height: viewportHeight });

      const widthScale = viewportWidth / imageDimensions.width;
      const heightScale = viewportHeight / imageDimensions.height;
      const nextScale = Math.min(widthScale, heightScale, 1);

      setScale(Math.max(0.45, Math.round(nextScale * 100) / 100));
      setPan({ x: 0, y: 0 });
    };

    fitPreview();
    window.addEventListener('resize', fitPreview);

    return () => window.removeEventListener('resize', fitPreview);
  }, [imageDimensions, templateUrl, showModal]);

  useEffect(() => {
    if (showModal && selectionMode === 'single') {
      let cancelled = false;

      const fetchStudentOptions = async () => {
        setLoadingStudentOptions(true);
        try {
          const params = new URLSearchParams({
            withGroups: 'true',
            limit: '40',
          });

          if (studentSearch.trim()) {
            params.set('search', studentSearch.trim());
          }
          if (formData.course_id) {
            params.set('courseId', formData.course_id);
          }
          if (formData.group_id) {
            params.set('groupId', formData.group_id);
          }

          const response = await fetch(`/api/students?${params.toString()}`);
          const data = await response.json();
          if (cancelled) return;

          const nextStudents: StudentOption[] = Array.isArray(data.students)
            ? data.students.map((student: any) => ({
                id: student.id,
                full_name: student.full_name,
                gender: student.gender ?? null,
              }))
            : [];

          setStudents(nextStudents);
          setFormData((prev) => {
            if (!prev.student_id) return prev;
            return nextStudents.some((student) => String(student.id) === prev.student_id)
              ? prev
              : { ...prev, student_id: '', gender: '' };
          });
        } catch (error) {
          console.error('Failed to fetch student options:', error);
          if (!cancelled) {
            setStudents([]);
          }
        } finally {
          if (!cancelled) {
            setLoadingStudentOptions(false);
          }
        }
      };

      fetchStudentOptions();

      return () => {
        cancelled = true;
      };
    }
  }, [showModal, selectionMode, studentSearch, formData.course_id, formData.group_id]);

  useEffect(() => {
    if (!formData.group_id) {
      if (selectionMode === 'group') {
        setStudents([]);
      }
      setSelectedGroupStudentIds([]);
      setActiveGroupStudentId('');
      return;
    }

    let cancelled = false;

    const fetchGroupStudents = async () => {
      setLoadingGroupStudents(true);
      try {
        const response = await fetch(`/api/groups/${formData.group_id}/students?basic=true`);
        const data = await response.json();
        if (cancelled) return;

        const nextStudents: StudentOption[] = Array.isArray(data.students)
          ? data.students.map((student: any) => ({
              id: student.id,
              full_name: student.full_name,
              gender: student.gender ?? null,
            }))
          : [];

        setStudents(nextStudents);

        if (selectionMode === 'group') {
          const allIds = nextStudents.map((student) => String(student.id));
          setSelectedGroupStudentIds(allIds);
          setActiveGroupStudentId((prev) => prev && allIds.includes(prev) ? prev : (allIds[0] || ''));
          setFormData((prev) => ({ ...prev, student_id: allIds[0] || '' }));
        } else {
          setSelectedGroupStudentIds([]);
        }
      } catch (error) {
        console.error('Failed to fetch group students:', error);
        if (!cancelled) {
          setStudents([]);
          setSelectedGroupStudentIds([]);
          setActiveGroupStudentId('');
        }
      } finally {
        if (!cancelled) {
          setLoadingGroupStudents(false);
        }
      }
    };

    fetchGroupStudents();

    return () => {
      cancelled = true;
    };
  }, [formData.group_id, selectionMode]);

  useEffect(() => {
    if (!formData.student_id || !selectedStudent) return;
    const nextGender = selectedStudent.gender || inferGenderFromName(selectedStudent.full_name);
    if (!nextGender) return;
    if (selectionMode === 'group' && activeGroupStudentId) {
      setGroupStudentDrafts((prev) => {
        const current = prev[activeGroupStudentId];
        if (current?.gender === nextGender) return prev;
        return {
          ...prev,
          [activeGroupStudentId]: {
            gender: nextGender,
            previewTexts: current?.previewTexts || {},
          },
        };
      });
      return;
    }
    setFormData((prev) => (prev.gender === nextGender ? prev : { ...prev, gender: nextGender }));
  }, [selectionMode, activeGroupStudentId, formData.student_id, selectedStudent?.gender, selectedStudent?.full_name]);

  useEffect(() => {
    if (!resizing) return;

    const handleResizeMove = (event: MouseEvent) => {
      const delta = (event.clientY - resizing.startY) * resizing.directionY;
      const nextSize = Math.max(10, Math.min(160, resizing.startSize + delta * 0.28));
      updateBlock(resizing.index, { size: Math.round(nextSize) }, false);
    };

    const handleResizeEnd = () => {
      setResizing(null);
    };

    document.addEventListener('mousemove', handleResizeMove);
    document.addEventListener('mouseup', handleResizeEnd);

    return () => {
      document.removeEventListener('mousemove', handleResizeMove);
      document.removeEventListener('mouseup', handleResizeEnd);
    };
  }, [resizing]);

  useEffect(() => {
    const element = viewportRef.current;
    if (!element) return;

    const handleWheel = (event: WheelEvent) => {
      event.preventDefault();
      adjustScale(event.deltaY > 0 ? -0.08 : 0.08, false);
    };

    element.addEventListener('wheel', handleWheel, { passive: false });
    return () => element.removeEventListener('wheel', handleWheel);
  }, [showModal]);

  useEffect(() => {
    if (!showModal) return;

    const handleKeyDown = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      const isTypingTarget = Boolean(
        target && (
          target.tagName === 'INPUT' ||
          target.tagName === 'TEXTAREA' ||
          target.tagName === 'SELECT' ||
          target.isContentEditable
        )
      );

      if ((event.ctrlKey || event.metaKey) && event.code === 'KeyZ') {
        event.preventDefault();
        undoLastChange();
        return;
      }

      if (isTypingTarget || selectedBlock === null || event.ctrlKey || event.metaKey || event.altKey) {
        return;
      }

      if (event.key === 'ArrowLeft') {
        event.preventDefault();
        nudgeSelectedBlock(-1, 0);
        return;
      }

      if (event.key === 'ArrowRight') {
        event.preventDefault();
        nudgeSelectedBlock(1, 0);
        return;
      }

      if (event.key === 'ArrowUp') {
        event.preventDefault();
        nudgeSelectedBlock(0, 1);
        return;
      }

      if (event.key === 'ArrowDown') {
        event.preventDefault();
        nudgeSelectedBlock(0, -1);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [showModal, selectedBlock, renderedBlocks, imageDimensions.width, imageDimensions.height]);

  const updateBlock = (index: number, patch: Partial<BlockSetting>, shouldRecordHistory = true) => {
    if (index < 0 || index >= renderedBlocks.length) return;
    if (shouldRecordHistory) {
      pushHistory();
    }
    const targetBlock = renderedBlocks[index];
    if (!targetBlock) return;

    if (targetBlock.key === 'course_name' && formData.course_id) {
      setCourseBlockOverrides((prev) => ({
        ...prev,
        [formData.course_id]: { ...targetBlock, ...patch },
      }));
      return;
    }

    setBlocks((prev) => prev.map((block, currentIndex) => (
      currentIndex === index ? { ...block, ...patch } : block
    )));
  };

  const getPreviewText = (key: string) => {
    const currentPreviewTexts = selectionMode === 'group' && activeGroupDraft
      ? activeGroupDraft.previewTexts
      : previewTexts;

    if (key !== 'course_name' && currentPreviewTexts[key] !== undefined) {
      return currentPreviewTexts[key];
    }

    switch (key) {
      case 'student_name':
        if (!selectedStudent) return '';
        return selectedStudent?.full_name || "Єва Григор'єва";
      case 'verb':
        if (!selectedStudent || !effectiveGender) return '';
        return effectiveGender === 'male'
          ? 'успішно завершив навчання\nз курсу'
          : 'успішно завершила навчання\nз курсу';
      case 'course_name':
        if (!selectedCourse) return '';
        return selectedCourseLabel;
      case 'issue_date': {
        const date = new Date(formData.issue_date);
        if (Number.isNaN(date.getTime())) return formData.issue_date;
        const day = String(date.getDate()).padStart(2, '0');
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const year = date.getFullYear();
        return `${day}.${month}.${year}`;
      }
      default:
        return '';
    }
  };

  const getBlockFontFamily = (key: string) => (
    key === 'student_name' ? "'CertificateCassandra', cursive" : "'CertificateMontserrat', sans-serif"
  );

  const adjustScale = (delta: number, shouldRecordHistory = true) => {
    if (shouldRecordHistory) {
      pushHistory();
    }
    setScale((prev) => {
      const next = Math.max(0.4, Math.min(2.4, prev + delta));
      return Math.round(next * 100) / 100;
    });
  };

  const resetViewport = () => {
    pushHistory();
    setPan({ x: 0, y: 0 });
    if (!viewportRef.current) {
      setScale(1);
      return;
    }
    const viewportWidth = viewportRef.current.clientWidth - 40;
    const viewportHeight = viewportRef.current.clientHeight - 40;
    const widthScale = viewportWidth / imageDimensions.width;
    const heightScale = viewportHeight / imageDimensions.height;
    setScale(Math.max(0.45, Math.min(widthScale, heightScale, 1)));
  };

  const handleCanvasMouseDown = (event: React.MouseEvent) => {
    const clickedCanvasSurface = event.target === event.currentTarget || event.target instanceof HTMLImageElement;

    if (event.button === 0 && clickedCanvasSurface) {
      event.preventDefault();
      setSelectedBlock(null);
      setDragging(null);
      setResizing(null);
      return;
    }

    if (event.button === 1 && clickedCanvasSurface) {
      event.preventDefault();
      pushHistory();
      setIsPanning(true);
      setPanStart({ x: event.clientX - pan.x, y: event.clientY - pan.y });
    }
  };

  const handleMouseMove = (event: React.MouseEvent) => {
    if (isPanning) {
      setPan({ x: event.clientX - panStart.x, y: event.clientY - panStart.y });
      return;
    }

    if (!dragging) return;

    const container = event.currentTarget.getBoundingClientRect();
    let x = ((event.clientX - container.left - dragging.offsetX) / container.width) * 100;
    let y = 100 - (((event.clientY - container.top - dragging.offsetY) / container.height) * 100);

    x = Math.max(0, Math.min(100, x));
    y = Math.max(0, Math.min(100, y));

    updateBlock(dragging.index, {
      xPercent: parseFloat(x.toFixed(2)),
      yPercent: parseFloat(y.toFixed(2)),
    }, false);
  };

  const handleMouseUp = () => {
    setDragging(null);
    setIsPanning(false);
  };

  const handleSelectionModeChange = (mode: SelectionMode) => {
    setSelectionMode(mode);
    if (mode === 'group') {
      const allIds = students.map((student) => String(student.id));
      setSelectedGroupStudentIds(allIds);
      setActiveGroupStudentId(allIds[0] || '');
      setFormData((prev) => ({ ...prev, student_id: allIds[0] || '' }));
      return;
    }

    setSelectedGroupStudentIds([]);
    setActiveGroupStudentId('');
    setFormData((prev) => ({ ...prev, student_id: '', gender: '' }));
  };

  const handleCourseChange = (courseId: string) => {
    setFormData((prev) => ({
      ...prev,
      course_id: courseId,
      group_id: selectionMode === 'group' ? '' : prev.group_id,
      student_id: '',
      gender: selectionMode === 'group' ? '' : prev.gender,
    }));
    if (selectionMode === 'group') {
      setStudents([]);
      setSelectedGroupStudentIds([]);
      setActiveGroupStudentId('');
    }
  };

  const handleGroupChange = (groupId: string) => {
    setFormData((prev) => ({
      ...prev,
      group_id: groupId,
      student_id: '',
      gender: '',
    }));
    setStudents([]);
    setSelectedGroupStudentIds([]);
  };

  const toggleGroupStudent = (studentId: string) => {
    setSelectedGroupStudentIds((prev) => {
      const nextIds = prev.includes(studentId)
        ? prev.filter((id) => id !== studentId)
        : [...prev, studentId];

      if (!nextIds.includes(activeGroupStudentId)) {
        const fallbackId = nextIds[0] || '';
        setActiveGroupStudentId(fallbackId);
        setFormData((current) => ({
          ...current,
          student_id: fallbackId,
        }));
      }

      return nextIds;
    });
  };

  const selectGroupStudent = (studentId: string) => {
    setActiveGroupStudentId(studentId);
    setFormData((prev) => ({ ...prev, student_id: studentId }));
  };

  const handleCreate = async () => {
    historyRef.current = [];
    setFormData({
      student_id: '',
      course_id: '',
      group_id: '',
      issue_date: new Date().toISOString().slice(0, 10),
      gender: '',
    });
    setPreviewTexts({});
    setSelectedBlock(null);
    setSelectedFile(null);
    setSelectionMode('single');
    setStudents([]);
    setSelectedGroupStudentIds([]);
    setActiveGroupStudentId('');
    setGroupStudentDrafts({});
    setStudentSearch('');
    setShowModal(true);
    await bootstrapEditor();
  };

  const handleSave = async () => {
    if (!canCreate) return;

    setSaving(true);
    try {
      const payload = selectionMode === 'group'
        ? {
            course_id: formData.course_id,
            group_id: formData.group_id,
            issue_date: formData.issue_date,
            students: selectedGroupStudentIds.map((studentId) => ({
              student_id: studentId,
              gender: groupStudentDrafts[studentId]?.gender || null,
            })),
          }
        : formData;

      const response = await fetch('/api/completion-certificates', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const data = await response.json();
        alert(data.error || t('toasts.error'));
        return;
      }

      const result = await response.json();
      const createdCertificates = Array.isArray(result.created) ? result.created : [result];
      setShowModal(false);
      setPage(1);
      await fetchCertificates(1);
      if (createdCertificates.length === 1 && createdCertificates[0]?.id) {
        window.open(`/api/completion-certificates/${createdCertificates[0].id}/pdf`, '_blank');
      } else if (createdCertificates.length > 1) {
        alert(`Створено ${createdCertificates.length} сертифікатів`);
      }
    } catch (error) {
      console.error('Failed to save certificate:', error);
      alert('Не вдалося згенерувати сертифікат');
    } finally {
      setSaving(false);
    }
  };

  const handleDownload = (id: number) => {
    window.open(`/api/completion-certificates/${id}/pdf`, '_blank');
  };

  const handleUploadTemplate = async () => {
    if (!selectedFile) return;

    setUploading(true);
    try {
      const form = new FormData();
      form.append('file', selectedFile);

      const response = await fetch('/api/completion-certificates/template', {
        method: 'POST',
        body: form,
      });

      if (!response.ok) {
        const data = await response.json();
        alert(data.error || 'Помилка завантаження');
        return;
      }

      const data = await response.json();
      setTemplateUrl(data.url);
      setSelectedFile(null);
      alert('Шаблон успішно оновлено');
    } catch (error) {
      console.error(error);
      alert('Помилка завантаження');
    } finally {
      setUploading(false);
    }
  };

  const handleSaveSettings = async () => {
    setSavingSettings(true);
    try {
      const response = await fetch('/api/completion-certificates/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ templateUrl, blocks, courseBlockOverrides }),
      });

      if (!response.ok) {
        throw new Error('Failed to save settings');
      }

      alert('Налаштування збережено');
    } catch (error) {
      console.error(error);
      alert('Помилка збереження');
    } finally {
      setSavingSettings(false);
    }
  };

  const handleDelete = (id: number) => {
    setDeleteConfirmId(id);
  };

  const confirmDelete = async () => {
    if (!deleteConfirmId) return;

    setDeleteLoading(true);
    try {
      const response = await fetch(`/api/completion-certificates/${deleteConfirmId}`, {
        method: 'DELETE',
      });

      if (!response.ok) {
        throw new Error('Failed');
      }

      setCertificates((prev) => prev.filter((certificate) => certificate.id !== deleteConfirmId));
      setDeleteConfirmId(null);
      const nextPage = certificates.length === 1 && page > 1 ? page - 1 : page;
      setPage(nextPage);
      await fetchCertificates(nextPage);
    } catch (error) {
      console.error(error);
      alert('Помилка видалення');
    } finally {
      setDeleteLoading(false);
    }
  };

  const onStudentChange = (studentId: string) => {
    const student = students.find((item) => String(item.id) === studentId);
    const nextGender = student?.gender || inferGenderFromName(student?.full_name);
    setFormData((prev) => ({
      ...prev,
      student_id: studentId,
      gender: studentId ? nextGender : '',
    }));
  };

  if (!user || user.role !== 'admin') return null;

  return (
    <>
      <CertificatesSectionHeader
          title="Сертифікати про закінчення"
          subtitle="Генеруйте PDF і налаштовуйте макет у тому ж вікні."
          controls={(
            <>
              <select
                className="form-select"
                value={courseFilter}
                onChange={(event) => {
                  setPage(1);
                  setCourseFilter(event.target.value);
                }}
                style={{ maxWidth: '240px' }}
                disabled={filterOptionsLoading}
              >
                <option value="">Усі курси</option>
                {courses.map((course) => (
                  <option key={course.id} value={course.id}>{course.title}</option>
                ))}
              </select>
              <select
                className="form-select"
                value={groupFilter}
                onChange={(event) => {
                  setPage(1);
                  setGroupFilter(event.target.value);
                }}
                style={{ maxWidth: '240px' }}
                disabled={filterOptionsLoading || (!courseFilter && groups.length > 0)}
              >
                <option value="">{courseFilter ? 'Усі групи курсу' : 'Спершу оберіть курс'}</option>
                {groups
                  .filter((group) => !courseFilter || String(group.course_id) === courseFilter)
                  .map((group) => (
                    <option key={group.id} value={group.id}>{group.title}</option>
                  ))}
              </select>
              <input
                type="search"
                className="form-input"
                value={searchInput}
                onChange={(event) => setSearchInput(event.target.value)}
                placeholder="Пошук по учню, групі або курсу"
                style={{ maxWidth: '280px' }}
              />
            </>
          )}
          actionLabel={t('actions.add')}
          onAction={handleCreate}
        />

        <div className="table-container">
          <CompletionCertificatesList
            certificates={certificates}
            groupedCertificates={groupedCertificates}
            loading={listLoading}
            formatIssuedAt={formatDateKyiv}
            onDownload={handleDownload}
            onDelete={handleDelete}
            onCreate={handleCreate}
          />
        </div>
        {listLoading && certificates.length > 0 && (
          <div style={{ padding: '16px', textAlign: 'center', color: 'var(--gray-500)', fontSize: '13px' }}>
            Завантажуємо ще…
          </div>
        )}
        <div ref={sentinelRef} style={{ height: '1px' }} />

      <CertificateEditorModalShell
        isOpen={showModal}
        onClose={() => setShowModal(false)}
        shellClassName={s.modalShell}
        headerClassName={s.modalHeader}
        headerMainClassName={s.modalHeaderMain}
        headerBackClassName={s.headerBack}
        headerTitleStackClassName={s.headerTitleStack}
        headerActionsClassName={s.headerActions}
        closeButtonClassName={s.modalClose}
        bodyClassName={s.modalBody}
        footerClassName={s.modalFooter}
        headerContent={(
          <div className={s.headerTitleRow}>
            <h3 className={s.modalTitle}>Редактор сертифіката</h3>
            <span className={s.headerStudentBadge}>
              {selectedStudent?.full_name || 'Оберіть учня'}
            </span>
          </div>
        )}
        bodyNotice={editorBootstrapLoading ? (
          <CertificateEditorLoadingNotice description="Підтягуємо шаблон, налаштування, курси і групи для сертифіката." />
        ) : undefined}
        footer={(
          <CertificateEditorFooterActions
            className={s.footerActions}
            onClose={() => setShowModal(false)}
            onSaveSettings={handleSaveSettings}
            onPrimaryAction={handleSave}
            settingsDisabled={savingSettings || editorBootstrapLoading}
            primaryDisabled={!canCreate || editorBootstrapLoading}
            savingSettings={savingSettings}
            primaryLoading={saving}
            primaryLabel="Згенерувати PDF"
            primaryLoadingLabel="Генеруємо…"
          />
        )}
      >
              <CompletionCertificateCanvas
                templateUrl={templateUrl}
                viewportRef={viewportRef}
                previewRef={previewRef}
                imageDimensions={imageDimensions}
                setImageDimensions={setImageDimensions}
                pan={pan}
                scale={scale}
                dragging={dragging}
                isPanning={isPanning}
                handleMouseMove={handleMouseMove}
                handleMouseUp={handleMouseUp}
                handleCanvasMouseDown={handleCanvasMouseDown}
                renderedBlocks={renderedBlocks}
                selectedBlock={selectedBlock}
                setSelectedBlock={setSelectedBlock}
                setOpenAccordion={setOpenAccordion}
                pushHistory={pushHistory}
                setDragging={setDragging}
                setResizing={setResizing}
                updateBlock={updateBlock}
                getPreviewText={getPreviewText}
                getBlockFontFamily={getBlockFontFamily}
                toolbarScale={toolbarScale}
                panBounds={panBounds}
                setPan={setPan}
                canUndo={canUndo}
                undoLastChange={undoLastChange}
                adjustScale={adjustScale}
                resetViewport={resetViewport}
              />

              <CompletionCertificateEditorSidebar
                openAccordion={openAccordion}
                toggleAccordion={toggleAccordion}
                selectionMode={selectionMode}
                handleSelectionModeChange={handleSelectionModeChange}
                formData={formData}
                courses={courses}
                groups={groups}
                filteredGroups={filteredGroups}
                students={students}
                studentSearch={studentSearch}
                setStudentSearch={setStudentSearch}
                handleCourseChange={handleCourseChange}
                handleGroupChange={handleGroupChange}
                onStudentChange={onStudentChange}
                loadingStudentOptions={loadingStudentOptions}
                loadingGroupStudents={loadingGroupStudents}
                selectedGroup={selectedGroup}
                selectedStudent={selectedStudent}
                selectedGroupStudentIds={selectedGroupStudentIds}
                setSelectedGroupStudentIds={setSelectedGroupStudentIds}
                activeGroupStudentId={activeGroupStudentId}
                setActiveGroupStudentId={setActiveGroupStudentId}
                setFormData={setFormData}
                groupStudentDrafts={groupStudentDrafts}
                toggleGroupStudent={toggleGroupStudent}
                selectGroupStudent={selectGroupStudent}
                effectiveGender={effectiveGender}
                setGroupStudentDrafts={setGroupStudentDrafts}
                selectedCourse={selectedCourse}
                renderedBlocks={renderedBlocks}
                selectedBlock={selectedBlock}
                setSelectedBlock={setSelectedBlock}
                activeBlock={activeBlock}
                activeBlockIndex={activeBlockIndex}
                getPreviewText={getPreviewText}
                activeGroupDraft={activeGroupDraft}
                previewTexts={previewTexts}
                pushHistory={pushHistory}
                setPreviewTexts={setPreviewTexts}
                updateBlock={updateBlock}
                selectedFile={selectedFile}
                setSelectedFile={setSelectedFile}
                templateUrl={templateUrl}
                handleUploadTemplate={handleUploadTemplate}
                uploading={uploading}
              />
      </CertificateEditorModalShell>

      {deleteConfirmId !== null && createPortal(
        <div className="modal-overlay" onClick={() => setDeleteConfirmId(null)}>
          <div className="modal" onClick={(event) => event.stopPropagation()} style={{ maxWidth: '400px' }}>
            <div className="modal-header">
              <h3 className="modal-title">Видалити сертифікат?</h3>
              <button className="modal-close" onClick={() => setDeleteConfirmId(null)}>×</button>
            </div>
            <div className="modal-body">
              <p>Цю дію неможливо скасувати.</p>
            </div>
            <div className="modal-footer" style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px' }}>
              <button className="btn btn-secondary" onClick={() => setDeleteConfirmId(null)}>
                {t('actions.cancel')}
              </button>
              <button className="btn btn-danger" onClick={confirmDelete} disabled={deleteLoading}>
                {deleteLoading ? 'Видалення…' : t('actions.delete')}
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}
    </>
  );
}
