import React, { ErrorInfo } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ReactQueryDevtools } from '@tanstack/react-query-devtools';
import { ErrorBoundary } from 'react-error-boundary';
import { PostHogProvider } from 'posthog-js/react';
import { config } from '@/app/config/env';
import { ErrorFallback } from '@/shared/components/error';
import { StoreInitializer } from '@/stores';

// Configure React Query client
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 5 * 60 * 1000, // 5 minutes
      retry: 1,
      refetchOnWindowFocus: false,
      // Add error handling for queries
      throwOnError: false, // Let error boundaries handle errors instead of throwing
    },
    mutations: {
      retry: 1,
      // Add error handling for mutations
      throwOnError: false,
    },
  },
});

// Global error handler for the entire app
const handleGlobalError = (error: Error, errorInfo: ErrorInfo) => {
  console.error('Global Error Boundary caught an error:', error);
  console.error('Component Stack:', errorInfo.componentStack);
  
  // In production, send to error tracking service
  if (process.env.NODE_ENV === 'production') {
    // Example: Send to error tracking service
    // errorTrackingService.captureException(error, {
    //   tags: { boundary: 'global' },
    //   extra: errorInfo
    // });
  }
};

export const AppProviders: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  // Only render PostHogProvider if PostHog is properly configured and not in test mode
  const isPostHogConfigured = !config.isTest && config.posthogApiKey && config.posthogHost;

  return (
    <ErrorBoundary
      FallbackComponent={ErrorFallback}
      onError={handleGlobalError}
      onReset={() => {
        // Reset any global state that might be causing issues
        queryClient.clear();
        // Could also clear localStorage or other persistent state if needed
      }}
    >
      <QueryClientProvider client={queryClient}>
        {isPostHogConfigured ? (
          <PostHogProvider
            apiKey={config.posthogApiKey}
            options={{
              api_host: config.posthogHost,
              capture_exceptions: true, // This enables capturing exceptions using Error Tracking, set to false if you don't want this
              debug: config.isDevelopment,
            }}
          >
            <StoreInitializer>
              {children}
            </StoreInitializer>
          </PostHogProvider>
        ) : (
          <StoreInitializer>
            {children}
          </StoreInitializer>
        )}
        {config.isDevelopment && !config.isTest && <ReactQueryDevtools initialIsOpen={false} />}
      </QueryClientProvider>
    </ErrorBoundary>
  );
};