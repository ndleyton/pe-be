import React, { useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { HiOutlineBars3 } from 'react-icons/hi2';
import { useDrawer } from '@/contexts/DrawerContext';
import { useAuth } from '@/contexts/AuthContext';
import HomeLogo from '../HomeLogo';
import { useGoogleSignIn } from '@/features/auth/hooks';
import { Button } from '@/components/ui/button';

const AppBar: React.FC = () => {
  const navigate = useNavigate();
  const { toggleDrawer } = useDrawer();
  const { isAuthenticated } = useAuth();

  const handleLogoClick = useCallback(() => {
    navigate('/');
  }, [navigate]);

  const googleSignIn = useGoogleSignIn();

  return (
    <header className="relative flex h-16 items-center justify-center border-b bg-background px-4" role="banner" aria-label="Primary navigation">
      {/* Left section for hamburger menu */}
      <div className="absolute left-4 flex items-center">
        <Button
          variant="ghost"
          size="icon"
          className="lg:hidden" // Only show on mobile/tablet
          onClick={toggleDrawer}
          aria-label="Open navigation menu"
        >
          <HiOutlineBars3 className="h-6 w-6" />
        </Button>
      </div>

      {/* Center section for the logo */}
      <div className="flex items-center">
        <Button
          variant="ghost"
          onClick={handleLogoClick}
          className="text-xl" // You can adjust styling here if needed
          aria-label="Go to home"
        >
          <HomeLogo />
        </Button>
      </div>

      {/* Right section for auth button */}
      <div className="absolute right-4 flex items-center">
        {!isAuthenticated() && (
          <Button onClick={googleSignIn} size="sm">
            Sign In
          </Button>
        )}
      </div>
    </header>
  );
};

export default AppBar;
