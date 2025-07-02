import React from 'react';
import { Button } from '@/components/ui/button';

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
    <Button
      onClick={onClick}
      disabled={disabled}
      size="icon"
      className={`
        fixed bottom-20 md:bottom-6 right-6 z-40 h-12 w-12
        shadow-lg hover:shadow-xl
        transition-all duration-200
        ${className}
      `}
      aria-label="Floating action button"
    >
      {children}
    </Button>
  );
};

export default FloatingActionButton;