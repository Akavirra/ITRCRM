'use client';

import { AlertCircle, CheckCircle, ChevronDown, Upload } from 'lucide-react';
import { t } from '@/i18n/t';
import s from '@/components/certificates/certificates-editor.module.css';

type AccordionKey = 'data' | 'blocks' | 'template';
type TextWeight = 'normal' | 'bold';
type TextStyle = 'normal' | 'italic';

interface GiftCertificateSettings {
  fontSize: number;
  xPercent: number;
  yPercent: number;
  color: string;
  idLetterSpacing: number;
  idWeight: TextWeight;
  idStyle: TextStyle;
  amountFontSize: number;
  amountXPercent: number;
  amountYPercent: number;
  amountColor: string;
  amountRotation: number;
  amountWeight: TextWeight;
  amountStyle: TextStyle;
}

interface EditorFormData {
  amount: number;
  notes: string;
  count: number;
}

interface ActiveBlockData {
  key: 'id' | 'amount';
  preview: string;
  fontSize: number;
  xPercent: number;
  yPercent: number;
  color: string;
  weight: TextWeight;
  style: TextStyle;
  extraLabel: string;
  extraValue: number;
}

interface GiftCertificateEditorSidebarProps {
  openAccordion: AccordionKey;
  toggleAccordion: (key: AccordionKey) => void;
  formData: EditorFormData;
  totalAmount: number;
  presetAmounts: number[];
  isCustomAmount: boolean;
  updateFormData: (patch: Partial<EditorFormData>, pushToHistory?: boolean) => void;
  activeBlock: ActiveBlockData;
  idSettings: GiftCertificateSettings;
  selectedBlock: 'id' | 'amount';
  setSelectedBlock: (key: 'id' | 'amount') => void;
  updateSettings: (patch: Partial<GiftCertificateSettings>) => void;
  setSelectedFile: (file: File | null) => void;
  selectedTemplateName: string;
  handleUploadTemplate: () => void;
  selectedFile: File | null;
  uploading: boolean;
}

