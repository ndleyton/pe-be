import React from 'react';
import { FallbackProps } from 'react-error-boundary';
import { Button } from '@/shared/components/ui/button';
import { Alert, AlertDescription, AlertTitle } from '@/shared/components/ui/alert';
import { HomeLogo } from '@/shared/components/layout';

interface CustomFallbackProps extends FallbackProps {
  message?: string;
}

export const ErrorFallback: React.FC<CustomFallbackProps> = ({ 
  error, 
  resetErrorBoundary,
  message 
}) => {
  const errorMessage = message || error?.message || 'An unexpected error occurred';
  const isNetworkError = error?.message?.includes('Network Error') || error?.message?.includes('fetch');
  const isAuthError = error?.message?.includes('401') || error?.message?.includes('403') || error?.message?.includes('Unauthorized');

  const handleGoHome = () => {
    window.location.href = '/';
  };

  const handleReload = () => {
    window.location.reload();
  };

  const handleRetry = () => {
    resetErrorBoundary();
  };

  // Log error for debugging (in development) and monitoring (in production)
  React.useEffect(() => {
    console.error('Error caught by ErrorBoundary:', error);
    
    // In production, you might want to send this to an error tracking service
    // like Sentry, LogRocket, or Bugsnag
    if (process.env.NODE_ENV === 'production') {
      // Example: Send to error tracking service
      // errorTrackingService.captureException(error);
    }
  }, [error]);

  return (
    <div className="min-h-screen flex flex-col bg-background">
      <div className="p-4">
        <HomeLogo />
      </div>
      
      <div className="flex-1 flex items-center justify-center p-4">
        <div className="max-w-md w-full">
          <Alert variant="destructive" className="mb-6">
            <div className="w-6 h-6">⚠️</div>
            <AlertTitle>Something went wrong</AlertTitle>
            <AlertDescription className="mt-2">
              {isNetworkError && (
                <>
                  We're having trouble connecting to our servers. 
                  Please check your internet connection and try again.
                </>
              )}
              {isAuthError && (
                <>
                  Your session may have expired. Please sign in again to continue.
                </>
              )}
              {!isNetworkError && !isAuthError && (
                <>
                  {errorMessage}
                </>
              )}
            </AlertDescription>
          </Alert>

          <div className="space-y-4">
            <div className="grid grid-cols-1 gap-3">
              <Button onClick={handleRetry} className="w-full">
                Try Again
              </Button>
              
              <Button onClick={handleReload} variant="outline" className="w-full">
                Reload Page
              </Button>
              
              <Button onClick={handleGoHome} variant="ghost" className="w-full">
                Go to Home
              </Button>
            </div>

            {process.env.NODE_ENV === 'development' && (
              <details className="mt-6 p-3 bg-muted rounded-lg">
                <summary className="cursor-pointer text-sm font-medium text-muted-foreground">
                  Developer Details (Development Only)
                </summary>
                <pre className="mt-2 text-xs text-muted-foreground overflow-auto max-h-40">
                  {error?.stack || error?.toString()}
                </pre>
              </details>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default ErrorFallback; 