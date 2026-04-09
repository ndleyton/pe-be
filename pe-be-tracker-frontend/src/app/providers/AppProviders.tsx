import type { ErrorInfo, ReactNode } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ReactQueryDevtools } from "@tanstack/react-query-devtools";
import { ErrorBoundary } from "react-error-boundary";
import { PostHogProvider, usePostHog } from "posthog-js/react";
import { config } from "@/app/config/env";
import { StoreInitializer } from "@/stores";

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
  <div className="flex min-h-screen items-center justify-center p-4">
    <div className="w-full max-w-md text-center">
      <h2 className="mb-2 text-xl font-semibold">Something went wrong</h2>
      <p className="text-muted-foreground mb-4">
        Please try refreshing the page
      </p>
      <button
        onClick={() => window.location.reload()}
        className="bg-primary text-primary-foreground hover:bg-primary/90 rounded-md px-4 py-2"
      >
        Reload Page
      </button>
    </div>
  </div>
);

// Error boundary that sends errors to PostHog
const PostHogErrorBoundary = ({ children }: { children: ReactNode }) => {
  const posthog = usePostHog();

  const handleError = (error: unknown, info: ErrorInfo) => {
    console.error("App Error:", error);
    posthog?.captureException(error, {
      source: "react-error-boundary",
      timestamp: new Date().toISOString(),
      componentStack: info.componentStack,
    });
  };

  return (
    <ErrorBoundary
      FallbackComponent={SimpleErrorFallback}
      onError={handleError}
    >
      {children}
    </ErrorBoundary>
  );
};

export const AppProviders = ({ children }: { children: ReactNode }) => {
  // Only render PostHogProvider if PostHog is properly configured and not in test mode
  const isPostHogConfigured =
    !config.isTest && config.posthogApiKey && config.posthogHost;
  const isAutomatedBrowser =
    typeof navigator !== "undefined" && navigator.webdriver;
  const shouldShowReactQueryDevtools =
    config.isDevelopment && !config.isTest && !isAutomatedBrowser;

  return (
    <QueryClientProvider client={queryClient}>
      {isPostHogConfigured ? (
        <PostHogProvider
          apiKey={config.posthogApiKey}
          options={{
            api_host: config.posthogHost,
            capture_exceptions: true, // Enable automatic exception capture for unhandled errors
            debug: config.isDevelopment,
          }}
        >
          <PostHogErrorBoundary>
            <StoreInitializer>{children}</StoreInitializer>
          </PostHogErrorBoundary>
        </PostHogProvider>
      ) : (
        <ErrorBoundary
          FallbackComponent={SimpleErrorFallback}
          onError={(error) => {
            console.error("App Error:", error);
          }}
        >
          <StoreInitializer>{children}</StoreInitializer>
        </ErrorBoundary>
      )}
      {shouldShowReactQueryDevtools && (
        <ReactQueryDevtools initialIsOpen={false} buttonPosition="bottom-left" />
      )}
    </QueryClientProvider>
  );
};
