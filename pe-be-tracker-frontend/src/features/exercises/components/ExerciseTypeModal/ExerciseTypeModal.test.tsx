import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { render } from '../../../../test/utils';
import ExerciseTypeModal from './ExerciseTypeModal';

describe('ExerciseTypeModal', () => {
  const mockOnClose = vi.fn();
  const mockOnSelect = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('does not render when closed', () => {
    render(
      <ExerciseTypeModal
        isOpen={false}
        onClose={mockOnClose}
        onSelect={mockOnSelect}
      />
    );

    expect(screen.queryByText('Select Exercise Type')).not.toBeInTheDocument();
  });

  it('renders modal when open', () => {
    render(
      <ExerciseTypeModal
        isOpen={true}
        onClose={mockOnClose}
        onSelect={mockOnSelect}
      />
    );

    expect(screen.getByText('Select Exercise Type')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /close modal/i })).toBeInTheDocument();
  });

  it('has a search input', () => {
    render(
      <ExerciseTypeModal
        isOpen={true}
        onClose={mockOnClose}
        onSelect={mockOnSelect}
      />
    );

    expect(screen.getByPlaceholderText(/search exercise types/i)).toBeInTheDocument();
  });

  it('calls onClose when close button is clicked', async () => {
    const user = userEvent.setup();
    render(
      <ExerciseTypeModal
        isOpen={true}
        onClose={mockOnClose}
        onSelect={mockOnSelect}
      />
    );

    const closeButton = screen.getByRole('button', { name: /close modal/i });
    await user.click(closeButton);

    expect(mockOnClose).toHaveBeenCalled();
  });
});