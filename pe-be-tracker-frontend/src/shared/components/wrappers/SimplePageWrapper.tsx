import React from 'react';
import { PageErrorBoundary } from '@/shared/components/error';

interface SimplePageWrapperProps {
  children: React.ReactNode;
}

const SimplePageWrapper: React.FC<SimplePageWrapperProps> = ({ children }) => (
  <PageErrorBoundary>
    {children}
  </PageErrorBoundary>
);

export default SimplePageWrapper;

