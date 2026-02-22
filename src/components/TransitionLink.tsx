'use client';

import { useRef, MouseEvent, AnchorHTMLAttributes } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
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
  const router = useRouter();
  const { startLoading } = usePageTransition();
  const linkRef = useRef<HTMLAnchorElement>(null);
  const isExternal = href.startsWith('http') || href.startsWith('//');

  const handleClick = (e: MouseEvent<HTMLAnchorElement>) => {
    if (isExternal) {
      return; // Зовнішні посилання відкриваються звичайним чином
    }

    e.preventDefault();
    
    if (onClick) {
      onClick();
    }

    // Починаємо показувати лоадер
    startLoading();
    
    // Використовуємо router.push для навігації
    router.push(href);
  };

  if (isExternal) {
    return (
      <a href={href} {...props} target="_blank" rel="noopener noreferrer">
        {children}
      </a>
    );
  }

  return (
    <Link href={href} ref={linkRef} onClick={handleClick} {...props}>
      {children}
    </Link>
  );
};

export default TransitionLink;
