import React from 'react';
import { NavLink } from 'react-router-dom';
import { navItems } from '@/shared/navigation/navItems';
import { Button } from '@/shared/components/ui/button';

const BottomNav: React.FC = () => (
  <nav
    className="fixed bottom-0 inset-x-0 z-50 flex justify-around items-center bg-background border-t md:hidden"
    style={{ bottom: 'env(safe-area-inset-bottom)' }}
    aria-label="Bottom navigation"
  >
    {navItems.map(({ to, icon: Icon, label }) => (
      <NavLink
        key={to}
        to={to}
        aria-label={label}
        className={({ isActive }) =>
          `flex flex-col items-center justify-center gap-0.5 w-full h-full py-2 ${
            isActive ? 'text-primary' : 'text-muted-foreground'
          }`
        }
      >
        <Icon className="w-6 h-6" />
        <span className="text-xs">{label}</span>
      </NavLink>
    ))}
  </nav>
);

export default BottomNav;
