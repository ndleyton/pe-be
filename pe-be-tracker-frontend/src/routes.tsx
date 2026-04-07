import { Suspense, lazy, type ReactNode } from "react";
import { type RouteObject, Navigate } from "react-router-dom";

import { Skeleton } from "@/shared/components/ui/skeleton";
import { DEFAULT_SKELETON_COUNT } from "@/shared/constants";
import LoginPage from "./features/auth/pages/LoginPage";
import ExerciseTypesPageSkeleton from "@/features/exercises/components/skeletons/ExerciseTypesPageSkeleton";
import ExerciseTypeDetailsPageSkeleton from "@/features/exercises/components/skeletons/ExerciseTypeDetailsPageSkeleton";
import ProfilePageSkeleton from "@/features/profile/components/skeletons/ProfilePageSkeleton";
import WorkoutPageSkeleton from "@/features/workouts/components/skeletons/WorkoutPageSkeleton";

import AppLayout from "./layouts/AppLayout";
import NotFoundPage from "./pages/NotFoundPage";

// These pages are not lazy loaded as they are core pages
import MyWorkoutsPage from "./features/workouts/pages/MyWorkoutsPage";
import ChatPage from "./features/chat/pages/ChatPage";

// Lazy load other components with error boundaries
const WorkoutPage = lazy(() => import("./features/workouts/pages/WorkoutPage"));
const ExerciseTypesPage = lazy(
  () => import("./features/exercises/pages/ExerciseTypesPage"),
);
const ExerciseTypeDetailsPage = lazy(
  () => import("./features/exercises/pages/ExerciseTypeDetailsPage"),
);
const ExerciseTypeImageAdminPage = lazy(
  () => import("./features/admin/pages/ExerciseTypeImageAdminPage"),
);
const RoutinesPage = lazy(
  () => import("./features/routines/pages/RoutinesPage"),
);
const RoutineDetailsPage = lazy(
  () => import("./features/routines/pages/RoutineDetailsPage"),
);
const ProfilePage = lazy(() => import("./features/profile/pages/ProfilePage"));
const AboutPage = lazy(() => import("./features/about/pages/AboutPage"));
const OAuthCallbackPage = lazy(
  () => import("./features/auth/pages/OAuthCallbackPage"),
);

