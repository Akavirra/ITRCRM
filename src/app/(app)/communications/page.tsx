'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  AlertCircle,
  Check,
  ChevronDown,
  Copy,
  Edit3,
  Mail,
  Plus,
  RefreshCw,
  Save,
  Search,
  Send,
  Trash2,
  Users,
  X,
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

const VARIABLE_LABELS: Record<string, string> = {
  studentName: 'Імʼя учня',
  parentName: 'Імʼя батьків',
  studentEmail: 'Email учня',
  school: 'Школа',
  groups: 'Групи',
  courses: 'Курси',
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
  const [studentOptions, setStudentOptions] = useState<StudentOption[]>([]);
  const [selectedStudents, setSelectedStudents] = useState<StudentOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [savingTemplate, setSavingTemplate] = useState(false);
  const [sending, setSending] = useState(false);
  const [notice, setNotice] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [advancedOpen, setAdvancedOpen] = useState(false);
  const [templateModalOpen, setTemplateModalOpen] = useState(false);
  const [lastSendResult, setLastSendResult] = useState<CampaignSummary | null>(null);

  const selectedTemplate = useMemo(
    () => templates.find((template) => template.id === selectedTemplateId) || null,
    [selectedTemplateId, templates]
  );

  const selectedPreviewStudent = preview?.students[selectedPreviewIndex] || preview?.students[0] || null;

  const effectiveFilter = useMemo<AudienceFilter>(() => ({
    ...filter,
    studentIds: selectedStudents.map((student) => student.id),
  }), [filter, selectedStudents]);

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
    return `Показуємо: ${parts.join('; ')}.`;
  }, [filter.includeInactive, filter.mode, filter.requireEmail, filter.search, filter.studyStatuses, selectedCourseTitles, selectedGroupTitles, selectedStudents.length]);

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

  const canGoReview = Boolean(subject.trim() && body.trim() && preview?.deliverable && unknownVariables.length === 0);

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
      return { ...current, [key]: Array.from(values) };
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
    setFilter((current) => ({ ...current, mode: 'manual' }));
    setStudentSearch('');
    setStudentOptions([]);
  };

  const removeStudent = (id: number) => {
    setSelectedStudents((current) => current.filter((student) => student.id !== id));
  };

  const sendCampaign = async () => {
    if (!preview || preview.deliverable === 0) {
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
      <section className={styles.hero}>
        <div>
          <p className={styles.eyebrow}>Комунікації</p>
          <h1>Розсилки учням і батькам</h1>
          <p className={styles.heroText}>Спочатку обери аудиторію, потім текст, і лише після перевірки запускай відправку.</p>
        </div>
        <div className={styles.heroMeta}>
          <span>{audienceLabel}</span>
          <strong>{preview?.deliverable ?? 0} готові до відправки</strong>
        </div>
      </section>

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
            <button
              key={item.id}
              type="button"
              className={active ? styles.stepActive : done ? styles.stepDone : styles.step}
              onClick={() => setStep(item.id)}
            >
              <span>{done ? <Check size={15} /> : index + 1}</span>
              <div>
                <strong>{item.label}</strong>
                <small>{item.hint}</small>
              </div>
            </button>
          );
        })}
      </nav>

      <section className={styles.summaryBar}>
        <div>
          <span>В аудиторії</span>
          <strong>{preview?.total ?? 0}</strong>
        </div>
        <div>
          <span>Можна надіслати</span>
          <strong>{preview?.deliverable ?? 0}</strong>
        </div>
        <div>
          <span>Без email</span>
          <strong>{preview?.missingEmail ?? 0}</strong>
        </div>
        <div>
          <span>Пропущено</span>
          <strong>{preview?.suppressed ?? 0}</strong>
        </div>
        <div>
          <span>Шаблон</span>
          <strong>{selectedTemplate?.name || 'Власний текст'}</strong>
        </div>
        <button className={styles.ghostButton} type="button" onClick={refreshPreview} disabled={previewLoading}>
          <RefreshCw size={16} />
          Оновити
        </button>
      </section>

      {step === 'audience' && (
        <section className={styles.stage}>
          <div className={styles.stageHeader}>
            <div>
              <p className={styles.panelKicker}>Крок 1</p>
              <h2>Кого обираємо</h2>
              <p>Почни з простого сегмента. Детальні фільтри доступні нижче, коли вони справді потрібні.</p>
            </div>
            <Users size={22} />
          </div>

          <div className={styles.choiceGrid}>
            <button
              type="button"
              className={filter.mode !== 'manual' && (filter.studyStatuses || []).includes('studying') ? styles.choiceActive : styles.choice}
              onClick={() => setFilter((current) => ({ ...current, mode: 'all', studyStatuses: ['studying'], requireEmail: true }))}
            >
              <strong>Активні учні</strong>
              <span>Навчаються і мають email</span>
            </button>
            <button
              type="button"
              className={(filter.courseIds || []).length > 0 ? styles.choiceActive : styles.choice}
              onClick={() => setAdvancedOpen(true)}
            >
              <strong>За курсом</strong>
              <span>{(filter.courseIds || []).length || 'Обрати'} курсів</span>
            </button>
            <button
              type="button"
              className={(filter.groupIds || []).length > 0 ? styles.choiceActive : styles.choice}
              onClick={() => setAdvancedOpen(true)}
            >
              <strong>За групою</strong>
              <span>{(filter.groupIds || []).length || 'Обрати'} груп</span>
            </button>
            <button
              type="button"
              className={filter.mode === 'manual' ? styles.choiceActive : styles.choice}
              onClick={() => setFilter((current) => ({ ...current, mode: 'manual' }))}
            >
              <strong>Вручну</strong>
              <span>{selectedStudents.length || 'Пошук'} учнів</span>
            </button>
          </div>

          <div className={styles.compactFilters}>
            <label className={styles.field}>
              <span>Пошук у сегменті</span>
              <div className={styles.inputWithIcon}>
                <Search size={16} />
                <input
                  value={filter.search || ''}
                  onChange={(event) => setFilter((current) => ({ ...current, search: event.target.value }))}
                  placeholder="Імʼя, email, школа або група"
                />
              </div>
            </label>

            <div className={styles.checkGrid}>
              <label>
                <input
                  type="checkbox"
                  checked={(filter.studyStatuses || []).includes('studying')}
                  onChange={(event) => setStatusValue('studying', event.target.checked)}
                />
                Навчаються
              </label>
              <label>
                <input
                  type="checkbox"
                  checked={(filter.studyStatuses || []).includes('not_studying')}
                  onChange={(event) => setStatusValue('not_studying', event.target.checked)}
                />
                Не навчаються
              </label>
              <label>
                <input
                  type="checkbox"
                  checked={filter.requireEmail !== false}
                  onChange={(event) => setFilter((current) => ({ ...current, requireEmail: event.target.checked }))}
                />
                Тільки з email
              </label>
              <label>
                <input
                  type="checkbox"
                  checked={Boolean(filter.includeInactive)}
                  onChange={(event) => setFilter((current) => ({ ...current, includeInactive: event.target.checked }))}
                />
                Включити архів
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

          <button
            className={styles.disclosure}
            type="button"
            onClick={() => setAdvancedOpen((current) => !current)}
            aria-expanded={advancedOpen}
          >
            <ChevronDown className={advancedOpen ? styles.chevronOpen : ''} size={17} />
            Розширені фільтри
          </button>

          {advancedOpen && (
            <div className={styles.advancedGrid}>
              <div className={styles.filterSection}>
                <h3>Курси</h3>
                <div className={styles.optionList}>
                  {courses.map((course) => (
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

              <div className={styles.filterSection}>
                <h3>Групи</h3>
                <div className={styles.optionList}>
                  {groups.map((group) => (
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
            </div>
          )}

          <div className={styles.audienceInsight}>
            <div className={styles.audienceBadges}>
              <span>Вибрано {preview?.total ?? 0}</span>
              <span>{preview?.deliverable ?? 0} з email</span>
              <span>{preview?.missingEmail ?? 0} без email</span>
              <span>{selectedGroupTitles.length} груп</span>
              <span>{selectedCourseTitles.length} курсів</span>
            </div>
            <p>{audienceExplanation}</p>
          </div>

          <div className={styles.audiencePreview}>
            <div className={styles.audiencePreviewHeader}>
              <div>
                <h3>Учні в аудиторії</h3>
                <p>{previewLoading ? 'Оновлюємо список...' : `${preview?.deliverable ?? 0} з валідним email`}</p>
              </div>
              <button className={styles.ghostButton} type="button" onClick={refreshPreview} disabled={previewLoading}>
                <RefreshCw size={16} />
                Оновити
              </button>
            </div>

            {preview?.students.length ? (
              <div className={styles.audienceList}>
                {preview.students.slice(0, 16).map((student, index) => (
                  <button
                    key={student.id}
                    type="button"
                    className={index === selectedPreviewIndex ? styles.audienceRowActive : styles.audienceRow}
                    onClick={() => setSelectedPreviewIndex(index)}
                  >
                    <span>{student.full_name}</span>
                    <small>{student.email || 'немає email'}</small>
                    <em>{student.groups.map((group) => group.title).slice(0, 2).join(', ') || 'без групи'}</em>
                  </button>
                ))}
              </div>
            ) : (
              <div className={styles.emptyAudience}>
                <Users size={20} />
                Немає учнів за поточними фільтрами
              </div>
            )}

            {preview && preview.students.length > 16 && (
              <p className={styles.moreText}>Показано 16 з {preview.students.length}. Звузь пошук або групи, щоб швидше перевірити список.</p>
            )}
          </div>
        </section>
      )}

      {step === 'message' && (
        <section className={styles.stage}>
          <div className={styles.stageHeader}>
            <div>
              <p className={styles.panelKicker}>Крок 2</p>
              <h2>Повідомлення</h2>
              <p>Обери шаблон і відредагуй конкретний текст розсилки. Сам шаблон відкривається тільки коли треба.</p>
            </div>
            <Mail size={22} />
          </div>

          <div className={styles.templateLibrary}>
            {templates.map((template) => (
              <button
                key={template.id}
                type="button"
                className={template.id === selectedTemplateId ? styles.templateCardActive : styles.templateCard}
                onClick={() => handleTemplateSelect(template.id)}
              >
                <span>
                  <Mail size={16} />
                  {template.name}
                </span>
                <strong>{template.subject || 'Без теми'}</strong>
                <small>{templateSnippet(template.body)}</small>
                <em>Оновлено {formatDateTime(template.updated_at)}</em>
              </button>
            ))}
            <div className={styles.templateCreateCard}>
              <strong>Бібліотека шаблонів</strong>
              <span>Шаблони зберігають базовий текст. Перед відправкою його все одно можна змінити нижче.</span>
              <div className={styles.templateActionsInline}>
                <button className={styles.iconTextButton} type="button" onClick={handleNewTemplate}>
                  <Plus size={16} />
                  Новий
                </button>
                <button className={styles.iconTextButton} type="button" onClick={handleEditTemplate}>
                  <Edit3 size={16} />
                  Редагувати
                </button>
              </div>
            </div>
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
                {variables.map((variable) => (
                  <button
                    key={variable}
                    type="button"
                    onClick={() => setBody((current) => `${current} {{${variable}}}`)}
                    title={VARIABLE_LABELS[variable] || variable}
                  >
                    <Copy size={14} />
                    {`{{${variable}}}`}
                  </button>
                ))}
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
            </aside>
          </div>

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
        </section>
      )}

      {step === 'review' && (
        <section className={styles.stage}>
          <div className={styles.stageHeader}>
            <div>
              <p className={styles.panelKicker}>Крок 3</p>
              <h2>Перевірка і відправка</h2>
              <p>Фінальна перевірка перед реальною відправкою через Resend.</p>
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
              <p className={styles.panelKicker}>Фінальний контроль</p>
              <h3>Буде надіслано {preview?.deliverable ?? 0} листів</h3>
              <span>{audienceExplanation}</span>
            </div>
            <div className={styles.safetyFacts}>
              <span>Аудиторія: {preview?.total ?? 0}</span>
              <span>Без email: {preview?.missingEmail ?? 0}</span>
              <span>Пропущено: {preview?.suppressed ?? 0}</span>
              <span>Канал: Email через Resend</span>
              <span>Шаблон: {selectedTemplate?.name || 'Власний текст'}</span>
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
              {preview?.students.slice(0, 14).map((student, index) => (
                <button
                  key={student.id}
                  type="button"
                  className={index === selectedPreviewIndex ? styles.recipientActive : styles.recipientButton}
                  onClick={() => setSelectedPreviewIndex(index)}
                >
                  <span>{student.full_name}</span>
                  <small>{student.email || 'немає email'}</small>
                </button>
              ))}
              {preview && preview.students.length > 14 && (
                <p className={styles.moreText}>Ще {preview.students.length - 14} отримувачів у цій аудиторії</p>
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
        </section>
      )}

      <footer className={styles.footerNav}>
        <button className={styles.secondaryButton} type="button" onClick={goBack} disabled={step === 'audience'}>
          Назад
        </button>
        {step !== 'review' ? (
          <button className={styles.primaryButton} type="button" onClick={goNext} disabled={step === 'message' && !canGoReview}>
            Далі
          </button>
        ) : (
          <button className={styles.primaryButton} type="button" onClick={sendCampaign} disabled={sending || !preview?.deliverable}>
            <Send size={16} />
            {sending ? 'Надсилаємо...' : `Надіслати ${preview?.deliverable ?? 0} листів`}
          </button>
        )}
      </footer>
    </div>
  );
}
