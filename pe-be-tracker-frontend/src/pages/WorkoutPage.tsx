import React from 'react';
import { useParams } from 'react-router-dom';
import ExerciseForm from '../components/ExerciseForm';

const WorkoutPage: React.FC = () => {
  const { workoutId } = useParams<{ workoutId: string }>();

  // Placeholder: implement exercise list and refresh logic in the future
  const handleExerciseCreated = () => {
    // TODO: Fetch and display exercises for this workout
  };

  return (
    <div className="max-w-2xl mx-auto p-6 bg-gray-900 text-gray-100 rounded-lg shadow-lg mt-8">
      <h1 className="text-2xl font-bold mb-6">Log Exercises for Workout #{workoutId}</h1>
      <ExerciseForm workoutId={workoutId!} onExerciseCreated={handleExerciseCreated} />
      {/* TODO: Render list of exercises and ExerciseSet logging UI here */}
      <p>This is where you can add exercises and sets for this workout.</p>
    </div>
  );
};

export default WorkoutPage;
