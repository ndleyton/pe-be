import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import GoogleSignInButton from './GoogleSignInButton';
import api from '@/shared/api/client';

// Mock the API client with proper typing
vi.mock('@/shared/api/client', () => ({
  default: {
    get: vi.fn(),
  },
}));

// Type the mocked API properly
interface MockedApi {
  get: ReturnType<typeof vi.fn>;
}

const mockApi = vi.mocked(api) as unknown as MockedApi;

// Mock window.location.href
const mockLocation = {
  href: '',
};
Object.defineProperty(window, 'location', {
  value: mockLocation,
  writable: true,
});

describe('GoogleSignInButton', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockLocation.href = '';
  });

  afterEach(() => {
    vi.clearAllTimers();
  });

  describe('Rendering and Initial State', () => {
    it('should render the sign-in button with correct initial text', () => {
      render(<GoogleSignInButton />);
      
      const button = screen.getByRole('button', { name: /sign in with google/i });
      expect(button).toBeInTheDocument();
      expect(button).toHaveTextContent('Sign in with Google');
      expect(button).not.toBeDisabled();
    });

    it('should have proper button structure and styling', () => {
      render(<GoogleSignInButton />);
      
      const button = screen.getByRole('button', { name: /sign in with google/i });
      expect(button).toHaveClass('w-full');
      expect(button).toHaveAttribute('type', 'button');
    });

    it('should render Google logo SVG', () => {
      render(<GoogleSignInButton />);
      
      const svg = screen.getByRole('button').querySelector('svg');
      expect(svg).toBeInTheDocument();
      expect(svg).toHaveAttribute('width', '20');
      expect(svg).toHaveAttribute('height', '20');
      expect(svg).toHaveAttribute('viewBox', '0 0 24 24');
    });

    it('should not display error message initially', () => {
      render(<GoogleSignInButton />);
      
      expect(screen.queryByText(/error/i)).not.toBeInTheDocument();
    });
  });

  describe('Successful OAuth Flow', () => {
    it('should handle successful Google sign-in authorization', async () => {
      const user = userEvent.setup();
      const mockAuthUrl = 'https://accounts.google.com/oauth/authorize?client_id=test';
      
      mockApi.get.mockResolvedValueOnce({
        data: { authorization_url: mockAuthUrl }
      });
      
      render(<GoogleSignInButton />);
      
      const button = screen.getByRole('button', { name: /sign in with google/i });
      await user.click(button);
      
      expect(mockApi.get).toHaveBeenCalledWith('/auth/google/authorize');
      expect(mockLocation.href).toBe(mockAuthUrl);
    });

    it('should show loading state during OAuth request', async () => {
      const user = userEvent.setup();
      let resolvePromise: (value: any) => void;
      const promise = new Promise(resolve => {
        resolvePromise = resolve;
      });
      
      mockApi.get.mockReturnValueOnce(promise);
      
      render(<GoogleSignInButton />);
      
      const button = screen.getByRole('button', { name: /sign in with google/i });
      await user.click(button);
      
      // Should show loading state
      expect(screen.getByRole('button', { name: /redirecting/i })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /redirecting/i })).toBeDisabled();
      expect(screen.getByText('Redirecting...')).toBeInTheDocument();
      
      // Resolve the promise
      resolvePromise!({ data: { authorization_url: 'https://google.com' } });
      
      await waitFor(() => {
        expect(mockLocation.href).toBe('https://google.com');
      });
    });
  });

  describe('Error Handling', () => {
    it('should handle API request failure', async () => {
      const user = userEvent.setup();
      const errorMessage = 'Network error';
      
      mockApi.get.mockRejectedValueOnce(new Error(errorMessage));
      
      render(<GoogleSignInButton />);
      
      const button = screen.getByRole('button', { name: /sign in with google/i });
      await user.click(button);
      
      await waitFor(() => {
        expect(screen.getByText(errorMessage)).toBeInTheDocument();
      });
      
      // Button should be re-enabled after error
      expect(screen.getByRole('button', { name: /sign in with google/i })).not.toBeDisabled();
      expect(mockLocation.href).toBe('');
    });

    it('should handle missing authorization_url in response', async () => {
      const user = userEvent.setup();
      
      mockApi.get.mockResolvedValueOnce({
        data: {} // Missing authorization_url
      });
      
      render(<GoogleSignInButton />);
      
      const button = screen.getByRole('button', { name: /sign in with google/i });
      await user.click(button);
      
      await waitFor(() => {
        expect(screen.getByText('No authorization_url in response')).toBeInTheDocument();
      });
      
      expect(screen.getByRole('button', { name: /sign in with google/i })).not.toBeDisabled();
      expect(mockLocation.href).toBe('');
    });

    it('should handle non-Error exceptions', async () => {
      const user = userEvent.setup();
      
      mockApi.get.mockRejectedValueOnce('Some string error');
      
      render(<GoogleSignInButton />);
      
      const button = screen.getByRole('button', { name: /sign in with google/i });
      await user.click(button);
      
      await waitFor(() => {
        expect(screen.getByText('An unknown error occurred')).toBeInTheDocument();
      });
      
      expect(screen.getByRole('button', { name: /sign in with google/i })).not.toBeDisabled();
    });

    it('should display error message with proper styling', async () => {
      const user = userEvent.setup();
      
      mockApi.get.mockRejectedValueOnce(new Error('Test error'));
      
      render(<GoogleSignInButton />);
      
      await user.click(screen.getByRole('button', { name: /sign in with google/i }));
      
      await waitFor(() => {
        const errorElement = screen.getByText('Test error');
        expect(errorElement).toBeInTheDocument();
        expect(errorElement).toHaveClass('text-destructive', 'mt-2');
        expect(errorElement.tagName).toBe('P');
      });
    });
  });

  describe('User Interactions', () => {
    it('should handle multiple rapid clicks gracefully', async () => {
      const user = userEvent.setup();
      
      mockApi.get.mockImplementation(() => new Promise(() => {})); // Never resolves
      
      render(<GoogleSignInButton />);
      
      const button = screen.getByRole('button', { name: /sign in with google/i });
      
      // Click multiple times rapidly
      await user.click(button);
      await user.click(button);
      await user.click(button);
      
      // Should still only make one API call
      expect(mockApi.get).toHaveBeenCalledTimes(1);
      
      // Button should be disabled
      expect(screen.getByRole('button', { name: /redirecting/i })).toBeDisabled();
    });

    it('should be keyboard accessible', async () => {
      const user = userEvent.setup();
      
      mockApi.get.mockResolvedValueOnce({
        data: { authorization_url: 'https://google.com' }
      });
      
      render(<GoogleSignInButton />);
      
      const button = screen.getByRole('button', { name: /sign in with google/i });
      button.focus();
      
      // Press Enter to trigger the button
      await user.keyboard('{Enter}');
      
      expect(mockApi.get).toHaveBeenCalledWith('/auth/google/authorize');
    });
  });

  describe('API Integration', () => {
    it('should call the correct OAuth endpoint', async () => {
      const user = userEvent.setup();
      
      mockApi.get.mockResolvedValueOnce({
        data: { authorization_url: 'https://google.com' }
      });
      
      render(<GoogleSignInButton />);
      
      await user.click(screen.getByRole('button', { name: /sign in with google/i }));
      
      expect(mockApi.get).toHaveBeenCalledWith('/auth/google/authorize');
      expect(mockApi.get).toHaveBeenCalledTimes(1);
    });
  });
});