// Enhanced loading component with reduced CLS and accessibility
const LoadingFallback = () => (
  <div
    className="flex min-h-[60vh] items-center justify-center"
    aria-busy="true"
    aria-live="polite"
  >
    <div className="w-full max-w-4xl px-6">
      {/* Page title skeleton */}
      <Skeleton className="mx-auto mb-6 h-8 w-48" />
      {/* Content skeleton grid */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        {Array.from({ length: DEFAULT_SKELETON_COUNT }).map((_, i) => (
          <div key={i} className="bg-card border-border rounded-lg border p-4">
            <div className="flex items-start gap-4">
              <Skeleton className="h-10 w-10 rounded" />
              <div className="flex-1 space-y-2">
                <Skeleton className="h-5 w-2/3" />
                <Skeleton className="h-4 w-full" />
                <Skeleton className="h-4 w-5/6" />
              </div>
            </div>
          </div>
        ))}
      </div>
      {/* Keep a spinner for SR and visual cue */}
      <div className="flex justify-center py-4" role="status">
        <div
          className="loading loading-spinner loading-lg"
          aria-label="Loading"
        ></div>
      </div>
    </div>
  </div>
);

// Wrapper component for pages with suspense
const PageWrapper = ({ children }: { children: ReactNode }) => (
  <Suspense fallback={<LoadingFallback />}>{children}</Suspense>
);

// Wrapper component for ExerciseTypesPage with custom fallback
const ExerciseTypesPageWrapper = ({ children }: { children: ReactNode }) => (
  <Suspense fallback={<ExerciseTypesPageSkeleton />}>{children}</Suspense>
);

// Wrapper component for ExerciseTypeDetailsPage with custom fallback
const ExerciseTypeDetailsPageWrapper = ({ children }: { children: ReactNode }) => (
  <Suspense fallback={<ExerciseTypeDetailsPageSkeleton />}>{children}</Suspense>
);

// Wrapper component for ProfilePage with custom fallback
const ProfilePageWrapper = ({ children }: { children: ReactNode }) => (
  <Suspense fallback={<ProfilePageSkeleton />}>{children}</Suspense>
);

// Wrapper component for WorkoutPage with custom fallback
const WorkoutPageWrapper = ({ children }: { children: ReactNode }) => (
  <Suspense fallback={<WorkoutPageSkeleton />}>{children}</Suspense>
);

const RoutinesPageFallback = () => (
  <div className="mx-auto max-w-5xl p-2 text-center md:p-4 lg:p-8">
    <div className="mb-6">
      <div className="mb-4 flex items-center gap-4 text-left">
        <Skeleton className="h-10 w-10 rounded-md lg:hidden" />
        <Skeleton className="h-9 w-40" />
      </div>
      <div className="mb-6 flex flex-col gap-4 sm:flex-row">
        <Skeleton className="h-10 flex-1" />
        <Skeleton className="h-10 w-full sm:w-40" />
      </div>
    </div>
    <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
      {Array.from({ length: 6 }).map((_, index) => (
        <div key={index} className="rounded-2xl border p-4 text-left">
          <Skeleton className="mb-3 h-6 w-2/3" />
          <Skeleton className="mb-2 h-4 w-full" />
          <Skeleton className="mb-4 h-4 w-5/6" />
          <div className="flex gap-2">
            <Skeleton className="h-9 flex-1" />
            <Skeleton className="h-9 flex-1" />
          </div>
        </div>
      ))}
    </div>
  </div>
);

const RoutineDetailsFallback = () => (
  <div className="mx-auto min-h-screen max-w-4xl px-4 py-6 md:py-8">
    <div className="mb-8 flex items-center gap-4 text-left">
      <Skeleton className="h-10 w-10 rounded-full" />
      <div className="min-w-0 flex-1">
        <Skeleton className="mb-2 h-9 w-56" />
        <Skeleton className="h-4 w-32" />
      </div>
    </div>
    <div className="space-y-8">
      <div className="rounded-2xl border p-4">
        <Skeleton className="mb-3 h-7 w-56" />
        <Skeleton className="mb-2 h-4 w-full" />
        <Skeleton className="mb-4 h-4 w-5/6" />
        <div className="grid gap-3 sm:grid-cols-3">
          <Skeleton className="h-12 w-full" />
          <Skeleton className="h-12 w-full" />
          <Skeleton className="h-12 w-full" />
        </div>
      </div>
      <div className="rounded-2xl border p-4">
        <Skeleton className="mb-3 h-6 w-48" />
        <Skeleton className="mb-4 h-4 w-3/4" />
        <div className="space-y-3">
          {Array.from({ length: 3 }).map((_, index) => (
            <div key={index} className="rounded-md border p-3">
              <Skeleton className="mb-2 h-5 w-2/3" />
              <Skeleton className="h-4 w-1/2" />
            </div>
          ))}
        </div>
      </div>
    </div>
  </div>
);

const RoutinesPageWrapper = ({ children }: { children: ReactNode }) => (
  <Suspense fallback={<RoutinesPageFallback />}>{children}</Suspense>
);

const RoutineDetailsPageWrapper = ({ children }: { children: ReactNode }) => (
  <Suspense fallback={<RoutineDetailsFallback />}>{children}</Suspense>
);

const routes: RouteObject[] = [
  {
    path: "/login",
    element: <LoginPage />,
  },
  {
    path: "/oauth/callback",
    element: (
      <PageWrapper>
        <OAuthCallbackPage />
      </PageWrapper>
    ),
  },
  {
    element: <AppLayout />,
    children: [
      {
        index: true,
        element: <Navigate to="workouts" replace />,
      },
      {
        path: "workouts",
        element: <MyWorkoutsPage />,
      },
      {
        path: "workouts/:workoutId",
        element: (
          <WorkoutPageWrapper>
            <WorkoutPage />
          </WorkoutPageWrapper>
        ),
      },
      {
        path: "exercise-types",
        element: (
          <ExerciseTypesPageWrapper>
            <ExerciseTypesPage />
          </ExerciseTypesPageWrapper>
        ),
      },
      {
        path: "exercise-types/:exerciseTypeId",
        element: (
          <ExerciseTypeDetailsPageWrapper>
            <ExerciseTypeDetailsPage />
          </ExerciseTypeDetailsPageWrapper>
        ),
      },
      {
        path: "exercise-types/:exerciseTypeId/admin-images",
        element: (
          <PageWrapper>
            <ExerciseTypeImageAdminPage />
          </PageWrapper>
        ),
      },
      {
        path: "routines",
        element: (
          <RoutinesPageWrapper>
            <RoutinesPage />
          </RoutinesPageWrapper>
        ),
      },
      {
        path: "routines/:routineId",
        element: (
          <RoutineDetailsPageWrapper>
            <RoutineDetailsPage />
          </RoutineDetailsPageWrapper>
        ),
      },
      {
        path: "chat",
        element: <ChatPage />,
      },
      {
        path: "profile",
        element: (
          <ProfilePageWrapper>
            <ProfilePage />
          </ProfilePageWrapper>
        ),
      },
      {
        path: "about",
        element: (
          <PageWrapper>
            <AboutPage />
          </PageWrapper>
        ),
      },
      {
        path: "*",
        element: <NotFoundPage />,
      },
    ],
  },
];

export default routes;
