import React from 'react';
import { useNavigate } from 'react-router-dom';

const HomeLogo: React.FC = () => {
  const navigate = useNavigate();

  const handleClick = () => {
    navigate('/');
  };

  return (
    <button
      onClick={handleClick}
      className="flex items-center gap-2 text-lg font-bold text-gray-100 hover:text-blue-400 transition-colors duration-200 cursor-pointer"
    >
      <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center">
        <span className="text-white font-bold text-sm">FT</span>
      </div>
      <span>Fitness Tracker</span>
    </button>
  );
};

export default HomeLogo;