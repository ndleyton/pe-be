import React, { useState } from 'react';
import { Exercise, ExerciseSet, IntensityUnit } from '@/features/exercises/api';
import { GuestExerciseSet } from '@/stores';
import { AddExerciseSetForm } from '@/features/exercise-sets/components';
import { ExerciseTypeMore } from '@/features/exercises/components/ExerciseTypeMore';
import { Card, CardHeader, CardContent, Button, Input, Badge, Dialog, DialogTrigger, DialogContent, DialogHeader, DialogTitle, Textarea } from '@/shared/components/ui';
import { MoreVertical, Timer, StickyNote, Plus, Minus, Check } from 'lucide-react';
import { formatDisplayDate } from '@/utils/date';
import { truncateWords } from '@/utils/text';

// Guest intensity unit type (simplified)
interface GuestIntensityUnit {
  id: number;
  name: string;
  abbreviation: string;
}

interface ExerciseRowProps {
  exercise: Exercise;
  onExerciseUpdate?: (updatedExercise: Exercise) => void;
  workoutId?: string;
}

interface SetData {
  id: number | string;
  type?: 'warmup' | 'working';
  weight?: number;
  reps?: number;
  notes?: string;
  completed: boolean;
}

interface RestTimer {
  minutes: number;
  seconds: number;
}

interface NotesModalState {
  exerciseId: string | number;
  setId: string | number;
}

