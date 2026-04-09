import { ArrowLeft } from "lucide-react";
import { Link } from "react-router-dom";

import { Button } from "@/shared/components/ui/button";

import { RoutineDetailsPageSkeleton } from "./RoutineDetailsPageSkeleton";

export const RoutineDetailsLoadingState = () => (
  <div className="mx-auto min-h-screen max-w-4xl px-4 py-6 md:py-8">
    <div className="mb-8 flex items-center gap-4 text-left">
      <Button
        variant="ghost"
        size="icon"
        asChild
        aria-label="Go back"
        className="rounded-full bg-primary/5 transition-all duration-300 hover:bg-primary hover:text-primary-foreground"
      >
        <Link to="/routines">
          <ArrowLeft className="h-5 w-5" />
        </Link>
      </Button>
      <div>
        <div className="flex items-center gap-3">
          <h1 className="text-3xl font-black tracking-tight text-glow bg-gradient-to-b from-foreground to-foreground/70 bg-clip-text text-transparent truncate">
            Routine Details
          </h1>
        </div>
        <p className="text-muted-foreground/70 mt-1 text-xs font-bold uppercase tracking-widest">
          Plan Overview
        </p>
      </div>
    </div>

    <div className="grid gap-8 text-left">
      <RoutineDetailsPageSkeleton />
    </div>
  </div>
);
