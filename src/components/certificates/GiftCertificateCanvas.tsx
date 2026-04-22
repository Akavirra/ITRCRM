'use client';

import s from '@/components/certificates/certificates-editor.module.css';
import CertificateCanvasToolbar from '@/components/certificates/CertificateCanvasToolbar';

type TextWeight = 'normal' | 'bold';
type TextStyle = 'normal' | 'italic';
type BlockKey = 'id' | 'amount';

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

interface GiftCertificateCanvasProps {
  templateUrl: string | null;
  viewportRef: React.RefObject<HTMLDivElement>;
  previewRef: React.RefObject<HTMLDivElement>;
  imageDimensions: { width: number; height: number };
  setImageDimensions: React.Dispatch<React.SetStateAction<{ width: number; height: number }>>;
  pan: { x: number; y: number };
  scale: number;
  dragging: { target: BlockKey; offsetX: number; offsetY: number } | null;
  isPanning: boolean;
  handleMouseMove: (event: React.MouseEvent<HTMLDivElement>) => void;
  handleMouseUp: () => void;
  handleCanvasMouseDown: (event: React.MouseEvent) => void;
  selectedBlock: BlockKey | null;
  setSelectedBlock: React.Dispatch<React.SetStateAction<BlockKey | null>>;
  setOpenAccordion: React.Dispatch<React.SetStateAction<'data' | 'blocks' | 'template'>>;
  pushHistory: () => void;
  setDragging: React.Dispatch<React.SetStateAction<{ target: BlockKey; offsetX: number; offsetY: number } | null>>;
  idSettings: GiftCertificateSettings;
  updateSettings: (patch: Partial<GiftCertificateSettings>) => void;
  nextPublicId: string | null;
  amountValue: number;
  panBounds: { x: number; y: number };
  setPan: React.Dispatch<React.SetStateAction<{ x: number; y: number }>>;
  canUndo: boolean;
  undoLastChange: () => void;
  adjustScale: (delta: number) => void;
  resetViewport: () => void;
}

