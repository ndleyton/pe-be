import React from 'react';
import { NavLink } from 'react-router-dom';
import { HiOutlineHome, HiOutlineUser } from 'react-icons/hi2';
import { IoFitnessOutline } from 'react-icons/io5';

const BottomNav: React.FC = () => {
  return (
    <div className="btm-nav md:hidden" role="navigation" aria-label="Bottom navigation">
      <NavLink
        to="/dashboard"
        className={({ isActive }) =>
          `${isActive ? 'active text-primary' : 'text-base-content/70'}`
        }
      >
        <HiOutlineHome className="w-5 h-5" />
        <span className="btm-nav-label">Home</span>
      </NavLink>
      
      <NavLink
        to="/workouts"
        className={({ isActive }) =>
          `${isActive ? 'active text-primary' : 'text-base-content/70'}`
        }
      >
        <IoFitnessOutline className="w-5 h-5" />
        <span className="btm-nav-label">Workouts</span>
      </NavLink>
      
      <NavLink
        to="/profile"
        className={({ isActive }) =>
          `${isActive ? 'active text-primary' : 'text-base-content/70'}`
        }
      >
        <HiOutlineUser className="w-5 h-5" />
        <span className="btm-nav-label">Profile</span>
      </NavLink>
    </div>
  );
};

export default BottomNav;