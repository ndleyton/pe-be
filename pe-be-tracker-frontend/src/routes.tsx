import { Suspense, lazy, type ReactNode } from "react";
import { type RouteObject, Navigate } from "react-router-dom";

import { Skeleton } from "@/shared/components/ui/skeleton";
import { DEFAULT_SKELETON_COUNT } from "@/shared/constants";
import LoginPage from "./features/auth/pages/LoginPage";
import OAuthCallbackPage from "./features/auth/pages/OAuthCallbackPage";
import ExerciseTypesPageSkeleton from "@/features/exercises/components/skeletons/ExerciseTypesPageSkeleton";
import ExerciseTypeDetailsLoadingState from "@/features/exercises/components/skeletons/ExerciseTypeDetailsLoadingState";
import ProfilePageSkeleton from "@/features/profile/components/skeletons/ProfilePageSkeleton";
import {
  RoutineDetailsLoadingState,
  RoutinesPageSkeleton,
} from "@/features/routines/components";
import WorkoutPageSkeleton from "@/features/workouts/components/skeletons/WorkoutPageSkeleton";
import AboutPageSkeleton from "@/features/about/components/skeletons/AboutPageSkeleton";

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
const CreateRoutinePage = lazy(
  () => import("./features/routines/pages/CreateRoutinePage"),
);
const ProfilePage = lazy(() => import("./features/profile/pages/ProfilePage"));
const AboutPage = lazy(() => import("./features/about/pages/AboutPage"));

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
  <Suspense fallback={<ExerciseTypeDetailsLoadingState />}>{children}</Suspense>
);

// Wrapper component for ProfilePage with custom fallback
const ProfilePageWrapper = ({ children }: { children: ReactNode }) => (
  <Suspense fallback={<ProfilePageSkeleton />}>{children}</Suspense>
);

// Wrapper component for WorkoutPage with custom fallback
const WorkoutPageWrapper = ({ children }: { children: ReactNode }) => (
  <Suspense fallback={<WorkoutPageSkeleton />}>{children}</Suspense>
);

// Wrapper component for routines page with custom fallback
const RoutinesPageWrapper = ({ children }: { children: ReactNode }) => (
  <Suspense fallback={<RoutinesPageSkeleton />}>{children}</Suspense>
);

const RoutineDetailsPageWrapper = ({ children }: { children: ReactNode }) => (
  <Suspense fallback={<RoutineDetailsLoadingState />}>{children}</Suspense>
);

const AboutPageWrapper = ({ children }: { children: ReactNode }) => (
  <Suspense fallback={<AboutPageSkeleton />}>{children}</Suspense>
);

const routes: RouteObject[] = [
  {
    path: "/login",
    element: <LoginPage />,
  },
  {
    path: "/auth/complete",
    element: (
      <PageWrapper>
        <OAuthCallbackPage />
      </PageWrapper>
    ),
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
        path: "routines/new",
        element: (
          <RoutinesPageWrapper>
            <CreateRoutinePage />
          </RoutinesPageWrapper>
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
          <AboutPageWrapper>
            <AboutPage />
          </AboutPageWrapper>
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
