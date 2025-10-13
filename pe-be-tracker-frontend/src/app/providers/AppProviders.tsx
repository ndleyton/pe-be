import React from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ReactQueryDevtools } from '@tanstack/react-query-devtools';
import { PostHogProvider } from 'posthog-js/react';
import { ErrorBoundary } from 'react-error-boundary';
import { config } from '@/app/config/env';

// Configure React Query client
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 5 * 60 * 1000, // 5 minutes
      retry: 1,
      refetchOnWindowFocus: false,
    },
    mutations: {
      retry: 1,
    },
  },
});

const SimpleErrorFallback = () => (
  <div className="min-h-screen flex items-center justify-center p-4">
    <div className="max-w-md w-full text-center">
      <h2 className="text-xl font-semibold mb-2">Something went wrong</h2>
      <p className="text-muted-foreground mb-4">Please try refreshing the page</p>
      <button
        onClick={() => window.location.reload()}
        className="px-4 py-2 bg-primary text-primary-foreground rounded-md hover:bg-primary/90"
      >
        Reload Page
      </button>
    </div>
  </div>
);

export const AppProviders: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  // Only render PostHogProvider if PostHog is properly configured and not in test mode
  const isPostHogConfigured = !config.isTest && config.posthogApiKey && config.posthogHost;

  return (
    <QueryClientProvider client={queryClient}>
      {isPostHogConfigured ? (
        <PostHogProvider
          apiKey={config.posthogApiKey}
          options={{
            api_host: config.posthogHost,
            capture_exceptions: true, // Enable automatic exception capture
            debug: config.isDevelopment,
          }}
        >
          <ErrorBoundary
            FallbackComponent={SimpleErrorFallback}
            onError={(error) => {
              console.error('App Error:', error);
            }}
          >
            {children}
          </ErrorBoundary>
        </PostHogProvider>
      ) : (
        <ErrorBoundary
          FallbackComponent={SimpleErrorFallback}
          onError={(error) => {
            console.error('App Error:', error);
          }}
        >
          {children}
        </ErrorBoundary>
      )}
      {config.isDevelopment && !config.isTest && <ReactQueryDevtools initialIsOpen={false} />}
    </QueryClientProvider>
  );
};
