'use client';

import { MouseEvent, AnchorHTMLAttributes } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';

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
  const isExternal = href.startsWith('http') || href.startsWith('//');

  const handleClick = (e: MouseEvent<HTMLAnchorElement>) => {
    if (isExternal) {
      return;
    }

    if (onClick) {
      onClick();
    }
    
    // Пряма SPA навігація через router.push щоб запобігти повному перевантаженню
    e.preventDefault();
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
    <Link href={href} onClick={handleClick} {...props}>
      {children}
    </Link>
  );
};

export default TransitionLink;
