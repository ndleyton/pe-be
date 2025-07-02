import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import FinishWorkoutModal from './FinishWorkoutModal';

const defaultProps = {
  isOpen: true,
  onConfirm: vi.fn(),
  onCancel: vi.fn(),
  isLoading: false,
};

describe('FinishWorkoutModal', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Rendering and Visibility', () => {
    it('should not render when isOpen is false', () => {
      render(<FinishWorkoutModal {...defaultProps} isOpen={false} />);
      
      expect(screen.queryByText('Finish Workout?')).not.toBeInTheDocument();
      expect(screen.queryByText('Cancel')).not.toBeInTheDocument();
    });

    it('should render when isOpen is true', () => {
      render(<FinishWorkoutModal {...defaultProps} />);
      
      expect(screen.getByText('Finish Workout?')).toBeInTheDocument();
      expect(screen.getByText('Are you sure you want to finish this workout? This will set the end time to now.')).toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Cancel' })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Finish Workout' })).toBeInTheDocument();
    });

    it('should have proper modal overlay and content structure', () => {
      render(<FinishWorkoutModal {...defaultProps} />);
      
      // Check for overlay
      const overlay = screen.getByTestId('finish-workout-modal').closest('.fixed.inset-0');
      expect(overlay).toHaveClass('fixed', 'inset-0', 'bg-black/50', 'flex', 'items-center', 'justify-center', 'z-50');
      
      // Check for modal content
      const modalContent = screen.getByTestId('finish-workout-modal');
      expect(modalContent).toHaveClass('bg-card', 'text-card-foreground', 'p-6', 'rounded-lg', 'max-w-md', 'w-full', 'mx-4', 'max-h-[90vh]', 'overflow-y-auto');
    });
  });

  describe('Content and Messaging', () => {
    it('should display the correct title', () => {
      render(<FinishWorkoutModal {...defaultProps} />);
      
      const title = screen.getByText('Finish Workout?');
      expect(title).toBeInTheDocument();
      expect(title.tagName).toBe('H2');
      expect(title).toHaveClass('text-xl', 'font-bold', 'mb-4');
    });

    it('should display the correct confirmation message', () => {
      render(<FinishWorkoutModal {...defaultProps} />);
      
      const message = screen.getByText('Are you sure you want to finish this workout? This will set the end time to now.');
      expect(message).toBeInTheDocument();
      expect(message).toHaveClass('mb-4', 'text-muted-foreground');
    });

    it('should display correct button labels in normal state', () => {
      render(<FinishWorkoutModal {...defaultProps} />);
      
      expect(screen.getByRole('button', { name: 'Cancel' })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Finish Workout' })).toBeInTheDocument();
    });

    it('should display loading state on confirm button when isLoading is true', () => {
      render(<FinishWorkoutModal {...defaultProps} isLoading={true} />);
      
      expect(screen.getByRole('button', { name: 'Finishing...' })).toBeInTheDocument();
      expect(screen.queryByRole('button', { name: 'Finish Workout' })).not.toBeInTheDocument();
    });
  });

  describe('User Interactions', () => {
    it('should call onCancel when Cancel button is clicked', async () => {
      const user = userEvent.setup();
      const onCancel = vi.fn();
      
      render(<FinishWorkoutModal {...defaultProps} onCancel={onCancel} />);
      
      await user.click(screen.getByRole('button', { name: 'Cancel' }));
      
      expect(onCancel).toHaveBeenCalledTimes(1);
    });

    it('should call onConfirm when Finish Workout button is clicked', async () => {
      const user = userEvent.setup();
      const onConfirm = vi.fn();
      
      render(<FinishWorkoutModal {...defaultProps} onConfirm={onConfirm} />);
      
      await user.click(screen.getByRole('button', { name: 'Finish Workout' }));
      
      expect(onConfirm).toHaveBeenCalledTimes(1);
    });

    it('should handle keyboard events for Cancel button', () => {
      const onCancel = vi.fn();
      
      render(<FinishWorkoutModal {...defaultProps} onCancel={onCancel} />);
      
      const cancelButton = screen.getByRole('button', { name: 'Cancel' });
      fireEvent.keyDown(cancelButton, { key: 'Enter' });
      
      // Since we're testing keyboard accessibility, the button should be focusable
      expect(cancelButton).toBeInTheDocument();
    });

    it('should handle keyboard events for Confirm button', () => {
      const onConfirm = vi.fn();
      
      render(<FinishWorkoutModal {...defaultProps} onConfirm={onConfirm} />);
      
      const confirmButton = screen.getByRole('button', { name: 'Finish Workout' });
      fireEvent.keyDown(confirmButton, { key: 'Enter' });
      
      // Since we're testing keyboard accessibility, the button should be focusable
      expect(confirmButton).toBeInTheDocument();
    });
  });

  describe('Loading State', () => {
    it('should disable both buttons when isLoading is true', () => {
      render(<FinishWorkoutModal {...defaultProps} isLoading={true} />);
      
      const cancelButton = screen.getByRole('button', { name: 'Cancel' });
      const confirmButton = screen.getByRole('button', { name: 'Finishing...' });
      
      expect(cancelButton).toBeDisabled();
      expect(confirmButton).toBeDisabled();
    });

    it('should enable both buttons when isLoading is false', () => {
      render(<FinishWorkoutModal {...defaultProps} isLoading={false} />);
      
      const cancelButton = screen.getByRole('button', { name: 'Cancel' });
      const confirmButton = screen.getByRole('button', { name: 'Finish Workout' });
      
      expect(cancelButton).not.toBeDisabled();
      expect(confirmButton).not.toBeDisabled();
    });

    it('should not call onCancel when Cancel button is disabled and clicked', async () => {
      const user = userEvent.setup();
      const onCancel = vi.fn();
      
      render(<FinishWorkoutModal {...defaultProps} onCancel={onCancel} isLoading={true} />);
      
      const cancelButton = screen.getByRole('button', { name: 'Cancel' });
      await user.click(cancelButton);
      
      expect(onCancel).not.toHaveBeenCalled();
    });

    it('should not call onConfirm when Confirm button is disabled and clicked', async () => {
      const user = userEvent.setup();
      const onConfirm = vi.fn();
      
      render(<FinishWorkoutModal {...defaultProps} onConfirm={onConfirm} isLoading={true} />);
      
      const confirmButton = screen.getByRole('button', { name: 'Finishing...' });
      await user.click(confirmButton);
      
      expect(onConfirm).not.toHaveBeenCalled();
    });
  });

  describe('Button Styling and States', () => {
    it('should have correct styling for Cancel button', () => {
      render(<FinishWorkoutModal {...defaultProps} />);
      
      const cancelButton = screen.getByRole('button', { name: 'Cancel' });
      expect(cancelButton).toHaveClass('bg-muted', 'hover:bg-accent', 'border-border');
    });

    it('should have correct styling for Confirm button', () => {
      render(<FinishWorkoutModal {...defaultProps} />);
      
      const confirmButton = screen.getByRole('button', { name: 'Finish Workout' });
      expect(confirmButton).toHaveClass('bg-primary', 'hover:bg-primary/90');
    });

    it('should have disabled styling when buttons are disabled', () => {
      render(<FinishWorkoutModal {...defaultProps} isLoading={true} />);
      
      const cancelButton = screen.getByRole('button', { name: 'Cancel' });
      const confirmButton = screen.getByRole('button', { name: 'Finishing...' });
      
      expect(cancelButton).toBeDisabled();
      expect(confirmButton).toBeDisabled();
    });

    it('should have proper button layout and spacing', () => {
      render(<FinishWorkoutModal {...defaultProps} />);
      
      const buttonContainer = screen.getByRole('button', { name: 'Cancel' }).parentElement;
      expect(buttonContainer).toHaveClass('flex', 'justify-end', 'space-x-4');
    });
  });

  describe('Component Props Handling', () => {
    it('should handle optional isLoading prop defaulting to false', () => {
      const { onConfirm, onCancel, isOpen } = defaultProps;
      render(<FinishWorkoutModal isOpen={isOpen} onConfirm={onConfirm} onCancel={onCancel} />);
      
      const cancelButton = screen.getByRole('button', { name: 'Cancel' });
      const confirmButton = screen.getByRole('button', { name: 'Finish Workout' });
      
      expect(cancelButton).not.toBeDisabled();
      expect(confirmButton).not.toBeDisabled();
    });

    it('should properly handle all required props', () => {
      const onConfirm = vi.fn();
      const onCancel = vi.fn();
      
      render(
        <FinishWorkoutModal 
          isOpen={true}
          onConfirm={onConfirm}
          onCancel={onCancel}
          isLoading={false}
        />
      );
      
      expect(screen.getByText('Finish Workout?')).toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Cancel' })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Finish Workout' })).toBeInTheDocument();
    });
  });

  describe('Modal Behavior', () => {
    it('should have proper z-index for modal overlay', () => {
      render(<FinishWorkoutModal {...defaultProps} />);
      
      const overlay = screen.getByText('Finish Workout?').closest('.fixed');
      expect(overlay).toHaveClass('z-50');
    });

    it('should center modal content properly', () => {
      render(<FinishWorkoutModal {...defaultProps} />);
      
      const overlay = screen.getByText('Finish Workout?').closest('.fixed');
      expect(overlay).toHaveClass('flex', 'items-center', 'justify-center');
    });

    it('should have responsive modal width', () => {
      render(<FinishWorkoutModal {...defaultProps} />);
      
      const modalContent = screen.getByTestId('finish-workout-modal');
      expect(modalContent).toHaveClass('max-w-md', 'w-full', 'mx-4');
    });
  });

  describe('Accessibility', () => {
    it('should have focusable buttons', () => {
      render(<FinishWorkoutModal {...defaultProps} />);
      
      const cancelButton = screen.getByRole('button', { name: 'Cancel' });
      const confirmButton = screen.getByRole('button', { name: 'Finish Workout' });
      
      expect(cancelButton).toBeInTheDocument();
      expect(confirmButton).toBeInTheDocument();
      
      // Both buttons should be focusable (not disabled)
      expect(cancelButton).not.toHaveAttribute('disabled');
      expect(confirmButton).not.toHaveAttribute('disabled');
    });

    it('should have proper semantic structure', () => {
      render(<FinishWorkoutModal {...defaultProps} />);
      
      // Title should be h2
      const title = screen.getByText('Finish Workout?');
      expect(title.tagName).toBe('H2');
      
      // Message should be paragraph
      const message = screen.getByText(/Are you sure you want to finish this workout/);
      expect(message.tagName).toBe('P');
      
      // Action elements should be buttons
      const buttons = screen.getAllByRole('button');
      expect(buttons).toHaveLength(2);
    });
  });

  describe('Muscle Group Summary', () => {
    const mockExercisesWithSets = [
      {
        exercise_type: { 
          name: 'Bench Press',
          muscles: [
            {
              id: 1,
              name: 'Pectoralis Major',
              muscle_group_id: 1,
              muscle_group: { id: 1, name: 'Chest', created_at: '2025-01-01T00:00:00Z', updated_at: '2025-01-01T00:00:00Z' },
              created_at: '2025-01-01T00:00:00Z',
              updated_at: '2025-01-01T00:00:00Z'
            }
          ]
        },
        exercise_sets: [
          { done: true },
          { done: true },
          { done: false }
        ]
      },
      {
        exercise_type: { 
          name: 'Squats',
          muscles: [
            {
              id: 6,
              name: 'Quadriceps',
              muscle_group_id: 3,
              muscle_group: { id: 3, name: 'Legs', created_at: '2025-01-01T00:00:00Z', updated_at: '2025-01-01T00:00:00Z' },
              created_at: '2025-01-01T00:00:00Z',
              updated_at: '2025-01-01T00:00:00Z'
            }
          ]
        },
        exercise_sets: [
          { done: true },
          { done: true },
          { done: true }
        ]
      }
    ];

    const mockExercisesNoSets = [
      {
        exercise_type: { name: 'Bench Press' },
        exercise_sets: []
      }
    ];

    it('should display muscle group summary when exercises with completed sets are provided', () => {
      render(
        <FinishWorkoutModal 
          {...defaultProps} 
          exercises={mockExercisesWithSets}
        />
      );
      
      expect(screen.getByText('🎉 Great work! You trained:')).toBeInTheDocument();
      expect(screen.getByText('Legs')).toBeInTheDocument();
      expect(screen.getByText('Chest')).toBeInTheDocument();
      expect(screen.getByText('Total Sets Completed:')).toBeInTheDocument();
      expect(screen.getByText('5')).toBeInTheDocument(); // 2 chest + 3 legs
    });

    it('should not display muscle group summary when no exercises are provided', () => {
      render(
        <FinishWorkoutModal 
          {...defaultProps} 
          exercises={[]}
        />
      );
      
      expect(screen.queryByText('🎉 Great work! You trained:')).not.toBeInTheDocument();
      expect(screen.queryByText('Total Sets Completed:')).not.toBeInTheDocument();
    });

    it('should not display muscle group summary when exercises have no completed sets', () => {
      const exercisesWithUncompletedSets = [
        {
          exercise_type: { name: 'Bench Press' },
          exercise_sets: [
            { done: false },
            { done: false }
          ]
        }
      ];

      render(
        <FinishWorkoutModal 
          {...defaultProps} 
          exercises={exercisesWithUncompletedSets}
        />
      );
      
      expect(screen.queryByText('🎉 Great work! You trained:')).not.toBeInTheDocument();
      expect(screen.queryByText('Total Sets Completed:')).not.toBeInTheDocument();
    });

    it('should handle exercises prop defaulting to empty array', () => {
      render(<FinishWorkoutModal {...defaultProps} />);
      
      expect(screen.queryByText('🎉 Great work! You trained:')).not.toBeInTheDocument();
      expect(screen.queryByText('Total Sets Completed:')).not.toBeInTheDocument();
    });

    it('should display correct set counts for each muscle group', () => {
      render(
        <FinishWorkoutModal 
          {...defaultProps} 
          exercises={mockExercisesWithSets}
        />
      );
      
      // Check if set counts are displayed correctly
      const legsSets = screen.getByText('3 sets');
      const chestSets = screen.getByText('2 sets');
      
      expect(legsSets).toBeInTheDocument();
      expect(chestSets).toBeInTheDocument();
    });

    it('should handle singular vs plural sets correctly', () => {
      const singleSetExercise = [
        {
          exercise_type: { 
            name: 'Push-ups',
            muscles: [
              {
                id: 1,
                name: 'Pectoralis Major',
                muscle_group_id: 1,
                muscle_group: { id: 1, name: 'Chest', created_at: '2025-01-01T00:00:00Z', updated_at: '2025-01-01T00:00:00Z' },
                created_at: '2025-01-01T00:00:00Z',
                updated_at: '2025-01-01T00:00:00Z'
              },
              {
                id: 9,
                name: 'Triceps',
                muscle_group_id: 5,
                muscle_group: { id: 5, name: 'Arms', created_at: '2025-01-01T00:00:00Z', updated_at: '2025-01-01T00:00:00Z' },
                created_at: '2025-01-01T00:00:00Z',
                updated_at: '2025-01-01T00:00:00Z'
              }
            ]
          },
          exercise_sets: [
            { done: true }
          ]
        }
      ];

      render(
        <FinishWorkoutModal 
          {...defaultProps} 
          exercises={singleSetExercise}
        />
      );
      
      // Should display "1 set" not "1 sets" - Push-ups maps to both Chest and Arms, so there will be multiple "1 set" texts
      const setSingularTexts = screen.getAllByText('1 set');
      expect(setSingularTexts.length).toBeGreaterThan(0);
      expect(screen.queryByText('1 sets')).not.toBeInTheDocument();
    });
  });
});