# Frontend Code Restructuring - AI Agent Instructions

## Overview
You are tasked with restructuring a React TypeScript frontend application from a flat component structure to a modern, feature-based architecture following 2025 best practices. The current codebase uses React 19, TypeScript, Vite, React Query, and Tailwind CSS.

## Current State Analysis
- **Tech Stack**: React 19, TypeScript, Vite, React Query, Tailwind CSS, DaisyUI
- **Issues**: Flat component structure (29 components in one directory), mixed concerns, no feature organization
- **Structure**: Traditional folder-by-type organization (components/, pages/, contexts/, etc.)

## Target Architecture
Transform to a feature-based, scalable architecture with proper separation of concerns.

## PHASE 1: Setup New Structure

### Step 1.1: Create Base Directory Structure
Create the following directories in `src/`:

```
src/
├── app/
│   ├── providers/
│   ├── router/
│   └── config/
├── shared/
│   ├── components/
│   │   ├── ui/
│   │   ├── layout/
│   │   └── feedback/
│   ├── hooks/
│   ├── utils/
│   ├── types/
│   └── api/
│       └── endpoints/
├── features/
│   ├── auth/
│   │   ├── components/
│   │   ├── hooks/
│   │   ├── services/
│   │   ├── types/
│   │   └── pages/
│   ├── workouts/
│   │   ├── components/
│   │   ├── hooks/
│   │   ├── services/
│   │   ├── types/
│   │   └── pages/
│   ├── exercises/
│   │   ├── components/
│   │   ├── hooks/
│   │   ├── services/
│   │   ├── types/
│   │   └── pages/
│   └── exercise-sets/
│       ├── components/
│       ├── hooks/
│       ├── services/
│       └── types/
├── pages/
└── styles/
```

**Command**: Create all directories using mkdir -p commands.

### Step 1.2: Configure Path Aliases
Update `vite.config.js` to add path aliases:

```typescript
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
      '@/shared': path.resolve(__dirname, './src/shared'),
      '@/features': path.resolve(__dirname, './src/features'),
      '@/app': path.resolve(__dirname, './src/app'),
    }
  },
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: './src/test/setup.ts'
  }
})
```

Update `tsconfig.json` to include path mapping:

```json
{
  "compilerOptions": {
    "baseUrl": ".",
    "paths": {
      "@/*": ["./src/*"],
      "@/shared/*": ["./src/shared/*"],
      "@/features/*": ["./src/features/*"],
      "@/app/*": ["./src/app/*"]
    }
    // ... existing config
  }
}
```

## PHASE 2: Move Shared Components

### Step 2.1: Identify and Categorize Current Components
Analyze existing components in `src/components/` and categorize them:

**UI Components** (move to `src/shared/components/ui/`):
- `BottomNav.tsx` → `src/shared/components/layout/BottomNav/`
- `Breadcrumbs.tsx` → `src/shared/components/layout/Breadcrumbs/`
- `FloatingActionButton.tsx` → `src/shared/components/ui/FloatingActionButton/`
- `GuestModeBanner.tsx` → `src/shared/components/feedback/GuestModeBanner/`

**Layout Components** (move to `src/shared/components/layout/`):
- `AppBar.tsx` → `src/shared/components/layout/AppBar/`
- `DesktopSidebar.tsx` → `src/shared/components/layout/DesktopSidebar/`
- `SideDrawer.tsx` → `src/shared/components/layout/SideDrawer/`
- `HomeLogo.tsx` → `src/shared/components/layout/HomeLogo/`

