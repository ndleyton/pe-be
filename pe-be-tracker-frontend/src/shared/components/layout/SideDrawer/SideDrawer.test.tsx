import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import SideDrawer from './SideDrawer';
import { AuthProvider } from '../contexts/AuthContext';
import api from '../api/client';

// Mock the API client
vi.mock('../api/client', () => ({
  default: {
    get: vi.fn(),
    post: vi.fn(),
  },
}));

// Use deep mock so nested functions like `get` & `post` have jest-style helpers (mockRejectedValue, etc.)
const mockApi = vi.mocked(api, { deep: true });

// Mock window.location.href
const mockLocation = {
  href: '',
};
Object.defineProperty(window, 'location', {
  value: mockLocation,
  writable: true,
});

// Mock the DrawerContext - default to open for most tests
const mockCloseDrawer = vi.fn();
const mockOpenDrawer = vi.fn();
const mockToggleDrawer = vi.fn();
let mockIsOpen = true;

vi.mock('../contexts/DrawerContext', () => ({
  useDrawer: () => ({
    isOpen: mockIsOpen,
    openDrawer: mockOpenDrawer,
    closeDrawer: mockCloseDrawer,
    toggleDrawer: mockToggleDrawer,
  }),
}));

// Test wrapper with required providers
const TestWrapper = ({ 
  children, 
  initialEntries = ['/dashboard']
}: { 
  children: React.ReactNode;
  initialEntries?: string[];
}) => (
  <MemoryRouter initialEntries={initialEntries}>
    <AuthProvider>
      {children}
    </AuthProvider>
  </MemoryRouter>
);

