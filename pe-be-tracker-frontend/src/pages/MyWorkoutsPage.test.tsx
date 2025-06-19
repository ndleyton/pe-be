import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen } from '@testing-library/react';
import { render } from '../test/utils';
import MyWorkoutsPage from './MyWorkoutsPage';

vi.mock('../components/WorkoutForm', () => ({
  default: () => <div data-testid="workout-form">Mock Workout Form</div>,
}));

describe('MyWorkoutsPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders the page with heading', () => {
    render(<MyWorkoutsPage />);

    expect(screen.getByRole('heading', { name: /workouts/i })).toBeInTheDocument();
  });

  it('shows message when no workouts exist', () => {
    render(<MyWorkoutsPage />);

    expect(screen.getByText(/you haven't logged any workouts yet/i)).toBeInTheDocument();
  });
});