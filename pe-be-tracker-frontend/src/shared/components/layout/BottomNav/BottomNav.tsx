import React from 'react';
import { NavLink } from 'react-router-dom';
import { navItems, NavItem } from '@/shared/navigation/navItems';
import usePersistentNav from '@/shared/hooks/usePersistentNav';

const NavItemLink: React.FC<{ item: NavItem }> = ({ item }) => {
  const lastVisited = usePersistentNav(item.key, item.to);
  const IconComponent = item.icon;

  return (
    <NavLink
      to={lastVisited}
      aria-label={item.label}
      className={({ isActive }) =>
        `flex flex-col items-center justify-center gap-0.5 w-full h-full py-2 ${
          isActive ? 'text-primary' : 'text-muted-foreground'
        }`
      }
    >
      <IconComponent className="w-6 h-6" />
      <span className="text-xs">{item.label}</span>
    </NavLink>
  );
};

const BottomNav: React.FC = () => (
  <nav
    className="fixed bottom-0 inset-x-0 z-50 flex justify-around items-center bg-background border-t md:hidden"
    style={{ bottom: 'env(safe-area-inset-bottom)' }}
    aria-label="Bottom navigation"
  >
    {navItems.map((item) => (
      <NavItemLink key={item.key} item={item} />
    ))}
  </nav>
);

export default BottomNav;
