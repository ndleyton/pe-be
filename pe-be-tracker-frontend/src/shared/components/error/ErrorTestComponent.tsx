import { useState } from "react";
import { Button } from "@/shared/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/shared/components/ui/card";

interface ErrorTestComponentProps {
  className?: string;
}

export const ErrorTestComponent = ({ className }: ErrorTestComponentProps) => {
  const [shouldThrow, setShouldThrow] = useState(false);

  // This will trigger an error in the render method
  if (shouldThrow) {
    throw new Error("Test error triggered by ErrorTestComponent");
  }

  const triggerRenderError = () => {
    setShouldThrow(true);
  };

  const triggerAsyncError = () => {
    // This won't be caught by error boundaries (async errors aren't caught)
    setTimeout(() => {
      throw new Error(
        "Async error - this will not be caught by error boundaries",
      );
    }, 100);
  };

  const triggerPromiseRejection = () => {
    // This also won't be caught by error boundaries
    Promise.reject(
      new Error(
        "Promise rejection - this will not be caught by error boundaries",
      ),
    );
  };

  const triggerNetworkError = () => {
    // Simulate a network error by making a request to a non-existent endpoint
    fetch("/api/non-existent-endpoint")
      .then((response) => {
        if (!response.ok) {
          throw new Error(`Network error: ${response.status}`);
        }
        return response.json();
      })
      .catch((error) => {
        console.error("Network error (not caught by error boundary):", error);
      });
  };

  const triggerMapError = () => {
    // Simulate the "map is not a function" error
    try {
      const notAnArray = { data: "not an array" };
      // @ts-ignore - intentionally causing an error
      notAnArray.map((item) => item);
    } catch (error) {
      console.error(
        "Map error (caught in try-catch, not by error boundary):",
        error,
      );
    }
  };

  // Only show this component in development
  if (process.env.NODE_ENV !== "development") {
    return null;
  }

  return (
    <Card className={className}>
      <CardHeader>
        <CardTitle>🧪 Error Boundary Testing</CardTitle>
        <CardDescription>
          Development tool for testing error boundaries. Only visible in
          development mode.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="grid grid-cols-1 gap-2">
          <Button onClick={triggerRenderError} variant="destructive" size="sm">
            Trigger Render Error (Caught by Error Boundary)
          </Button>

          <Button onClick={triggerAsyncError} variant="outline" size="sm">
            Trigger Async Error (Not Caught)
          </Button>

          <Button onClick={triggerPromiseRejection} variant="outline" size="sm">
            Trigger Promise Rejection (Not Caught)
          </Button>

          <Button onClick={triggerNetworkError} variant="outline" size="sm">
            Trigger Network Error (Not Caught)
          </Button>

          <Button onClick={triggerMapError} variant="outline" size="sm">
            Trigger Map Error (Try-Catch)
          </Button>
        </div>

        <div className="text-muted-foreground bg-muted mt-4 rounded p-2 text-xs">
          <strong>Note:</strong> Error boundaries only catch errors in:
          <ul className="mt-1 list-inside list-disc">
            <li>Render methods</li>
            <li>Lifecycle methods</li>
            <li>Constructors</li>
          </ul>
          They do NOT catch errors in event handlers, async code, or during
          server-side rendering.
        </div>
      </CardContent>
    </Card>
  );
};

export default ErrorTestComponent;
