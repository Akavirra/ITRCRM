'use client';

import Link from 'next/link';
import { usePageTransition } from './PageTransitionProvider';

interface NavigationLinkProps {
  href: string;
  children: React.ReactNode;
  className?: string;
  onClick?: () => void;
}

export const NavigationLink = ({ href, children, className, onClick }: NavigationLinkProps) => {
  const { startLoading } = usePageTransition();

  const handleClick = (e: React.MouseEvent<HTMLAnchorElement>) => {
    // Start the loading animation immediately before navigation
    startLoading();
    
    // Call onClick if provided
    if (onClick) {
      onClick();
    }
  };

  return (
    <Link href={href} className={className} onClick={handleClick}>
      {children}
    </Link>
  );
};

export default NavigationLink;
