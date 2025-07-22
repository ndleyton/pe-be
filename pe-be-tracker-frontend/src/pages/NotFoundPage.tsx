import { useAuthStore } from '@/stores';
import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Home, ArrowLeft, AlertTriangle } from 'lucide-react';
;

const NotFoundPage: React.FC = () => {
  const navigate = useNavigate();
  const isAuthenticated = useAuthStore(state => state.isAuthenticated);

  const handleGoHome = () => {
    // Navigate to dashboard if authenticated, otherwise to landing page
    navigate(isAuthenticated ? '/dashboard' : '/');
  };

  const handleGoBack = () => {
    // Go back in browser history
    window.history.back();
  };

  return (
    <div className="min-h-screen bg-background flex items-center justify-center px-4">
      <div className="max-w-md w-full text-center">
        {/* Error Icon */}
        <div className="flex justify-center mb-6">
          <div className="rounded-full bg-destructive/10 p-6">
            <AlertTriangle className="h-16 w-16 text-destructive" />
          </div>
        </div>

        {/* Error Code */}
        <h1 className="text-8xl font-bold text-primary mb-2">404</h1>
        
        {/* Error Message */}
        <h2 className="text-2xl font-semibold text-foreground mb-4">
          Page Not Found
        </h2>
        
        <p className="text-muted-foreground mb-8 leading-relaxed">
          Oops! The page you're looking for doesn't exist. It might have been moved, 
          deleted, or you entered the wrong URL.
        </p>

        {/* Action Buttons */}
        <div className="space-y-4">
          <button
            onClick={handleGoHome}
            className="w-full flex items-center justify-center gap-2 bg-primary hover:bg-primary/90 text-primary-foreground font-medium py-3 px-6 rounded-lg transition-colors duration-200"
          >
            <Home className="h-5 w-5" />
            {isAuthenticated ? 'Go to Dashboard' : 'Go to Home'}
          </button>
          
          <button
            onClick={handleGoBack}
            className="w-full flex items-center justify-center gap-2 bg-muted hover:bg-accent text-muted-foreground font-medium py-3 px-6 rounded-lg transition-colors duration-200"
          >
            <ArrowLeft className="h-5 w-5" />
            Go Back
          </button>
        </div>

        {/* Helpful Links */}
        <div className="mt-12 pt-8 border-t border-border">
          <p className="text-sm text-muted-foreground mb-4">Need help? Try these:</p>
          <div className="flex flex-wrap justify-center gap-4 text-sm">
            <button
              onClick={() => navigate('/dashboard')}
              className="text-primary hover:text-primary/90 hover:underline"
              disabled={!isAuthenticated}
            >
              Dashboard
            </button>
            <button
              onClick={() => navigate('/dashboard')}
              className="text-primary hover:text-primary/90 hover:underline"
              disabled={!isAuthenticated}
            >
              My Workouts
            </button>
            <button
              onClick={() => navigate('/chat')}
              className="text-primary hover:text-primary/90 hover:underline"
              disabled={!isAuthenticated}
            >
              AI Chat
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default NotFoundPage;