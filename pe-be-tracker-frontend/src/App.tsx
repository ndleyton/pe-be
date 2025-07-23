import React from 'react';
import { useNavigate } from 'react-router-dom';
import { GoogleSignInButton } from "./features/auth/components";
import { HomeLogo } from "./shared/components/ui/layout";
import './App.css';

const App: React.FC = () => {
  const navigate = useNavigate();

  const handleTryAsGuest = () => {
    navigate('/dashboard');
  };

  return (
    <div className="min-h-screen flex flex-col bg-background">
      <div className="p-4">
        <HomeLogo />
      </div>
      <div className="flex-1 flex items-center justify-center">
        <div className="w-full max-w-xs p-8 bg-card rounded-xl shadow-lg flex flex-col items-center gap-6">
          <h1 className="text-2xl font-bold text-center mb-4 text-card-foreground">Welcome to PersonalBestie</h1>
          
          <div className="w-full space-y-4">
            <GoogleSignInButton />
            
            <div className="relative">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-border"></div>
              </div>
              <div className="relative flex justify-center text-sm">
                <span className="px-2 bg-card text-muted-foreground"></span>
              </div>
            </div>
            
            <button
              onClick={handleTryAsGuest}
              className="w-full py-2 px-4 border border-border rounded-md shadow-sm bg-secondary text-secondary-foreground hover:bg-secondary/80 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-ring transition-colors"
            >
              Try as Guest
            </button>
          </div>
          
          <p className="text-xs text-muted-foreground text-center">
            Guest mode stores data locally. Sign in to sync across devices.
          </p>
        </div>
      </div>
    </div>
  );
};

export default App;