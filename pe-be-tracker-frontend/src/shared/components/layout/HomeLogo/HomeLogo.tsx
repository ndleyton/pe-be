import React from 'react';

interface HomeLogoProps {
  onClick?: () => void;
  className?: string;
}

const HomeLogo: React.FC<HomeLogoProps> = ({ onClick, className = "" }) => {
  const handleKeyDown = (event: React.KeyboardEvent) => {
    if (onClick && (event.key === 'Enter' || event.key === ' ')) {
      event.preventDefault();
      onClick();
    }
  };

  const isInteractive = !!onClick;

  return (
    <div
      data-testid="home-logo"
      onClick={onClick}
      onKeyDown={handleKeyDown}
      role={isInteractive ? "button" : undefined}
      tabIndex={isInteractive ? 0 : undefined}
      className={`flex items-center gap-2 text-lg font-bold text-gray-100 ${
        isInteractive ? 'cursor-pointer focus:outline-none focus:ring-2 focus:ring-blue-400 focus:ring-offset-2 focus:ring-offset-gray-800 rounded-md transition-all duration-200 hover:text-blue-400' : ''
      } ${className}`}
      aria-label={isInteractive ? "Go to home page" : undefined}
    >
      <img src="/assets/logo.svg" alt="PBestie Logo" className="w-8 h-8" />
      <div className="flex flex-col leading-none items-start text-left text-base text-rose-400">
        <span>Personal</span>
        <span>Bestie</span>
      </div>
    </div>
  );
};

export default HomeLogo;