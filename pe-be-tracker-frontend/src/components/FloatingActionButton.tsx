import React from 'react';

interface FloatingActionButtonProps {
  onClick: () => void;
  children: React.ReactNode;
  className?: string;
  disabled?: boolean;
}

const FloatingActionButton: React.FC<FloatingActionButtonProps> = ({
  onClick,
  children,
  className = '',
  disabled = false
}) => {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={`
        fixed bottom-20 md:bottom-6 right-6 z-40
        btn btn-primary btn-circle btn-lg
        shadow-lg hover:shadow-xl
        transition-all duration-200
        ${disabled ? 'btn-disabled' : ''}
        ${className}
      `}
      aria-label="Floating action button"
    >
      {children}
    </button>
  );
};

export default FloatingActionButton;