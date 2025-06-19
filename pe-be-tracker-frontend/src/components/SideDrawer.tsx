import React, { useEffect, useRef } from 'react';
import { NavLink } from 'react-router-dom';
import { HiOutlineHome, HiOutlineUser } from 'react-icons/hi2';
import { IoFitnessOutline } from 'react-icons/io5';
import { useDrawer } from '../contexts/DrawerContext';
import { useAuth } from '../contexts/AuthContext';
import api from '../api/client';

const SideDrawer: React.FC = () => {
  const { isOpen, closeDrawer } = useDrawer();
  const { isAuthenticated, signOut } = useAuth();
  const drawerRef = useRef<HTMLDivElement>(null);
  const firstFocusableRef = useRef<HTMLAnchorElement>(null);

  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        closeDrawer();
      }
    };

    if (isOpen) {
      document.addEventListener('keydown', handleEscape);
      // Focus trap: focus first element when drawer opens
      firstFocusableRef.current?.focus();
    }

    return () => {
      document.removeEventListener('keydown', handleEscape);
    };
  }, [isOpen, closeDrawer]);

  const handleOverlayClick = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget) {
      closeDrawer();
    }
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

  if (!isOpen) return null;

  return (
    <div 
      className="fixed inset-0 z-50 lg:hidden"
      onClick={handleOverlayClick}
      role="dialog"
      aria-modal="true"
      aria-labelledby="drawer-title"
    >
      {/* Overlay */}
      <div className="absolute inset-0 bg-black bg-opacity-50" />
      
      {/* Drawer */}
      <div 
        ref={drawerRef}
        className="absolute left-0 top-0 h-full w-64 bg-base-100 shadow-xl transform transition-transform duration-300"
      >
        <div className="p-4">
          <h2 id="drawer-title" className="text-lg font-semibold mb-6">Navigation</h2>
          
          <nav role="navigation" aria-label="Secondary navigation">
            <ul className="space-y-2">
              <li>
                <NavLink
                  ref={firstFocusableRef}
                  to="/dashboard"
                  onClick={closeDrawer}
                  className={({ isActive }) =>
                    `flex items-center space-x-3 p-3 rounded-lg transition-colors ${
                      isActive 
                        ? 'bg-primary text-primary-content' 
                        : 'hover:bg-base-200'
                    }`
                  }
                >
                  <HiOutlineHome className="w-5 h-5" />
                  <span>Home</span>
                </NavLink>
              </li>
              <li>
                <NavLink
                  to="/workouts"
                  onClick={closeDrawer}
                  className={({ isActive }) =>
                    `flex items-center space-x-3 p-3 rounded-lg transition-colors ${
                      isActive 
                        ? 'bg-primary text-primary-content' 
                        : 'hover:bg-base-200'
                    }`
                  }
                >
                  <IoFitnessOutline className="w-5 h-5" />
                  <span>Workouts</span>
                </NavLink>
              </li>
              <li>
                <NavLink
                  to="/profile"
                  onClick={closeDrawer}
                  className={({ isActive }) =>
                    `flex items-center space-x-3 p-3 rounded-lg transition-colors ${
                      isActive 
                        ? 'bg-primary text-primary-content' 
                        : 'hover:bg-base-200'
                    }`
                  }
                >
                  <HiOutlineUser className="w-5 h-5" />
                  <span>Profile</span>
                </NavLink>
              </li>
            </ul>
          </nav>
          
          <div className="mt-8 pt-8 border-t border-base-300">
            <h3 className="text-sm font-medium text-base-content/70 mb-4">Account</h3>
            <div className="space-y-2">
              {isAuthenticated() ? (
                <>
                  <button className="w-full text-left p-3 rounded-lg hover:bg-base-200 transition-colors">
                    Settings
                  </button>
                  <button
                    onClick={() => {
                      closeDrawer();
                      signOut();
                    }}
                    className="w-full text-left p-3 rounded-lg hover:bg-base-200 transition-colors text-error"
                  >
                    Sign Out
                  </button>
                </>
              ) : (
                <button
                  onClick={handleGoogleSignIn}
                  className="w-full text-left p-3 rounded-lg hover:bg-base-200 transition-colors text-primary"
                >
                  Sign In with Google
                </button>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default SideDrawer;