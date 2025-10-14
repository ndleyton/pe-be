import type { KeyboardEvent } from "react";

interface HomeLogoProps {
  onClick?: () => void;
  className?: string;
}

const HomeLogo = ({ onClick, className = "" }: HomeLogoProps) => {
  const handleKeyDown = (event: KeyboardEvent) => {
    if (onClick && (event.key === "Enter" || event.key === " ")) {
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
      className={`text-foreground flex items-center gap-2 text-lg font-bold ${
        isInteractive
          ? "focus:ring-ring focus:ring-offset-background hover:text-primary cursor-pointer rounded-md transition-all duration-200 focus:ring-2 focus:ring-offset-2 focus:outline-none"
          : ""
      } ${className}`}
      aria-label={isInteractive ? "Go to home page" : undefined}
    >
      {/* Reserve logo space to avoid CLS */}
      <img
        src="/assets/logo.svg"
        alt="PBestie Logo"
        className="h-8 w-8"
        width={32}
        height={32}
      />
      <div className="flex flex-col items-start text-left text-base leading-none text-rose-400">
        <span>Personal</span>
        <span>Bestie</span>
      </div>
    </div>
  );
};

export default HomeLogo;
