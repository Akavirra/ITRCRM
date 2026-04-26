'use client';

import { RotateCcw, Undo2, ZoomIn, ZoomOut } from 'lucide-react';

interface CertificateCanvasToolbarProps {
  topbarClassName: string;
  metaClassName: string;
  labelClassName: string;
  hintClassName?: string;
  toolbarClassName: string;
  toolbarButtonClassName: string;
  toolbarScaleClassName: string;
  label: string;
  hint?: string;
  scale: number;
  canUndo: boolean;
  onUndo: () => void;
  onZoomOut: () => void;
  onReset: () => void;
  onZoomIn: () => void;
}

export default function CertificateCanvasToolbar({
  topbarClassName,
  metaClassName,
  labelClassName,
  hintClassName,
  toolbarClassName,
  toolbarButtonClassName,
  toolbarScaleClassName,
  label,
  hint,
  scale,
  canUndo,
  onUndo,
  onZoomOut,
  onReset,
  onZoomIn,
}: CertificateCanvasToolbarProps) {
  return (
    <div className={topbarClassName}>
      <div className={metaClassName}>
        <span className={labelClassName}>{label}</span>
        {hint ? <span className={hintClassName}>{hint}</span> : null}
      </div>

      <div className={toolbarClassName}>
        <button 
          type="button" 
          className={toolbarButtonClassName} 
          onClick={onUndo} 
          title="Крок назад (Ctrl+Z)" 
          disabled={!canUndo}
          style={{ marginRight: '4px' }}
        >
          <Undo2 size={14} />
        </button>
        
        <div style={{ display: 'flex', alignItems: 'center', background: 'rgba(148, 163, 184, 0.1)', borderRadius: '6px', padding: '2px' }}>
          <button type="button" className={toolbarButtonClassName} onClick={onZoomOut} title="Зменшити">
            <ZoomOut size={14} />
          </button>
          <span className={toolbarScaleClassName}>{Math.round(scale * 100)}%</span>
          <button type="button" className={toolbarButtonClassName} onClick={onZoomIn} title="Збільшити">
            <ZoomIn size={14} />
          </button>
        </div>

        <button 
          type="button" 
          className={toolbarButtonClassName} 
          onClick={onReset} 
          title="Скинути вигляд"
          style={{ marginLeft: '4px' }}
        >
          <RotateCcw size={14} />
        </button>
      </div>
    </div>
  );
}
