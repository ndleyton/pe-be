import React from "react";
import { Button } from "@/shared/components/ui/button";
import { ArrowLeft } from "lucide-react";
import { Link } from "react-router-dom";

const RoutineDetailsPage: React.FC = () => {
  return (
    <div className="mx-auto max-w-5xl p-8">
      <div className="mb-6 flex items-center gap-4 text-left">
        <Button
          variant="ghost"
          size="icon"
          asChild
          aria-label="Go back"
          className="lg:hidden"
        >
          <Link to="/routines">
            <ArrowLeft className="h-5 w-5" />
          </Link>
        </Button>
        <h1 className="text-3xl font-bold">Routine Details</h1>
      </div>
      <p>Details for a specific routine will be displayed here.</p>
    </div>
  );
};

export default RoutineDetailsPage;
