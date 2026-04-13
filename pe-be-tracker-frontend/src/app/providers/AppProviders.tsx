import { Suspense, lazy, useEffect, type ErrorInfo, type ReactNode } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ErrorBoundary } from "react-error-boundary";
import { config } from "@/app/config/env";
import {
  capturePostHogException,
  schedulePostHogInit,
} from "@/app/telemetry/posthog";
import { StoreInitializer } from "@/stores";

const ReactQueryDevtools = lazy(() =>
  import("@tanstack/react-query-devtools").then((module) => ({
    default: module.ReactQueryDevtools,
  })),
);

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

const AppErrorBoundary = ({ children }: { children: ReactNode }) => {
  const handleError = (error: unknown, info: ErrorInfo) => {
    console.error("App Error:", error);
    capturePostHogException(error, {
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
  const isPostHogConfigured =
    !config.isTest && config.posthogApiKey && config.posthogHost;
  const isAutomatedBrowser =
    typeof navigator !== "undefined" && navigator.webdriver;
  const shouldShowReactQueryDevtools =
    config.isDevelopment && !config.isTest && !isAutomatedBrowser;

  useEffect(() => {
    if (!isPostHogConfigured) {
      return;
    }

    return schedulePostHogInit();
  }, [isPostHogConfigured]);

  return (
    <QueryClientProvider client={queryClient}>
      {isPostHogConfigured ? (
        <AppErrorBoundary>
          <StoreInitializer>{children}</StoreInitializer>
        </AppErrorBoundary>
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
        <Suspense fallback={null}>
          <ReactQueryDevtools
            initialIsOpen={false}
            buttonPosition="bottom-left"
          />
        </Suspense>
      )}
    </QueryClientProvider>
  );
};