**Feature-Specific Components** (move to respective feature folders):
- `WorkoutForm.tsx` → `src/features/workouts/components/WorkoutForm/`
- `WorkoutTypeModal.tsx` → `src/features/workouts/components/WorkoutTypeModal/`
- `FinishWorkoutModal.tsx` → `src/features/workouts/components/FinishWorkoutModal/`
- `ExerciseForm.tsx` → `src/features/exercises/components/ExerciseForm/`
- `ExerciseList.tsx` → `src/features/exercises/components/ExerciseList/`
- `ExerciseRow.tsx` → `src/features/exercises/components/ExerciseRow/`
- `ExerciseTypeModal.tsx` → `src/features/exercises/components/ExerciseTypeModal/`
- `IntensityUnitModal.tsx` → `src/features/exercises/components/IntensityUnitModal/`
- `AddExerciseSetForm.tsx` → `src/features/exercise-sets/components/AddExerciseSetForm/`
- `ExerciseSetRow.tsx` → `src/features/exercise-sets/components/ExerciseSetRow/`

### Step 2.2: Component Migration Template
For each component, follow this pattern:

```
ComponentName/
├── index.ts              # Barrel export
├── ComponentName.tsx     # Main component
├── ComponentName.test.tsx # Tests
└── ComponentName.types.ts # Component-specific types (if needed)
```

**Example for `BottomNav`**:
1. Create `src/shared/components/layout/BottomNav/`
2. Move `BottomNav.tsx` to `src/shared/components/layout/BottomNav/BottomNav.tsx`
3. Create `src/shared/components/layout/BottomNav/index.ts`:
```typescript
export { default as BottomNav } from './BottomNav';
```

### Step 2.3: Update Imports
After moving each component, update all import statements throughout the codebase:

**Before**: `import { BottomNav } from '../components/BottomNav'`
**After**: `import { BottomNav } from '@/shared/components/layout'`

**Create barrel exports** in each directory:
- `src/shared/components/ui/index.ts`
- `src/shared/components/layout/index.ts`
- `src/shared/components/feedback/index.ts`

## PHASE 3: Reorganize by Features

### Step 3.1: Move Authentication Components
1. Move `GoogleSignInButton.tsx` to `src/features/auth/components/GoogleSignInButton/`
2. Move `OAuthCallbackPage.tsx` to `src/features/auth/pages/OAuthCallbackPage/`
3. Move `AuthContext.tsx` to `src/features/auth/hooks/useAuth.ts`

**Transform Context to Hook**:
```typescript
// src/features/auth/hooks/useAuth.ts
export const useAuth = () => {
  // Extract logic from AuthContext
  return {
    user,
    login,
    logout,
    isAuthenticated,
    isLoading
  };
};
```

### Step 3.2: Move Workout Components
1. Create feature structure for workouts
2. Move all workout-related components
3. Create `src/features/workouts/services/workoutQueries.ts`:

```typescript
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { workoutApi } from './workoutApi';

export const useWorkouts = () => {
  return useQuery({
    queryKey: ['workouts'],
    queryFn: workoutApi.getWorkouts
  });
};

export const useCreateWorkout = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: workoutApi.createWorkout,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['workouts'] });
    }
  });
};
```

### Step 3.3: Move Exercise Components
1. Create feature structure for exercises
2. Move all exercise-related components
3. Extract API calls from `src/api/exercises.ts` to `src/features/exercises/services/`

### Step 3.4: Move Exercise Sets
1. Create feature structure for exercise-sets
2. Move related components
3. Create proper API services

## PHASE 4: Create Shared Services

### Step 4.1: API Client Restructure
Move and enhance `src/api/client.ts` to `src/shared/api/client.ts`:

```typescript
import axios from 'axios';
import { config } from '@/app/config/env';

export const apiClient = axios.create({
  baseURL: config.apiBaseUrl,
  timeout: 10000,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Add interceptors for auth, error handling, etc.
```

### Step 4.2: Create Type Definitions
Create `src/shared/types/` with proper TypeScript definitions:

```typescript
// src/shared/types/api.ts
export interface ApiResponse<T> {
  data: T;
  message?: string;
  success: boolean;
}

export interface PaginatedResponse<T> extends ApiResponse<T[]> {
  total: number;
  page: number;
  limit: number;
}
```

### Step 4.3: Create Custom Hooks
Move and enhance custom hooks to `src/shared/hooks/`:

