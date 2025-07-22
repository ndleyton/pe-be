import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import IntensityUnitModal from './IntensityUnitModal';
import * as exerciseApi from '@/features/exercises/api';

// Mock Zustand stores
const mockIsAuthenticated = vi.fn();
vi.mock('@/stores', () => ({
  useAuthStore: vi.fn((selector) => {
    const state = {
      isAuthenticated: mockIsAuthenticated(),
      user: null,
    };
    return selector ? selector(state) : state;
  }),
}));

// Mock the exercises API
vi.mock('@/features/exercises/api', () => ({
  getIntensityUnits: vi.fn(),
}));

const mockGetIntensityUnits = vi.mocked(exerciseApi.getIntensityUnits);

const defaultProps = {
  isOpen: true,
  onClose: vi.fn(),
  onSelect: vi.fn(),
};

const createTestQueryClient = () => new QueryClient({
  defaultOptions: {
    queries: {
      retry: false,
    },
  },
});

const TestWrapper = ({ children, queryClient = createTestQueryClient() }: { 
  children: React.ReactNode; 
  queryClient?: QueryClient; 
}) => (
  <QueryClientProvider client={queryClient}>
    {children}
  </QueryClientProvider>
);

describe('IntensityUnitModal', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockIsAuthenticated.mockReturnValue(false); // Default to guest mode
  });

  describe('Rendering and Visibility', () => {
    it('should not render when isOpen is false', () => {
      render(
        <TestWrapper>
          <IntensityUnitModal {...defaultProps} isOpen={false} />
        </TestWrapper>
      );
      
      expect(screen.queryByTestId('intensity-unit-modal')).not.toBeInTheDocument();
      expect(screen.queryByText('Select Unit:')).not.toBeInTheDocument();
    });

    it('should render when isOpen is true', () => {
      render(
        <TestWrapper>
          <IntensityUnitModal {...defaultProps} />
        </TestWrapper>
      );
      
      expect(screen.getByTestId('intensity-unit-modal')).toBeInTheDocument();
      expect(screen.getByText('Select Unit:')).toBeInTheDocument();
    });

    it('should have proper modal structure and styling', () => {
      render(
        <TestWrapper>
          <IntensityUnitModal {...defaultProps} />
        </TestWrapper>
      );
      
      const modal = screen.getByTestId('intensity-unit-modal');
      expect(modal).toHaveClass('fixed', 'inset-0', 'bg-black/50', 'flex', 'items-center', 'justify-center', 'p-4', 'z-50');
    });
  });

  describe('Header', () => {
    it('should display correct title', () => {
      render(
        <TestWrapper>
          <IntensityUnitModal {...defaultProps} />
        </TestWrapper>
      );
      
      const title = screen.getByText('Select Unit:');
      expect(title).toBeInTheDocument();
      expect(title.tagName).toBe('H3');
      expect(title).toHaveClass('text-lg', 'font-semibold', 'text-foreground');
    });
  });

  describe('Guest Mode (Not Authenticated)', () => {
    beforeEach(() => {
      mockIsAuthenticated.mockReturnValue(false);
    });

    it('should display hardcoded guest intensity units', () => {
      render(
        <TestWrapper>
          <IntensityUnitModal {...defaultProps} />
        </TestWrapper>
      );
      
      expect(screen.getByRole('button', { name: /select bodyweight \(bw\)/i })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /select kilograms \(kg\)/i })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /select pounds \(lbs\)/i })).toBeInTheDocument();
    });

    it('should display units with correct format', () => {
      render(
        <TestWrapper>
          <IntensityUnitModal {...defaultProps} />
        </TestWrapper>
      );
      
      expect(screen.getByText('bw - Bodyweight')).toBeInTheDocument();
      expect(screen.getByText('kg - Kilograms')).toBeInTheDocument();
      expect(screen.getByText('lbs - Pounds')).toBeInTheDocument();
    });

    it('should call onSelect with guest unit when unit button is clicked', async () => {
      const user = userEvent.setup();
      const onSelect = vi.fn();
      
      render(
        <TestWrapper>
          <IntensityUnitModal {...defaultProps} onSelect={onSelect} />
        </TestWrapper>
      );
      
      await user.click(screen.getByRole('button', { name: /select bodyweight \(bw\)/i }));
      
      expect(onSelect).toHaveBeenCalledWith({ 
        id: 1, 
        name: 'Bodyweight', 
        abbreviation: 'bw' 
      });
    });

    it('should not make API call in guest mode', () => {
      render(
        <TestWrapper>
          <IntensityUnitModal {...defaultProps} />
        </TestWrapper>
      );
      
      expect(mockGetIntensityUnits).not.toHaveBeenCalled();
    });
  });

  describe('Authenticated Mode', () => {
    beforeEach(() => {
      mockIsAuthenticated.mockReturnValue(true);
    });

    it('should display loading skeleton when fetching server units', () => {
      mockGetIntensityUnits.mockImplementation(() => new Promise(() => {})); // Never resolves
      
      render(
        <TestWrapper>
          <IntensityUnitModal {...defaultProps} />
        </TestWrapper>
      );
      
      // Find skeleton elements by their data attribute or specific class combination
      const container = screen.getByTestId('intensity-unit-modal');
      const skeletons = container.querySelectorAll('.h-10.bg-muted.rounded-lg.animate-pulse');
      
      // If no test ID exists, fall back to class-based selection
      if (skeletons.length === 0) {
        const skeletonsByClass = container.querySelectorAll('.h-10.bg-muted.rounded-lg.animate-pulse');
        expect(skeletonsByClass.length).toBeGreaterThan(0);
      } else {
        expect(skeletons.length).toBeGreaterThan(0);
      }
    });

    it('should display server intensity units when loaded successfully', async () => {
      const mockUnits = [
        { id: 1, name: 'Kilograms', abbreviation: 'kg' },
        { id: 2, name: 'Pounds', abbreviation: 'lbs' },
        { id: 3, name: 'Reps', abbreviation: 'reps' },
      ];
      
      mockGetIntensityUnits.mockResolvedValue(mockUnits);
      
      render(
        <TestWrapper>
          <IntensityUnitModal {...defaultProps} />
        </TestWrapper>
      );
      
      await waitFor(() => {
        expect(screen.getByRole('button', { name: /select kilograms \(kg\)/i })).toBeInTheDocument();
      });
      
      expect(screen.getByRole('button', { name: /select pounds \(lbs\)/i })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /select reps \(reps\)/i })).toBeInTheDocument();
    });

    it('should call onSelect with server unit when unit button is clicked', async () => {
      const user = userEvent.setup();
      const onSelect = vi.fn();
      const mockUnits = [
        { id: 1, name: 'Kilograms', abbreviation: 'kg' },
      ];
      
      mockGetIntensityUnits.mockResolvedValue(mockUnits);
      
      render(
        <TestWrapper>
          <IntensityUnitModal {...defaultProps} onSelect={onSelect} />
        </TestWrapper>
      );
      
      await waitFor(() => {
        expect(screen.getByRole('button', { name: /select kilograms \(kg\)/i })).toBeInTheDocument();
      });
      
      await user.click(screen.getByRole('button', { name: /select kilograms \(kg\)/i }));
      
      expect(onSelect).toHaveBeenCalledWith({ 
        id: 1, 
        name: 'Kilograms', 
        abbreviation: 'kg' 
      });
    });

    it('should display error message when API call fails', async () => {
      mockGetIntensityUnits.mockRejectedValue(new Error('API Error'));
      
      render(
        <TestWrapper>
          <IntensityUnitModal {...defaultProps} />
        </TestWrapper>
      );
      
      await waitFor(() => {
        expect(screen.getByText('Failed to load intensity units.')).toBeInTheDocument();
      });
      
      const errorMessage = screen.getByText('Failed to load intensity units.');
      expect(errorMessage).toHaveClass('text-center', 'text-destructive');
    });

    it('should make API call when authenticated', () => {
      render(
        <TestWrapper>
          <IntensityUnitModal {...defaultProps} />
        </TestWrapper>
      );
      
      expect(mockGetIntensityUnits).toHaveBeenCalled();
    });
  });

  describe('Backdrop Interaction', () => {
    it('should call onClose when clicking backdrop', async () => {
      const user = userEvent.setup();
      const onClose = vi.fn();
      
      render(
        <TestWrapper>
          <IntensityUnitModal {...defaultProps} onClose={onClose} />
        </TestWrapper>
      );
      
      const backdrop = screen.getByTestId('intensity-unit-modal');
      await user.click(backdrop);
      
      expect(onClose).toHaveBeenCalledTimes(1);
    });

    it('should not close when clicking on modal content', async () => {
      const user = userEvent.setup();
      const onClose = vi.fn();
      
      render(
        <TestWrapper>
          <IntensityUnitModal {...defaultProps} onClose={onClose} />
        </TestWrapper>
      );
      
      const title = screen.getByText('Select Unit:');
      await user.click(title);
      
      expect(onClose).not.toHaveBeenCalled();
    });
  });

  describe('Grid Layout and Styling', () => {
    it('should have proper button styling for unit buttons', () => {
      render(
        <TestWrapper>
          <IntensityUnitModal {...defaultProps} />
        </TestWrapper>
      );
      
      const unitButton = screen.getByRole('button', { name: /select bodyweight \(bw\)/i });
      expect(unitButton).toHaveClass(
        'w-full',
        'text-left',
        'px-4',
        'py-2',
        'rounded',
        'bg-muted',
        'hover:bg-accent',
        'text-muted-foreground'
      );
    });
  });

  describe('Accessibility', () => {
    it('should have proper aria-labels for unit buttons', () => {
      render(
        <TestWrapper>
          <IntensityUnitModal {...defaultProps} />
        </TestWrapper>
      );
      
      expect(screen.getByRole('button', { name: /select bodyweight \(bw\)/i })).toHaveAttribute('aria-label', 'Select Bodyweight (bw)');
      expect(screen.getByRole('button', { name: /select kilograms \(kg\)/i })).toHaveAttribute('aria-label', 'Select Kilograms (kg)');
      expect(screen.getByRole('button', { name: /select pounds \(lbs\)/i })).toHaveAttribute('aria-label', 'Select Pounds (lbs)');
    });

    it('should be keyboard navigable', () => {
      render(
        <TestWrapper>
          <IntensityUnitModal {...defaultProps} />
        </TestWrapper>
      );
      
      const buttons = screen.getAllByRole('button');
      buttons.forEach(button => {
        expect(button).toBeInTheDocument();
        // All buttons should be focusable (no disabled attribute)
        expect(button).not.toHaveAttribute('disabled');
      });
    });
  });

  describe('Loading States', () => {
    beforeEach(() => {
      mockIsAuthenticated.mockReturnValue(true);
    });

    it('should show loading skeleton with correct structure', async () => {
      mockGetIntensityUnits.mockImplementation(() => new Promise(() => {})); // Never resolves
      
      render(
        <TestWrapper>
          <IntensityUnitModal {...defaultProps} />
        </TestWrapper>
      );
      
      // Use more stable query - find skeleton elements by class rather than DOM traversal
      const container = screen.getByTestId('intensity-unit-modal');
      const skeletons = container.querySelectorAll('.h-10.bg-muted.rounded-lg.animate-pulse');
      expect(skeletons).toHaveLength(4);
      
      // Verify each skeleton has the correct classes
      skeletons.forEach(skeleton => {
        expect(skeleton).toHaveClass('h-10', 'bg-muted', 'rounded-lg', 'animate-pulse');
      });
    });

    it('should not show loading skeleton in guest mode', () => {
      mockIsAuthenticated.mockReturnValue(false);
      
      render(
        <TestWrapper>
          <IntensityUnitModal {...defaultProps} />
        </TestWrapper>
      );
      
      const container = screen.getByTestId('intensity-unit-modal');
      const skeletons = container.querySelectorAll('.animate-pulse');
      expect(skeletons).toHaveLength(0);
    });
  });
});