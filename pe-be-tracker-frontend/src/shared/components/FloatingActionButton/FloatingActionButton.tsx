import React from "react";
import { Button } from "@/shared/components/ui/button";

interface FloatingActionButtonProps {
  onClick: () => void;
  children: React.ReactNode;
  className?: string;
  disabled?: boolean;
  /** Optional test id for E2E selectors */
  dataTestId?: string;
}

const FloatingActionButton: React.FC<FloatingActionButtonProps> = ({
  onClick,
  children,
  className = "",
  disabled = false,
  dataTestId,
}) => {
  return (
    <Button
      onClick={onClick}
      disabled={disabled}
      size="icon"
      className={`fixed right-6 bottom-20 z-50 h-12 w-12 shadow-lg transition-all duration-200 hover:shadow-xl md:bottom-6 ${className} `}
      aria-label="Floating action button"
      data-testid={dataTestId}
    >
      {children}
    </Button>
  );
};

export default FloatingActionButton;
