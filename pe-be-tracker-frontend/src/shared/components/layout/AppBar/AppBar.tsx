import React, { useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { HiOutlineBars3 } from 'react-icons/hi2';
import { useDrawer } from '@/contexts/DrawerContext';
import { useAuth } from '@/contexts/AuthContext';
import HomeLogo from '../HomeLogo';
import { useGoogleSignIn } from '@/features/auth/hooks';

const AppBar: React.FC = () => {
  const navigate = useNavigate();
  const { toggleDrawer } = useDrawer();
  const { isAuthenticated } = useAuth();

  const handleLogoClick = useCallback(() => {
    navigate('/');
  }, [navigate]);

  const googleSignIn = useGoogleSignIn();

  return (
    <header className="bg-base-100 shadow-sm px-2 h-14 flex items-center" role="banner" aria-label="Primary">
      <div className="flex items-center w-14 justify-start">
        <button
          type="button"
          className="btn btn-ghost btn-circle lg:hidden"
          onClick={toggleDrawer}
          aria-label="Open navigation menu"
        >
          <HiOutlineBars3 className="w-6 h-6" />
        </button>
      </div>

      <div className="flex-1 flex justify-center">
        <button
          type="button"
          onClick={handleLogoClick}
          className="btn btn-ghost text-xl hover:text-primary transition-colors duration-200"
          aria-label="Go to home"
        >
          <HomeLogo />
        </button>
      </div>

      <div className="w-14 flex justify-end">
        {!isAuthenticated() && (
          <button
            onClick={googleSignIn}
            className="btn btn-primary btn-sm normal-case"
          >
            Sign&nbsp;In
          </button>
        )}
      </div>
    </header>
  );
};

export default AppBar;