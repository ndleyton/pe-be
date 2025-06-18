import React from 'react';

interface HomeLogoProps {
  onClick?: () => void;
  className?: string;
}

const HomeLogo: React.FC<HomeLogoProps> = ({ onClick, className = "" }) => {
  return (
    <div
      onClick={onClick}
      className={`flex items-center gap-2 text-lg font-bold text-gray-100 ${className}`}
    >
      <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center">
        <span className="text-white font-bold text-sm">FT</span>
      </div>
      <span>Fitness Tracker</span>
    </div>
  );
};

export default HomeLogo;