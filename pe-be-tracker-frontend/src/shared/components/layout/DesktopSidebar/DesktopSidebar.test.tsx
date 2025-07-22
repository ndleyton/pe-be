import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import DesktopSidebar from './DesktopSidebar';

// Mock Zustand stores
const mockSignOut = vi.fn();
const mockIsAuthenticated = vi.fn(() => false);
vi.mock('@/stores', () => ({
  useAuthStore: vi.fn((selector) => {
    const state = {
      isAuthenticated: mockIsAuthenticated(),
      signOut: mockSignOut,
      user: null,
    };
    return selector ? selector(state) : state;
  }),
  useUIStore: vi.fn((selector) => {
    const state = {
      isDrawerOpen: false,
      workoutTimer: {
        startTime: null,
        elapsedSeconds: 0,
        paused: false,
        intervalId: null,
      },
      openDrawer: vi.fn(),
      closeDrawer: vi.fn(),
      toggleDrawer: vi.fn(),
      startWorkoutTimer: vi.fn(),
      pauseWorkoutTimer: vi.fn(),
      resumeWorkoutTimer: vi.fn(),
      toggleWorkoutTimer: vi.fn(),
      stopWorkoutTimer: vi.fn(),
      getFormattedWorkoutTime: vi.fn(() => '0:00'),
    };
    return selector ? selector(state) : state;
  }),
}));

// Mock API client
vi.mock('@/shared/api/client', () => ({
  default: {
    get: vi.fn(),
  },
}));

const TestWrapper: React.FC<{ children: React.ReactNode; initialEntries?: string[] }> = ({ 
  children, 
  initialEntries = ['/'] 
}) => (
  <MemoryRouter initialEntries={initialEntries}>
    {children}
  </MemoryRouter>
);

