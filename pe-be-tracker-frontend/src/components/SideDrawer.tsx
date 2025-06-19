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

  const handleOutsideClick = (e: React.MouseEvent) => {
    // Close drawer if clicking outside of it
    if (drawerRef.current && !drawerRef.current.contains(e.target as Node)) {
      closeDrawer();
    }
  };

  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        closeDrawer();
      }
    };

    const handleClickOutside = (e: MouseEvent) => {
      // Close drawer if clicking outside of it when open
      if (isOpen && drawerRef.current && !drawerRef.current.contains(e.target as Node)) {
        closeDrawer();
      }
    };

    if (isOpen) {
      document.addEventListener('keydown', handleEscape);
      document.addEventListener('mousedown', handleClickOutside);
      // Focus trap: focus first element when drawer opens
      firstFocusableRef.current?.focus();
      // Prevent body scroll when drawer is open
      document.body.style.overflow = 'hidden';
    } else {
      // Re-enable body scroll when drawer is closed
      document.body.style.overflow = 'unset';
    }

    return () => {
      document.removeEventListener('keydown', handleEscape);
      document.removeEventListener('mousedown', handleClickOutside);
      document.body.style.overflow = 'unset';
    };
  }, [isOpen, closeDrawer]);

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
    <>
      {/* Drawer - with solid background */}
      <div 
        ref={drawerRef}
        className={`fixed left-0 top-0 z-50 h-full w-64 bg-white dark:bg-gray-800 shadow-xl border-r border-gray-200 dark:border-gray-700 transform transition-transform duration-300 ease-in-out lg:hidden ${
          isOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
        role="dialog"
        aria-modal="true"
        aria-labelledby="drawer-title"
      >
        <div className="p-4 h-full overflow-y-auto text-gray-900 dark:text-gray-100">
          <h2 id="drawer-title" className="text-lg font-semibold mb-6 text-gray-900 dark:text-gray-100">Navigation</h2>
          
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
                        ? 'bg-blue-600 text-white' 
                        : 'text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700'
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
                        ? 'bg-blue-600 text-white' 
                        : 'text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700'
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
                        ? 'bg-blue-600 text-white' 
                        : 'text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700'
                    }`
                  }
                >
                  <HiOutlineUser className="w-5 h-5" />
                  <span>Profile</span>
                </NavLink>
              </li>
            </ul>
          </nav>
          
          <div className="mt-8 pt-8 border-t border-gray-200 dark:border-gray-700">
            <h3 className="text-sm font-medium text-gray-600 dark:text-gray-400 mb-4">Account</h3>
            <div className="space-y-2">
              {isAuthenticated() ? (
                <>
                  <button className="w-full text-left p-3 rounded-lg text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors">
                    Settings
                  </button>
                  <button
                    onClick={() => {
                      closeDrawer();
                      signOut();
                    }}
                    className="w-full text-left p-3 rounded-lg text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
                  >
                    Sign Out
                  </button>
                </>
              ) : (
                <button
                  onClick={handleGoogleSignIn}
                  className="w-full text-left p-3 rounded-lg text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/20 transition-colors"
                >
                  Sign In with Google
                </button>
              )}
            </div>
          </div>
        </div>
      </div>
    </>
  );
};

export default SideDrawer;