const ExerciseRow: React.FC<ExerciseRowProps> = ({ exercise, onExerciseUpdate, workoutId }) => {
  const [exerciseSets, setExerciseSets] = useState<ExerciseSet[]>(exercise.exercise_sets || []);
  const [showAddForm, setShowAddForm] = useState(false);
  const [exerciseNotes, setExerciseNotes] = useState<string>(exercise.notes || '');
  const [notesModal, setNotesModal] = useState<NotesModalState | null>(null);
  const [restTimer] = useState<RestTimer>({ minutes: 2, seconds: 30 });
  const [showExerciseModal, setShowExerciseModal] = useState(false);
  
  // Default intensity unit based on exercise type or fallback
  const [currentIntensityUnit, setCurrentIntensityUnit] = useState<IntensityUnit | GuestIntensityUnit>(() => {
    // Try to get from exercise type default, otherwise fallback to kg
    return {
      id: 2,
      name: 'Kilograms',
      abbreviation: 'kg'
    };
  });
  
  // Convert exercise sets to sets with additional UI state
  const [sets, setSets] = useState<SetData[]>(() => {
    return exerciseSets.map((set, index) => ({
      id: set.id,
      type: index === 0 ? 'warmup' : 'working',
      weight: set.intensity || 0,
      reps: set.reps || 0,
      notes: '',
      completed: set.done
    }));
  });

  const handleSetAdded = (newSet: ExerciseSet | GuestExerciseSet) => {
    const updatedSets = [...exerciseSets, newSet];
    setExerciseSets(updatedSets);
    setShowAddForm(false);
    
    // Update the parent with the updated exercise
    if (onExerciseUpdate) {
      onExerciseUpdate({
        ...exercise,
        exercise_sets: updatedSets
      });
    }
  };

  const updateSet = (exerciseId: string | number, setId: string | number, field: 'weight' | 'reps', value: number) => {
    setSets(prev => prev.map(set => 
      set.id === setId ? { ...set, [field]: value } : set
    ));
  };

  const incrementReps = (exerciseId: string | number, setId: string | number) => {
    setSets(prev => prev.map(set => 
      set.id === setId ? { ...set, reps: (set.reps || 0) + 1 } : set
    ));
  };

  const decrementReps = (exerciseId: string | number, setId: string | number) => {
    setSets(prev => prev.map(set => 
      set.id === setId ? { ...set, reps: Math.max((set.reps || 0) - 1, 0) } : set
    ));
  };

  const toggleSetCompletion = (exerciseId: string | number, setId: string | number) => {
    setSets(prev => prev.map(set => 
      set.id === setId ? { ...set, completed: !set.completed } : set
    ));
  };

  const updateSetNotes = (exerciseId: string | number, setId: string | number, notes: string) => {
    setSets(prev => prev.map(set => 
      set.id === setId ? { ...set, notes } : set
    ));
  };

  const addSet = (exerciseId: string | number) => {
    const newSet: SetData = {
      id: Date.now(), // Temporary ID
      type: 'working',
      weight: sets.length > 0 ? sets[sets.length - 1].weight : 0,
      reps: sets.length > 0 ? sets[sets.length - 1].reps : 0,
      notes: '',
      completed: false
    };
    setSets(prev => [...prev, newSet]);
  };

  const handleIntensityUnitChange = (unit: IntensityUnit | GuestIntensityUnit) => {
    setCurrentIntensityUnit(unit);
    setShowExerciseModal(false);
  };

  return (
    <Card key={exercise.id}>
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 bg-gray-200 rounded-full flex items-center justify-center">
              <div className="w-4 h-4 bg-gray-600 rounded"></div>
            </div>
            <div>
              <h3 className="font-semibold text-blue-600">
                {exercise.exercise_type.name} ({exercise.exercise_type.default_intensity_unit || 'kg'})
              </h3>
            </div>
          </div>
          <Dialog open={showExerciseModal} onOpenChange={setShowExerciseModal}>
            <DialogTrigger asChild>
              <Button variant="ghost" size="sm">
                <MoreVertical className="w-4 h-4" />
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Exercise Settings</DialogTitle>
              </DialogHeader>
              <ExerciseTypeMore
                currentIntensityUnit={currentIntensityUnit}
                onIntensityUnitChange={handleIntensityUnitChange}
              />
            </DialogContent>
          </Dialog>
        </div>

        <Textarea
          placeholder="Add notes here..."
          className="mt-2 text-sm"
          value={exerciseNotes}
          onChange={(e) => setExerciseNotes(e.target.value)}
        />

        {/* Rest Timer */}
        <div className="flex items-center gap-2 mt-2">
          <Timer className="w-4 h-4 text-blue-500" />
          <span className="text-sm text-blue-500">
            Rest Timer: {restTimer.minutes}min {restTimer.seconds}s
          </span>
        </div>
      </CardHeader>

      <CardContent className="p-4 pt-0">
        {/* Sets Table Header */}
        <div className="grid gap-4 text-xs font-medium text-gray-500 mb-2" style={{ gridTemplateColumns: "auto 60px 1fr 2fr auto" }}>
          <div>SET</div>
          <div>NOTES</div>
          <div>{currentIntensityUnit.abbreviation.toUpperCase()}</div>
          <div>REPS</div>
          <div className="text-right">DONE</div>
        </div>

        {/* Sets */}
        <div className="space-y-2">
          {sets.map((set, index) => (
            <div
              key={set.id}
              className={`grid gap-4 items-center p-2 rounded ${
                set.completed ? "bg-green-100" : "bg-white"
              }`}
              style={{ gridTemplateColumns: "auto 60px 1fr 2fr auto" }}
            >
              <div className="font-medium">
                {set.type === "warmup" ? (
                  <Badge variant="outline" className="text-xs bg-yellow-100 text-yellow-700">
                    W
                  </Badge>
                ) : (
                  <span>{index + 1}</span>
                )}
              </div>
              <div className="text-sm text-gray-500">
                <Dialog>
                  <DialogTrigger asChild>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-6 w-6 p-0"
                      onClick={() => setNotesModal({ exerciseId: exercise.id, setId: set.id })}
                    >
                      <StickyNote className="w-3 h-3" />
                    </Button>
                  </DialogTrigger>
                  <DialogContent>
                    <DialogHeader>
                      <DialogTitle>Set Notes</DialogTitle>
                    </DialogHeader>
                    <Textarea
                      placeholder="Add notes for this set..."
                      value={set.notes || ""}
                      onChange={(e) => updateSetNotes(exercise.id, set.id, e.target.value)}
                      className="min-h-[100px]"
                    />
                  </DialogContent>
                </Dialog>
              </div>
              <div>
                <Input
                  type="number"
                  value={set.weight || ""}
                  onChange={(e) => updateSet(exercise.id, set.id, "weight", Number.parseInt(e.target.value) || 0)}
                  className="h-8 text-center"
                  disabled={set.completed}
                />
              </div>
              <div className="flex items-center gap-1">
                <Button
                  variant="outline"
                  size="sm"
                  className="h-6 w-6 p-0 bg-transparent"
                  onClick={() => decrementReps(exercise.id, set.id)}
                  disabled={set.completed}
                >
                  <Minus className="w-3 h-3" />
                </Button>
                <Input
                  type="number"
                  value={set.reps || ""}
                  onChange={(e) => updateSet(exercise.id, set.id, "reps", Number.parseInt(e.target.value) || 0)}
                  className="h-8 text-center flex-1 min-w-0"
                  disabled={set.completed}
                />
                <Button
                  variant="outline"
                  size="sm"
                  className="h-6 w-6 p-0 bg-transparent"
                  onClick={() => incrementReps(exercise.id, set.id)}
                  disabled={set.completed}
                >
                  <Plus className="w-3 h-3" />
                </Button>
              </div>
              <div className="flex justify-end">
                <Button
                  variant={set.completed ? "default" : "outline"}
                  size="sm"
                  className={`h-8 w-8 p-0 ${set.completed ? "bg-green-500 hover:bg-green-600" : ""}`}
                  onClick={() => toggleSetCompletion(exercise.id, set.id)}
                >
                  <Check className="w-4 h-4" />
                </Button>
              </div>
            </div>
          ))}
        </div>

        {/* Add Set Button */}
        <Button variant="outline" className="w-full mt-4 bg-transparent" onClick={() => addSet(exercise.id)}>
          <Plus className="w-4 h-4 mr-2" />
          Add Set
        </Button>
      </CardContent>
    </Card>
  );
};

export default ExerciseRow;