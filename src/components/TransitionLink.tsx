'use client';

import { MouseEvent, AnchorHTMLAttributes } from 'react';
import Link from 'next/link';

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
  const isExternal = href.startsWith('http') || href.startsWith('//');

  const handleClick = (e: MouseEvent<HTMLAnchorElement>) => {
    if (isExternal) {
      return;
    }

    if (onClick) {
      onClick();
    }
    
    // Next.js Link обробить навігацію автоматично
    // Сторінка покаже свій власний loading стан
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
