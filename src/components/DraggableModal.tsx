'use client';

import { useState, useRef, useEffect, ReactNode } from 'react';

interface DraggableModalProps {
  id: string;
  isOpen: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
  initialWidth?: number;
  initialHeight?: number;
  minWidth?: number;
  minHeight?: number;
  initialPosition?: { x: number; y: number };
  groupUrl?: string;
  courseUrl?: string;
  onPositionChange?: (position: { x: number; y: number }) => void;
  onSizeChange?: (size: { width: number; height: number }) => void;
}

export default function DraggableModal({
  id,
  isOpen,
  onClose,
  title,
  children,
  initialWidth = 480,
  initialHeight = 400,
  minWidth = 320,
  minHeight = 200,
  initialPosition,
  groupUrl,
  courseUrl,
  onPositionChange,
  onSizeChange,
}: DraggableModalProps) {
  const [position, setPosition] = useState({ 
    x: initialPosition?.x ?? 100 + Math.random() * 100, 
    y: initialPosition?.y ?? 100 + Math.random() * 100 
  });
  const [size, setSize] = useState({ width: initialWidth, height: initialHeight });
  const [isDragging, setIsDragging] = useState(false);
  const [isResizing, setIsResizing] = useState(false);
  const [resizeDirection, setResizeDirection] = useState<string | null>(null);
  const [isMobileView, setIsMobileView] = useState(false);
  
  const dragOffset = useRef({ x: 0, y: 0 });
  const resizeStart = useRef({ x: 0, y: 0, width: 0, height: 0, posX: 0, posY: 0 });
  const modalRef = useRef<HTMLDivElement>(null);

  // Check if mobile
  useEffect(() => {
    const checkMobile = () => {
      setIsMobileView(window.innerWidth < 769);
    };
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  // Sync position when initialPosition changes (e.g., after page navigation)
  useEffect(() => {
    if (initialPosition && !isDragging) {
      setPosition(initialPosition);
    }
  }, [initialPosition]);

  // Sync size when initialWidth/initialHeight changes
  useEffect(() => {
    if (!isResizing) {
      setSize({ width: initialWidth, height: initialHeight });
    }
  }, [initialWidth, initialHeight]);

  // Handle dragging (desktop only)
  const handleMouseDown = (e: React.MouseEvent) => {
    if (isMobileView) return;
    if ((e.target as HTMLElement).closest('.modal-drag-handle')) {
      setIsDragging(true);
      dragOffset.current = {
        x: e.clientX - position.x,
        y: e.clientY - position.y,
      };
    }
  };

  // Handle resize (desktop only)
  const handleResizeMouseDown = (e: React.MouseEvent, direction: string) => {
    if (isMobileView) return;
    e.stopPropagation();
    setIsResizing(true);
    setResizeDirection(direction);
    resizeStart.current = {
      x: e.clientX,
      y: e.clientY,
      width: size.width,
      height: size.height,
      posX: position.x,
      posY: position.y,
    };
  };

  useEffect(() => {
    if (!isDragging && !isResizing) return;

    const handleMouseMove = (e: MouseEvent) => {
      if (isDragging) {
        setPosition({
          x: e.clientX - dragOffset.current.x,
          y: e.clientY - dragOffset.current.y,
        });
        onPositionChange?.({
          x: e.clientX - dragOffset.current.x,
          y: e.clientY - dragOffset.current.y,
        });
      }

      if (isResizing && resizeDirection) {
        const deltaX = e.clientX - resizeStart.current.x;
        const deltaY = e.clientY - resizeStart.current.y;

        let newWidth = resizeStart.current.width;
        let newHeight = resizeStart.current.height;
        let newX = resizeStart.current.posX;
        let newY = resizeStart.current.posY;

        if (resizeDirection.includes('e')) {
          newWidth = Math.max(minWidth, resizeStart.current.width + deltaX);
        }
        if (resizeDirection.includes('s')) {
          newHeight = Math.max(minHeight, resizeStart.current.height + deltaY);
        }
        if (resizeDirection.includes('w')) {
          const widthDelta = Math.min(deltaX, resizeStart.current.width - minWidth);
          newWidth = resizeStart.current.width - widthDelta;
          newX = resizeStart.current.posX + widthDelta;
        }
        if (resizeDirection.includes('n')) {
          const heightDelta = Math.min(deltaY, resizeStart.current.height - minHeight);
          newHeight = resizeStart.current.height - heightDelta;
          newY = resizeStart.current.posY + heightDelta;
        }

        setSize({ width: newWidth, height: newHeight });
        setPosition({ x: newX, y: newY });
        onSizeChange?.({ width: newWidth, height: newHeight });
        onPositionChange?.({ x: newX, y: newY });
      }
    };

    const handleMouseUp = () => {
      setIsDragging(false);
      setIsResizing(false);
      setResizeDirection(null);
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);

    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isDragging, isResizing, resizeDirection, minWidth, minHeight]);

  // Keep modal in viewport (desktop only)
  useEffect(() => {
    if (isOpen && modalRef.current && !isMobileView) {
      const viewportWidth = window.innerWidth;
      const viewportHeight = window.innerHeight;
      
      let needsAdjustment = false;
      let newX = position.x;
      let newY = position.y;

      if (position.x + size.width > viewportWidth - 20) {
        newX = viewportWidth - size.width - 20;
        needsAdjustment = true;
      }
      if (position.y + size.height > viewportHeight - 20) {
        newY = viewportHeight - size.height - 20;
        needsAdjustment = true;
      }
      if (position.x < 20) {
        newX = 20;
        needsAdjustment = true;
      }
      if (position.y < 20) {
        newY = 20;
        needsAdjustment = true;
      }

      if (needsAdjustment) {
        setPosition({ x: newX, y: newY });
      }
    }
  }, [isOpen]);

  if (!isOpen) return null;

  // Mobile: full-screen bottom sheet style
  if (isMobileView) {
    return (
      <div
        style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          zIndex: 9999,
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'flex-end',
        }}
      >
        <style>{`
          @keyframes mobileModalBackdropIn {
            from { opacity: 0; }
            to { opacity: 1; }
          }
          @keyframes mobileModalSlideUp {
            from { transform: translateY(100%); }
            to { transform: translateY(0); }
          }
        `}</style>

        {/* Backdrop */}
        <div
          onClick={onClose}
          style={{
            position: 'absolute',
            inset: 0,
            backgroundColor: 'rgba(0, 0, 0, 0.5)',
            animation: 'mobileModalBackdropIn 0.2s ease',
          }}
        />

        {/* Modal content */}
        <div
          ref={modalRef}
          style={{
            position: 'relative',
            backgroundColor: 'white',
            borderRadius: '16px 16px 0 0',
            maxHeight: '90vh',
            display: 'flex',
            flexDirection: 'column',
            overflow: 'hidden',
            animation: 'mobileModalSlideUp 0.3s cubic-bezier(0.32, 0.72, 0, 1)',
            zIndex: 10000,
          }}
        >
          {/* Drag indicator for mobile */}
          <div style={{
            display: 'flex',
            justifyContent: 'center',
            padding: '8px 0 4px',
            backgroundColor: '#f8fafc',
          }}>
            <div style={{
              width: '36px',
              height: '4px',
              borderRadius: '2px',
              backgroundColor: '#cbd5e1',
            }} />
          </div>

          {/* Header */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: '8px 16px 12px',
              background: 'linear-gradient(135deg, #f8fafc 0%, #f1f5f9 100%)',
              borderBottom: '1px solid #e2e8f0',
              flexShrink: 0,
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flex: 1, minWidth: 0 }}>
              <h3 style={{
                margin: 0,
                fontSize: '1rem',
                fontWeight: 600,
                color: '#1e293b',
                letterSpacing: '-0.01em',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
              }}>
                {title}
              </h3>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexShrink: 0 }}>
              {(groupUrl || courseUrl) && (
                <a
                  href={groupUrl || courseUrl}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '4px',
                    padding: '8px 12px',
                    backgroundColor: '#3b82f6',
                    color: 'white',
                    borderRadius: '8px',
                    fontSize: '0.8125rem',
                    fontWeight: 500,
                    textDecoration: 'none',
                    border: 'none',
                    cursor: 'pointer',
                  }}
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
                    <polyline points="15 3 21 3 21 9" />
                    <line x1="10" y1="14" x2="21" y2="3" />
                  </svg>
                  Відкрити
                </a>
              )}
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onClose();
                }}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  width: '36px',
                  height: '36px',
                  backgroundColor: '#f1f5f9',
                  border: 'none',
                  borderRadius: '10px',
                  cursor: 'pointer',
                  color: '#64748b',
                }}
              >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="18" y1="6" x2="6" y2="18" />
                  <line x1="6" y1="6" x2="18" y2="18" />
                </svg>
              </button>
            </div>
          </div>

          {/* Content */}
          <div style={{
            flex: 1,
            overflow: 'auto',
            padding: '16px',
            backgroundColor: '#fafbfc',
            WebkitOverflowScrolling: 'touch',
          }}>
            {children}
          </div>
        </div>
      </div>
    );
  }

  // Desktop: draggable/resizable modal
  return (
    <div
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        zIndex: 9999,
        pointerEvents: 'none',
      }}
    >
      {/* No backdrop - modal works independently */}

      {/* Modal */}
      <div
        ref={modalRef}
        onMouseDown={handleMouseDown}
        style={{
          position: 'absolute',
          left: position.x,
          top: position.y,
          width: size.width,
          height: size.height,
          backgroundColor: 'white',
          borderRadius: '16px',
          boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25), 0 0 0 1px rgba(255, 255, 255, 0.1)',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
          pointerEvents: 'auto',
          transform: 'translate(0, 0) scale(1)',
          transition: isDragging || isResizing ? 'none' : 'transform 0.2s ease-out, box-shadow 0.2s ease-out',
          animation: 'modalSlideIn 0.3s cubic-bezier(0.34, 1.56, 0.64, 1)',
          zIndex: 10000,
        }}
      >
        <style>{`
          @keyframes modalBackdropFadeIn {
            from { opacity: 0; }
            to { opacity: 1; }
          }
          @keyframes modalSlideIn {
            from { 
              opacity: 0;
              transform: scale(0.95) translateY(10px);
            }
            to { 
              opacity: 1;
              transform: scale(1) translateY(0);
            }
          }
        `}</style>

        {/* Header - Drag Handle */}
        <div
          className="modal-drag-handle"
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '12px 16px',
            background: 'linear-gradient(135deg, #f8fafc 0%, #f1f5f9 100%)',
            borderBottom: '1px solid #e2e8f0',
            cursor: isDragging ? 'grabbing' : 'grab',
            userSelect: 'none',
            flexShrink: 0,
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            {/* Drag indicator */}
            <div style={{ 
              display: 'flex', 
              gap: '2px', 
              opacity: 0.4,
            }}>
              <div style={{ width: '4px', height: '4px', borderRadius: '50%', backgroundColor: '#94a3b8' }} />
              <div style={{ width: '4px', height: '4px', borderRadius: '50%', backgroundColor: '#94a3b8' }} />
            </div>
            <h3 style={{
              margin: 0,
              fontSize: '0.9375rem',
              fontWeight: 600,
              color: '#1e293b',
              letterSpacing: '-0.01em',
            }}>
              {title}
            </h3>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            {/* Go to page button */}
            {(groupUrl || courseUrl) && (
              <a
                href={groupUrl || courseUrl}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '4px',
                  padding: '6px 10px',
                  backgroundColor: '#3b82f6',
                  color: 'white',
                  borderRadius: '6px',
                  fontSize: '0.75rem',
                  fontWeight: 500,
                  textDecoration: 'none',
                  transition: 'all 0.15s ease',
                  border: 'none',
                  cursor: 'pointer',
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.backgroundColor = '#2563eb';
                  e.currentTarget.style.transform = 'translateY(-1px)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.backgroundColor = '#3b82f6';
                  e.currentTarget.style.transform = 'translateY(0)';
                }}
              >
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
                  <polyline points="15 3 21 3 21 9" />
                  <line x1="10" y1="14" x2="21" y2="3" />
                </svg>
                Відкрити
              </a>
            )}
            {/* Close button */}
            <button
              onClick={(e) => {
                e.stopPropagation();
                onClose();
              }}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                width: '28px',
                height: '28px',
                backgroundColor: 'transparent',
                border: 'none',
                borderRadius: '6px',
                cursor: 'pointer',
                color: '#64748b',
                transition: 'all 0.15s ease',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.backgroundColor = '#fee2e2';
                e.currentTarget.style.color = '#dc2626';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.backgroundColor = 'transparent';
                e.currentTarget.style.color = '#64748b';
              }}
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <line x1="18" y1="6" x2="6" y2="18" />
                <line x1="6" y1="6" x2="18" y2="18" />
              </svg>
            </button>
          </div>
        </div>

        {/* Content */}
        <div style={{
          flex: 1,
          overflow: 'auto',
          padding: '16px',
          backgroundColor: '#fafbfc',
        }}>
          {children}
        </div>

        {/* Resize handles */}
        {/* Corner handles */}
        <div
          onMouseDown={(e) => handleResizeMouseDown(e, 'se')}
          style={{
            position: 'absolute',
            right: 0,
            bottom: 0,
            width: '16px',
            height: '16px',
            cursor: 'se-resize',
            zIndex: 10,
          }}
        >
          <svg 
            width="12" 
            height="12" 
            viewBox="0 0 12 12" 
            style={{ 
              position: 'absolute', 
              right: '4px', 
              bottom: '4px',
              color: '#cbd5e1',
            }}
          >
            <path d="M10 1L1 10M10 5L5 10M10 9L9 10" stroke="currentColor" strokeWidth="1.5" fill="none" strokeLinecap="round"/>
          </svg>
        </div>
        
        {/* Edge handles */}
        <div
          onMouseDown={(e) => handleResizeMouseDown(e, 'e')}
          style={{
            position: 'absolute',
            right: 0,
            top: '20px',
            bottom: '20px',
            width: '8px',
            cursor: 'e-resize',
            zIndex: 5,
          }}
        />
        <div
          onMouseDown={(e) => handleResizeMouseDown(e, 's')}
          style={{
            position: 'absolute',
            bottom: 0,
            left: '20px',
            right: '20px',
            height: '8px',
            cursor: 's-resize',
            zIndex: 5,
          }}
        />
      </div>
    </div>
  );
}