describe('SideDrawer', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockLocation.href = '';
    mockIsOpen = true; // Default to open for most tests
    // Mock API to not be authenticated by default
    mockApi.get.mockRejectedValue(new Error('Unauthorized'));
  });

  afterEach(() => {
    vi.clearAllTimers();
  });

  describe('Rendering and Basic Structure', () => {
    it('should always render drawer elements', () => {
      render(
        <TestWrapper>
          <SideDrawer />
        </TestWrapper>
      );
      
      // Drawer content should always be in DOM
      expect(screen.getByText('Navigation')).toBeInTheDocument();
      expect(screen.getByRole('navigation')).toBeInTheDocument();
    });

    it('should show drawer when open', () => {
      mockIsOpen = true;
      
      render(
        <TestWrapper>
          <SideDrawer />
        </TestWrapper>
      );
      
      const drawer = screen.getByRole('dialog');
      expect(drawer).toBeInTheDocument();
      
      // Check drawer is translated in (visible)
      expect(drawer).toHaveClass('translate-x-0');
      expect(drawer).not.toHaveClass('-translate-x-full');
    });

    it('should hide drawer when closed', () => {
      mockIsOpen = false;
      
      render(
        <TestWrapper>
          <SideDrawer />
        </TestWrapper>
      );
      
      const drawer = screen.getByRole('dialog');
      expect(drawer).toBeInTheDocument();
      
      // Check drawer is translated out (hidden)
      expect(drawer).toHaveClass('-translate-x-full');
      expect(drawer).not.toHaveClass('translate-x-0');
    });

    it('should have proper ARIA attributes for accessibility', () => {
      render(
        <TestWrapper>
          <SideDrawer />
        </TestWrapper>
      );
      
      const dialog = screen.getByRole('dialog');
      expect(dialog).toHaveAttribute('aria-modal', 'true');
      expect(dialog).toHaveAttribute('aria-labelledby', 'drawer-title');
      
      expect(screen.getByRole('navigation')).toHaveAttribute('aria-label', 'Secondary navigation');
    });

    it('should have lg:hidden class for large desktop hiding', () => {
      render(
        <TestWrapper>
          <SideDrawer />
        </TestWrapper>
      );
      
      const drawer = screen.getByRole('dialog');
      expect(drawer).toHaveClass('lg:hidden');
    });

    it('should have smooth animation classes', () => {
      render(
        <TestWrapper>
          <SideDrawer />
        </TestWrapper>
      );
      
      const drawer = screen.getByRole('dialog');
      expect(drawer).toHaveClass('transition-transform', 'duration-300', 'ease-in-out');
    });


  });

  describe('Navigation Links', () => {
    it('should render all navigation links', () => {
      render(
        <TestWrapper>
          <SideDrawer />
        </TestWrapper>
      );
      
      expect(screen.getByRole('link', { name: /home/i })).toBeInTheDocument();
      expect(screen.getByRole('link', { name: /workouts/i })).toBeInTheDocument();
      expect(screen.getByRole('link', { name: /profile/i })).toBeInTheDocument();
    });

    it('should have correct href attributes', () => {
      render(
        <TestWrapper>
          <SideDrawer />
        </TestWrapper>
      );
      
      expect(screen.getByRole('link', { name: /home/i })).toHaveAttribute('href', '/dashboard');
      expect(screen.getByRole('link', { name: /workouts/i })).toHaveAttribute('href', '/workouts');
      expect(screen.getByRole('link', { name: /profile/i })).toHaveAttribute('href', '/profile');
    });

    it('should highlight active navigation link', () => {
      render(
        <TestWrapper initialEntries={['/workouts']}>
          <SideDrawer />
        </TestWrapper>
      );
      
      const workoutsLink = screen.getByRole('link', { name: /workouts/i });
      expect(workoutsLink).toHaveClass('bg-blue-600', 'text-white');
    });

    it('should close drawer when navigation link is clicked', async () => {
      const user = userEvent.setup();
      
      render(
        <TestWrapper>
          <SideDrawer />
        </TestWrapper>
      );
      
      await user.click(screen.getByRole('link', { name: /home/i }));
      
      expect(mockCloseDrawer).toHaveBeenCalled();
    });
  });

  describe('Click Outside Interaction', () => {
    it('should close drawer when clicking outside drawer area', async () => {
      const user = userEvent.setup();
      
      render(
        <TestWrapper>
          <SideDrawer />
        </TestWrapper>
      );
      
      // Click outside the drawer (on document body)
      await user.click(document.body);
      
      expect(mockCloseDrawer).toHaveBeenCalled();
    });

    it('should not close drawer when clicking on drawer content', async () => {
      const user = userEvent.setup();
      
      render(
        <TestWrapper>
          <SideDrawer />
        </TestWrapper>
      );
      
      const drawerContent = screen.getByText('Navigation');
      await user.click(drawerContent);
      
      expect(mockCloseDrawer).not.toHaveBeenCalled();
    });
  });

  describe('Authentication States', () => {
    it('should show Google sign-in button when not authenticated', async () => {
      // API returns unauthorized (not authenticated)
      mockApi.get.mockRejectedValueOnce(new Error('Unauthorized'));
      
      render(
        <TestWrapper>
          <SideDrawer />
        </TestWrapper>
      );
      
      await waitFor(() => {
        expect(screen.getByRole('button', { name: /sign in with google/i })).toBeInTheDocument();
      });
      
      expect(screen.queryByRole('button', { name: /sign out/i })).not.toBeInTheDocument();
      expect(screen.queryByRole('button', { name: /settings/i })).not.toBeInTheDocument();
    });

    it('should show Settings and Sign Out buttons when authenticated', async () => {
      // API returns user (authenticated)
      mockApi.get.mockResolvedValueOnce({
        data: { id: 1, email: 'test@example.com', name: 'Test User' }
      });
      
      render(
        <TestWrapper>
          <SideDrawer />
        </TestWrapper>
      );
      
      await waitFor(() => {
        expect(screen.getByRole('button', { name: /settings/i })).toBeInTheDocument();
        expect(screen.getByRole('button', { name: /sign out/i })).toBeInTheDocument();
      });
      
      expect(screen.queryByRole('button', { name: /sign in with google/i })).not.toBeInTheDocument();
    });
  });

  describe('Google Sign-In', () => {
    it('should handle Google sign-in flow', async () => {
      const user = userEvent.setup();
      
      // First API call should fail (not authenticated)
      mockApi.get.mockRejectedValueOnce(new Error('Unauthorized'));
      // Second API call for Google OAuth should succeed
      mockApi.get.mockResolvedValueOnce({
        data: { authorization_url: 'https://accounts.google.com/oauth/authorize' }
      });
      
      render(
        <TestWrapper>
          <SideDrawer />
        </TestWrapper>
      );
      
      await waitFor(() => {
        expect(screen.getByRole('button', { name: /sign in with google/i })).toBeInTheDocument();
      });
      
      await user.click(screen.getByRole('button', { name: /sign in with google/i }));
      
      expect(mockApi.get).toHaveBeenCalledWith('/auth/google/authorize');
      expect(mockLocation.href).toBe('https://accounts.google.com/oauth/authorize');
    });

    it('should handle Google sign-in failure gracefully', async () => {
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      const user = userEvent.setup();
      
      mockApi.get.mockRejectedValueOnce(new Error('Network error'));
      
      render(
        <TestWrapper>
          <SideDrawer />
        </TestWrapper>
      );
      
      await waitFor(() => {
        expect(screen.getByRole('button', { name: /sign in with google/i })).toBeInTheDocument();
      });
      
      await user.click(screen.getByRole('button', { name: /sign in with google/i }));
      
      expect(consoleSpy).toHaveBeenCalledWith('Google sign-in failed', expect.any(Error));
      expect(mockLocation.href).toBe('');
      
      consoleSpy.mockRestore();
    });
  });

  describe('Sign Out', () => {
    it('should handle sign out and close drawer', async () => {
      const user = userEvent.setup();
      
      // Setup authenticated state
      mockApi.get.mockResolvedValueOnce({
        data: { id: 1, email: 'test@example.com', name: 'Test User' }
      });
      mockApi.post.mockResolvedValueOnce({});
      
      render(
        <TestWrapper>
          <SideDrawer />
        </TestWrapper>
      );
      
      await waitFor(() => {
        expect(screen.getByRole('button', { name: /sign out/i })).toBeInTheDocument();
      });
      
      await user.click(screen.getByRole('button', { name: /sign out/i }));
      
      expect(mockCloseDrawer).toHaveBeenCalled();
    });
  });

  describe('Keyboard Navigation', () => {
    it('should close drawer when Escape key is pressed', () => {
      render(
        <TestWrapper>
          <SideDrawer />
        </TestWrapper>
      );
      
      fireEvent.keyDown(document, { key: 'Escape', code: 'Escape' });
      
      expect(mockCloseDrawer).toHaveBeenCalled();
    });

    it('should focus first navigation link when drawer opens', () => {
      render(
        <TestWrapper>
          <SideDrawer />
        </TestWrapper>
      );
      
      const firstLink = screen.getByRole('link', { name: /home/i });
      expect(firstLink).toHaveFocus();
    });

    it('should not close drawer when other keys are pressed', () => {
      render(
        <TestWrapper>
          <SideDrawer />
        </TestWrapper>
      );
      
      fireEvent.keyDown(document, { key: 'Enter', code: 'Enter' });
      fireEvent.keyDown(document, { key: 'Space', code: 'Space' });
      
      expect(mockCloseDrawer).not.toHaveBeenCalled();
    });
  });

  describe('Body Scroll Management', () => {
    it('should prevent body scroll when drawer is open', () => {
      mockIsOpen = true;
      
      render(
        <TestWrapper>
          <SideDrawer />
        </TestWrapper>
      );
      
      expect(document.body.style.overflow).toBe('hidden');
    });

    it('should restore body scroll when drawer is closed', () => {
      mockIsOpen = false;
      
      render(
        <TestWrapper>
          <SideDrawer />
        </TestWrapper>
      );
      
      expect(document.body.style.overflow).toBe('unset');
    });
  });

  describe('Responsive Design', () => {
    it('should be hidden on large desktop screens', () => {
      render(
        <TestWrapper>
          <SideDrawer />
        </TestWrapper>
      );
      
      const drawer = screen.getByRole('dialog');
      
      expect(drawer).toHaveClass('lg:hidden');
    });

    it('should have proper z-index stacking', () => {
      render(
        <TestWrapper>
          <SideDrawer />
        </TestWrapper>
      );
      
      const drawer = screen.getByRole('dialog');
      
      expect(drawer).toHaveClass('z-50');
    });
  });
});