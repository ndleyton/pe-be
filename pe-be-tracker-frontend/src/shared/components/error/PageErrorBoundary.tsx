import React from 'react';
import { ErrorBoundary } from 'react-error-boundary';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { ErrorInfo } from 'react';

interface PageErrorFallbackProps {
  error: Error;
  resetErrorBoundary: () => void;
}

const PageErrorFallback: React.FC<PageErrorFallbackProps> = ({ 
  error, 
  resetErrorBoundary 
}) => {
  return (
    <div className="flex items-center justify-center min-h-[400px] p-4">
      <div className="max-w-md w-full">
        <Alert variant="destructive" className="mb-4">
          <div className="w-5 h-5">⚠️</div>
          <AlertTitle>Page Error</AlertTitle>
          <AlertDescription className="mt-2">
            This page encountered an error and couldn't load properly.
          </AlertDescription>
        </Alert>
        
        <div className="space-y-2">
          <Button onClick={resetErrorBoundary} className="w-full">
            Try Again
          </Button>
          <Button 
            onClick={() => window.location.reload()} 
            variant="outline" 
            className="w-full"
          >
            Reload Page
          </Button>
        </div>

        {process.env.NODE_ENV === 'development' && (
          <details className="mt-4 p-3 bg-muted rounded-lg">
            <summary className="cursor-pointer text-sm font-medium text-muted-foreground">
              Error Details (Development Only)
            </summary>
            <pre className="mt-2 text-xs text-muted-foreground overflow-auto max-h-32">
              {error?.message || error?.toString()}
            </pre>
          </details>
        )}
      </div>
    </div>
  );
};

interface PageErrorBoundaryProps {
  children: React.ReactNode;
  fallback?: React.ComponentType<PageErrorFallbackProps>;
}

export const PageErrorBoundary: React.FC<PageErrorBoundaryProps> = ({ 
  children, 
  fallback: Fallback = PageErrorFallback 
}) => {
  const handleError = (error: Error, errorInfo: ErrorInfo) => {
    console.error('Page Error:', error);
    console.error('Component Stack:', errorInfo.componentStack);
    
    // In production, you might want to send this to an error tracking service
    if (process.env.NODE_ENV === 'production') {
      // Example: Send to error tracking service
      // errorTrackingService.captureException(error, {
      //   tags: { boundary: 'page' },
      //   extra: errorInfo
      // });
    }
  };

  return (
    <ErrorBoundary
      FallbackComponent={Fallback}
      onError={handleError}
      onReset={() => {
        // Clear any stale data or reset state if needed
        // This could trigger a refetch of data or clear cache
      }}
    >
      {children}
    </ErrorBoundary>
  );
};

export default PageErrorBoundary; 