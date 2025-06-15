import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import api from '../api/client';
import { render } from '../test/utils';
import WorkoutForm from './WorkoutForm';

vi.mock('../api/client');
const mockedApi = vi.mocked(api, true);


vi.mock('./WorkoutTypeModal', () => ({
  default: ({ isOpen, onClose, onSelect }: any) => 
    isOpen ? (
      <div data-testid="workout-type-modal">
        <button onClick={() => onSelect({ id: 1, name: 'Push Day', description: 'Chest, shoulders, triceps' })}>
          Select Push Day
        </button>
        <button onClick={onClose}>Close Modal</button>
      </div>
    ) : null,
  WorkoutType: {}
}));

const mockNavigate = vi.fn();
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return {
    ...actual,
    useNavigate: () => mockNavigate,
  };
});

describe('WorkoutForm', () => {
  const mockOnWorkoutCreated = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders the form with all required fields', () => {
    render(<WorkoutForm onWorkoutCreated={mockOnWorkoutCreated} />);

    // Check for workout name title (either date or fallback text)
    const today = new Date().toISOString().slice(0, 10);
    expect(screen.getByText(today)).toBeInTheDocument();
    
    // Check for form fields - notes now has placeholder text
    expect(screen.getByPlaceholderText(/how am i feeling today/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/start time/i)).toBeInTheDocument();
    
    // Check for workout type selector (not direct input anymore)
    expect(screen.getByText(/select workout type/i)).toBeInTheDocument();
    
    // Check for updated button text
    expect(screen.getByRole('button', { name: /start workout/i })).toBeInTheDocument();
  });

  it('allows editing the workout name', async () => {
    const user = userEvent.setup();
    render(<WorkoutForm onWorkoutCreated={mockOnWorkoutCreated} />);

    // Click on the workout name to edit it
    const today = new Date().toISOString().slice(0, 10);
    const workoutNameTitle = screen.getByText(today);
    await user.click(workoutNameTitle);

    // Should show input field and save button
    expect(screen.getByDisplayValue(today)).toBeInTheDocument(); // The input field
    // Check for the green save button (by class)
    const saveButton = screen.getAllByRole('button').find(btn => 
      btn.className.includes('bg-green-600')
    );
    expect(saveButton).toBeInTheDocument(); // Save button (checkmark)
  });

  it('opens workout type modal when clicking select workout type', async () => {
    const user = userEvent.setup();
    render(<WorkoutForm onWorkoutCreated={mockOnWorkoutCreated} />);

    const selectButton = screen.getByText(/select workout type/i);
    await user.click(selectButton);

    expect(screen.getByTestId('workout-type-modal')).toBeInTheDocument();
  });

  it('selects workout type from modal and updates name', async () => {
    const user = userEvent.setup();
    render(<WorkoutForm onWorkoutCreated={mockOnWorkoutCreated} />);

    // Open modal
    const selectButton = screen.getByText(/select workout type/i);
    await user.click(selectButton);

    // Select workout type
    const pushDayButton = screen.getByText(/select push day/i);
    await user.click(pushDayButton);

    // Should close modal and show selected workout type
    expect(screen.queryByTestId('workout-type-modal')).not.toBeInTheDocument();
    expect(screen.getAllByText(/push day/i)).toHaveLength(2); // One in title, one in card
    
    // Name should be auto-updated with workout type and date
    const today = new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    expect(screen.getByText(`Push Day - ${today}`)).toBeInTheDocument();
  });

  it('shows validation errors for required fields', async () => {
    const user = userEvent.setup();
    render(<WorkoutForm onWorkoutCreated={mockOnWorkoutCreated} />);

    // Clear the start time field (it has a default value)
    const startTimeInput = screen.getByLabelText(/start time/i);
    await user.clear(startTimeInput);

    const submitButton = screen.getByRole('button', { name: /start workout/i });
    await user.click(submitButton);

    await waitFor(() => {
      expect(screen.getByText(/start time is required/i)).toBeInTheDocument();
      expect(screen.getByText(/workout type is required/i)).toBeInTheDocument();
    });
  });

  it('successfully creates a workout with valid data', async () => {
    const user = userEvent.setup();
    const mockWorkout = { id: 123, name: 'Test Workout' };
    
    mockedApi.post.mockResolvedValueOnce({ data: mockWorkout });

    render(<WorkoutForm onWorkoutCreated={mockOnWorkoutCreated} />);

    // Edit the workout name
    const today = new Date().toISOString().slice(0, 10);
    const workoutNameTitle = screen.getByText(today);
    await user.click(workoutNameTitle);
    const nameInput = screen.getByDisplayValue(today);
    await user.clear(nameInput);
    await user.type(nameInput, 'Test Workout');
    const saveButton = screen.getAllByRole('button').find(btn => 
      btn.className.includes('bg-green-600')
    );
    await user.click(saveButton!);

    // Fill out notes
    await user.type(screen.getByPlaceholderText(/how am i feeling today/i), 'Test notes');
    
    // Set start time
    await user.clear(screen.getByLabelText(/start time/i));
    await user.type(screen.getByLabelText(/start time/i), '2024-01-01T10:00');
    
    // Select workout type
    const selectButton = screen.getByText(/select workout type/i);
    await user.click(selectButton);
    const pushDayButton = screen.getByText(/select push day/i);
    await user.click(pushDayButton);

    const submitButton = screen.getByRole('button', { name: /start workout/i });
    await user.click(submitButton);

    await waitFor(() => {
      expect(mockedApi.post).toHaveBeenCalledWith(
        '/workouts/',
        expect.objectContaining({
          name: 'Test Workout',
          notes: 'Test notes',
          workout_type_id: 1,
          start_time: expect.stringMatching(/2024-01-01T\d{2}:00:00\.000Z/),
          end_time: null,
        }),
      );
    });

    await waitFor(() => {
      expect(mockOnWorkoutCreated).toHaveBeenCalledWith(123);
      expect(mockNavigate).toHaveBeenCalledWith('/workout/123');
    });
  });

  it('shows loading state during submission', async () => {
    const user = userEvent.setup();
    
    render(<WorkoutForm onWorkoutCreated={mockOnWorkoutCreated} />);

    // Select workout type (required field)  
    const selectButton = screen.getByText(/select workout type/i);
    await user.click(selectButton);
    const pushDayButton = screen.getByText(/select push day/i);
    await user.click(pushDayButton);

    // Ensure we have the "Start Workout" button before clicking
    expect(screen.getByRole('button', { name: /start workout/i })).toBeInTheDocument();
    
    // Mock a delayed response AFTER setting up the form 
    let resolvePromise: (value: any) => void;
    const delayedPromise = new Promise(resolve => {
      resolvePromise = resolve;
    });
    mockedApi.post.mockImplementation(() => delayedPromise);
    
    const submitButton = screen.getByRole('button', { name: /start workout/i });
    await user.click(submitButton);

    // Check loading state
    await waitFor(() => {
      expect(screen.getByRole('button', { name: /creating/i })).toBeInTheDocument();
    });
    expect(screen.getByRole('button', { name: /creating/i })).toBeDisabled();
    
    // Cleanup - resolve the promise to avoid affecting other tests
    resolvePromise!({ data: { id: 123 } });
  });


  it('resets form after successful submission', async () => {
    const user = userEvent.setup();
    const mockWorkout = { id: 123 };
    
    mockedApi.post.mockResolvedValueOnce({ data: mockWorkout });

    render(<WorkoutForm onWorkoutCreated={mockOnWorkoutCreated} />);

    // Edit name
    const today = new Date().toISOString().slice(0, 10);
    const workoutNameTitle = screen.getByText(today);
    await user.click(workoutNameTitle);
    const nameInput = screen.getByDisplayValue(today);
    await user.clear(nameInput);
    await user.type(nameInput, 'Test Workout');
    const saveButton = screen.getAllByRole('button').find(btn => 
      btn.className.includes('bg-green-600')
    );
    await user.click(saveButton!);

    // Fill notes
    const notesInput = screen.getByPlaceholderText(/how am i feeling today/i) as HTMLInputElement;
    await user.type(notesInput, 'Test notes');
    
    // Select workout type
    const selectButton = screen.getByText(/select workout type/i);
    await user.click(selectButton);
    const pushDayButton = screen.getByText(/select push day/i);
    await user.click(pushDayButton);

    const submitButton = screen.getByRole('button', { name: /start workout/i });
    await user.click(submitButton);

    await waitFor(() => {
      // After reset, should show default workout name again
      const resetToday = new Date().toISOString().slice(0, 10);
      expect(screen.getByText(resetToday)).toBeInTheDocument();
      expect(notesInput.value).toBe('');
      // Should show "Select Workout Type" again
      expect(screen.getByText(/select workout type/i)).toBeInTheDocument();
    });

  });
});