import type { ReactNode } from "react";
import { Button } from "@/shared/components/ui/button";

interface FloatingActionButtonProps {
  onClick: () => void;
  children: ReactNode;
  className?: string;
  disabled?: boolean;
  onMouseEnter?: () => void;
  /** Optional test id for E2E selectors */
  dataTestId?: string;
}

const FloatingActionButton = ({
  onClick,
  onMouseEnter,
  children,
  className = "",
  disabled = false,
  dataTestId,
}: FloatingActionButtonProps) => {
  return (
    <Button
      onClick={onClick}
      onMouseEnter={onMouseEnter}
      disabled={disabled}
      size="icon"
      className={`bg-primary/90 hover:bg-primary fixed right-6 bottom-24 z-50 h-12 w-12 shadow-lg transition-all duration-200 backdrop-blur-sm hover:shadow-xl md:bottom-6 ${className} `}
      aria-label="Floating action button"
      data-testid={dataTestId}
    >
      {children}
    </Button>
  );
};

export default FloatingActionButton;
