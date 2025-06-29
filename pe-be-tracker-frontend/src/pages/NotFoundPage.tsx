import React from 'react';
import { useNavigate } from 'react-router-dom';
import { HiOutlineHome, HiOutlineArrowLeft, HiOutlineExclamationTriangle } from 'react-icons/hi2';
import { useAuth } from '@/contexts/AuthContext';

const NotFoundPage: React.FC = () => {
  const navigate = useNavigate();
  const { isAuthenticated } = useAuth();

  const handleGoHome = () => {
    // Navigate to dashboard if authenticated, otherwise to landing page
    navigate(isAuthenticated() ? '/dashboard' : '/');
  };

  const handleGoBack = () => {
    // Go back in browser history
    window.history.back();
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center px-4">
      <div className="max-w-md w-full text-center">
        {/* Error Icon */}
        <div className="flex justify-center mb-6">
          <div className="rounded-full bg-yellow-100 p-6">
            <HiOutlineExclamationTriangle className="h-16 w-16 text-yellow-600" />
          </div>
        </div>

        {/* Error Code */}
        <h1 className="text-8xl font-bold text-indigo-600 mb-2">404</h1>
        
        {/* Error Message */}
        <h2 className="text-2xl font-semibold text-gray-800 mb-4">
          Page Not Found
        </h2>
        
        <p className="text-gray-600 mb-8 leading-relaxed">
          Oops! The page you're looking for doesn't exist. It might have been moved, 
          deleted, or you entered the wrong URL.
        </p>

        {/* Action Buttons */}
        <div className="space-y-4">
          <button
            onClick={handleGoHome}
            className="w-full flex items-center justify-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white font-medium py-3 px-6 rounded-lg transition-colors duration-200"
          >
            <HiOutlineHome className="h-5 w-5" />
            {isAuthenticated() ? 'Go to Dashboard' : 'Go to Home'}
          </button>
          
          <button
            onClick={handleGoBack}
            className="w-full flex items-center justify-center gap-2 bg-gray-100 hover:bg-gray-200 text-gray-700 font-medium py-3 px-6 rounded-lg transition-colors duration-200"
          >
            <HiOutlineArrowLeft className="h-5 w-5" />
            Go Back
          </button>
        </div>

        {/* Helpful Links */}
        <div className="mt-12 pt-8 border-t border-gray-200">
          <p className="text-sm text-gray-500 mb-4">Need help? Try these:</p>
          <div className="flex flex-wrap justify-center gap-4 text-sm">
            <button
              onClick={() => navigate('/dashboard')}
              className="text-indigo-600 hover:text-indigo-800 hover:underline"
              disabled={!isAuthenticated}
            >
              Dashboard
            </button>
            <button
              onClick={() => navigate('/workouts')}
              className="text-indigo-600 hover:text-indigo-800 hover:underline"
              disabled={!isAuthenticated}
            >
              My Workouts
            </button>
            <button
              onClick={() => navigate('/chat')}
              className="text-indigo-600 hover:text-indigo-800 hover:underline"
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