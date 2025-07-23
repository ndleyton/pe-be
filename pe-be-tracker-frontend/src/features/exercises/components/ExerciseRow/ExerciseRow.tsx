import React, { useState, useEffect } from 'react';
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
  
  // Helper function to get set type
  const getSetType = (index: number) => index === 0 ? 'warmup' : 'working';

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
    const updatedSets = exerciseSets.map(set => {
      if (set.id === setId) {
        return {
          ...set,
          [field === 'weight' ? 'intensity' : 'reps']: value
        };
      }
      return set;
    });
    setExerciseSets(updatedSets);
    
    // Update the parent with the updated exercise
    if (onExerciseUpdate) {
      onExerciseUpdate({
        ...exercise,
        exercise_sets: updatedSets
      });
    }
  };

  const incrementReps = (exerciseId: string | number, setId: string | number) => {
    const currentSet = exerciseSets.find(s => s.id === setId);
    const newReps = (currentSet?.reps || 0) + 1;
    updateSet(exerciseId, setId, 'reps', newReps);
  };

  const decrementReps = (exerciseId: string | number, setId: string | number) => {
    const currentSet = exerciseSets.find(s => s.id === setId);
    const newReps = Math.max((currentSet?.reps || 0) - 1, 0);
    updateSet(exerciseId, setId, 'reps', newReps);
  };

  const toggleSetCompletion = (exerciseId: string | number, setId: string | number) => {
    const updatedSets = exerciseSets.map(set => {
      if (set.id === setId) {
        return {
          ...set,
          done: !set.done
        };
      }
      return set;
    });
    setExerciseSets(updatedSets);
    
    // Update the parent with the updated exercise
    if (onExerciseUpdate) {
      onExerciseUpdate({
        ...exercise,
        exercise_sets: updatedSets
      });
    }
  };

  const updateSetNotes = (exerciseId: string | number, setId: string | number, notes: string) => {
    // For now, just store in local state since notes aren't part of ExerciseSet API
    // Could be extended to update a notes field if added to the API
    console.log('Set notes updated:', { setId, notes });
  };

  const addSet = (exerciseId: string | number) => {
    const lastSet = exerciseSets[exerciseSets.length - 1];
    
    const newExerciseSet: ExerciseSet = {
      id: Date.now(), // Temporary ID
      reps: lastSet?.reps || 0,
      intensity: lastSet?.intensity || 0,
      intensity_unit_id: currentIntensityUnit.id,
      exercise_id: exerciseId,
      rest_time_seconds: null,
      done: false,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };
    
    const updatedSets = [...exerciseSets, newExerciseSet];
    setExerciseSets(updatedSets);
    
    // Update the parent with the updated exercise
    if (onExerciseUpdate) {
      onExerciseUpdate({
        ...exercise,
        exercise_sets: updatedSets
      });
    }
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
              <h3 className="font-semibold text-rose-700">
                {exercise.exercise_type.name} 
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
          {exerciseSets.map((set, index) => (
            <div
              key={set.id}
              className={`grid gap-4 items-center p-2 rounded ${
                set.done ? "bg-green-100" : "bg-white"
              }`}
              style={{ gridTemplateColumns: "auto 60px 1fr 2fr auto" }}
            >
              <div className="font-medium">
                {getSetType(index) === "warmup" ? (
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
                      value={""}
                      onChange={(e) => updateSetNotes(exercise.id, set.id, e.target.value)}
                      className="min-h-[100px]"
                    />
                  </DialogContent>
                </Dialog>
              </div>
              <div>
                <Input
                  type="number"
                  value={set.intensity || ""}
                  onChange={(e) => updateSet(exercise.id, set.id, "weight", Number.parseInt(e.target.value) || 0)}
                  className="h-8 text-center"
                  disabled={set.done}
                />
              </div>
              <div className="flex items-center gap-1">
                <Button
                  variant="outline"
                  size="sm"
                  className="h-6 w-6 p-0 bg-transparent"
                  onClick={() => decrementReps(exercise.id, set.id)}
                  disabled={set.done}
                >
                  <Minus className="w-3 h-3" />
                </Button>
                <Input
                  type="number"
                  value={set.reps || ""}
                  onChange={(e) => updateSet(exercise.id, set.id, "reps", Number.parseInt(e.target.value) || 0)}
                  className="h-8 text-center flex-1 min-w-0"
                  disabled={set.done}
                />
                <Button
                  variant="outline"
                  size="sm"
                  className="h-6 w-6 p-0 bg-transparent"
                  onClick={() => incrementReps(exercise.id, set.id)}
                  disabled={set.done}
                >
                  <Plus className="w-3 h-3" />
                </Button>
              </div>
              <div className="flex justify-end">
                <Button
                  variant={set.done ? "default" : "outline"}
                  size="sm"
                  className={`h-8 w-8 p-0 ${set.done ? "bg-green-500 hover:bg-green-600" : ""}`}
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