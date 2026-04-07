'use client';

import dynamic from 'next/dynamic';
import { usePageTransition } from './PageTransitionProvider';

const PageLoader = dynamic(() => import('./PageLoader'), {
  ssr: false,
});

export const PageTransitionLoader = () => {
  const { isLoading } = usePageTransition();
  return <PageLoader isLoading={isLoading} />;
};

export default PageTransitionLoader;
