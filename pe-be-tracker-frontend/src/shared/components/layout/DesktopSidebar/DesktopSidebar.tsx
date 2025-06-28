import React from 'react';
import { NavLink } from 'react-router-dom';
import { HiOutlineHome, HiOutlineUser, HiOutlineChatBubbleLeftRight } from 'react-icons/hi2';
import { IoFitnessOutline } from 'react-icons/io5';
import { useAuth } from '@/contexts/AuthContext';
import api from '@/shared/api/client';

interface NavItem {
  to: string;
  icon: React.ComponentType<{ className?: string }>;
  label: string;
}

const DesktopSidebar: React.FC = () => {
  const { isAuthenticated, signOut } = useAuth();

  const navItems: NavItem[] = [
    {
      to: '/dashboard',
      icon: HiOutlineHome,
      label: 'Home'
    },
    {
      to: '/workouts',
      icon: IoFitnessOutline,
      label: 'Workouts'
    },
    {
      to: '/chat',
      icon: HiOutlineChatBubbleLeftRight,
      label: 'Chat'
    },
    {
      to: '/profile',
      icon: HiOutlineUser,
      label: 'Profile'
    }
  ];

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
    <aside className="hidden lg:flex lg:flex-col lg:w-64 lg:fixed lg:inset-y-0 lg:bg-base-100 lg:border-r lg:border-base-300">
      <div className="flex flex-col flex-1 min-h-0">
        {/* Sidebar Header */}
        <div className="flex items-center h-16 px-6 border-b border-base-300">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center">
              <span className="text-white font-bold text-sm">FT</span>
            </div>
            <span className="text-lg font-semibold">Fitness Tracker</span>
          </div>
        </div>

        {/* Navigation */}
        <nav className="flex-1 px-4 py-6 space-y-2" role="navigation" aria-label="Sidebar navigation">
          {navItems.map((item) => {
            const IconComponent = item.icon;
            return (
              <NavLink
                key={item.to}
                to={item.to}
                className={({ isActive }) =>
                  `flex items-center px-4 py-3 text-sm font-medium rounded-lg transition-colors duration-200 ${
                    isActive
                      ? 'bg-primary text-primary-content shadow-sm'
                      : 'text-base-content hover:bg-base-200'
                  }`
                }
              >
                <IconComponent className="w-5 h-5 mr-3" />
                {item.label}
              </NavLink>
            );
          })}
        </nav>

        {/* Account Section */}
        <div className="p-4 border-t border-base-300">
          {isAuthenticated() ? (
            <div className="space-y-2">
              <button className="w-full flex items-center px-4 py-3 text-sm font-medium text-base-content hover:bg-base-200 rounded-lg transition-colors duration-200">
                <HiOutlineUser className="w-5 h-5 mr-3" />
                Settings
              </button>
              <button
                onClick={signOut}
                className="w-full flex items-center px-4 py-3 text-sm font-medium text-error hover:bg-error hover:text-error-content rounded-lg transition-colors duration-200"
              >
                <svg className="w-5 h-5 mr-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                </svg>
                Sign Out
              </button>
            </div>
          ) : (
            <button
              onClick={handleGoogleSignIn}
              className="w-full flex items-center justify-center px-4 py-3 text-sm font-medium bg-primary text-primary-content hover:bg-primary-focus rounded-lg transition-colors duration-200"
            >
              Sign In with Google
            </button>
          )}
        </div>
      </div>
    </aside>
  );
};

export default DesktopSidebar; 