export default function GiftCertificateEditorSidebar({
  openAccordion,
  toggleAccordion,
  formData,
  totalAmount,
  presetAmounts,
  isCustomAmount,
  updateFormData,
  activeBlock,
  idSettings,
  selectedBlock,
  setSelectedBlock,
  updateSettings,
  setSelectedFile,
  selectedTemplateName,
  handleUploadTemplate,
  selectedFile,
  uploading,
}: GiftCertificateEditorSidebarProps) {
  return (
    <aside className={s.sidebar}>
      <div className={s.sidebarInner}>
        <section className={s.accordionSection}>
          <button type="button" className={s.accordionHeader} onClick={() => toggleAccordion('data')}>
            <div>
              <div className={s.accordionTitle}>Дані</div>
              <div className={s.accordionMeta}>Номінал, кількість і службова нотатка</div>
            </div>
            <ChevronDown className={`${s.accordionChevron} ${openAccordion === 'data' ? s.accordionChevronOpen : ''}`} />
          </button>
          {openAccordion === 'data' && (
            <div className={s.accordionBody}>
              <div className={s.summaryCard}>
                <span className={s.summaryLabel}>Поточна генерація</span>
                <strong className={s.summaryValue}>{formData.count} шт. · {totalAmount} грн</strong>
                <span className={s.summaryMeta}>Максимум за один запуск: 50 сертифікатів</span>
              </div>

              <div className={s.compactGroup}>
                <label className={s.compactLabel}>Номінал <span className={s.compactRequired}>*</span></label>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                  {presetAmounts.map((amount) => (
                    <button
                      key={amount}
                      type="button"
                      className={`${s.segmentedOption} ${formData.amount === amount ? s.segmentedOptionActive : ''}`}
                      style={{ minWidth: '84px' }}
                      onClick={() => updateFormData({ amount }, true)}
                    >
                      {amount} грн
                    </button>
                  ))}
                  <button
                    type="button"
                    className={`${s.segmentedOption} ${isCustomAmount ? s.segmentedOptionActive : ''}`}
                    onClick={() => updateFormData({ amount: 0 }, true)}
                  >
                    Свій номінал
                  </button>
                </div>
              </div>

              <div className={s.compactRow}>
                <div className={s.compactGroup}>
                  <label className={s.compactLabel}>Сума вручну</label>
                  <input
                    type="number"
                    className="form-input"
                    value={formData.amount === 0 ? '' : formData.amount}
                    onChange={(event) => updateFormData({ amount: parseInt(event.target.value, 10) || 0 }, true)}
                    min="1"
                  />
                </div>
                <div className={s.compactGroup}>
                  <label className={s.compactLabel}>Кількість <span className={s.compactRequired}>*</span></label>
                  <input
                    type="number"
                    className="form-input"
                    value={formData.count}
                    onChange={(event) => updateFormData({ count: parseInt(event.target.value, 10) || 1 }, true)}
                    min="1"
                    max="50"
                  />
                </div>
              </div>

              <div className={s.compactGroup}>
                <label className={s.compactLabel}>{t('common.note')}</label>
                <textarea
                  className="form-input"
                  rows={3}
                  value={formData.notes}
                  onChange={(event) => updateFormData({ notes: event.target.value }, true)}
                  placeholder="Наприклад: для подарунка, акції чи внутрішнього обліку"
                />
              </div>

              <div style={{ display: 'flex', gap: '8px', alignItems: 'flex-start', color: 'var(--text-muted)' }}>
                <CheckCircle size={16} style={{ flexShrink: 0, marginTop: '1px' }} />
                <span style={{ fontSize: '12px', lineHeight: '16px' }}>
                  Без учнів, груп і курсів: тільки те, що реально потрібно подарунковому сертифікату.
                </span>
              </div>
            </div>
          )}
        </section>

        <section className={s.accordionSection}>
          <button type="button" className={s.accordionHeader} onClick={() => toggleAccordion('blocks')}>
            <div>
              <div className={s.accordionTitle}>Текстові блоки</div>
              <div className={s.accordionMeta}>ID і сума сертифіката</div>
            </div>
            <ChevronDown className={`${s.accordionChevron} ${openAccordion === 'blocks' ? s.accordionChevronOpen : ''}`} />
          </button>
          {openAccordion === 'blocks' && (
            <div className={s.accordionBody}>
              <div className={s.blockList}>
                {[
                  { key: 'id' as const, name: 'ID сертифіката', x: idSettings.xPercent, y: idSettings.yPercent, size: idSettings.fontSize },
                  { key: 'amount' as const, name: 'Номінал', x: idSettings.amountXPercent, y: idSettings.amountYPercent, size: idSettings.amountFontSize },
                ].map((block) => (
                  <button
                    key={block.key}
                    type="button"
                    onClick={() => setSelectedBlock(block.key)}
                    className={`${s.blockItem} ${selectedBlock === block.key ? s.blockItemActive : ''}`}
                  >
                    <span>
                      <span className={s.blockItemName}>{block.name}</span>
                      <span className={s.blockItemMeta}>{Math.round(block.x)}% / {Math.round(block.y)}%</span>
                    </span>
                    <span className={s.blockItemMeta}>{block.size}px</span>
                  </button>
                ))}
              </div>

              <div className={s.blockEditor}>
                <div className={s.compactGroup}>
                  <label className={s.compactLabel}>Текст у прев’ю</label>
                  <input
                    className="form-input"
                    value={activeBlock.preview}
                    onChange={(event) => {
                      if (activeBlock.key === 'amount') {
                        const numericValue = parseInt(event.target.value.replace(/[^\d]/g, ''), 10) || 0;
                        updateFormData({ amount: numericValue }, true);
                      }
                    }}
                    disabled={activeBlock.key === 'id'}
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
                      value={activeBlock.fontSize}
                      onChange={(event) => {
                        const nextValue = parseInt(event.target.value, 10) || 10;
                        if (activeBlock.key === 'id') {
                          updateSettings({ fontSize: nextValue });
                        } else {
                          updateSettings({ amountFontSize: nextValue });
                        }
                      }}
                    />
                  </div>
                  <div className={s.compactGroup}>
                    <label className={s.compactLabel}>Колір</label>
                    <input
                      type="color"
                      className={`form-input ${s.colorInput}`}
                      value={activeBlock.color}
                      onChange={(event) => {
                        if (activeBlock.key === 'id') {
                          updateSettings({ color: event.target.value });
                        } else {
                          updateSettings({ amountColor: event.target.value });
                        }
                      }}
                    />
                  </div>
                </div>

                <div className={s.compactRow}>
                  <div className={s.compactGroup}>
                    <label className={s.compactLabel}>Накреслення</label>
                    <select
                      className="form-select"
                      value={`${activeBlock.weight}:${activeBlock.style}`}
                      onChange={(event) => {
                        const [weight, style] = event.target.value.split(':') as [TextWeight, TextStyle];
                        if (activeBlock.key === 'id') {
                          updateSettings({ idWeight: weight, idStyle: style });
                        } else {
                          updateSettings({ amountWeight: weight, amountStyle: style });
                        }
                      }}
                    >
                      <option value="normal:normal">Звичайне</option>
                      <option value="bold:normal">Жирне</option>
                      <option value="normal:italic">Курсив</option>
                      <option value="bold:italic">Жирний курсив</option>
                    </select>
                  </div>
                  <div className={s.compactGroup}>
                    <label className={s.compactLabel}>Шрифт</label>
                    <input className="form-input" value={activeBlock.key === 'id' ? 'Bebas Neue Cyrillic' : 'Ermilov'} readOnly />
                  </div>
                </div>

                <div className={s.sliderGroup}>
                  <label className={s.compactLabel}>Позиція зліва: {Math.round(activeBlock.xPercent)}%</label>
                  <input
                    type="range"
                    min="0"
                    max="100"
                    value={activeBlock.xPercent}
                    onChange={(event) => {
                      const nextValue = parseInt(event.target.value, 10);
                      if (activeBlock.key === 'id') {
                        updateSettings({ xPercent: nextValue });
                      } else {
                        updateSettings({ amountXPercent: nextValue });
                      }
                    }}
                  />
                </div>

                <div className={s.sliderGroup}>
                  <label className={s.compactLabel}>Позиція знизу: {Math.round(activeBlock.yPercent)}%</label>
                  <input
                    type="range"
                    min="0"
                    max="100"
                    value={activeBlock.yPercent}
                    onChange={(event) => {
                      const nextValue = parseInt(event.target.value, 10);
                      if (activeBlock.key === 'id') {
                        updateSettings({ yPercent: nextValue });
                      } else {
                        updateSettings({ amountYPercent: nextValue });
                      }
                    }}
                  />
                </div>

                <div className={s.compactGroup}>
                  <label className={s.compactLabel}>{activeBlock.extraLabel}</label>
                  <input
                    type="number"
                    className="form-input"
                    step={activeBlock.key === 'id' ? '0.5' : '1'}
                    value={activeBlock.extraValue}
                    onChange={(event) => {
                      const nextValue = activeBlock.key === 'id'
                        ? parseFloat(event.target.value) || 0
                        : parseInt(event.target.value, 10) || 0;

                      if (activeBlock.key === 'id') {
                        updateSettings({ idLetterSpacing: nextValue });
                      } else {
                        updateSettings({ amountRotation: nextValue });
                      }
                    }}
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
              <div className={s.accordionMeta}>PNG або JPG для фону</div>
            </div>
            <ChevronDown className={`${s.accordionChevron} ${openAccordion === 'template' ? s.accordionChevronOpen : ''}`} />
          </button>
          {openAccordion === 'template' && (
            <div className={s.accordionBody}>
              <input
                id="certificate-template-upload"
                type="file"
                accept="image/png,image/jpeg"
                style={{ display: 'none' }}
                onChange={(event) => setSelectedFile(event.target.files?.[0] || null)}
              />

              <div className={s.templateInfo}>
                <span className={s.templateHint}>Поточний файл</span>
                <span className={s.templateFileName}>{selectedTemplateName}</span>
              </div>

              <div className={s.templateActions}>
                <label htmlFor="certificate-template-upload" className={s.templateUploadLabel}>
                  <Upload size={14} />
                  Обрати файл
                </label>
                <button className="btn btn-primary btn-sm" onClick={handleUploadTemplate} disabled={!selectedFile || uploading}>
                  {uploading ? 'Завантаження…' : 'Оновити'}
                </button>
              </div>

              <div style={{ display: 'flex', gap: '8px', alignItems: 'flex-start', color: 'var(--text-muted)' }}>
                <AlertCircle size={16} style={{ flexShrink: 0, marginTop: '1px' }} />
                <span style={{ fontSize: '12px', lineHeight: '16px' }}>
                  Підтримуються PNG і JPG. Пропорції шаблону в прев’ю зберігаються один в один.
                </span>
              </div>
            </div>
          )}
        </section>
      </div>
    </aside>
  );
}