export default function GiftCertificateCanvas({
  templateUrl,
  viewportRef,
  previewRef,
  imageDimensions,
  setImageDimensions,
  pan,
  scale,
  dragging,
  isPanning,
  handleMouseMove,
  handleMouseUp,
  handleCanvasMouseDown,
  selectedBlock,
  setSelectedBlock,
  setOpenAccordion,
  pushHistory,
  setDragging,
  idSettings,
  updateSettings,
  nextPublicId,
  amountValue,
  panBounds,
  setPan,
  canUndo,
  undoLastChange,
  adjustScale,
  resetViewport,
}: GiftCertificateCanvasProps) {
  return (
    <section className={s.canvasArea}>
      <CertificateCanvasToolbar
        topbarClassName={s.canvasTopbar}
        metaClassName={s.canvasMeta}
        labelClassName={s.canvasLabel}
        hintClassName={s.canvasHint}
        toolbarClassName={s.canvasToolbar}
        toolbarButtonClassName={s.toolbarBtn}
        toolbarScaleClassName={s.toolbarScale}
        label="Полотно сертифіката"
        hint="Wheel масштабує, `Ctrl+Z` повертає попередній стан, а drag & drop не змінює пропорції самого шаблону."
        scale={scale}
        canUndo={canUndo}
        onUndo={undoLastChange}
        onZoomOut={() => adjustScale(-0.08)}
        onReset={resetViewport}
        onZoomIn={() => adjustScale(0.08)}
      />

      {templateUrl ? (
        <div ref={viewportRef} className={s.canvasViewport}>
          <div className={s.canvasFrame}>
            <div
              ref={previewRef}
              className={s.canvasContent}
              onMouseMove={handleMouseMove}
              onMouseUp={handleMouseUp}
              onMouseLeave={handleMouseUp}
              onMouseDown={handleCanvasMouseDown}
              style={{
                width: `${imageDimensions.width}px`,
                aspectRatio: `${imageDimensions.width} / ${imageDimensions.height}`,
                transform: `translate(${pan.x}px, ${pan.y}px) scale(${scale})`,
                transformOrigin: 'center center',
                cursor: dragging ? 'grabbing' : isPanning ? 'grabbing' : (scale > 1 || pan.x !== 0 || pan.y !== 0) ? 'grab' : 'default',
              }}
            >
              <img
                src={templateUrl}
                alt="Шаблон сертифіката"
                onLoad={(event) => setImageDimensions({
                  width: event.currentTarget.naturalWidth || 842,
                  height: event.currentTarget.naturalHeight || 595,
                })}
                style={{ width: '100%', height: '100%', display: 'block', objectFit: 'contain' }}
              />

              <div
                className={`${s.canvasBlock} ${selectedBlock === 'id' ? s.canvasBlockSelected : ''}`}
                onClick={(event) => {
                  event.stopPropagation();
                  setSelectedBlock('id');
                  setOpenAccordion('blocks');
                }}
                onMouseDown={(event) => {
                  if (selectedBlock !== 'id') return;
                  event.stopPropagation();
                  pushHistory();
                  const rect = event.currentTarget.getBoundingClientRect();
                  setDragging({
                    target: 'id',
                    offsetX: event.clientX - (rect.left + rect.width / 2),
                    offsetY: event.clientY - (rect.top + rect.height / 2),
                  });
                }}
                style={{
                  left: `${idSettings.xPercent}%`,
                  bottom: `${idSettings.yPercent}%`,
                  transform: 'translateX(-50%)',
                  color: idSettings.color,
                  fontSize: `${idSettings.fontSize}px`,
                  letterSpacing: `${idSettings.idLetterSpacing}px`,
                  fontFamily: 'var(--font-certificate-id), sans-serif',
                  fontWeight: idSettings.idWeight === 'bold' ? 700 : 400,
                  fontStyle: idSettings.idStyle,
                  whiteSpace: 'nowrap',
                  maxWidth: 'none',
                }}
              >
                {selectedBlock === 'id' && (
                  <div className={s.blockToolbar} onMouseDown={(event) => event.stopPropagation()} style={{ transform: `translateX(-50%) scale(${1 / scale})` }}>
                    <input type="color" value={idSettings.color} onChange={(event) => updateSettings({ color: event.target.value })} className={s.blockColorInput} />
                    <button type="button" onClick={() => updateSettings({ idWeight: idSettings.idWeight === 'bold' ? 'normal' : 'bold' })} className={`${s.blockToolbarBtn} ${idSettings.idWeight === 'bold' ? s.blockToolbarBtnActive : ''}`} title="Жирний">B</button>
                    <button type="button" onClick={() => updateSettings({ idStyle: idSettings.idStyle === 'italic' ? 'normal' : 'italic' })} className={`${s.blockToolbarBtn} ${idSettings.idStyle === 'italic' ? s.blockToolbarBtnActive : ''}`} title="Курсив">I</button>
                    <button type="button" onClick={() => updateSettings({ fontSize: Math.max(10, idSettings.fontSize - 2) })} className={s.blockToolbarBtn} title="Зменшити розмір">-</button>
                    <button type="button" className={s.blockToolbarSize} title={`Поточний розмір: ${idSettings.fontSize}px`}>{idSettings.fontSize}px</button>
                    <button type="button" onClick={() => updateSettings({ fontSize: Math.min(160, idSettings.fontSize + 2) })} className={s.blockToolbarBtn} title="Збільшити розмір">+</button>
                  </div>
                )}
                {nextPublicId || 'GC-00001'}
              </div>

              <div
                className={`${s.canvasBlock} ${selectedBlock === 'amount' ? s.canvasBlockSelected : ''}`}
                onClick={(event) => {
                  event.stopPropagation();
                  setSelectedBlock('amount');
                  setOpenAccordion('blocks');
                }}
                onMouseDown={(event) => {
                  if (selectedBlock !== 'amount') return;
                  event.stopPropagation();
                  pushHistory();
                  const rect = event.currentTarget.getBoundingClientRect();
                  setDragging({
                    target: 'amount',
                    offsetX: event.clientX - (rect.left + rect.width / 2),
                    offsetY: event.clientY - (rect.top + rect.height / 2),
                  });
                }}
                style={{
                  left: `${idSettings.amountXPercent}%`,
                  bottom: `${idSettings.amountYPercent}%`,
                  transform: `translateX(-50%) rotate(${idSettings.amountRotation}deg)`,
                  color: idSettings.amountColor,
                  fontSize: `${idSettings.amountFontSize}px`,
                  fontFamily: 'var(--font-certificate-amount), sans-serif',
                  fontWeight: idSettings.amountWeight === 'bold' ? 700 : 400,
                  fontStyle: idSettings.amountStyle,
                  whiteSpace: 'nowrap',
                  maxWidth: 'none',
                  textAlign: 'center',
                }}
              >
                {selectedBlock === 'amount' && (
                  <div className={s.blockToolbar} onMouseDown={(event) => event.stopPropagation()} style={{ transform: `translateX(-50%) scale(${1 / scale})` }}>
                    <input type="color" value={idSettings.amountColor} onChange={(event) => updateSettings({ amountColor: event.target.value })} className={s.blockColorInput} />
                    <button type="button" onClick={() => updateSettings({ amountWeight: idSettings.amountWeight === 'bold' ? 'normal' : 'bold' })} className={`${s.blockToolbarBtn} ${idSettings.amountWeight === 'bold' ? s.blockToolbarBtnActive : ''}`} title="Жирний">B</button>
                    <button type="button" onClick={() => updateSettings({ amountStyle: idSettings.amountStyle === 'italic' ? 'normal' : 'italic' })} className={`${s.blockToolbarBtn} ${idSettings.amountStyle === 'italic' ? s.blockToolbarBtnActive : ''}`} title="Курсив">I</button>
                    <button type="button" onClick={() => updateSettings({ amountFontSize: Math.max(10, idSettings.amountFontSize - 2) })} className={s.blockToolbarBtn} title="Зменшити розмір">-</button>
                    <button type="button" className={s.blockToolbarSize} title={`Поточний розмір: ${idSettings.amountFontSize}px`}>{idSettings.amountFontSize}px</button>
                    <button type="button" onClick={() => updateSettings({ amountFontSize: Math.min(160, idSettings.amountFontSize + 2) })} className={s.blockToolbarBtn} title="Збільшити розмір">+</button>
                  </div>
                )}
                {amountValue || 0}
              </div>
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
      ) : (
        <div className={s.canvasEmpty}>
          <span className={s.canvasEmptyTitle}>Спочатку завантажте шаблон сертифіката</span>
          <span className={s.canvasEmptyDesc}>Після цього тут з’явиться повноцінне прев’ю без спотворення пропорцій.</span>
        </div>
      )}
    </section>
  );
}