```typescript
// src/shared/hooks/useLocalStorage.ts
export const useLocalStorage = <T>(key: string, initialValue: T) => {
  // Implementation
};

// src/shared/hooks/useDebounce.ts
export const useDebounce = <T>(value: T, delay: number) => {
  // Implementation
};
```

## PHASE 5: App Configuration

### Step 5.1: Create App Providers
Create `src/app/providers/AppProviders.tsx`:

```typescript
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ReactQueryDevtools } from '@tanstack/react-query-devtools';
import { BrowserRouter } from 'react-router-dom';
import { AuthProvider } from '@/features/auth/hooks/useAuth';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 5 * 60 * 1000, // 5 minutes
      retry: 1,
    },
  },
});

export const AppProviders = ({ children }: { children: React.ReactNode }) => {
  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <AuthProvider>
          {children}
        </AuthProvider>
      </BrowserRouter>
      <ReactQueryDevtools initialIsOpen={false} />
    </QueryClientProvider>
  );
};
```

### Step 5.2: Create Environment Configuration
Create `src/app/config/env.ts`:

```typescript
export const config = {
  apiBaseUrl: import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000',
  googleClientId: import.meta.env.VITE_GOOGLE_CLIENT_ID || '',
  environment: import.meta.env.VITE_ENVIRONMENT || 'development',
  isDevelopment: import.meta.env.VITE_ENVIRONMENT === 'development',
  isProduction: import.meta.env.VITE_ENVIRONMENT === 'production',
} as const;
```

### Step 5.3: Update Main App Files
Update `src/main.tsx`:

```typescript
import React from 'react';
import ReactDOM from 'react-dom/client';
import { App } from './App';
import { AppProviders } from '@/app/providers/AppProviders';
import '@/styles/globals.css';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <AppProviders>
      <App />
    </AppProviders>
  </React.StrictMode>
);
```

## PHASE 6: Testing and Validation

### Step 6.1: Update Test Files
1. Move test files alongside their components
2. Update test imports to use new paths
3. Create shared test utilities in `src/__tests__/`

### Step 6.2: Create Barrel Exports
Create `index.ts` files in each directory for clean imports:

```typescript
// src/shared/components/ui/index.ts
export { FloatingActionButton } from './FloatingActionButton';
// ... other exports

// src/features/workouts/components/index.ts
export { WorkoutForm } from './WorkoutForm';
export { WorkoutTypeModal } from './WorkoutTypeModal';
// ... other exports
```

### Step 6.3: Validation Steps
1. Run `npm run lint` to check for linting errors
2. Run `npm run test` to ensure all tests pass
3. Run `npm run build` to verify production build
4. Test core functionality manually

## PHASE 7: Cleanup

### Step 7.1: Remove Old Structure
1. Remove empty directories from old structure
2. Update any remaining import statements
3. Clean up unused files

### Step 7.2: Update Documentation
1. Update README.md with new structure
2. Add JSDoc comments to key components
3. Create architecture documentation

## Implementation Guidelines

### General Rules
1. **Move one component at a time** and test immediately
2. **Update imports immediately** after moving each component
3. **Run tests** after each major move
4. **Create backup branch** before starting
5. **Use git commits** to track progress

### Error Handling
If any step fails:
1. Check console for specific error messages
2. Verify all import paths are correct
3. Ensure all dependencies are properly installed
4. Check that barrel exports are properly configured

### Performance Considerations
1. Use React.lazy() for code splitting where appropriate
2. Implement proper memoization for expensive computations
3. Optimize bundle size by proper tree-shaking

## Success Criteria
- [ ] All components moved to feature-based structure
- [ ] All imports updated to use path aliases
- [ ] All tests passing
- [ ] Build succeeds without errors
- [ ] Application functionality preserved
- [ ] Improved developer experience with better organization
- [ ] Easier navigation and maintenance

## Rollback Plan
If restructuring fails:
1. Reset to backup branch
2. Identify specific failure points
3. Implement changes incrementally
4. Use feature flags for gradual migration

Execute this restructuring systematically, testing each phase before proceeding to the next. Focus on maintaining functionality while improving structure. 