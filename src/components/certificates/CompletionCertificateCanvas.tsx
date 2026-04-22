'use client';

import type { Dispatch, MouseEvent, RefObject, SetStateAction } from 'react';
import { AlignCenter, AlignLeft, AlignRight } from 'lucide-react';
import s from '@/components/certificates/certificates-editor.module.css';
import CertificateCanvasToolbar from '@/components/certificates/CertificateCanvasToolbar';

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

interface CompletionCertificateCanvasProps {
  templateUrl: string | null;
  viewportRef: RefObject<HTMLDivElement>;
  previewRef: RefObject<HTMLDivElement>;
  imageDimensions: { width: number; height: number };
  setImageDimensions: Dispatch<SetStateAction<{ width: number; height: number }>>;
  pan: { x: number; y: number };
  scale: number;
  dragging: { index: number; offsetX: number; offsetY: number } | null;
  isPanning: boolean;
  handleMouseMove: (event: MouseEvent) => void;
  handleMouseUp: () => void;
  handleCanvasMouseDown: (event: MouseEvent) => void;
  renderedBlocks: BlockSetting[];
  selectedBlock: number | null;
  setSelectedBlock: Dispatch<SetStateAction<number | null>>;
  setOpenAccordion: Dispatch<SetStateAction<'data' | 'blocks' | 'template' | null>>;
  pushHistory: () => void;
  setDragging: Dispatch<SetStateAction<{ index: number; offsetX: number; offsetY: number } | null>>;
  setResizing: Dispatch<SetStateAction<{ index: number; startSize: number; startY: number; directionY: 1 | -1 } | null>>;
  updateBlock: (index: number, patch: Partial<BlockSetting>) => void;
  getPreviewText: (key: string) => string;
  getBlockFontFamily: (key: string) => string;
  toolbarScale: number;
  panBounds: { x: number; y: number };
  setPan: Dispatch<SetStateAction<{ x: number; y: number }>>;
  canUndo: boolean;
  undoLastChange: () => void;
  adjustScale: (delta: number) => void;
  resetViewport: () => void;
}

export default function CompletionCertificateCanvas({
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
  renderedBlocks,
  selectedBlock,
  setSelectedBlock,
  setOpenAccordion,
  pushHistory,
  setDragging,
  setResizing,
  updateBlock,
  getPreviewText,
  getBlockFontFamily,
  toolbarScale,
  panBounds,
  setPan,
  canUndo,
  undoLastChange,
  adjustScale,
  resetViewport,
}: CompletionCertificateCanvasProps) {
  return (
    <section className={s.canvasArea}>
      <CertificateCanvasToolbar
        topbarClassName={s.canvasTopbar}
        metaClassName={s.canvasMeta}
        labelClassName={s.canvasLabel}
        toolbarClassName={s.canvasToolbar}
        toolbarButtonClassName={s.toolbarBtn}
        toolbarScaleClassName={s.toolbarScale}
        label="Полотно сертифіката"
        scale={scale}
        canUndo={canUndo}
        onUndo={undoLastChange}
        onZoomOut={() => adjustScale(-0.08)}
        onReset={resetViewport}
        onZoomIn={() => adjustScale(0.08)}
      />

      {templateUrl ? (
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
      ) : (
        <div className={s.canvasEmpty}>
          <span className={s.canvasEmptyTitle}>Спочатку завантажте шаблон сертифіката</span>
          <span className={s.canvasEmptyDesc}>Після цього тут з'явиться повноцінне прев’ю з drag & drop і редагуванням блоків.</span>
        </div>
      )}
    </section>
  );
}
