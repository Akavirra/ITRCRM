'use client';

import { useRef, MouseEvent, AnchorHTMLAttributes } from 'react';
import Link from 'next/link';
import { usePageTransition } from './PageTransitionProvider';

interface TransitionLinkProps extends Omit<AnchorHTMLAttributes<HTMLAnchorElement>, 'href'> {
  href: string;
  children: React.ReactNode;
  onClick?: () => void;
}

export const TransitionLink = ({ 
  href, 
  children, 
  onClick,
  ...props 
}: TransitionLinkProps) => {
  const { startLoading } = usePageTransition();
  const isExternal = href.startsWith('http') || href.startsWith('//');

  const handleClick = (e: MouseEvent<HTMLAnchorElement>) => {
    if (isExternal) {
      return; // Зовнішні посилання відкриваються звичайним чином
    }

    // Якщо це поточна сторінка, не робимо нічого
    if (window.location.pathname === href) {
      e.preventDefault();
      return;
    }
    
    if (onClick) {
      onClick();
    }

    // Починаємо показувати лоадер
    startLoading();
    
    // Посилання буде оброблено Next.js Link автоматично
  };

  if (isExternal) {
    return (
      <a href={href} {...props} target="_blank" rel="noopener noreferrer">
        {children}
      </a>
    );
  }

  return (
    <Link href={href} onClick={handleClick} {...props}>
      {children}
    </Link>
  );
};

export default TransitionLink;
