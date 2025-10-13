import React, { useEffect, useState } from 'react';
import { usePostHog } from 'posthog-js/react';
import { Button } from '@/shared/components/ui/button';
import { useSearchParams } from 'react-router-dom';
import { captureExceptionSafe, resolvePostHog } from '@/shared/analytics/posthogHelpers';

function ThrowOnRender(): never {
  throw new Error('Debug: render error (handled by ErrorBoundary)');
}

const CrashPage: React.FC = () => {
  const posthog = usePostHog();
  const [showRenderCrash, setShowRenderCrash] = useState(false);
  const [searchParams] = useSearchParams();

  useEffect(() => {
    if (searchParams.get('render') === '1') {
      setShowRenderCrash(true);
    }
    if (searchParams.get('onerror') === '1') {
      setTimeout(() => {
        // Unhandled window error
        throw new Error('Debug: window error (unhandled)');
      }, 0);
    }
    if (searchParams.get('rejection') === '1') {
      setTimeout(() => {
        // Unhandled promise rejection
        // eslint-disable-next-line prefer-promise-reject-errors
        Promise.reject(new Error('Debug: unhandled promise rejection'));
      }, 0);
    }
    if (searchParams.get('manual') === '1') {
      const err = new Error('Debug: manual captureException');
      const props = { source: 'query', when: Date.now() } as const;
      const ph = resolvePostHog(posthog);
      captureExceptionSafe(ph, err, props);
    }
    if (searchParams.get('console') === '1') {
      // Console error (captured if console error wrapping is enabled)
      // eslint-disable-next-line no-console
      console.error('Debug: console.error with Error', new Error('Debug: console error'));
    }
  }, [posthog, searchParams]);

  if (showRenderCrash) {
    return <ThrowOnRender />;
  }

  return (
    <div className="max-w-xl mx-auto p-6 space-y-4">
      <h1 className="text-xl font-semibold">Debug: Error Tracking</h1>
      <p className="text-sm text-muted-foreground">
        Use these buttons to trigger different error paths and verify PostHog capture.
      </p>

      <div className="space-y-2">
        <Button className="w-full" onClick={() => setShowRenderCrash(true)}>
          Throw render error (handled by boundary)
        </Button>
        <Button className="w-full" variant="outline" onClick={() => setTimeout(() => { throw new Error('Debug: window error (unhandled)'); }, 0)}>
          Throw unhandled window error
        </Button>
        <Button className="w-full" variant="outline" onClick={() => setTimeout(() => { Promise.reject(new Error('Debug: unhandled promise rejection')); }, 0)}>
          Reject unhandled promise
        </Button>
        <Button className="w-full" variant="secondary" onClick={() => {
          const err = new Error('Debug: manual captureException');
          const props = { source: 'button', when: Date.now() } as const;
          const ph = resolvePostHog(posthog);
          captureExceptionSafe(ph, err, props);
        }}>
          Manually capture exception
        </Button>
        <Button className="w-full" variant="ghost" onClick={() => {
          // eslint-disable-next-line no-console
          console.error('Debug: console.error with Error', new Error('Debug: console error'));
        }}>
          console.error with Error
        </Button>
      </div>

      <div className="text-xs text-muted-foreground">
        Or use query params: <code>?render=1</code>, <code>?onerror=1</code>, <code>?rejection=1</code>, <code>?manual=1</code>, <code>?console=1</code>
      </div>
    </div>
  );
};

export default CrashPage;