describe('DesktopSidebar', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockIsAuthenticated.mockReturnValue(false);
  });

  describe('Rendering and Structure', () => {
    it('should render the desktop sidebar with proper structure', () => {
      render(
        <TestWrapper>
          <DesktopSidebar />
        </TestWrapper>
      );

      const sidebar = screen.getByRole('complementary');
      expect(sidebar).toBeInTheDocument();
      expect(sidebar).toHaveClass('hidden', 'lg:flex', 'lg:flex-col', 'lg:w-64', 'lg:fixed');
    });

    it('should render the brand logo and title', () => {
      render(
        <TestWrapper>
          <DesktopSidebar />
        </TestWrapper>
      );

      expect(screen.getByTestId('home-logo')).toBeInTheDocument();
    });

    it('should render all navigation items', () => {
      render(
        <TestWrapper>
          <DesktopSidebar />
        </TestWrapper>
      );

      expect(screen.getByRole('link', { name: /home/i })).toBeInTheDocument();
      expect(screen.getByRole('link', { name: /workouts/i })).toBeInTheDocument();
      expect(screen.getByRole('link', { name: /profile/i })).toBeInTheDocument();
    });

    it('should have correct href attributes for navigation links', () => {
      render(
        <TestWrapper>
          <DesktopSidebar />
        </TestWrapper>
      );

      expect(screen.getByRole('link', { name: /home/i })).toHaveAttribute('href', '/dashboard');
      expect(screen.getByRole('link', { name: /workouts/i })).toHaveAttribute('href', '/workouts');
      expect(screen.getByRole('link', { name: /profile/i })).toHaveAttribute('href', '/profile');
    });
  });

  describe('Navigation States', () => {
    it('should highlight the active navigation item', () => {
      render(
        <TestWrapper initialEntries={['/workouts']}>
          <DesktopSidebar />
        </TestWrapper>
      );

      const workoutsLink = screen.getByRole('link', { name: /workouts/i });
      expect(workoutsLink).toHaveClass('bg-primary', 'text-primary-foreground');
    });

    it('should not highlight inactive navigation items', () => {
      render(
        <TestWrapper initialEntries={['/workouts']}>
          <DesktopSidebar />
        </TestWrapper>
      );

      const homeLink = screen.getByRole('link', { name: /home/i });
      const profileLink = screen.getByRole('link', { name: /profile/i });
      
      expect(homeLink).not.toHaveClass('bg-primary', 'text-primary-content');
      expect(profileLink).not.toHaveClass('bg-primary', 'text-primary-content');
    });
  });

  describe('Authentication States', () => {
    it('should show sign in button when not authenticated', () => {
      mockIsAuthenticated.mockReturnValue(false);
      
      render(
        <TestWrapper>
          <DesktopSidebar />
        </TestWrapper>
      );

      expect(screen.getByRole('button', { name: /sign in with google/i })).toBeInTheDocument();
      expect(screen.queryByRole('button', { name: /settings/i })).not.toBeInTheDocument();
      expect(screen.queryByRole('button', { name: /sign out/i })).not.toBeInTheDocument();
    });

    it('should show settings and sign out buttons when authenticated', () => {
      mockIsAuthenticated.mockReturnValue(true);
      
      render(
        <TestWrapper>
          <DesktopSidebar />
        </TestWrapper>
      );

      expect(screen.getByRole('button', { name: /settings/i })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /sign out/i })).toBeInTheDocument();
      expect(screen.queryByRole('button', { name: /sign in with google/i })).not.toBeInTheDocument();
    });
  });

  describe('Accessibility', () => {
    it('should have proper ARIA labels and roles', () => {
      render(
        <TestWrapper>
          <DesktopSidebar />
        </TestWrapper>
      );

      const sidebar = screen.getByRole('complementary');
      expect(sidebar).toBeInTheDocument();

      const nav = screen.getByRole('navigation');
      expect(nav).toBeInTheDocument();
      expect(nav).toHaveAttribute('aria-label', 'Sidebar navigation');
    });

    it('should be keyboard navigable', async () => {
      const user = userEvent.setup();
      
      render(
        <TestWrapper>
          <DesktopSidebar />
        </TestWrapper>
      );

      // Tab through navigation items
      await user.tab();
      expect(screen.getByRole('link', { name: /home/i })).toHaveFocus();

      await user.tab();
      expect(screen.getByRole('link', { name: /workouts/i })).toHaveFocus();

      await user.tab();
      expect(screen.getByRole('link', { name: /exercises/i })).toHaveFocus();

      await user.tab();
      expect(screen.getByRole('link', { name: /profile/i })).toHaveFocus();
    });

    it('should have proper semantic structure', () => {
      render(
        <TestWrapper>
          <DesktopSidebar />
        </TestWrapper>
      );

      // Should have semantic aside element
      const sidebar = screen.getByRole('complementary');
      expect(sidebar.tagName).toBe('ASIDE');

      // Should have semantic nav element
      const nav = screen.getByRole('navigation');
      expect(nav.tagName).toBe('NAV');
    });
  });

  describe('Visual Design', () => {
    it('should have consistent styling classes', () => {
      render(
        <TestWrapper>
          <DesktopSidebar />
        </TestWrapper>
      );

      const sidebar = screen.getByRole('complementary');
      expect(sidebar).toHaveClass(
        'hidden',
        'lg:flex',
        'lg:flex-col',
        'lg:w-64',
        'lg:fixed',
        'lg:inset-y-0',
        'lg:left-0',
        'lg:bg-background',
        'lg:border-r'
      );
    });

    it('should have proper spacing and layout classes', () => {
      render(
        <TestWrapper>
          <DesktopSidebar />
        </TestWrapper>
      );

      const nav = screen.getByRole('navigation');
      expect(nav).toHaveClass('flex-1', 'px-4', 'py-6', 'space-y-2');
    });
  });

  describe('Responsive Design', () => {
    it('should be hidden on smaller screens and visible on desktop', () => {
      render(
        <TestWrapper>
          <DesktopSidebar />
        </TestWrapper>
      );

      const sidebar = screen.getByRole('complementary');
      expect(sidebar).toHaveClass('hidden', 'lg:flex');
    });
  });

  describe('Brand Display', () => {
    it('should display the brand correctly', () => {
      render(
        <TestWrapper>
          <DesktopSidebar />
        </TestWrapper>
      );

      expect(screen.getByTestId('home-logo')).toBeInTheDocument();
    });
  });
}); 