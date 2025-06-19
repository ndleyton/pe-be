import React from 'react';
import { NavLink } from 'react-router-dom';
import { HiOutlineHome, HiOutlineUser } from 'react-icons/hi2';
import { IoFitnessOutline } from 'react-icons/io5';

interface NavItem {
  to: string;
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  description?: string;
}

const DesktopNav: React.FC = () => {
  const navItems: NavItem[] = [
    {
      to: '/dashboard',
      icon: HiOutlineHome,
      label: 'Home',
      description: 'Dashboard and overview'
    },
    {
      to: '/workouts',
      icon: IoFitnessOutline,
      label: 'Workouts',
      description: 'Track and manage workouts'
    },
    {
      to: '/profile',
      icon: HiOutlineUser,
      label: 'Profile',
      description: 'Account settings and preferences'
    }
  ];

  return (
    <nav className="hidden lg:flex" role="navigation" aria-label="Main navigation">
      <ul className="menu menu-horizontal px-1 space-x-1">
        {navItems.map((item) => {
          const IconComponent = item.icon;
          return (
            <li key={item.to}>
              <NavLink
                to={item.to}
                className={({ isActive }) =>
                  `flex items-center space-x-2 px-4 py-2 rounded-lg transition-all duration-200 group relative ${
                    isActive 
                      ? 'bg-primary text-primary-content shadow-md' 
                      : 'hover:bg-base-200 hover:shadow-sm'
                  }`
                }
                aria-label={`Navigate to ${item.label}: ${item.description}`}
              >
                <IconComponent className="w-5 h-5" />
                <span className="font-medium">{item.label}</span>
                
                {/* Hover tooltip for additional context */}
                {item.description && (
                  <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 px-3 py-2 bg-base-content text-base-100 text-sm rounded-lg opacity-0 group-hover:opacity-100 transition-opacity duration-200 pointer-events-none whitespace-nowrap z-10">
                    {item.description}
                    <div className="absolute top-full left-1/2 transform -translate-x-1/2 border-4 border-transparent border-t-base-content"></div>
                  </div>
                )}
              </NavLink>
            </li>
          );
        })}
      </ul>
    </nav>
  );
};

export default DesktopNav; 