import { render, screen, waitFor } from '@testing-library/react';
import AnatomicalImage from './AnatomicalImage';

// Mock the fetch API
global.fetch = jest.fn(() =>
  Promise.resolve({
    text: () => Promise.resolve('<svg><rect id="pectorals" /></svg>'),
  }) as Promise<Response>
);

describe('AnatomicalImage', () => {
  it('renders loading state initially', () => {
    render(<AnatomicalImage muscleGroupSummary={[]} />);
    expect(screen.getByText('Loading anatomical image...')).toBeInTheDocument();
  });

  it('renders SVG content after fetching', async () => {
    render(<AnatomicalImage muscleGroupSummary={[]} />);
    await waitFor(() => {
      expect(screen.getByRole('img')).toBeInTheDocument();
    });
  });

  it('colors muscle groups based on summary', async () => {
    const muscleGroupSummary = [
      { name: 'Chest', setCount: 10, exerciseCount: 1 },
    ];
    render(<AnatomicalImage muscleGroupSummary={muscleGroupSummary} />);

    await waitFor(() => {
      const svgElement = screen.getByRole('img');
      const pectoralsRect = svgElement.querySelector('#pectorals');
      expect(pectoralsRect).toHaveAttribute('fill', 'rgb(100, 250, 155)'); // Example color based on getMuscleGroupColor
    });
  });
});