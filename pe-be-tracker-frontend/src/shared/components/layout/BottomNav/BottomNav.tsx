import React from 'react';
import { NavLink } from 'react-router-dom';
import { navItems } from '@/shared/navigation/navItems';

const BottomNav: React.FC = () => (
  <nav
    className="fixed bottom-0 inset-x-0 z-50 flex justify-around items-center bg-base-200 bg-slate-800 text-base-100 shadow-lg py-2 md:hidden"
    style={{ bottom: 'env(safe-area-inset-bottom)' }}
    aria-label="Bottom navigation"
  >
    {navItems.map(({ to, icon: Icon, label }) => (
      <NavLink
        key={to}
        to={to}
        aria-label={label}
        className={({ isActive }) =>
          `flex flex-col items-center justify-center gap-0.5 ${isActive ? 'text-primary' : 'text-base-content/70'}`
        }
      >
        <Icon className="w-6 h-6" />
        {/* Visually hidden label for accessibility */}
        <span className="sr-only">{label}</span>
      </NavLink>
    ))}
  </nav>
);

export default BottomNav;