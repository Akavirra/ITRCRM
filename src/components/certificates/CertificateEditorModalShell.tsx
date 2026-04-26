'use client';

import { ReactNode, useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { ArrowLeft, X } from 'lucide-react';

interface CertificateEditorModalShellProps {
  isOpen: boolean;
  onClose: () => void;
  shellClassName: string;
  headerClassName: string;
  headerMainClassName: string;
  headerBackClassName: string;
  headerTitleStackClassName: string;
  headerActionsClassName: string;
  closeButtonClassName: string;
  bodyClassName: string;
  footerClassName: string;
  headerContent: ReactNode;
  bodyNotice?: ReactNode;
  children: ReactNode;
  footer: ReactNode;
}

export default function CertificateEditorModalShell({
  isOpen,
  onClose,
  shellClassName,
  headerClassName,
  headerMainClassName,
  headerBackClassName,
  headerTitleStackClassName,
  headerActionsClassName,
  closeButtonClassName,
  bodyClassName,
  footerClassName,
  headerContent,
  bodyNotice,
  children,
  footer,
}: CertificateEditorModalShellProps) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [isOpen]);

  if (!isOpen || !mounted) {
    return null;
  }

  return createPortal(
    <div className="modal-overlay" onClick={onClose}>
      <div className={shellClassName} onClick={(event) => event.stopPropagation()}>
        <div className={headerClassName}>
          <div className={headerMainClassName}>
            <button type="button" className={headerBackClassName} onClick={onClose} aria-label="Назад">
              <ArrowLeft size={16} />
            </button>
            <div className={headerTitleStackClassName}>{headerContent}</div>
          </div>

          <div className={headerActionsClassName}>
            <button type="button" className={closeButtonClassName} onClick={onClose} aria-label="Закрити">
              <X size={16} />
            </button>
          </div>
        </div>

        <div className={bodyClassName}>
          {bodyNotice}
          {children}
        </div>

        <div className={footerClassName}>{footer}</div>
      </div>
    </div>,
    document.body
  );
}
