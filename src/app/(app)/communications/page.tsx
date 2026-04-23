'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  AlertCircle,
  AtSign,
  BookOpen,
  Check,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Edit3,
  Mail,
  Plus,
  RefreshCw,
  Save,
  Search,
  Send,
  School,
  Trash2,
  UserRound,
  Users,
  UsersRound,
  X,
  type LucideIcon,
} from 'lucide-react';
import styles from './communications.module.css';
import type {
  AudienceFilter,
  AudiencePreview,
  CampaignSummary,
  MessageTemplate,
  MessagingStudent,
} from '@/lib/messaging';

interface CourseOption {
  id: number;
  title: string;
}

interface GroupOption {
  id: number;
  title: string;
  course_title?: string;
}

interface StudentOption {
  id: number;
  full_name: string;
  public_id: string;
}

type Step = 'audience' | 'message' | 'review';

const STEPS: Array<{ id: Step; label: string; hint: string }> = [
  { id: 'audience', label: 'Аудиторія', hint: 'Кому надсилаємо' },
  { id: 'message', label: 'Повідомлення', hint: 'Шаблон і текст' },
  { id: 'review', label: 'Перевірка', hint: 'Preview і запуск' },
];

const EMPTY_TEMPLATE = {
  name: '',
  subject: '',
  body: '',
};

const DEFAULT_SUBJECT = 'Повідомлення від ITRobotics';
const DEFAULT_BODY = 'Вітаємо, {{parentName}}!\n\nПишемо щодо навчання {{studentName}}.\n\nЗ повагою,\nITRobotics';

const VARIABLE_CHIPS: Record<string, { label: string; icon: LucideIcon }> = {
  studentName: { label: 'Імʼя учня', icon: UserRound },
  parentName: { label: 'Батьки', icon: UsersRound },
  studentEmail: { label: 'Email', icon: AtSign },
  school: { label: 'Школа', icon: School },
  groups: { label: 'Групи', icon: Users },
  courses: { label: 'Курси', icon: BookOpen },
};

function renderMessage(template: string, student: MessagingStudent | null): string {
  if (!student) return template;

  const values = getStudentVariables(student);
  return template.replace(/\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g, (_, key: string) => values[key] ?? '');
}

function getStudentVariables(student: MessagingStudent): Record<string, string> {
  const courses = Array.from(new Set(student.groups.map((group) => group.course_title).filter(Boolean)));
  return {
    studentName: student.full_name,
    parentName: student.parent_name || '',
    studentEmail: student.email || '',
    school: student.school || '',
    groups: student.groups.map((group) => group.title).join(', '),
    courses: courses.join(', '),
  };
}

function extractVariables(value: string): string[] {
  return Array.from(value.matchAll(/\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g), (match) => match[1]);
}

function templateSnippet(value: string): string {
  const firstLine = value.split('\n').find((line) => line.trim())?.trim() || 'Без тексту';
  return firstLine.length > 88 ? `${firstLine.slice(0, 85)}...` : firstLine;
}

