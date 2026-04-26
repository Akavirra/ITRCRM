'use client';

import { ChevronDown, Upload, User, Type, Image } from 'lucide-react';
import s from '@/components/certificates/certificates-editor.module.css';

type AccordionKey = 'data' | 'blocks' | 'template';
type SelectionMode = 'single' | 'group';

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

const BLOCK_LABELS: Record<string, string> = {
  student_name: "Ім'я учня",
  verb: 'Текст завершення',
  course_name: 'Назва курсу',
  issue_date: 'Дата видачі',
};

interface CompletionCertificateEditorSidebarProps {
  openAccordion: AccordionKey | null;
  toggleAccordion: (key: AccordionKey) => void;
  selectionMode: SelectionMode;
  handleSelectionModeChange: (mode: SelectionMode) => void;
  formData: {
    student_id: string;
    course_id: string;
    group_id: string;
    issue_date: string;
    gender: 'male' | 'female' | '';
  };
  courses: CourseOption[];
  groups: GroupOption[];
  filteredGroups: GroupOption[];
  students: StudentOption[];
  studentSearch: string;
  setStudentSearch: (value: string) => void;
  handleCourseChange: (courseId: string) => void;
  handleGroupChange: (groupId: string) => void;
  onStudentChange: (studentId: string) => void;
  loadingStudentOptions: boolean;
  loadingGroupStudents: boolean;
  selectedGroup: GroupOption | null;
  selectedStudent: StudentOption | null;
  selectedGroupStudentIds: string[];
  setSelectedGroupStudentIds: React.Dispatch<React.SetStateAction<string[]>>;
  activeGroupStudentId: string;
  setActiveGroupStudentId: React.Dispatch<React.SetStateAction<string>>;
  setFormData: React.Dispatch<React.SetStateAction<{
    student_id: string;
    course_id: string;
    group_id: string;
    issue_date: string;
    gender: 'male' | 'female' | '';
  }>>;
  groupStudentDrafts: Record<string, GroupStudentDraft>;
  toggleGroupStudent: (studentId: string) => void;
  selectGroupStudent: (studentId: string) => void;
  effectiveGender: 'male' | 'female' | '';
  setGroupStudentDrafts: React.Dispatch<React.SetStateAction<Record<string, GroupStudentDraft>>>;
  selectedCourse: CourseOption | null;
  renderedBlocks: BlockSetting[];
  selectedBlock: number | null;
  setSelectedBlock: React.Dispatch<React.SetStateAction<number | null>>;
  activeBlock: BlockSetting;
  activeBlockIndex: number;
  getPreviewText: (key: string) => string;
  activeGroupDraft?: GroupStudentDraft;
  previewTexts: Record<string, string>;
  pushHistory: () => void;
  setPreviewTexts: React.Dispatch<React.SetStateAction<Record<string, string>>>;
  updateBlock: (index: number, patch: Partial<BlockSetting>) => void;
  selectedFile: File | null;
  setSelectedFile: (file: File | null) => void;
  templateUrl: string | null;
  handleUploadTemplate: () => void;
  uploading: boolean;
}

export default function CompletionCertificateEditorSidebar({
  openAccordion,
  toggleAccordion,
  selectionMode,
  handleSelectionModeChange,
  formData,
  courses,
  filteredGroups,
  students,
  studentSearch,
  setStudentSearch,
  handleCourseChange,
  handleGroupChange,
  onStudentChange,
  loadingStudentOptions,
  loadingGroupStudents,
  selectedGroup,
  selectedStudent,
  selectedGroupStudentIds,
  setSelectedGroupStudentIds,
  activeGroupStudentId,
  setActiveGroupStudentId,
  setFormData,
  groupStudentDrafts,
  toggleGroupStudent,
  selectGroupStudent,
  effectiveGender,
  setGroupStudentDrafts,
  selectedCourse,
  renderedBlocks,
  selectedBlock,
  setSelectedBlock,
  activeBlock,
  activeBlockIndex,
  getPreviewText,
  activeGroupDraft,
  previewTexts,
  pushHistory,
  setPreviewTexts,
  updateBlock,
  selectedFile,
  setSelectedFile,
  templateUrl,
  handleUploadTemplate,
  uploading,
}: CompletionCertificateEditorSidebarProps) {
  return (
    <aside className={s.sidebar}>
      <div className={s.sidebarInner}>
        <section className={s.accordionSection}>
          <button type="button" className={s.accordionHeader} onClick={() => toggleAccordion('data')}>
            <div>
              <div className={s.accordionTitle}><User size={16} /> Дані</div>
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
              <div className={s.accordionTitle}><Type size={16} /> Текстові блоки</div>
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
                        toggleAccordion('blocks');
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
              <div className={s.accordionTitle}><Image size={16} /> Шаблон</div>
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
  );
}
