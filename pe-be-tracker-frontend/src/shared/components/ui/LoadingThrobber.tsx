import React from "react";
import { Dumbbell } from "lucide-react";

export const LoadingThrobber: React.FC<{ className?: string }> = ({ className }) => (
  <div className={`flex flex-col items-center justify-center space-y-4 py-12 ${className}`}>
    <div className="relative flex items-center justify-center">
      {/* Expanding Ripple Rings */}
      <div className="absolute h-16 w-16 animate-ping rounded-full bg-primary/20 duration-1000" />
      <div className="absolute h-24 w-24 animate-ping rounded-full bg-primary/10 duration-2000" />

      {/* Card Base */}
      <div className="relative flex h-20 w-20 items-center justify-center rounded-2xl border border-primary/20 bg-card/60 shadow-2xl backdrop-blur-md">
        <Dumbbell className="text-primary h-10 w-10 animate-pulse drop-shadow-[0_0_15px_rgba(var(--primary),0.5)]" />
      </div>

      {/* Rotating Border Glow */}
      <div className="absolute inset-x-0 h-full w-full animate-[spin_3s_linear_infinite] rounded-full border-2 border-transparent border-t-primary/30" />
    </div>

    <div className="flex flex-col items-center">
      <p className="text-foreground/40 text-sm font-black uppercase tracking-[0.2em] animate-pulse">
        Initializing Workout
      </p>
      <div className="mt-2 flex gap-1">
        <div className="h-1 w-1 animate-bounce rounded-full bg-primary/50" />
        <div className="h-1 w-1 animate-bounce rounded-full bg-primary/50 [animation-delay:0.2s]" />
        <div className="h-1 w-1 animate-bounce rounded-full bg-primary/50 [animation-delay:0.4s]" />
      </div>
    </div>
  </div>
);