function formatDateTime(value: string | null): string {
  if (!value) return '—';
  return new Date(value).toLocaleString('uk-UA', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function statusLabel(status: CampaignSummary['status']): string {
  const labels: Record<CampaignSummary['status'], string> = {
    draft: 'Чернетка',
    sending: 'Надсилається',
    sent: 'Надіслано',
    failed: 'Помилка',
  };
  return labels[status] || status;
}

export default function CommunicationsPage() {
  const [step, setStep] = useState<Step>('audience');
  const [templates, setTemplates] = useState<MessageTemplate[]>([]);
  const [campaigns, setCampaigns] = useState<CampaignSummary[]>([]);
  const [variables, setVariables] = useState<string[]>([]);
  const [courses, setCourses] = useState<CourseOption[]>([]);
  const [groups, setGroups] = useState<GroupOption[]>([]);
  const [selectedTemplateId, setSelectedTemplateId] = useState<number | null>(null);
  const [templateDraft, setTemplateDraft] = useState(EMPTY_TEMPLATE);
  const [campaignName, setCampaignName] = useState('');
  const [subject, setSubject] = useState(DEFAULT_SUBJECT);
  const [body, setBody] = useState(DEFAULT_BODY);
  const [filter, setFilter] = useState<AudienceFilter>({
    mode: 'all',
    requireEmail: true,
    includeInactive: false,
    studentIds: [],
    courseIds: [],
    groupIds: [],
    studyStatuses: ['studying'],
    search: '',
  });
  const [preview, setPreview] = useState<AudiencePreview | null>(null);
  const [selectedPreviewIndex, setSelectedPreviewIndex] = useState(0);
  const [studentSearch, setStudentSearch] = useState('');
  const studentSearchRef = useRef<HTMLInputElement | null>(null);
  const [studentOptions, setStudentOptions] = useState<StudentOption[]>([]);
  const [selectedStudents, setSelectedStudents] = useState<StudentOption[]>([]);
  const [excludedIds, setExcludedIds] = useState<Set<number>>(() => new Set());
  const [loading, setLoading] = useState(true);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [savingTemplate, setSavingTemplate] = useState(false);
  const [sending, setSending] = useState(false);
  const [notice, setNotice] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [courseFilterOpen, setCourseFilterOpen] = useState(false);
  const [groupFilterOpen, setGroupFilterOpen] = useState(false);
  const [courseSearch, setCourseSearch] = useState('');
  const [groupSearch, setGroupSearch] = useState('');
  const [audienceListOpen, setAudienceListOpen] = useState(false);
  const [templateModalOpen, setTemplateModalOpen] = useState(false);
  const [lastSendResult, setLastSendResult] = useState<CampaignSummary | null>(null);

  const selectedTemplate = useMemo(
    () => templates.find((template) => template.id === selectedTemplateId) || null,
    [selectedTemplateId, templates]
  );

  const effectiveFilter = useMemo<AudienceFilter>(() => ({
    ...filter,
    studentIds: selectedStudents.map((student) => student.id),
    excludedStudentIds: Array.from(excludedIds),
  }), [excludedIds, filter, selectedStudents]);

  const visibleStudents = useMemo(
    () => (preview?.students || []).filter((student) => !excludedIds.has(student.id)),
    [excludedIds, preview?.students]
  );

  const visibleCounts = useMemo(() => {
    const missingEmail = visibleStudents.filter((student) => !student.email || !student.email.includes('@')).length;
    const deliverable = filter.requireEmail === false
      ? visibleStudents.filter((student) => Boolean(student.email && student.email.includes('@'))).length
      : visibleStudents.length;
    return {
      total: visibleStudents.length,
      deliverable,
      missingEmail,
      suppressed: preview?.suppressed ?? 0,
    };
  }, [filter.requireEmail, preview?.suppressed, visibleStudents]);

  const selectedPreviewStudent = visibleStudents[selectedPreviewIndex] || visibleStudents[0] || null;

  const audienceLabel = useMemo(() => {
    if (filter.mode === 'manual') {
      return selectedStudents.length > 0 ? `${selectedStudents.length} обрано вручну` : 'Ручний добір';
    }
    if ((filter.groupIds || []).length > 0) return `${filter.groupIds?.length} груп`;
    if ((filter.courseIds || []).length > 0) return `${filter.courseIds?.length} курсів`;
    return 'Активні учні';
  }, [filter.courseIds, filter.groupIds, filter.mode, selectedStudents.length]);

  const selectedCourseTitles = useMemo(
    () => courses.filter((course) => (filter.courseIds || []).includes(course.id)).map((course) => course.title),
    [courses, filter.courseIds]
  );

  const selectedGroupTitles = useMemo(
    () => groups.filter((group) => (filter.groupIds || []).includes(group.id)).map((group) => group.title),
    [groups, filter.groupIds]
  );

  const audienceExplanation = useMemo(() => {
    const parts: string[] = [];
    if (filter.mode === 'manual') {
      parts.push(selectedStudents.length > 0 ? `ручний список: ${selectedStudents.length} учнів` : 'ручний список ще порожній');
    } else {
      parts.push((filter.studyStatuses || []).includes('studying') ? 'учні, які навчаються' : 'обрані статуси учнів');
    }
    if (filter.requireEmail !== false) parts.push('мають email');
    if (selectedCourseTitles.length > 0) parts.push(`курси: ${selectedCourseTitles.slice(0, 3).join(', ')}`);
    if (selectedGroupTitles.length > 0) parts.push(`групи: ${selectedGroupTitles.slice(0, 3).join(', ')}`);
    if (filter.search?.trim()) parts.push(`пошук: "${filter.search.trim()}"`);
    if (filter.includeInactive) parts.push('включно з архівом');
    if (excludedIds.size > 0) parts.push(`виключено: ${excludedIds.size}`);
    return `Показуємо: ${parts.join('; ')}.`;
  }, [excludedIds.size, filter.includeInactive, filter.mode, filter.requireEmail, filter.search, filter.studyStatuses, selectedCourseTitles, selectedGroupTitles, selectedStudents.length]);

  const filteredCourses = useMemo(() => {
    const query = courseSearch.trim().toLowerCase();
    return query ? courses.filter((course) => course.title.toLowerCase().includes(query)) : courses;
  }, [courseSearch, courses]);

  const filteredGroups = useMemo(() => {
    const query = groupSearch.trim().toLowerCase();
    return query
      ? groups.filter((group) => `${group.title} ${group.course_title || ''}`.toLowerCase().includes(query))
      : groups;
  }, [groupSearch, groups]);

  const usedVariables = useMemo(
    () => Array.from(new Set([...extractVariables(subject), ...extractVariables(body)])),
    [body, subject]
  );

  const unknownVariables = useMemo(
    () => usedVariables.filter((variable) => !variables.includes(variable)),
    [usedVariables, variables]
  );

  const emptyVariables = useMemo(() => {
    if (!selectedPreviewStudent) return [];
    const values = getStudentVariables(selectedPreviewStudent);
    return usedVariables.filter((variable) => variables.includes(variable) && !values[variable]);
  }, [selectedPreviewStudent, usedVariables, variables]);

  const canGoReview = Boolean(subject.trim() && body.trim() && visibleCounts.deliverable && unknownVariables.length === 0);
  const currentStepIndex = STEPS.findIndex((item) => item.id === step);

  const loadBootstrap = useCallback(async () => {
    setLoading(true);
    try {
      const [bootstrapRes, coursesRes, groupsRes] = await Promise.all([
        fetch('/api/messaging/bootstrap', { cache: 'no-store' }),
        fetch('/api/courses?simple=true', { cache: 'no-store' }),
        fetch('/api/groups?basic=true', { cache: 'no-store' }),
      ]);

      const bootstrap = await bootstrapRes.json();
      const coursesData = await coursesRes.json();
      const groupsData = await groupsRes.json();

      setTemplates(Array.isArray(bootstrap.templates) ? bootstrap.templates : []);
      setCampaigns(Array.isArray(bootstrap.campaigns) ? bootstrap.campaigns : []);
      setVariables(Array.isArray(bootstrap.variables) ? bootstrap.variables : []);
      setCourses(Array.isArray(coursesData.courses) ? coursesData.courses : []);
      setGroups(Array.isArray(groupsData.groups) ? groupsData.groups : []);

      if (Array.isArray(bootstrap.templates) && bootstrap.templates.length > 0) {
        const first = bootstrap.templates[0] as MessageTemplate;
        setSelectedTemplateId(first.id);
        setTemplateDraft({
          name: first.name,
          subject: first.subject || '',
          body: first.body,
        });
        setSubject(first.subject || DEFAULT_SUBJECT);
        setBody(first.body);
        setCampaignName(first.name);
      }
    } catch {
      setNotice({ type: 'error', text: 'Не вдалося завантажити дані розсилок' });
    } finally {
      setLoading(false);
    }
  }, []);

  const refreshPreview = useCallback(async () => {
    setPreviewLoading(true);
    try {
      const res = await fetch('/api/messaging/audience/preview', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ filter: effectiveFilter }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || 'Preview failed');
      setPreview(data);
      setSelectedPreviewIndex(0);
    } catch {
      setNotice({ type: 'error', text: 'Не вдалося оновити аудиторію' });
    } finally {
      setPreviewLoading(false);
    }
  }, [effectiveFilter]);

  useEffect(() => {
    void loadBootstrap();
  }, [loadBootstrap]);

  useEffect(() => {
    if (!loading) {
      void refreshPreview();
    }
  }, [loading, refreshPreview]);

  useEffect(() => {
    if (!notice) return;
    const id = window.setTimeout(() => setNotice(null), 5000);
    return () => window.clearTimeout(id);
  }, [notice]);

  useEffect(() => {
    setSelectedPreviewIndex((current) => Math.min(current, Math.max(visibleStudents.length - 1, 0)));
  }, [visibleStudents.length]);

  useEffect(() => {
    const query = studentSearch.trim();
    if (query.length < 2) {
      setStudentOptions([]);
      return;
    }

    let active = true;
    const id = window.setTimeout(() => {
      fetch(`/api/students?autocomplete=true&limit=8&search=${encodeURIComponent(query)}`)
        .then((res) => res.ok ? res.json() : { students: [] })
        .then((data) => {
          if (active) {
            setStudentOptions(Array.isArray(data.students) ? data.students : []);
          }
        })
        .catch(() => {
          if (active) setStudentOptions([]);
        });
    }, 220);

    return () => {
      active = false;
      window.clearTimeout(id);
    };
  }, [studentSearch]);

  const setArrayValue = (key: 'courseIds' | 'groupIds', id: number, checked: boolean) => {
    setFilter((current) => {
      const values = new Set(current[key] || []);
      if (checked) values.add(id);
      else values.delete(id);
      return { ...current, mode: 'all', [key]: Array.from(values) };
    });
  };

  const setStatusValue = (status: 'studying' | 'not_studying', checked: boolean) => {
    setFilter((current) => {
      const values = new Set(current.studyStatuses || []);
      if (checked) values.add(status);
      else values.delete(status);
      return { ...current, studyStatuses: Array.from(values) };
    });
  };

  const handleTemplateSelect = (id: number) => {
    const template = templates.find((item) => item.id === id);
    if (!template) return;

    setSelectedTemplateId(id);
    setTemplateDraft({
      name: template.name,
      subject: template.subject || '',
      body: template.body,
    });
    setSubject(template.subject || DEFAULT_SUBJECT);
    setBody(template.body);
    setCampaignName(template.name);
    setTemplateModalOpen(false);
  };

  const handleNewTemplate = () => {
    setSelectedTemplateId(null);
    setTemplateDraft({
      name: 'Новий шаблон',
      subject: DEFAULT_SUBJECT,
      body: DEFAULT_BODY,
    });
    setTemplateModalOpen(true);
  };

  const handleEditTemplate = () => {
    if (!selectedTemplate) {
      handleNewTemplate();
      return;
    }

    setTemplateDraft({
      name: selectedTemplate.name,
      subject: selectedTemplate.subject || '',
      body: selectedTemplate.body,
    });
    setTemplateModalOpen(true);
  };

  const saveTemplate = async () => {
    setSavingTemplate(true);
    try {
      const url = selectedTemplateId
        ? `/api/messaging/templates/${selectedTemplateId}`
        : '/api/messaging/templates';
      const res = await fetch(url, {
        method: selectedTemplateId ? 'PATCH' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: templateDraft.name,
          subject: templateDraft.subject,
          body: templateDraft.body,
          variables,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || 'Не вдалося зберегти шаблон');

      setTemplates((current) => {
        const next = current.filter((template) => template.id !== data.template.id);
        return [data.template, ...next];
      });
      setSelectedTemplateId(data.template.id);
      setSubject(data.template.subject || DEFAULT_SUBJECT);
      setBody(data.template.body);
      setTemplateModalOpen(false);
      setNotice({ type: 'success', text: 'Шаблон збережено' });
    } catch (error) {
      setNotice({ type: 'error', text: error instanceof Error ? error.message : 'Не вдалося зберегти шаблон' });
    } finally {
      setSavingTemplate(false);
    }
  };

  const deleteTemplate = async () => {
    if (!selectedTemplateId || !window.confirm('Видалити цей шаблон?')) return;

    try {
      const res = await fetch(`/api/messaging/templates/${selectedTemplateId}`, { method: 'DELETE' });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || 'Не вдалося видалити шаблон');
      setTemplates((current) => current.filter((template) => template.id !== selectedTemplateId));
      setSelectedTemplateId(null);
      setTemplateDraft(EMPTY_TEMPLATE);
      setTemplateModalOpen(false);
      setNotice({ type: 'success', text: 'Шаблон видалено' });
    } catch (error) {
      setNotice({ type: 'error', text: error instanceof Error ? error.message : 'Не вдалося видалити шаблон' });
    }
  };

  const addStudent = (student: StudentOption) => {
    if (selectedStudents.some((item) => item.id === student.id)) return;
    setSelectedStudents((current) => [...current, student]);
    setExcludedIds((current) => {
      const next = new Set(current);
      next.delete(student.id);
      return next;
    });
    setFilter((current) => ({ ...current, mode: 'manual' }));
    setStudentSearch('');
    setStudentOptions([]);
    window.requestAnimationFrame(() => studentSearchRef.current?.focus());
  };

  const removeStudent = (id: number) => {
    setSelectedStudents((current) => current.filter((student) => student.id !== id));
  };

  const excludeStudent = (id: number) => {
    setExcludedIds((current) => {
      const next = new Set(current);
      next.add(id);
      return next;
    });
    setSelectedStudents((current) => current.filter((student) => student.id !== id));
  };

  const restoreExcludedStudents = () => {
    setExcludedIds(new Set());
  };

  const sendCampaign = async () => {
    if (!preview || visibleCounts.deliverable === 0) {
      setNotice({ type: 'error', text: 'Немає отримувачів з валідним email' });
      return;
    }

    setSending(true);
    try {
      const res = await fetch('/api/messaging/campaigns/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: campaignName || subject,
          subject,
          body,
          filter: effectiveFilter,
          templateId: selectedTemplateId,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || 'Не вдалося надіслати розсилку');
      setCampaigns((current) => [data.campaign, ...current].slice(0, 10));
      setLastSendResult(data.campaign);
      setNotice({
        type: data.campaign.failed_count > 0 ? 'error' : 'success',
        text: `Готово: надіслано ${data.campaign.sent_count}, помилок ${data.campaign.failed_count}, пропущено ${data.campaign.skipped_count}`,
      });
      void refreshPreview();
    } catch (error) {
      setNotice({ type: 'error', text: error instanceof Error ? error.message : 'Не вдалося надіслати розсилку' });
    } finally {
      setSending(false);
    }
  };

  const goNext = () => {
    if (step === 'audience') setStep('message');
    else if (step === 'message') setStep('review');
  };

  const goBack = () => {
    if (step === 'review') setStep('message');
    else if (step === 'message') setStep('audience');
  };

  if (loading) {
    return (
      <div className={styles.loadingState}>
        <RefreshCw size={20} />
        Завантаження системи розсилок...
      </div>
    );
  }

  return (
    <div className={styles.page}>
      <header className={styles.pageHeader}>
        <div>
          <h1>Розсилки</h1>
          <p>Аудиторія, текст і фінальна перевірка перед відправкою.</p>
        </div>
        <div className={styles.stepCounter}>
          <span>Крок {currentStepIndex + 1} з {STEPS.length}</span>
          <strong>{audienceLabel}</strong>
        </div>
      </header>

      {notice && (
        <div className={notice.type === 'success' ? styles.successNotice : styles.errorNotice}>
          {notice.type === 'success' ? <Check size={18} /> : <AlertCircle size={18} />}
          <span>{notice.text}</span>
          <button type="button" onClick={() => setNotice(null)} aria-label="Закрити">
            <X size={16} />
          </button>
        </div>
      )}

      <nav className={styles.stepper} aria-label="Кроки розсилки">
        {STEPS.map((item, index) => {
          const active = item.id === step;
          const done = STEPS.findIndex((candidate) => candidate.id === step) > index;
          return (
            <div key={item.id} className={styles.stepperItem}>
              <button
                type="button"
                className={active ? styles.stepActive : done ? styles.stepDone : styles.step}
                onClick={() => setStep(item.id)}
                aria-current={active ? 'step' : undefined}
              >
                <span className={styles.stepCircle}>{done ? <Check size={15} /> : index + 1}</span>
                <span className={styles.stepLabel}>{item.label}</span>
              </button>
              {index < STEPS.length - 1 && (
                <span className={done ? styles.stepLineDone : styles.stepLine} aria-hidden="true" />
              )}
            </div>
          );
        })}
      </nav>

      {step === 'audience' && (
        <section className={styles.stage}>
          <div className={styles.stageHeader}>
            <div>
              <h2>Кому надсилаємо</h2>
              <p>Почни з базового сегмента, а точні фільтри відкривай тільки за потреби.</p>
            </div>
            <Users size={22} />
          </div>

          <div className={styles.segmentPills} role="group" aria-label="Тип аудиторії">
            <button
              type="button"
              className={filter.mode !== 'manual' && (filter.studyStatuses || []).includes('studying') ? styles.pillActive : styles.pill}
              onClick={() => setFilter((current) => ({ ...current, mode: 'all', studyStatuses: ['studying'], requireEmail: true }))}
            >
              Активні
            </button>
            <button
              type="button"
              className={(filter.courseIds || []).length > 0 ? styles.pillActive : styles.pill}
              onClick={() => {
                setFilter((current) => ({ ...current, mode: 'all' }));
                setCourseFilterOpen((current) => !current);
                setGroupFilterOpen(false);
              }}
              aria-expanded={courseFilterOpen}
            >
              За курсом {(filter.courseIds || []).length > 0 ? `· ${filter.courseIds?.length}` : ''}
              <ChevronDown className={courseFilterOpen ? styles.chevronOpen : ''} size={15} />
            </button>
            <button
              type="button"
              className={(filter.groupIds || []).length > 0 ? styles.pillActive : styles.pill}
              onClick={() => {
                setFilter((current) => ({ ...current, mode: 'all' }));
                setGroupFilterOpen((current) => !current);
                setCourseFilterOpen(false);
              }}
              aria-expanded={groupFilterOpen}
            >
              За групою {(filter.groupIds || []).length > 0 ? `· ${filter.groupIds?.length}` : ''}
              <ChevronDown className={groupFilterOpen ? styles.chevronOpen : ''} size={15} />
            </button>
            <button
              type="button"
              className={filter.mode === 'manual' ? styles.pillActive : styles.pill}
              onClick={() => setFilter((current) => ({ ...current, mode: 'manual' }))}
            >
              Вручну {selectedStudents.length > 0 ? `· ${selectedStudents.length}` : ''}
            </button>
          </div>

          {selectedCourseTitles.length > 0 && (
            <div className={styles.selectedChips} aria-label="Вибрані курси">
              {courses.filter((course) => (filter.courseIds || []).includes(course.id)).map((course) => (
                <span key={course.id} className={styles.filterChip}>
                  {course.title}
                  <button type="button" onClick={() => setArrayValue('courseIds', course.id, false)} aria-label={`Прибрати курс ${course.title}`}>
                    <X size={13} />
                  </button>
                </span>
              ))}
            </div>
          )}

          {selectedGroupTitles.length > 0 && (
            <div className={styles.selectedChips} aria-label="Вибрані групи">
              {groups.filter((group) => (filter.groupIds || []).includes(group.id)).map((group) => (
                <span key={group.id} className={styles.filterChip}>
                  {group.title}
                  <button type="button" onClick={() => setArrayValue('groupIds', group.id, false)} aria-label={`Прибрати групу ${group.title}`}>
                    <X size={13} />
                  </button>
                </span>
              ))}
            </div>
          )}

          {courseFilterOpen && (
            <div className={styles.filterDropdown}>
              <div className={styles.inputWithIcon}>
                <Search size={16} />
                <input
                  value={courseSearch}
                  onChange={(event) => setCourseSearch(event.target.value)}
                  placeholder="Знайти курс"
                />
              </div>
              <div className={styles.optionList}>
                {filteredCourses.map((course) => (
                  <label key={course.id}>
                    <input
                      type="checkbox"
                      checked={(filter.courseIds || []).includes(course.id)}
                      onChange={(event) => setArrayValue('courseIds', course.id, event.target.checked)}
                    />
                    {course.title}
                  </label>
                ))}
              </div>
            </div>
          )}

          {groupFilterOpen && (
            <div className={styles.filterDropdown}>
              <div className={styles.inputWithIcon}>
                <Search size={16} />
                <input
                  value={groupSearch}
                  onChange={(event) => setGroupSearch(event.target.value)}
                  placeholder="Знайти групу"
                />
              </div>
              <div className={styles.optionList}>
                {filteredGroups.map((group) => (
                  <label key={group.id}>
                    <input
                      type="checkbox"
                      checked={(filter.groupIds || []).includes(group.id)}
                      onChange={(event) => setArrayValue('groupIds', group.id, event.target.checked)}
                    />
                    <span>{group.title}</span>
                  </label>
                ))}
              </div>
            </div>
          )}

          <div className={styles.filterRow}>
            <label className={styles.field}>
              <span className={styles.srOnly}>Пошук у сегменті</span>
              <div className={styles.inputWithIcon}>
                <Search size={16} />
                <input
                  value={filter.search || ''}
                  onChange={(event) => setFilter((current) => ({ ...current, search: event.target.value }))}
                  placeholder="Імʼя, email, школа або група"
                />
              </div>
            </label>

            <div className={styles.toggleRow}>
              <label className={styles.toggle}>
                <input
                  type="checkbox"
                  checked={(filter.studyStatuses || []).includes('studying')}
                  onChange={(event) => setStatusValue('studying', event.target.checked)}
                />
                <span>Навчаються</span>
              </label>
              <label className={styles.toggle}>
                <input
                  type="checkbox"
                  checked={(filter.studyStatuses || []).includes('not_studying')}
                  onChange={(event) => setStatusValue('not_studying', event.target.checked)}
                />
                <span>Не навчаються</span>
              </label>
              <label className={styles.toggle}>
                <input
                  type="checkbox"
                  checked={filter.requireEmail !== false}
                  onChange={(event) => setFilter((current) => ({ ...current, requireEmail: event.target.checked }))}
                />
                <span>З email</span>
              </label>
              <label className={styles.toggle}>
                <input
                  type="checkbox"
                  checked={Boolean(filter.includeInactive)}
                  onChange={(event) => setFilter((current) => ({ ...current, includeInactive: event.target.checked }))}
                />
                <span>Архів</span>
              </label>
            </div>
          </div>

          {filter.mode === 'manual' && (
            <div className={styles.manualBox}>
              <label className={styles.field}>
                <span>Додати учня</span>
                <div className={styles.inputWithIcon}>
                  <Search size={16} />
                  <input
                    ref={studentSearchRef}
                    value={studentSearch}
                    onChange={(event) => setStudentSearch(event.target.value)}
                    placeholder="Почни вводити імʼя"
                  />
                </div>
              </label>
              {studentOptions.length > 0 && (
                <div className={styles.searchResults}>
                  {studentOptions.map((student) => (
                    <button key={student.id} type="button" onClick={() => addStudent(student)}>
                      <Plus size={14} />
                      {student.full_name}
                    </button>
                  ))}
                </div>
              )}
              {selectedStudents.length > 0 && (
                <div className={styles.chipList}>
                  {selectedStudents.map((student) => (
                    <span key={student.id} className={styles.chip}>
                      {student.full_name}
                      <button type="button" onClick={() => removeStudent(student.id)} aria-label="Прибрати учня">
                        <X size={13} />
                      </button>
                    </span>
                  ))}
                </div>
              )}
            </div>
          )}

          <div className={styles.counters}>
            <span><strong>{visibleCounts.total}</strong> учні</span>
            <span><strong>{visibleCounts.deliverable}</strong> готові</span>
            <span><strong>{visibleCounts.missingEmail}</strong> без email</span>
            <span><strong>{visibleCounts.suppressed}</strong> пропущено</span>
            {excludedIds.size > 0 && <span><strong>{excludedIds.size}</strong> виключено</span>}
          </div>

          <div className={styles.listDisclosure}>
            <button
              className={styles.expandButton}
              type="button"
              onClick={() => setAudienceListOpen((current) => !current)}
              aria-expanded={audienceListOpen}
            >
              <ChevronDown className={audienceListOpen ? styles.chevronOpen : ''} size={17} />
              {audienceListOpen ? 'Сховати список учнів' : 'Показати список учнів'}
            </button>
            <div className={styles.inlineActions}>
              {excludedIds.size > 0 && (
                <button className={styles.ghostButton} type="button" onClick={restoreExcludedStudents}>
                  Повернути виключених
                </button>
              )}
              <button className={styles.ghostButton} type="button" onClick={refreshPreview} disabled={previewLoading}>
                <RefreshCw size={16} />
                Оновити
              </button>
            </div>
          </div>

          {audienceListOpen && (
          <div className={styles.audiencePreview}>
            <p className={styles.supportText}>{previewLoading ? 'Оновлюємо список...' : audienceExplanation}</p>

            {visibleStudents.length ? (
              <div className={styles.audienceList}>
                {visibleStudents.slice(0, 16).map((student, index) => (
                  <div
                    key={student.id}
                    className={index === selectedPreviewIndex ? styles.audienceRowActive : styles.audienceRow}
                  >
                    <button type="button" onClick={() => setSelectedPreviewIndex(index)}>
                      <span>{student.full_name}</span>
                      <small>{student.email || 'немає email'}</small>
                      <em>{student.groups.map((group) => group.title).slice(0, 2).join(', ') || 'без групи'}</em>
                    </button>
                    <button type="button" className={styles.excludeButton} onClick={() => excludeStudent(student.id)} aria-label={`Виключити ${student.full_name}`}>
                      <X size={15} />
                    </button>
                  </div>
                ))}
              </div>
            ) : (
              <div className={styles.emptyAudience}>
                <Users size={20} />
                Немає учнів за поточними фільтрами
              </div>
            )}

            {visibleStudents.length > 16 && (
              <p className={styles.moreText}>Показано 16 з {visibleStudents.length}. Звузь пошук або групи, щоб швидше перевірити список.</p>
            )}
          </div>
          )}

          <div className={styles.stageFooter}>
            <button className={styles.primaryButton} type="button" onClick={goNext}>
              Далі
              <ChevronRight size={16} />
            </button>
          </div>
        </section>
      )}

      {step === 'message' && (
        <section className={styles.stage}>
          <div className={styles.stageHeader}>
            <div>
              <h2>Повідомлення</h2>
              <p>Обери шаблон, уточни тему і перевір живий preview на реальному отримувачі.</p>
            </div>
            <Mail size={22} />
          </div>

          <div className={styles.templateToolbar}>
            <label className={styles.field}>
              <span>Шаблон</span>
              <select
                className={styles.templateSelect}
                value={selectedTemplateId ?? ''}
                onChange={(event) => {
                  const value = Number(event.target.value);
                  if (value) handleTemplateSelect(value);
                }}
              >
                <option value="">Власний текст</option>
                {templates.map((template) => (
                  <option key={template.id} value={template.id}>
                    {template.name}
                  </option>
                ))}
              </select>
            </label>
            <button className={styles.iconTextButton} type="button" onClick={handleNewTemplate}>
              <Plus size={16} />
              Новий
            </button>
            <button className={styles.iconTextButton} type="button" onClick={handleEditTemplate}>
              <Edit3 size={16} />
              Редагувати
            </button>
          </div>

          <div className={styles.messageGrid}>
            <div className={styles.editorStack}>
              <label className={styles.field}>
                <span>Назва розсилки</span>
                <input
                  value={campaignName}
                  onChange={(event) => setCampaignName(event.target.value)}
                  placeholder="Назва для історії"
                />
              </label>
              <label className={styles.field}>
                <span>Тема</span>
                <input value={subject} onChange={(event) => setSubject(event.target.value)} />
              </label>
              <label className={styles.field}>
                <span>Текст перед відправкою</span>
                <textarea value={body} onChange={(event) => setBody(event.target.value)} rows={10} />
              </label>
              <div className={styles.variables}>
                {variables.map((variable) => {
                  const MetaIcon = VARIABLE_CHIPS[variable]?.icon || Mail;
                  return (
                  <button
                    key={variable}
                    type="button"
                    onClick={() => setBody((current) => `${current} {{${variable}}}`)}
                    title={`Вставити {{${variable}}}`}
                  >
                    <MetaIcon size={15} />
                    {VARIABLE_CHIPS[variable]?.label || variable}
                  </button>
                  );
                })}
              </div>
            </div>

            <aside className={styles.livePreview}>
              <p>Preview email</p>
              <div className={styles.emailMeta}>
                <span>Від: ITRobotics</span>
                <span>Кому: {selectedPreviewStudent?.email || 'немає email'}</span>
              </div>
              <strong>{renderMessage(subject, selectedPreviewStudent)}</strong>
              <div className={styles.emailBody}>
                {renderMessage(body, selectedPreviewStudent).split('\n').map((line, index) => (
                  <span key={`${line}-${index}`}>{line || '\u00A0'}</span>
                ))}
              </div>
              {(unknownVariables.length > 0 || emptyVariables.length > 0) && (
                <div className={styles.variableWarnings}>
                  {unknownVariables.length > 0 && <span>Невідомі змінні: {unknownVariables.join(', ')}</span>}
                  {emptyVariables.length > 0 && <span>Порожні для цього учня: {emptyVariables.join(', ')}</span>}
                </div>
              )}
              <div className={styles.recipientNav}>
                <button
                  type="button"
                  onClick={() => setSelectedPreviewIndex((current) => Math.max(0, current - 1))}
                  disabled={selectedPreviewIndex <= 0}
                  aria-label="Попередній отримувач"
                >
                  <ChevronLeft size={16} />
                </button>
                <span>{selectedPreviewStudent?.full_name || 'Немає отримувача'}</span>
                <button
                  type="button"
                  onClick={() => setSelectedPreviewIndex((current) => Math.min((visibleStudents.length || 1) - 1, current + 1))}
                  disabled={!visibleStudents.length || selectedPreviewIndex >= visibleStudents.length - 1}
                  aria-label="Наступний отримувач"
                >
                  <ChevronRight size={16} />
                </button>
              </div>
            </aside>
          </div>

          {selectedTemplate && (
            <p className={styles.supportText}>Поточний шаблон: {selectedTemplate.name} · {templateSnippet(selectedTemplate.body)}</p>
          )}

          {templateModalOpen && (
            <div className={styles.modalOverlay} role="dialog" aria-modal="true" aria-labelledby="template-modal-title">
              <div className={styles.templateModal}>
                <div className={styles.modalHeader}>
                  <div>
                    <p className={styles.panelKicker}>Шаблон</p>
                    <h2 id="template-modal-title">{selectedTemplateId ? 'Редагувати шаблон' : 'Новий шаблон'}</h2>
                  </div>
                  <button type="button" className={styles.modalClose} onClick={() => setTemplateModalOpen(false)} aria-label="Закрити">
                    <X size={18} />
                  </button>
                </div>

              <label className={styles.field}>
                <span>Назва шаблону</span>
                <input
                  value={templateDraft.name}
                  onChange={(event) => setTemplateDraft((current) => ({ ...current, name: event.target.value }))}
                  placeholder="Наприклад: Запрошення на відкрите заняття"
                />
              </label>
              <label className={styles.field}>
                <span>Тема email</span>
                <input
                  value={templateDraft.subject}
                  onChange={(event) => setTemplateDraft((current) => ({ ...current, subject: event.target.value }))}
                  placeholder="Тема листа"
                />
              </label>
              <label className={styles.field}>
                <span>Шаблон повідомлення</span>
                <textarea
                  value={templateDraft.body}
                  onChange={(event) => setTemplateDraft((current) => ({ ...current, body: event.target.value }))}
                  rows={6}
                />
              </label>
              <div className={styles.templateActions}>
                <button className={styles.secondaryButton} type="button" onClick={saveTemplate} disabled={savingTemplate}>
                  <Save size={16} />
                  {savingTemplate ? 'Збереження...' : 'Зберегти шаблон'}
                </button>
                {selectedTemplate && (
                  <button className={styles.dangerButton} type="button" onClick={deleteTemplate}>
                    <Trash2 size={16} />
                    Видалити
                  </button>
                )}
              </div>
              </div>
            </div>
          )}

          <div className={styles.stageFooter}>
            <button className={styles.secondaryButton} type="button" onClick={goBack}>
              <ChevronLeft size={16} />
              Назад
            </button>
            <button className={styles.primaryButton} type="button" onClick={goNext} disabled={!canGoReview}>
              Далі
              <ChevronRight size={16} />
            </button>
          </div>
        </section>
      )}

      {step === 'review' && (
        <section className={styles.stage}>
          <div className={styles.stageHeader}>
            <div>
              <h2>Перевірка і відправка</h2>
              <p>Фінальна перевірка отримувачів, теми й тексту перед реальною відправкою.</p>
            </div>
            {previewLoading ? <RefreshCw className={styles.spin} size={22} /> : <Send size={22} />}
          </div>

          {lastSendResult && (
            <div className={lastSendResult.failed_count > 0 ? styles.sendReportWarn : styles.sendReport}>
              <Check size={18} />
              <div>
                <strong>Остання відправка завершена</strong>
                <span>
                  Надіслано {lastSendResult.sent_count}, помилок {lastSendResult.failed_count}, пропущено {lastSendResult.skipped_count}
                </span>
              </div>
            </div>
          )}

          <div className={styles.safetyPanel}>
            <div>
              <h3>Фінальна перевірка</h3>
              <p>{audienceExplanation}</p>
            </div>
            <div className={styles.confirmSummary}>
              <span><strong>Отримувачі</strong>{visibleCounts.deliverable}</span>
              <span><strong>Без email</strong>{visibleCounts.missingEmail}</span>
              <span><strong>Канал</strong>Email</span>
              <span><strong>Шаблон</strong>{selectedTemplate?.name || 'Власний текст'}</span>
              <span><strong>Тема</strong>{subject || 'Без теми'}</span>
              <span><strong>Виключено</strong>{excludedIds.size}</span>
            </div>
            {(unknownVariables.length > 0 || emptyVariables.length > 0) && (
              <div className={styles.safetyWarning}>
                <AlertCircle size={17} />
                <span>
                  {unknownVariables.length > 0
                    ? `Є невідомі змінні: ${unknownVariables.join(', ')}`
                    : `Деякі змінні порожні у preview: ${emptyVariables.join(', ')}`}
                </span>
              </div>
            )}
          </div>

          <div className={styles.reviewGrid}>
            <div className={styles.previewBox}>
              <div className={styles.previewHeader}>
                <span>Від: ITRobotics</span>
                <span>Кому: {selectedPreviewStudent?.email || 'немає email'}</span>
              </div>
              <p className={styles.previewSubject}>{renderMessage(subject, selectedPreviewStudent)}</p>
              <div className={styles.previewBody}>
                {renderMessage(body, selectedPreviewStudent).split('\n').map((line, index) => (
                  <p key={`${line}-${index}`}>{line || '\u00A0'}</p>
                ))}
              </div>
            </div>

            <aside className={styles.recipientsList}>
              <h3>Отримувачі</h3>
              {visibleStudents.slice(0, 14).map((student, index) => (
                <div
                  key={student.id}
                  className={index === selectedPreviewIndex ? styles.recipientActive : styles.recipientButton}
                >
                  <button type="button" onClick={() => setSelectedPreviewIndex(index)}>
                    <span>{student.full_name}</span>
                    <small>{student.email || 'немає email'}</small>
                  </button>
                  <button type="button" className={styles.excludeButton} onClick={() => excludeStudent(student.id)} aria-label={`Виключити ${student.full_name}`}>
                    <X size={15} />
                  </button>
                </div>
              ))}
              {visibleStudents.length > 14 && (
                <p className={styles.moreText}>Ще {visibleStudents.length - 14} отримувачів у цій аудиторії</p>
              )}
            </aside>
          </div>

          <div className={styles.history}>
            <h3>Останні розсилки</h3>
            {campaigns.length === 0 ? (
              <p className={styles.emptyText}>Історії ще немає</p>
            ) : (
              <div className={styles.historyGrid}>
                {campaigns.slice(0, 4).map((campaign) => (
                  <div key={campaign.id} className={styles.historyItem}>
                    <div>
                      <strong>{campaign.name}</strong>
                      <span>{formatDateTime(campaign.sent_at || campaign.created_at)}</span>
                    </div>
                    <small>
                      {statusLabel(campaign.status)} · {campaign.sent_count}/{campaign.total_count}
                    </small>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className={styles.stageFooter}>
            <button className={styles.secondaryButton} type="button" onClick={goBack}>
              <ChevronLeft size={16} />
              Назад
            </button>
            <button className={styles.primaryButton} type="button" onClick={sendCampaign} disabled={sending || !visibleCounts.deliverable}>
              <Send size={16} />
              {sending ? 'Надсилаємо...' : `Надіслати ${visibleCounts.deliverable} листів`}
            </button>
          </div>
        </section>
      )}
    </div>
  );
}
