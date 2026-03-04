'use client';

import React, { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';

type PortalProps = {
  anchorRef: React.RefObject<HTMLElement | null>;
  children: React.ReactNode;
  menuRef?: React.RefObject<HTMLDivElement | null>;
  offsetY?: number;
};

export default function Portal({ anchorRef, children, menuRef, offsetY = 6 }: PortalProps) {
  const [pos, setPos] = useState<{ left: number; top: number } | null>(null);

  useEffect(() => {
    const update = () => {
      const anchor = anchorRef?.current;
      if (!anchor) return;
      const rect = anchor.getBoundingClientRect();
      setPos({ left: rect.right, top: rect.bottom + offsetY });
    };

    update();
    window.addEventListener('resize', update);
    window.addEventListener('scroll', update, true);
    return () => {
      window.removeEventListener('resize', update);
      window.removeEventListener('scroll', update, true);
    };
  }, [anchorRef, offsetY]);

  if (!pos) return null;

  return createPortal(
    <div
      ref={menuRef as any}
      style={{
        position: 'fixed',
        left: pos.left,
        top: pos.top,
        transform: 'translateX(-100%)',
        zIndex: 9999,
      }}
    >
      {children}
    </div>,
    document.body
  );
}
