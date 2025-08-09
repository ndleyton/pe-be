import React from 'react';
import { Link } from 'react-router-dom';
import { Eye, Dumbbell } from 'lucide-react';
import type { Routine } from '@/features/routines/types';
import {
  Card,
  CardContent,
  CardTitle,
} from '@/shared/components/ui/card';

interface RoutineCardProps {
  routine: Routine;
}

export const RoutineCard: React.FC<RoutineCardProps> = ({ routine }) => {
  const { id, name, description, exercise_templates } = routine;

  return (
    <Link to={`/routines/${id}`} className="block">
      <Card className="shadow-md hover:shadow-lg transition-shadow duration-200 cursor-pointer">
        <CardContent className="pt-6">
          <CardTitle className="text-lg font-semibold">{name}</CardTitle>
          
          {description && (
            <p className="text-sm text-muted-foreground line-clamp-2 mb-2">
              {description}
            </p>
          )}
          
          <div className="flex items-center justify-between text-sm text-muted-foreground">
            <div className="flex items-center gap-1">
              <Dumbbell className="h-4 w-4" />
              <span>{exercise_templates.length} exercises</span>
            </div>
            
            <div className="flex items-center gap-1">
              <Eye className="h-4 w-4" />
              <span>View Details</span>
            </div>
          </div>
        </CardContent>
      </Card>
    </Link>
  );
};