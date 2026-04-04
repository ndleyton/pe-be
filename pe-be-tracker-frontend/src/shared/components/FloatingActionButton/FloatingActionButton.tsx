import type { ReactNode } from "react";
import { Button } from "@/shared/components/ui/button";

interface FloatingActionButtonProps {
  onClick: () => void;
  children: ReactNode;
  className?: string;
  disabled?: boolean;
  onMouseEnter?: () => void;
  onTouchStart?: () => void;
  onFocus?: () => void;
  /** Optional test id for E2E selectors */
  dataTestId?: string;
}

const FloatingActionButton = ({
  onClick,
  onMouseEnter,
  onTouchStart,
  onFocus,
  children,
  className = "",
  disabled = false,
  dataTestId,
}: FloatingActionButtonProps) => {
  return (
    <Button
      onClick={onClick}
      onMouseEnter={onMouseEnter}
      onTouchStart={onTouchStart}
      onFocus={onFocus}
      disabled={disabled}
      size="icon"
      className={`fixed right-6 bottom-24 z-50 h-14 w-14 rounded-full bg-primary/80 text-primary-foreground border border-white/20 backdrop-blur-md shadow-2xl hover:scale-110 active:scale-95 transition-all duration-300 hover:bg-primary hover:shadow-primary/20 md:bottom-6 ${className}`}
      aria-label="Floating action button"
      data-testid={dataTestId}
    >
      {children}
    </Button>
  );
};

export default FloatingActionButton;
