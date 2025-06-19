import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor, act } from '@testing-library/react';
import { AuthProvider, useAuth } from './AuthContext';
import api from '../api/client';

// Mock the API client
vi.mock('../api/client', () => ({
  default: {
    get: vi.fn(),
    post: vi.fn(),
  },
}));

const mockApi = vi.mocked(api);

// Mock window.location.href
const mockLocation = {
  href: '',
};
Object.defineProperty(window, 'location', {
  value: mockLocation,
  writable: true,
});

// Test component that uses the AuthContext
const TestComponent = () => {
  const { user, loading, refresh, signOut, isAuthenticated } = useAuth();
  
  return (
    <div>
      <div data-testid="loading">{loading.toString()}</div>
      <div data-testid="authenticated">{isAuthenticated().toString()}</div>
      <div data-testid="user-email">{user?.email || 'no-user'}</div>
      <div data-testid="user-name">{user?.name || 'no-name'}</div>
      <button onClick={refresh} data-testid="refresh-btn">Refresh</button>
      <button onClick={signOut} data-testid="signout-btn">Sign Out</button>
    </div>
  );
};

const renderWithAuth = (component: React.ReactNode) => {
  return render(
    <AuthProvider>
      {component}
    </AuthProvider>
  );
};

describe('AuthContext', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockLocation.href = '';
  });

  afterEach(() => {
    vi.clearAllTimers();
  });

  describe('AuthProvider', () => {
    it('should provide initial loading state', () => {
      mockApi.get.mockImplementation(() => new Promise(() => {})); // Never resolves
      
      renderWithAuth(<TestComponent />);
      
      expect(screen.getByTestId('loading')).toHaveTextContent('true');
      expect(screen.getByTestId('authenticated')).toHaveTextContent('false');
      expect(screen.getByTestId('user-email')).toHaveTextContent('no-user');
    });

    it('should fetch user on mount and set authenticated state', async () => {
      const mockUser = {
        id: 1,
        email: 'test@example.com',
        name: 'Test User',
      };
      
      mockApi.get.mockResolvedValueOnce({ data: mockUser });
      
      renderWithAuth(<TestComponent />);
      
      await waitFor(() => {
        expect(screen.getByTestId('loading')).toHaveTextContent('false');
      });
      
      expect(screen.getByTestId('authenticated')).toHaveTextContent('true');
      expect(screen.getByTestId('user-email')).toHaveTextContent('test@example.com');
      expect(screen.getByTestId('user-name')).toHaveTextContent('Test User');
      expect(mockApi.get).toHaveBeenCalledWith('/users/me');
    });

    it('should handle user fetch failure and set unauthenticated state', async () => {
      mockApi.get.mockRejectedValueOnce(new Error('Unauthorized'));
      
      renderWithAuth(<TestComponent />);
      
      await waitFor(() => {
        expect(screen.getByTestId('loading')).toHaveTextContent('false');
      });
      
      expect(screen.getByTestId('authenticated')).toHaveTextContent('false');
      expect(screen.getByTestId('user-email')).toHaveTextContent('no-user');
    });

    it('should handle user with no name field', async () => {
      const mockUser = {
        id: 2,
        email: 'noname@example.com',
        name: null,
      };
      
      mockApi.get.mockResolvedValueOnce({ data: mockUser });
      
      renderWithAuth(<TestComponent />);
      
      await waitFor(() => {
        expect(screen.getByTestId('loading')).toHaveTextContent('false');
      });
      
      expect(screen.getByTestId('user-email')).toHaveTextContent('noname@example.com');
      expect(screen.getByTestId('user-name')).toHaveTextContent('no-name');
    });
  });

  describe('refresh function', () => {
    it('should refetch user data and update loading state', async () => {
      const mockUser = {
        id: 1,
        email: 'initial@example.com',
        name: 'Initial User',
      };
      
      const updatedUser = {
        id: 1,
        email: 'updated@example.com',
        name: 'Updated User',
      };
      
      // Initial fetch
      mockApi.get.mockResolvedValueOnce({ data: mockUser });
      
      renderWithAuth(<TestComponent />);
      
      await waitFor(() => {
        expect(screen.getByTestId('user-email')).toHaveTextContent('initial@example.com');
      });
      
      // Refresh fetch
      mockApi.get.mockResolvedValueOnce({ data: updatedUser });
      
      await act(async () => {
        screen.getByTestId('refresh-btn').click();
      });
      
      await waitFor(() => {
        expect(screen.getByTestId('user-email')).toHaveTextContent('updated@example.com');
      });
      
      expect(mockApi.get).toHaveBeenCalledTimes(2);
    });

    it('should handle refresh failure gracefully', async () => {
      const mockUser = {
        id: 1,
        email: 'test@example.com',
        name: 'Test User',
      };
      
      // Initial successful fetch
      mockApi.get.mockResolvedValueOnce({ data: mockUser });
      
      renderWithAuth(<TestComponent />);
      
      await waitFor(() => {
        expect(screen.getByTestId('authenticated')).toHaveTextContent('true');
      });
      
      // Refresh failure
      mockApi.get.mockRejectedValueOnce(new Error('Network error'));
      
      await act(async () => {
        screen.getByTestId('refresh-btn').click();
      });
      
      await waitFor(() => {
        expect(screen.getByTestId('loading')).toHaveTextContent('false');
      });
      
      // Should be logged out after failed refresh
      expect(screen.getByTestId('authenticated')).toHaveTextContent('false');
    });
  });

  describe('signOut function', () => {
    it('should call logout endpoint and redirect to home', async () => {
      const mockUser = {
        id: 1,
        email: 'test@example.com',
        name: 'Test User',
      };
      
      mockApi.get.mockResolvedValueOnce({ data: mockUser });
      mockApi.post.mockResolvedValueOnce({});
      
      renderWithAuth(<TestComponent />);
      
      await waitFor(() => {
        expect(screen.getByTestId('authenticated')).toHaveTextContent('true');
      });
      
      await act(async () => {
        screen.getByTestId('signout-btn').click();
      });
      
      expect(mockApi.post).toHaveBeenCalledWith('/auth/jwt/logout');
      expect(screen.getByTestId('authenticated')).toHaveTextContent('false');
      expect(mockLocation.href).toBe('/');
    });

    it('should handle logout endpoint failure and still clear user state', async () => {
      const mockUser = {
        id: 1,
        email: 'test@example.com',
        name: 'Test User',
      };
      
      mockApi.get.mockResolvedValueOnce({ data: mockUser });
      mockApi.post.mockRejectedValueOnce(new Error('Network error'));
      
      renderWithAuth(<TestComponent />);
      
      await waitFor(() => {
        expect(screen.getByTestId('authenticated')).toHaveTextContent('true');
      });
      
      await act(async () => {
        screen.getByTestId('signout-btn').click();
      });
      
      expect(mockApi.post).toHaveBeenCalledWith('/auth/jwt/logout');
      expect(screen.getByTestId('authenticated')).toHaveTextContent('false');
      expect(mockLocation.href).toBe('/');
    });
  });

  describe('useAuth hook', () => {
    it('should throw error when used outside AuthProvider', () => {
      const TestComponentWithoutProvider = () => {
        useAuth();
        return <div>Test</div>;
      };
      
      expect(() => {
        render(<TestComponentWithoutProvider />);
      }).toThrow('useAuth must be used within an AuthProvider');
    });
  });

  describe('isAuthenticated helper', () => {
    it('should return true when user exists', async () => {
      const mockUser = {
        id: 1,
        email: 'test@example.com',
        name: 'Test User',
      };
      
      mockApi.get.mockResolvedValueOnce({ data: mockUser });
      
      renderWithAuth(<TestComponent />);
      
      await waitFor(() => {
        expect(screen.getByTestId('authenticated')).toHaveTextContent('true');
      });
    });

    it('should return false when user is null', async () => {
      mockApi.get.mockRejectedValueOnce(new Error('Unauthorized'));
      
      renderWithAuth(<TestComponent />);
      
      await waitFor(() => {
        expect(screen.getByTestId('authenticated')).toHaveTextContent('false');
      });
    });
  });
});