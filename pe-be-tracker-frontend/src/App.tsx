import React from 'react';
import { useNavigate } from 'react-router-dom';
import { GoogleSignInButton } from "./features/auth/components";
import { HomeLogo } from "./shared/components/layout";
import './App.css';

const App: React.FC = () => {
  const navigate = useNavigate();

  const handleTryAsGuest = () => {
    navigate('/dashboard');
  };

  return (
    <div className="min-h-screen flex flex-col bg-base-200">
      <div className="p-4">
        <HomeLogo />
      </div>
      <div className="flex-1 flex items-center justify-center">
        <div className="w-full max-w-xs p-8 bg-base-100 rounded-xl shadow-lg flex flex-col items-center gap-6">
          <h1 className="text-2xl font-bold text-center mb-4">Welcome to PersonalBestie</h1>
          
          <div className="w-full space-y-4">
            <GoogleSignInButton />
            
            <div className="relative">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-gray-300"></div>
              </div>
              <div className="relative flex justify-center text-sm">
                <span className="px-2 bg-base-100 text-gray-500"></span>
              </div>
            </div>
            
            <button
              onClick={handleTryAsGuest}
              className="w-full py-2 px-4 border border-gray-300 rounded-md shadow-sm bg-white text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 transition-colors"
            >
              Try as Guest
            </button>
          </div>
          
          <p className="text-xs text-gray-500 text-center">
            Guest mode stores data locally. Sign in to sync across devices.
          </p>
        </div>
      </div>
    </div>
  );
};

export default App;