import {
  useEffect,
  useState,
  type ErrorInfo,
  type ReactNode,
} from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ReactQueryDevtools } from "@tanstack/react-query-devtools";
import { ErrorBoundary } from "react-error-boundary";
import posthog from "posthog-js";
import { PostHogProvider, usePostHog } from "posthog-js/react";
import { config } from "@/app/config/env";
import { StoreInitializer } from "@/stores";
import { Toaster, TooltipProvider } from "@/shared/components/ui";

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

const posthogOptions = {
  api_host: config.posthogHost,
  capture_exceptions: true,
  debug: config.isDevelopment,
  disable_surveys: true,
} as const;

const DeferredPostHogProvider = ({ children }: { children: ReactNode }) => {
  const [posthogReady, setPostHogReady] = useState(posthog.__loaded);

  useEffect(() => {
    if (posthog.__loaded) {
      setPostHogReady(true);
      return;
    }

    let cancelled = false;

    const initializePostHog = () => {
      if (cancelled || posthog.__loaded) {
        if (!cancelled && posthog.__loaded) {
          setPostHogReady(true);
        }
        return;
      }

      posthog.init(config.posthogApiKey, posthogOptions);
      if (!cancelled) {
        setPostHogReady(true);
      }
    };

    const browserWindow = window as Window &
      typeof globalThis & {
        requestIdleCallback?: (
          callback: IdleRequestCallback,
          options?: IdleRequestOptions,
        ) => number;
        cancelIdleCallback?: (handle: number) => void;
      };

    if (typeof browserWindow.requestIdleCallback === "function") {
      const idleId = browserWindow.requestIdleCallback(initializePostHog, {
        timeout: 2000,
      });

      return () => {
        cancelled = true;
        browserWindow.cancelIdleCallback?.(idleId);
      };
    }

    const timeoutId = globalThis.setTimeout(initializePostHog, 0);
    return () => {
      cancelled = true;
      globalThis.clearTimeout(timeoutId);
    };
  }, []);

  return (
    <PostHogProvider client={posthog}>
      <PostHogErrorBoundary>
        <StoreInitializer posthogReady={posthogReady}>
          {children}
        </StoreInitializer>
      </PostHogErrorBoundary>
    </PostHogProvider>
  );
};

export const AppProviders = ({ children }: { children: ReactNode }) => {
  // Only render PostHogProvider if PostHog is properly configured and not in test mode
  const isPostHogConfigured = Boolean(
    config.posthogApiKey && config.posthogHost && !config.isTest,
  );
  const isAutomatedBrowser =
    typeof navigator !== "undefined" && navigator.webdriver;
  const shouldShowReactQueryDevtools =
    config.isDevelopment && !config.isTest && !isAutomatedBrowser;

  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider delayDuration={300}>
        {isPostHogConfigured ? (
          <DeferredPostHogProvider>{children}</DeferredPostHogProvider>
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
        <Toaster />
      </TooltipProvider>
    </QueryClientProvider>
  );
};
