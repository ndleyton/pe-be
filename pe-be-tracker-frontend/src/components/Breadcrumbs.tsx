import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { HiChevronRight } from 'react-icons/hi2';
import { generateBreadcrumbs } from '../utils/breadcrumbs';

const Breadcrumbs: React.FC = () => {
  const location = useLocation();
  const breadcrumbs = generateBreadcrumbs(location.pathname);

  // Don't show breadcrumbs for single-level pages or root
  if (breadcrumbs.length <= 1) {
    return null;
  }

  return (
    <div className="hidden md:flex">
      <div className="breadcrumbs text-sm">
        <ul>
          {breadcrumbs.map((crumb, index) => (
            <li key={crumb.path || crumb.label}>
              {crumb.path ? (
                <Link 
                  to={crumb.path}
                  className="link link-hover"
                >
                  {crumb.label}
                </Link>
              ) : (
                <span className="text-base-content/70">{crumb.label}</span>
              )}
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
};

export default Breadcrumbs;