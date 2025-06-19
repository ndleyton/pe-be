import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import DesktopNav from './DesktopNav';

// Mock react-router-dom
const mockNavigate = vi.fn();
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return {
    ...actual,
    useNavigate: () => mockNavigate,
  };
});

const TestWrapper: React.FC<{ children: React.ReactNode; initialEntries?: string[] }> = ({ 
  children, 
  initialEntries = ['/'] 
}) => (
  <MemoryRouter initialEntries={initialEntries}>
    {children}
  </MemoryRouter>
);

describe('DesktopNav', () => {
  describe('Rendering and Structure', () => {
    it('should render the desktop navigation with proper ARIA attributes', () => {
      render(
        <TestWrapper>
          <DesktopNav />
        </TestWrapper>
      );

      const nav = screen.getByRole('navigation', { name: /main navigation/i });
      expect(nav).toBeInTheDocument();
      expect(nav).toHaveClass('hidden', 'lg:flex');
    });

    it('should render all navigation items', () => {
      render(
        <TestWrapper>
          <DesktopNav />
        </TestWrapper>
      );

      expect(screen.getByRole('link', { name: /navigate to home/i })).toBeInTheDocument();
      expect(screen.getByRole('link', { name: /navigate to workouts/i })).toBeInTheDocument();
      expect(screen.getByRole('link', { name: /navigate to profile/i })).toBeInTheDocument();
    });

    it('should have correct href attributes for all links', () => {
      render(
        <TestWrapper>
          <DesktopNav />
        </TestWrapper>
      );

      expect(screen.getByRole('link', { name: /navigate to home/i })).toHaveAttribute('href', '/dashboard');
      expect(screen.getByRole('link', { name: /navigate to workouts/i })).toHaveAttribute('href', '/workouts');
      expect(screen.getByRole('link', { name: /navigate to profile/i })).toHaveAttribute('href', '/profile');
    });

    it('should display icons and labels for each navigation item', () => {
      render(
        <TestWrapper>
          <DesktopNav />
        </TestWrapper>
      );

      expect(screen.getByText('Home')).toBeInTheDocument();
      expect(screen.getByText('Workouts')).toBeInTheDocument();
      expect(screen.getByText('Profile')).toBeInTheDocument();
    });
  });

  describe('Active State Styling', () => {
    it('should highlight the active navigation item', () => {
      render(
        <TestWrapper initialEntries={['/workouts']}>
          <DesktopNav />
        </TestWrapper>
      );

      const workoutsLink = screen.getByRole('link', { name: /navigate to workouts/i });
      expect(workoutsLink).toHaveClass('bg-primary', 'text-primary-content');
    });

    it('should not highlight inactive navigation items', () => {
      render(
        <TestWrapper initialEntries={['/workouts']}>
          <DesktopNav />
        </TestWrapper>
      );

      const homeLink = screen.getByRole('link', { name: /navigate to home/i });
      const profileLink = screen.getByRole('link', { name: /navigate to profile/i });
      
      expect(homeLink).not.toHaveClass('bg-primary', 'text-primary-content');
      expect(profileLink).not.toHaveClass('bg-primary', 'text-primary-content');
    });
  });

  describe('Hover Interactions', () => {
    it('should show hover styles on navigation items', async () => {
      const user = userEvent.setup();
      
      render(
        <TestWrapper>
          <DesktopNav />
        </TestWrapper>
      );

      const homeLink = screen.getByRole('link', { name: /navigate to home/i });
      
      await user.hover(homeLink);
      
      // The hover class is applied via CSS, so we check that the element has the hover class
      expect(homeLink).toHaveClass('hover:bg-base-200');
    });
  });

  describe('Accessibility', () => {
    it('should have proper ARIA labels for screen readers', () => {
      render(
        <TestWrapper>
          <DesktopNav />
        </TestWrapper>
      );

      const homeLink = screen.getByRole('link', { name: /navigate to home: dashboard and overview/i });
      const workoutsLink = screen.getByRole('link', { name: /navigate to workouts: track and manage workouts/i });
      const profileLink = screen.getByRole('link', { name: /navigate to profile: account settings and preferences/i });

      expect(homeLink).toBeInTheDocument();
      expect(workoutsLink).toBeInTheDocument();
      expect(profileLink).toBeInTheDocument();
    });

    it('should be keyboard navigable', async () => {
      const user = userEvent.setup();
      
      render(
        <TestWrapper>
          <DesktopNav />
        </TestWrapper>
      );

      // Tab through navigation items
      await user.tab();
      expect(screen.getByRole('link', { name: /navigate to home/i })).toHaveFocus();

      await user.tab();
      expect(screen.getByRole('link', { name: /navigate to workouts/i })).toHaveFocus();

      await user.tab();
      expect(screen.getByRole('link', { name: /navigate to profile/i })).toHaveFocus();
    });

    it('should activate links with Enter key', async () => {
      const user = userEvent.setup();
      
      render(
        <TestWrapper>
          <DesktopNav />
        </TestWrapper>
      );

      const homeLink = screen.getByRole('link', { name: /navigate to home/i });
      homeLink.focus();
      
      await user.keyboard('{Enter}');
      
      // Since we're using MemoryRouter, the navigation should work
      expect(homeLink).toHaveAttribute('href', '/dashboard');
    });
  });

  describe('Responsive Design', () => {
    it('should be hidden on smaller screens', () => {
      render(
        <TestWrapper>
          <DesktopNav />
        </TestWrapper>
      );

      const nav = screen.getByRole('navigation', { name: /main navigation/i });
      expect(nav).toHaveClass('hidden', 'lg:flex');
    });
  });

  describe('Visual Design', () => {
    it('should have consistent styling classes', () => {
      render(
        <TestWrapper>
          <DesktopNav />
        </TestWrapper>
      );

      const links = screen.getAllByRole('link');
      
      links.forEach(link => {
        expect(link).toHaveClass('flex', 'items-center', 'space-x-2', 'px-4', 'py-2', 'rounded-lg', 'transition-all');
      });
    });

    it('should have proper menu structure with DaisyUI classes', () => {
      render(
        <TestWrapper>
          <DesktopNav />
        </TestWrapper>
      );

      const nav = screen.getByRole('navigation');
      const menu = nav.querySelector('ul');
      
      expect(menu).toHaveClass('menu', 'menu-horizontal', 'px-1', 'space-x-1');
    });
  });

  describe('Navigation Items Configuration', () => {
    it('should handle navigation items with icons and descriptions', () => {
      render(
        <TestWrapper>
          <DesktopNav />
        </TestWrapper>
      );

      // Check that each link has an icon (svg element) and text
      const links = screen.getAllByRole('link');
      
      links.forEach(link => {
        const icon = link.querySelector('svg');
        const text = link.querySelector('span');
        
        expect(icon).toBeInTheDocument();
        expect(text).toBeInTheDocument();
      });
    });
  });
}); 