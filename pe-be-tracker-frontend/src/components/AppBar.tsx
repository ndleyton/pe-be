import React from 'react';
import { useNavigate } from 'react-router-dom';
import { HiOutlineBars3, HiOutlineUser } from 'react-icons/hi2';
import { useDrawer } from '../contexts/DrawerContext';
import { useAuth } from '../contexts/AuthContext';
import HomeLogo from './HomeLogo';
import Breadcrumbs from './Breadcrumbs';
import DesktopNav from './DesktopNav';
import api from '../api/client';

const AppBar: React.FC = () => {
  const navigate = useNavigate();
  const { toggleDrawer } = useDrawer();
  const { isAuthenticated, signOut } = useAuth();

  const handleLogoClick = () => {
    navigate('/');
  };

  const handleGoogleSignIn = async () => {
    try {
      const { data } = await api.get('/auth/google/authorize');
      if (data.authorization_url) {
        window.location.href = data.authorization_url;
      }
    } catch (error) {
      // eslint-disable-next-line no-console
      console.error('Google sign-in failed', error);
    }
  };

  return (
    <div className="navbar bg-base-100 shadow-sm" role="banner" aria-label="Primary">
      <div className="navbar-start">
        <button
          type="button"
          className="btn btn-ghost btn-circle lg:hidden"
          onClick={toggleDrawer}
          aria-label="Open navigation menu"
        >
          <HiOutlineBars3 className="w-6 h-6" />
        </button>
        <button
          type="button"
          onClick={handleLogoClick}
          className="btn btn-ghost text-xl hover:text-blue-400 transition-colors duration-200"
          aria-label="Go to home"
        >
          <HomeLogo />
        </button>
      </div>
      
      <div className="navbar-center">
        {/* Mobile/Tablet: Show breadcrumbs */}
        <div className="hidden md:flex lg:hidden">
          <Breadcrumbs />
        </div>
        
        {/* Desktop: Show main navigation */}
        <DesktopNav />
      </div>
      
      <div className="navbar-end">
        {/* Desktop: User account actions */}
        <div className="hidden lg:flex items-center space-x-2">
          {isAuthenticated() ? (
            <div className="dropdown dropdown-end">
              <div tabIndex={0} role="button" className="btn btn-ghost btn-circle avatar">
                <div className="w-8 rounded-full bg-primary text-primary-content flex items-center justify-center">
                  <HiOutlineUser className="w-5 h-5" />
                </div>
              </div>
              <ul tabIndex={0} className="mt-3 z-[1] p-2 shadow menu menu-sm dropdown-content bg-base-100 rounded-box w-52">
                <li>
                  <button className="text-left">
                    Settings
                  </button>
                </li>
                <li>
                  <button
                    onClick={signOut}
                    className="text-left text-error"
                  >
                    Sign Out
                  </button>
                </li>
              </ul>
            </div>
          ) : (
            <button
              onClick={handleGoogleSignIn}
              className="btn btn-primary btn-sm"
            >
              Sign In
            </button>
          )}
        </div>
        
        {/* Tablet: Show breadcrumbs */}
        <div className="hidden md:flex lg:hidden">
          <Breadcrumbs />
        </div>
      </div>
    </div>
  );
};

export default AppBar;