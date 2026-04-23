'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  AlertCircle,
  Check,
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

  const courses = Array.from(new Set(student.groups.map((group) => group.course_title).filter(Boolean)));
  const values: Record<string, string> = {
    studentName: student.full_name,
    parentName: student.parent_name || '',
    studentEmail: student.email || '',
    school: student.school || '',
    groups: student.groups.map((group) => group.title).join(', '),
    courses: courses.join(', '),
  };

  return template.replace(/\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g, (_, key: string) => values[key] ?? '');
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

  const selectedTemplate = useMemo(
    () => templates.find((template) => template.id === selectedTemplateId) || null,
    [selectedTemplateId, templates]
  );

  const selectedPreviewStudent = preview?.students[selectedPreviewIndex] || preview?.students[0] || null;

  const effectiveFilter = useMemo<AudienceFilter>(() => ({
    ...filter,
    studentIds: selectedStudents.map((student) => student.id),
  }), [filter, selectedStudents]);

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
  };

  const handleNewTemplate = () => {
    setSelectedTemplateId(null);
    setTemplateDraft({
      name: 'Новий шаблон',
      subject: DEFAULT_SUBJECT,
      body: DEFAULT_BODY,
    });
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

    const confirmed = window.confirm(`Надіслати розсилку ${preview.deliverable} отримувачам?`);
    if (!confirmed) return;

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
          <p className={styles.heroText}>
            Email через Resend зараз, інші канали підключаються окремими адаптерами пізніше.
          </p>
        </div>
        <div className={styles.heroActions}>
          <button className={styles.secondaryButton} type="button" onClick={refreshPreview} disabled={previewLoading}>
            <RefreshCw size={16} />
            Оновити аудиторію
          </button>
          <button className={styles.primaryButton} type="button" onClick={sendCampaign} disabled={sending || !preview?.deliverable}>
            <Send size={16} />
            {sending ? 'Надсилаємо...' : 'Надіслати'}
          </button>
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

      <section className={styles.statsGrid}>
        <div className={styles.statBlock}>
          <span>В аудиторії</span>
          <strong>{preview?.total ?? 0}</strong>
        </div>
        <div className={styles.statBlock}>
          <span>Можна надіслати</span>
          <strong>{preview?.deliverable ?? 0}</strong>
        </div>
        <div className={styles.statBlock}>
          <span>Без email</span>
          <strong>{preview?.missingEmail ?? 0}</strong>
        </div>
        <div className={styles.statBlock}>
          <span>Виключено</span>
          <strong>{preview?.suppressed ?? 0}</strong>
        </div>
      </section>

      <div className={styles.workspace}>
        <aside className={styles.panel}>
          <div className={styles.panelHeader}>
            <div>
              <p className={styles.panelKicker}>Аудиторія</p>
              <h2>Кого обираємо</h2>
            </div>
            <Users size={20} />
          </div>

          <div className={styles.segmented}>
            <button
              type="button"
              className={filter.mode !== 'manual' ? styles.segmentActive : ''}
              onClick={() => setFilter((current) => ({ ...current, mode: 'all' }))}
            >
              За фільтрами
            </button>
            <button
              type="button"
              className={filter.mode === 'manual' ? styles.segmentActive : ''}
              onClick={() => setFilter((current) => ({ ...current, mode: 'manual' }))}
            >
              Вручну
            </button>
          </div>

          <label className={styles.field}>
            <span>Пошук у сегменті</span>
            <div className={styles.inputWithIcon}>
              <Search size={16} />
              <input
                value={filter.search || ''}
                onChange={(event) => setFilter((current) => ({ ...current, search: event.target.value }))}
                placeholder="Імʼя, email, група..."
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

          <div className={styles.filterSection}>
            <h3>Ручний добір</h3>
            <div className={styles.inputWithIcon}>
              <Search size={16} />
              <input
                value={studentSearch}
                onChange={(event) => setStudentSearch(event.target.value)}
                placeholder="Знайти учня"
              />
            </div>
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
        </aside>

        <main className={styles.composer}>
          <section className={styles.panel}>
            <div className={styles.panelHeader}>
              <div>
                <p className={styles.panelKicker}>Шаблони</p>
                <h2>Текст повідомлення</h2>
              </div>
              <button className={styles.iconButton} type="button" onClick={handleNewTemplate} aria-label="Новий шаблон">
                <Plus size={18} />
              </button>
            </div>

            <div className={styles.templateGrid}>
              {templates.map((template) => (
                <button
                  key={template.id}
                  type="button"
                  className={template.id === selectedTemplateId ? styles.templateActive : styles.templateButton}
                  onClick={() => handleTemplateSelect(template.id)}
                >
                  <Mail size={16} />
                  <span>{template.name}</span>
                </button>
              ))}
            </div>

            <div className={styles.templateEditor}>
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
                  rows={8}
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
          </section>

          <section className={styles.panel}>
            <div className={styles.panelHeader}>
              <div>
                <p className={styles.panelKicker}>Перед відправкою</p>
                <h2>Можна змінити текст</h2>
              </div>
              <Edit3 size={20} />
            </div>
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
              <span>Повідомлення</span>
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
          </section>
        </main>

        <aside className={styles.panel}>
          <div className={styles.panelHeader}>
            <div>
              <p className={styles.panelKicker}>Preview</p>
              <h2>Перевірка</h2>
            </div>
            {previewLoading ? <RefreshCw className={styles.spin} size={20} /> : <Mail size={20} />}
          </div>

          <div className={styles.previewBox}>
            <p className={styles.previewSubject}>{renderMessage(subject, selectedPreviewStudent)}</p>
            <div className={styles.previewBody}>
              {renderMessage(body, selectedPreviewStudent).split('\n').map((line, index) => (
                <p key={`${line}-${index}`}>{line || '\u00A0'}</p>
              ))}
            </div>
          </div>

          <div className={styles.recipientsList}>
            <h3>Отримувачі</h3>
            {preview?.students.slice(0, 12).map((student, index) => (
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
            {preview && preview.students.length > 12 && (
              <p className={styles.moreText}>Ще {preview.students.length - 12} отримувачів у цій аудиторії</p>
            )}
          </div>

          <div className={styles.history}>
            <h3>Останні розсилки</h3>
            {campaigns.length === 0 ? (
              <p className={styles.emptyText}>Історії ще немає</p>
            ) : (
              campaigns.map((campaign) => (
                <div key={campaign.id} className={styles.historyItem}>
                  <div>
                    <strong>{campaign.name}</strong>
                    <span>{formatDateTime(campaign.sent_at || campaign.created_at)}</span>
                  </div>
                  <small>
                    {statusLabel(campaign.status)} · {campaign.sent_count}/{campaign.total_count}
                  </small>
                </div>
              ))
            )}
          </div>
        </aside>
      </div>
    </div>
  );
}
