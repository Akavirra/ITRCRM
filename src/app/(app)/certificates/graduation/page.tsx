'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  AlignCenter,
  AlignLeft,
  AlignRight,
  ArrowLeft,
  ChevronDown,
  Download,
  Plus,
  RotateCcw,
  Trash2,
  Undo2,
  Upload,
  X,
  ZoomIn,
  ZoomOut,
} from 'lucide-react';
import PageLoading from '@/components/PageLoading';
import { useUser } from '@/components/UserContext';
import { t } from '@/i18n/t';
import { formatDateKyiv } from '@/lib/date-utils';
import s from './graduation.module.css';

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

export default function GraduationCertificatesPage() {
  const router = useRouter();
  const { user } = useUser();

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
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [saving, setSaving] = useState(false);
  const [templateUrl, setTemplateUrl] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [blocks, setBlocks] = useState<BlockSetting[]>(DEFAULT_BLOCKS);
  const [savingSettings, setSavingSettings] = useState(false);
  const [deleteConfirmId, setDeleteConfirmId] = useState<number | null>(null);
  const [deleteLoading, setDeleteLoading] = useState(false);
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
    const fetchData = async () => {
      try {
        if (!user || user.role !== 'admin') {
          router.push('/dashboard');
          return;
        }

        const [certRes, courseRes, groupRes, templateRes, settingsRes] = await Promise.all([
          fetch('/api/completion-certificates'),
          fetch('/api/courses'),
          fetch('/api/groups?basic=true'),
          fetch('/api/completion-certificates/template'),
          fetch('/api/completion-certificates/settings'),
        ]);

        const certData = await certRes.json();
        setCertificates(Array.isArray(certData) ? certData : []);

        setStudents([]);

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
        if (templateData.url) {
          setTemplateUrl(templateData.url);
        }

        const settingsData = await settingsRes.json() as CompletionCertificateSettings & { error?: string };
        if (settingsData && !settingsData.error && Array.isArray(settingsData.blocks)) {
          setBlocks(settingsData.blocks);
          setCourseBlockOverrides(settingsData.courseBlockOverrides || {});
        }
      } catch (error) {
        console.error('Failed to fetch data:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [router, user]);

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

  const handleCreate = () => {
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
      setCertificates((prev) => [...createdCertificates, ...prev]);
      setShowModal(false);
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

  if (loading) return <PageLoading />;
  if (!user || user.role !== 'admin') return null;

  return (
    <>
      <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1rem', borderBottom: '1px solid var(--gray-200)', paddingBottom: '0.5rem' }}>
        <button
          className="btn btn-sm"
          onClick={() => router.push('/certificates')}
          style={{
            fontWeight: 400,
            color: '#6b7280',
            borderBottom: '2px solid transparent',
            borderRadius: 0,
            background: 'transparent',
            padding: '0.5rem 0.75rem',
          }}
        >
          Подарункові
        </button>
        <button
          className="btn btn-sm"
          style={{
            fontWeight: 600,
            color: '#111827',
            borderBottom: '2px solid #111827',
            borderRadius: 0,
            background: 'transparent',
            padding: '0.5rem 0.75rem',
          }}
        >
          Про закінчення
        </button>
      </div>

      <div className="card">
        <div className="card-header" style={{ flexWrap: 'wrap', gap: '0.75rem', alignItems: 'center' }}>
          <div style={{ display: 'grid', gap: '4px' }}>
            <h3 className="card-title" style={{ margin: 0 }}>Сертифікати про закінчення</h3>
            <span style={{ fontSize: '13px', lineHeight: '18px', color: 'var(--gray-500)' }}>
              Генеруйте PDF і налаштовуйте макет у тому ж вікні.
            </span>
          </div>
          <button className="btn btn-primary" onClick={handleCreate} style={{ marginLeft: 'auto' }}>
            <Plus size={18} style={{ marginRight: '8px' }} />
            {t('actions.add')}
          </button>
        </div>

        <div className="table-container">
          {certificates.length > 0 ? (
            <div style={{ display: 'grid', gap: '1rem', padding: '0.5rem 0' }}>
              {Object.entries(groupedCertificates).map(([groupTitle, items]) => (
                <div key={groupTitle} style={{ border: '1px solid var(--gray-200)', borderRadius: '14px', overflow: 'hidden' }}>
                  <div style={{ padding: '0.75rem 1rem', borderBottom: '1px solid var(--gray-200)', background: 'var(--gray-50)', fontWeight: 700 }}>
                    {groupTitle}
                  </div>
                  <table className="table">
                    <thead>
                      <tr>
                        <th>{t('table.student')}</th>
                        <th>{t('table.course')}</th>
                        <th>Дата видачі</th>
                        <th style={{ textAlign: 'right' }}>{t('common.actions')}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {items.map((certificate) => (
                        <tr key={certificate.id}>
                          <td style={{ fontWeight: 600 }}>{certificate.student_name}</td>
                          <td style={{ color: '#6b7280', fontSize: '0.875rem' }}>{certificate.course_title || '—'}</td>
                          <td style={{ color: '#6b7280', fontSize: '0.875rem' }}>{formatDateKyiv(certificate.issue_date)}</td>
                          <td style={{ textAlign: 'right' }}>
                            <div style={{ display: 'inline-flex', gap: '6px' }}>
                              <button className="btn btn-secondary btn-sm" onClick={() => handleDownload(certificate.id)} title="Завантажити PDF">
                                <Download size={16} />
                              </button>
                              <button className="btn btn-danger btn-sm" onClick={() => handleDelete(certificate.id)} title="Видалити">
                                <Trash2 size={16} />
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ))}
            </div>
          ) : (
            <div style={{ textAlign: 'center', padding: '3rem 1rem' }}>
              <p style={{ color: 'var(--gray-500)', marginBottom: '1rem' }}>
                Сертифікатів про закінчення ще немає
              </p>
              <button className="btn btn-primary" onClick={handleCreate}>
                <Plus size={18} style={{ marginRight: '8px' }} />
                Створити перший сертифікат
              </button>
            </div>
          )}
        </div>
      </div>

      {showModal && (
        <div className="modal-overlay" onClick={() => setShowModal(false)}>
          <div className={s.modalShell} onClick={(event) => event.stopPropagation()}>
            <div className={s.modalHeader}>
              <div className={s.modalHeaderMain}>
                <button type="button" className={s.headerBack} onClick={() => setShowModal(false)} aria-label="Назад">
                  <ArrowLeft size={16} />
                </button>
                <div className={s.headerTitleStack}>
                  <div className={s.headerTitleRow}>
                    <h3 className={s.modalTitle}>Сертифікат</h3>
                    <span className={s.headerDivider}>•</span>
                    <span className={s.headerStudent}>{selectedStudent?.full_name || 'Оберіть учня'}</span>
                  </div>
                </div>
              </div>

              <div className={s.headerActions}>
                <button type="button" className={s.modalClose} onClick={() => setShowModal(false)} aria-label="Закрити">
                  <X size={16} />
                </button>
              </div>
            </div>

            <div className={s.modalBody}>
              <section className={s.canvasArea}>
                <div className={s.canvasTopbar}>
                  <div className={s.canvasMeta}>
                    <span className={s.canvasLabel}>Полотно сертифіката</span>
                  </div>

                  <div className={s.canvasToolbar}>
                    <button type="button" className={s.toolbarBtn} onClick={undoLastChange} title="Крок назад (Ctrl+Z)" disabled={!canUndo}>
                      <Undo2 size={15} />
                    </button>
                    <button type="button" className={s.toolbarBtn} onClick={() => adjustScale(-0.08)} title="Зменшити">
                      <ZoomOut size={15} />
                    </button>
                    <span className={s.toolbarScale}>{Math.round(scale * 100)}%</span>
                    <button type="button" className={s.toolbarBtn} onClick={resetViewport} title="Скинути вигляд">
                      <RotateCcw size={15} />
                    </button>
                    <button type="button" className={s.toolbarBtn} onClick={() => adjustScale(0.08)} title="Збільшити">
                      <ZoomIn size={15} />
                    </button>
                  </div>
                </div>

                {templateUrl ? (
                  <>
                  <div ref={viewportRef} className={s.canvasViewport}>
                    <div
                      className={s.canvasFrame}
                      style={{ cursor: isPanning ? 'grabbing' : 'default' }}
                    >
                      <div
                        ref={previewRef}
                        className={s.canvasContent}
                        onMouseMove={handleMouseMove}
                        onMouseUp={handleMouseUp}
                        onMouseLeave={handleMouseUp}
                        onMouseDown={handleCanvasMouseDown}
                        style={{
                          width: `${imageDimensions.width}px`,
                          height: `${imageDimensions.height}px`,
                          transform: `translate(${pan.x}px, ${pan.y}px) scale(${scale})`,
                          transformOrigin: 'center center',
                          cursor: dragging ? 'grabbing' : isPanning ? 'grabbing' : 'default',
                        }}
                      >
                        <img
                          src={templateUrl}
                          alt="Шаблон сертифіката"
                          onLoad={(event) => setImageDimensions({
                            width: event.currentTarget.naturalWidth || 842,
                            height: event.currentTarget.naturalHeight || 595,
                          })}
                        />

                        {renderedBlocks.map((block, index) => {
                          const isSelected = selectedBlock === index;
                          const text = getPreviewText(block.key);

                          return (
                            <div
                              key={block.key}
                              className={`${s.canvasBlock} ${isSelected ? s.canvasBlockSelected : ''}`}
                              onClick={(event) => {
                                event.stopPropagation();
                                setSelectedBlock(index);
                                setOpenAccordion('blocks');
                              }}
                              onMouseDown={(event) => {
                                if (!isSelected) return;
                                event.stopPropagation();
                                pushHistory();
                                const rect = event.currentTarget.getBoundingClientRect();
                                setDragging({
                                  index,
                                  offsetX: event.clientX - (rect.left + rect.width / 2),
                                  offsetY: event.clientY - (rect.top + rect.height / 2),
                                });
                              }}
                              style={{
                                left: `${block.xPercent}%`,
                                bottom: `${block.yPercent}%`,
                                transform: 'translateX(-50%)',
                                color: block.color,
                                fontSize: `${block.size}px`,
                                fontFamily: getBlockFontFamily(block.key),
                                fontWeight: block.weight === 'bold' ? 700 : 400,
                                fontStyle: block.style === 'italic' ? 'italic' : 'normal',
                                textAlign: block.align,
                                whiteSpace: 'pre',
                                maxWidth: 'none',
                              }}
                            >
                              {isSelected && (
                                <div
                                  className={s.blockToolbar}
                                  onMouseDown={(event) => event.stopPropagation()}
                                  style={{ transform: `translateX(-50%) scale(${toolbarScale})` }}
                                >
                                  <input
                                    type="color"
                                    value={block.color}
                                    onChange={(event) => updateBlock(index, { color: event.target.value })}
                                    className={s.blockColorInput}
                                  />
                                  {[{ value: 'left', icon: AlignLeft }, { value: 'center', icon: AlignCenter }, { value: 'right', icon: AlignRight }].map(({ value, icon: Icon }) => (
                                    <button
                                      key={value}
                                      type="button"
                                      onClick={() => updateBlock(index, { align: value as BlockSetting['align'] })}
                                      className={`${s.blockToolbarBtn} ${block.align === value ? s.blockToolbarBtnActive : ''}`}
                                    >
                                      <Icon size={14} />
                                    </button>
                                  ))}
                                  <button
                                    type="button"
                                    onClick={() => updateBlock(index, { weight: block.weight === 'bold' ? 'normal' : 'bold' })}
                                    className={`${s.blockToolbarBtn} ${block.weight === 'bold' ? s.blockToolbarBtnActive : ''}`}
                                  >
                                    B
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => updateBlock(index, { style: block.style === 'italic' ? 'normal' : 'italic' })}
                                    className={`${s.blockToolbarBtn} ${block.style === 'italic' ? s.blockToolbarBtnActive : ''}`}
                                  >
                                    I
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => updateBlock(index, { size: Math.max(10, block.size - 2) })}
                                    className={s.blockToolbarBtn}
                                    title="Зменшити розмір"
                                  >
                                    -
                                  </button>
                                  <button
                                    type="button"
                                    className={s.blockToolbarSize}
                                    title={`Поточний розмір: ${block.size}px`}
                                  >
                                    {block.size}px
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => updateBlock(index, { size: Math.min(160, block.size + 2) })}
                                    className={s.blockToolbarBtn}
                                    title="Збільшити розмір"
                                  >
                                    +
                                  </button>
                                </div>
                              )}

                              {isSelected && (
                                <>
                                  {[
                                    { top: '-7px', left: '-7px', cursor: 'nwse-resize', directionY: -1 as const },
                                    { top: '-7px', right: '-7px', cursor: 'nesw-resize', directionY: -1 as const },
                                    { bottom: '-7px', left: '-7px', cursor: 'nesw-resize', directionY: 1 as const },
                                    { bottom: '-7px', right: '-7px', cursor: 'nwse-resize', directionY: 1 as const },
                                  ].map(({ directionY, ...handleStyle }, handleIndex) => (
                                    <button
                                      key={handleIndex}
                                      type="button"
                                      className={s.resizeHandle}
                                      onMouseDown={(event) => {
                                        event.stopPropagation();
                                        pushHistory();
                                        setResizing({ index, startSize: block.size, startY: event.clientY, directionY });
                                      }}
                                      style={handleStyle}
                                    />
                                  ))}
                                </>
                              )}

                              {text}
                            </div>
                          );
                        })}
                      </div>
                      {(panBounds.x > 0 || panBounds.y > 0) && (
                        <div className={s.panOverlay}>
                          {panBounds.y > 0 && (
                            <div className={`${s.panRail} ${s.panRailVertical}`}>
                              <input
                                type="range"
                                min={-panBounds.y}
                                max={panBounds.y}
                                value={Math.round(pan.y)}
                                onChange={(event) => setPan((prev) => ({ ...prev, y: parseInt(event.target.value, 10) }))}
                                className={`${s.panSlider} ${s.panSliderVertical}`}
                                aria-label="Прокрутка по вертикалі"
                              />
                            </div>
                          )}
                          {panBounds.x > 0 && (
                            <div className={`${s.panRail} ${s.panRailHorizontal}`}>
                              <input
                                type="range"
                                min={-panBounds.x}
                                max={panBounds.x}
                                value={Math.round(pan.x)}
                                onChange={(event) => setPan((prev) => ({ ...prev, x: parseInt(event.target.value, 10) }))}
                                className={`${s.panSlider} ${s.panSliderHorizontal}`}
                                aria-label="Прокрутка по горизонталі"
                              />
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                  </>
                ) : (
                  <div className={s.canvasEmpty}>
                    <span className={s.canvasEmptyTitle}>Спочатку завантажте шаблон сертифіката</span>
                    <span className={s.canvasEmptyDesc}>Після цього тут з'явиться повноцінне прев’ю з drag & drop і редагуванням блоків.</span>
                  </div>
                )}

              </section>

              <aside className={s.sidebar}>
                <div className={s.sidebarInner}>
                  <section className={s.accordionSection}>
                    <button type="button" className={s.accordionHeader} onClick={() => toggleAccordion('data')}>
                      <div>
                        <div className={s.accordionTitle}>Дані</div>
                        <div className={s.accordionMeta}>Учень, курс, дата і стать</div>
                      </div>
                      <ChevronDown className={`${s.accordionChevron} ${openAccordion === 'data' ? s.accordionChevronOpen : ''}`} />
                    </button>
                    {openAccordion === 'data' && (
                      <div className={s.accordionBody}>
                        <div className={s.summaryCard}>
                          <span className={s.summaryLabel}>
                            {selectionMode === 'group' ? 'Групове створення' : 'Поточний сертифікат'}
                          </span>
                          <strong className={s.summaryValue}>
                            {selectionMode === 'group'
                              ? (selectedGroup ? `${selectedGroup.title} · ${selectedGroupStudentIds.length} уч.` : 'Оберіть групу')
                              : (selectedStudent?.full_name || 'Оберіть учня')}
                          </strong>
                          <span className={s.summaryMeta}>
                            {selectionMode === 'group'
                              ? `${selectedGroupStudentIds.length} із ${students.length} активних учнів буде створено`
                              : (selectedCourse?.title || 'Курс ще не обрано')}
                          </span>
                        </div>

                        <div className={s.compactGroup}>
                          <label className={s.compactLabel}>Режим створення</label>
                          <div className={s.segmentedControl}>
                            <button
                              type="button"
                              className={`${s.segmentedOption} ${selectionMode === 'single' ? s.segmentedOptionActive : ''}`}
                              onClick={() => handleSelectionModeChange('single')}
                            >
                              Один учень
                            </button>
                            <button
                              type="button"
                              className={`${s.segmentedOption} ${selectionMode === 'group' ? s.segmentedOptionActive : ''}`}
                              onClick={() => handleSelectionModeChange('group')}
                            >
                              Уся група
                            </button>
                          </div>
                        </div>

                        <div className={s.compactGroup}>
                          <label className={s.compactLabel}>Курс</label>
                          <select
                            className="form-select"
                            value={formData.course_id}
                            onChange={(event) => handleCourseChange(event.target.value)}
                          >
                            <option value="">Оберіть курс</option>
                            {courses.map((course) => (
                              <option key={course.id} value={course.id}>{course.title}</option>
                            ))}
                          </select>
                        </div>

                        {selectionMode === 'single' && (
                          <div className={s.compactGroup}>
                            <label className={s.compactLabel}>Пошук учня</label>
                            <input
                              type="text"
                              className="form-input"
                              value={studentSearch}
                              onChange={(event) => setStudentSearch(event.target.value)}
                              placeholder="Введіть ім’я учня"
                            />
                          </div>
                        )}

                        <div className={s.compactGroup}>
                          <label className={s.compactLabel}>
                            Група {selectionMode === 'group' && <span className={s.compactRequired}>*</span>}
                          </label>
                          <select
                            className="form-select"
                            value={formData.group_id}
                            onChange={(event) => handleGroupChange(event.target.value)}
                            disabled={selectionMode === 'group' ? !formData.course_id : false}
                          >
                            <option value="">{selectionMode === 'single' ? 'Будь-яка група' : 'Оберіть групу'}</option>
                            {filteredGroups.map((group) => (
                              <option key={group.id} value={group.id}>{group.title}</option>
                            ))}
                          </select>
                        </div>

                        {selectionMode === 'single' ? (
                          <div className={s.compactGroup}>
                            <label className={s.compactLabel}>Учень <span className={s.compactRequired}>*</span></label>
                            <select
                              className="form-select"
                              value={formData.student_id}
                              onChange={(event) => onStudentChange(event.target.value)}
                              disabled={loadingStudentOptions || loadingGroupStudents}
                            >
                              <option value="">
                                {loadingStudentOptions || loadingGroupStudents ? 'Завантаження учнів…' : 'Оберіть учня'}
                              </option>
                              {students.map((student) => (
                                <option key={student.id} value={student.id}>{student.full_name}</option>
                              ))}
                            </select>
                          </div>
                        ) : (
                          <div className={s.groupSelectionCard}>
                            <div className={s.groupSelectionHeader}>
                              <span>{selectedGroup ? selectedGroup.title : 'Оберіть групу'}</span>
                              <button
                                type="button"
                                className={s.selectionLink}
                                onClick={() => {
                                  const allIds = students.map((student) => String(student.id));
                                  setSelectedGroupStudentIds(allIds);
                                  setActiveGroupStudentId(allIds[0] || '');
                                  setFormData((prev) => ({ ...prev, student_id: allIds[0] || '' }));
                                }}
                                disabled={!students.length}
                              >
                                Вибрати всіх
                              </button>
                            </div>
                            <div className={s.groupStudentList}>
                              {loadingGroupStudents ? (
                                <span className={s.groupSelectionHint}>Завантаження активних учнів…</span>
                              ) : students.length ? (
                                students.map((student) => (
                                  <div
                                    key={student.id}
                                    className={`${s.groupStudentItem} ${activeGroupStudentId === String(student.id) ? s.groupStudentItemActive : ''}`}
                                  >
                                    <label className={s.groupStudentCheck}>
                                      <input
                                        type="checkbox"
                                        checked={selectedGroupStudentIds.includes(String(student.id))}
                                        onChange={() => toggleGroupStudent(String(student.id))}
                                      />
                                    </label>
                                    <button
                                      type="button"
                                      className={s.groupStudentButton}
                                      onClick={() => selectGroupStudent(String(student.id))}
                                    >
                                      <span>{student.full_name}</span>
                                      {groupStudentDrafts[String(student.id)]?.gender && (
                                        <span className={s.groupStudentMeta}>
                                          {groupStudentDrafts[String(student.id)]?.gender === 'male' ? 'чол.' : 'жін.'}
                                        </span>
                                      )}
                                    </button>
                                  </div>
                                ))
                              ) : (
                                <span className={s.groupSelectionHint}>У вибраній групі немає активних учнів</span>
                              )}
                            </div>
                          </div>
                        )}

                        <div className={s.compactRow}>
                          <div className={s.compactGroup}>
                            <label className={s.compactLabel}>Дата <span className={s.compactRequired}>*</span></label>
                            <input
                              type="date"
                              className="form-input"
                              value={formData.issue_date}
                              onChange={(event) => setFormData((prev) => ({ ...prev, issue_date: event.target.value }))}
                            />
                          </div>
                          <div className={s.compactGroup}>
                            <label className={s.compactLabel}>
                              {selectionMode === 'group' ? 'Стать у прев’ю' : 'Стать'} <span className={s.compactRequired}>*</span>
                            </label>
                            <select
                              className="form-select"
                              value={effectiveGender}
                              onChange={(event) => {
                                const nextGender = event.target.value as 'male' | 'female';
                                if (selectionMode === 'group' && activeGroupStudentId) {
                                  setGroupStudentDrafts((prev) => ({
                                    ...prev,
                                    [activeGroupStudentId]: {
                                      gender: nextGender,
                                      previewTexts: prev[activeGroupStudentId]?.previewTexts || {},
                                    },
                                  }));
                                  return;
                                }
                                setFormData((prev) => ({ ...prev, gender: nextGender }));
                              }}
                              disabled={selectionMode === 'group' && !formData.student_id}
                            >
                              <option value="">Оберіть</option>
                              <option value="female">Жіноча</option>
                              <option value="male">Чоловіча</option>
                            </select>
                          </div>
                        </div>
                      </div>
                    )}
                  </section>

                  <section className={s.accordionSection}>
                    <button type="button" className={s.accordionHeader} onClick={() => toggleAccordion('blocks')}>
                      <div>
                        <div className={s.accordionTitle}>Текстові блоки</div>
                        <div className={s.accordionMeta}>Позиція, стиль і текст активного елемента</div>
                      </div>
                      <ChevronDown className={`${s.accordionChevron} ${openAccordion === 'blocks' ? s.accordionChevronOpen : ''}`} />
                    </button>
                    {openAccordion === 'blocks' && (
                      <div className={s.accordionBody}>
                        <div className={s.blockList}>
                          {renderedBlocks.map((block, index) => {
                            const isActive = selectedBlock === index;
                            return (
                              <button
                                key={block.key}
                                type="button"
                                onClick={() => {
                                  setSelectedBlock(index);
                                  setOpenAccordion('blocks');
                                }}
                                className={`${s.blockItem} ${isActive ? s.blockItemActive : ''}`}
                              >
                                <span>
                                  <span className={s.blockItemName}>{BLOCK_LABELS[block.key]}</span>
                                  <span className={s.blockItemMeta}>{Math.round(block.xPercent)}% / {Math.round(block.yPercent)}%</span>
                                </span>
                                <span className={s.blockItemMeta}>{block.size}px</span>
                              </button>
                            );
                          })}
                        </div>

                        <div className={s.blockEditor}>
                          <div className={s.compactGroup}>
                            <label className={s.compactLabel}>Текст у прев’ю</label>
                            <textarea
                              className="form-input"
                              rows={activeBlock.key === 'verb' ? 3 : 2}
                              value={activeBlock.key === 'course_name'
                                ? getPreviewText(activeBlock.key)
                                : ((selectionMode === 'group' && activeGroupDraft
                                    ? activeGroupDraft.previewTexts[activeBlock.key]
                                    : previewTexts[activeBlock.key]) ?? getPreviewText(activeBlock.key))}
                              disabled={activeBlock.key === 'course_name'}
                              onChange={(event) => {
                                pushHistory();
                                if (selectionMode === 'group' && activeGroupStudentId) {
                                  setGroupStudentDrafts((prev) => ({
                                    ...prev,
                                    [activeGroupStudentId]: {
                                      gender: prev[activeGroupStudentId]?.gender || effectiveGender,
                                      previewTexts: {
                                        ...(prev[activeGroupStudentId]?.previewTexts || {}),
                                        [activeBlock.key]: event.target.value,
                                      },
                                    },
                                  }));
                                  return;
                                }
                                setPreviewTexts((prev) => ({
                                  ...prev,
                                  [activeBlock.key]: event.target.value,
                                }));
                              }}
                            />
                          </div>

                          <div className={s.compactRow}>
                            <div className={s.compactGroup}>
                              <label className={s.compactLabel}>Розмір</label>
                              <input
                                type="number"
                                className="form-input"
                                min="10"
                                max="160"
                                value={activeBlock.size}
                                onChange={(event) => updateBlock(activeBlockIndex, { size: parseInt(event.target.value, 10) || 10 })}
                              />
                            </div>
                            <div className={s.compactGroup}>
                              <label className={s.compactLabel}>Колір</label>
                              <input
                                type="color"
                                className={`form-input ${s.colorInput}`}
                                value={activeBlock.color}
                                onChange={(event) => updateBlock(activeBlockIndex, { color: event.target.value })}
                              />
                            </div>
                          </div>

                          <div className={s.compactRow}>
                            <div className={s.compactGroup}>
                              <label className={s.compactLabel}>Вирівнювання</label>
                              <select
                                className="form-select"
                                value={activeBlock.align}
                                onChange={(event) => updateBlock(activeBlockIndex, { align: event.target.value as BlockSetting['align'] })}
                              >
                                <option value="left">Ліворуч</option>
                                <option value="center">По центру</option>
                                <option value="right">Праворуч</option>
                              </select>
                            </div>
                            <div className={s.compactGroup}>
                              <label className={s.compactLabel}>Накреслення</label>
                              <select
                                className="form-select"
                                value={`${activeBlock.weight}:${activeBlock.style}`}
                                onChange={(event) => {
                                  const [weight, style] = event.target.value.split(':') as [BlockSetting['weight'], BlockSetting['style']];
                                  updateBlock(activeBlockIndex, { weight, style });
                                }}
                              >
                                <option value="normal:normal">Звичайне</option>
                                <option value="bold:normal">Жирне</option>
                                <option value="normal:italic">Курсив</option>
                                <option value="bold:italic">Жирний курсив</option>
                              </select>
                            </div>
                          </div>

                          <div className={s.sliderGroup}>
                            <label className={s.compactLabel}>Позиція зліва: {activeBlock.xPercent}%</label>
                            <input
                              type="range"
                              min="0"
                              max="100"
                              value={activeBlock.xPercent}
                              onChange={(event) => updateBlock(activeBlockIndex, { xPercent: parseInt(event.target.value, 10) })}
                            />
                          </div>

                          <div className={s.sliderGroup}>
                            <label className={s.compactLabel}>Позиція знизу: {activeBlock.yPercent}%</label>
                            <input
                              type="range"
                              min="0"
                              max="100"
                              value={activeBlock.yPercent}
                              onChange={(event) => updateBlock(activeBlockIndex, { yPercent: parseInt(event.target.value, 10) })}
                            />
                          </div>

                        </div>
                      </div>
                    )}
                  </section>

                  <section className={s.accordionSection}>
                    <button type="button" className={s.accordionHeader} onClick={() => toggleAccordion('template')}>
                      <div>
                        <div className={s.accordionTitle}>Шаблон</div>
                        <div className={s.accordionMeta}>PNG або JPG до 10 МБ</div>
                      </div>
                      <ChevronDown className={`${s.accordionChevron} ${openAccordion === 'template' ? s.accordionChevronOpen : ''}`} />
                    </button>
                    {openAccordion === 'template' && (
                      <div className={s.accordionBody}>
                        <input
                          id="completion-certificate-template"
                          type="file"
                          accept="image/png,image/jpeg"
                          style={{ display: 'none' }}
                          onChange={(event) => setSelectedFile(event.target.files?.[0] || null)}
                        />
                        <div className={s.templateInfo}>
                          <span className={s.templateHint}>Поточний файл</span>
                          <span className={s.templateFileName}>{selectedFile?.name || (templateUrl ? 'Шаблон завантажено' : 'Файл ще не вибрано')}</span>
                        </div>

                        <div className={s.templateActions}>
                          <label htmlFor="completion-certificate-template" className={s.templateUploadLabel}>
                            <Upload size={14} />
                            Обрати файл
                          </label>
                          <button className="btn btn-primary btn-sm" onClick={handleUploadTemplate} disabled={!selectedFile || uploading}>
                            {uploading ? 'Завантаження…' : 'Оновити'}
                          </button>
                        </div>
                      </div>
                    )}
                  </section>
                </div>
              </aside>
            </div>

            <div className={s.modalFooter}>
              <div className={s.footerActions}>
                <button className="btn btn-secondary" onClick={() => setShowModal(false)}>
                  {t('actions.close')}
                </button>
                <button className="btn btn-primary" onClick={handleSaveSettings} disabled={savingSettings}>
                  {savingSettings ? 'Зберігаємо…' : 'Зберегти вигляд'}
                </button>
                <button className="btn btn-primary" onClick={handleSave} disabled={!canCreate}>
                  {saving ? 'Генеруємо…' : 'Згенерувати PDF'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {deleteConfirmId !== null && (
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
        </div>
      )}
    </>
  );
}
