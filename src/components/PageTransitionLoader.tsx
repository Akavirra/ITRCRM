'use client';

import { usePageTransition } from './PageTransitionProvider';
import PageLoader from './PageLoader';

export const PageTransitionLoader = () => {
  const { isLoading } = usePageTransition();
  return <PageLoader isLoading={isLoading} />;
};

export default PageTransitionLoader;
