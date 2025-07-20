# Error Boundary System

This document describes the comprehensive error boundary system implemented in the PE-BE Tracker Frontend to provide graceful error handling and improved user experience.

## Overview

The application uses [React Error Boundaries](https://react.dev/reference/react/Component#catching-rendering-errors-with-an-error-boundary) combined with the [react-error-boundary](https://github.com/bvaughn/react-error-boundary) library to catch and handle JavaScript errors gracefully.

## Architecture

### 1. Global Error Boundary
- **Location**: `src/app/providers/AppProviders.tsx`
- **Purpose**: Catches any unhandled errors throughout the entire application
- **Fallback**: Full-screen error page with recovery options
- **Features**:
  - Automatic error logging
  - React Query cache clearing on reset
  - Different error messages for network/auth errors
  - Production error tracking integration ready

### 2. Page-Level Error Boundaries
- **Location**: `src/shared/components/error/PageErrorBoundary.tsx`
- **Purpose**: Catches errors within individual pages/routes
- **Fallback**: Inline error component that doesn't break the entire app
- **Features**:
  - Lighter error UI suitable for page-level errors
  - Quick recovery options
  - Preserves navigation and app structure

## Components

### ErrorFallback
- **File**: `src/shared/components/error/ErrorFallback.tsx`
- **Purpose**: Full-screen error page for global errors
- **Features**:
  - Responsive design matching app theme
  - Context-aware error messages (network, auth, generic)
  - Multiple recovery options (retry, reload, go home)
  - Developer details in development mode
  - Error logging and tracking integration

### PageErrorBoundary
- **File**: `src/shared/components/error/PageErrorBoundary.tsx`
- **Purpose**: Wraps individual pages for isolated error handling
- **Features**:
  - Inline error display
  - Quick recovery options
  - Maintains app layout and navigation
  - Development error details

### ErrorTestComponent (Development Only)
- **File**: `src/shared/components/error/ErrorTestComponent.tsx`
- **Purpose**: Testing tool for developers to verify error boundaries
- **Features**:
  - Trigger various types of errors
  - Educational information about error boundary limitations
  - Only visible in development mode
  - Available in Settings page

## Usage

### Automatic Coverage
All routes are automatically wrapped with error boundaries:

```tsx
// routes.tsx
const PageWrapper: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <PageErrorBoundary>
    <Suspense fallback={<LoadingFallback />}>
      {children}
    </Suspense>
  </PageErrorBoundary>
);
```

### Manual Implementation
For custom components that need error boundaries:

```tsx
import { PageErrorBoundary } from '@/shared/components/error';

function MyComponent() {
  return (
    <PageErrorBoundary>
      <RiskyComponent />
    </PageErrorBoundary>
  );
}
```

## What Error Boundaries Catch

✅ **Caught by Error Boundaries:**
- Errors during component rendering
- Errors in lifecycle methods
- Errors in constructors of component tree
- Errors in React hooks during render

❌ **NOT Caught by Error Boundaries:**
- Event handler errors
- Asynchronous code errors (setTimeout, promises)
- Server-side rendering errors
- Errors in the error boundary itself

## Error Handling Strategy

### For Caught Errors
1. Error is caught by the nearest error boundary
2. Error is logged to console (and error tracking in production)
3. Fallback UI is displayed with recovery options
4. User can retry, reload, or navigate away

### For Uncaught Errors
These should be handled with try-catch blocks or promise .catch():

```tsx
// Event handlers
const handleClick = async () => {
  try {
    await riskyOperation();
  } catch (error) {
    console.error('Operation failed:', error);
    // Show toast notification or inline error
  }
};

// Async operations
useEffect(() => {
  fetchData()
    .catch(error => {
      console.error('Data fetch failed:', error);
      // Handle error appropriately
    });
}, []);
```

## Testing Error Boundaries

### Development Testing
1. Navigate to Settings page
2. Scroll down to "Error Boundary Testing" section (development only)
3. Click different buttons to test various error scenarios
4. Verify error boundaries work as expected

### Manual Testing
Create a component that throws an error:

```tsx
function ErrorComponent() {
  throw new Error('Test error');
  return <div>This won't render</div>;
}
```

## Production Integration

### Error Tracking
The system is ready for integration with error tracking services:

```tsx
// In ErrorFallback.tsx and PageErrorBoundary.tsx
if (process.env.NODE_ENV === 'production') {
  // Example: Send to error tracking service
  // Sentry.captureException(error);
  // LogRocket.captureException(error);
  // Bugsnag.notify(error);
}
```

### Monitoring
Monitor these metrics in production:
- Error boundary activation frequency
- Error types and messages
- User recovery actions (retry vs. reload vs. navigate away)
- Pages/components with highest error rates

## Best Practices

### 1. Defensive Programming
Always validate data before using array methods:

```tsx
// Good
const items = Array.isArray(data) ? data : [];
return items.map(item => <Item key={item.id} {...item} />);

// Bad
return data.map(item => <Item key={item.id} {...item} />);
```

### 2. Graceful Degradation
Provide fallback UI for optional features:

```tsx
function OptionalComponent({ data }) {
  if (!data) {
    return <div>No data available</div>;
  }
  
  return <ComplexComponent data={data} />;
}
```

### 3. Error Boundary Placement
- Use global error boundary for application-level errors
- Use page error boundaries for route-level isolation
- Consider component-level boundaries for critical features

## Configuration

### React Query Integration
Error boundaries are integrated with React Query:

```tsx
// In AppProviders.tsx
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      throwOnError: false, // Let error boundaries handle errors
    },
    mutations: {
      throwOnError: false,
    },
  },
});
```

### Environment Variables
No additional configuration needed. The system respects:
- `NODE_ENV` for development features
- Existing app configuration for API endpoints

## Troubleshooting

### Common Issues

1. **Error not caught**: Verify it's not an async error or event handler error
2. **Infinite error loops**: Check error boundary implementation doesn't throw
3. **Missing fallback UI**: Ensure ErrorFallback component renders properly

### Debug Mode
In development, all errors are logged with stack traces and component information for easier debugging.

## Future Enhancements

- [ ] User feedback collection on errors
- [ ] Automatic retry with exponential backoff
- [ ] Error categorization and custom handling
- [ ] Integration with performance monitoring
- [ ] A/B testing for different error messages 