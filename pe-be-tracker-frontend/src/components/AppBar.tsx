import React from 'react';
import { useNavigate } from 'react-router-dom';
import { HiOutlineBars3 } from 'react-icons/hi2';
import { useDrawer } from '../contexts/DrawerContext';
import HomeLogo from './HomeLogo';
import Breadcrumbs from './Breadcrumbs';

const AppBar: React.FC = () => {
  const navigate = useNavigate();
  const { toggleDrawer } = useDrawer();

  const handleLogoClick = () => {
    navigate('/');
  };

  return (
    <div className="navbar bg-base-100 shadow-sm" role="banner" aria-label="Primary">
      <div className="navbar-start">
        <button
          type="button"
          className="btn btn-ghost btn-circle md:hidden"
          onClick={toggleDrawer}
          aria-label="Open navigation menu"
        >
          <HiOutlineBars3 className="w-6 h-6" />
        </button>
        <button
          type="button"
          onClick={handleLogoClick}
          className="btn btn-ghost text-xl"
          aria-label="Go to home"
        >
          <HomeLogo />
        </button>
      </div>
      
      <div className="navbar-center hidden md:flex">
        <Breadcrumbs />
      </div>
      
      <div className="navbar-end">
        {/* Future: User menu, notifications, etc. */}
      </div>
    </div>
  );
};

export default AppBar;