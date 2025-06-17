import React, { useState } from 'react';
import { ExerciseSet, updateExerciseSet, deleteExerciseSet, UpdateExerciseSetData } from '../api/exercises';

interface ExerciseSetRowProps {
  exerciseSet: ExerciseSet;
  onUpdate: (updatedSet: ExerciseSet) => void;
  onDelete: (setId: number) => void;
}

const ExerciseSetRow: React.FC<ExerciseSetRowProps> = ({ exerciseSet, onUpdate, onDelete }) => {
  const [isEditing, setIsEditing] = useState(false);
  const [editData, setEditData] = useState<UpdateExerciseSetData>({
    reps: exerciseSet.reps || undefined,
    intensity: exerciseSet.intensity || undefined,
    rest_time_seconds: exerciseSet.rest_time_seconds || undefined,
    done: exerciseSet.done,
  });

  const handleSave = async () => {
    try {
      const updatedSet = await updateExerciseSet(exerciseSet.id, editData);
      onUpdate(updatedSet);
      setIsEditing(false);
    } catch (error) {
      console.error('Error updating exercise set:', error);
    }
  };

  const handleDelete = async () => {
    if (window.confirm('Are you sure you want to delete this set?')) {
      try {
        await deleteExerciseSet(exerciseSet.id);
        onDelete(exerciseSet.id);
      } catch (error) {
        console.error('Error deleting exercise set:', error);
      }
    }
  };

  const toggleDone = async () => {
    try {
      const updatedSet = await updateExerciseSet(exerciseSet.id, { done: !exerciseSet.done });
      onUpdate(updatedSet);
    } catch (error) {
      console.error('Error toggling done status:', error);
    }
  };

  if (isEditing) {
    return (
      <div className="bg-gray-700 border border-gray-600 rounded-lg p-3 flex items-center space-x-2">
        <input
          type="number"
          placeholder="Reps"
          value={editData.reps || ''}
          onChange={(e) => setEditData({ ...editData, reps: e.target.value ? parseInt(e.target.value) : undefined })}
          className="w-20 p-2 bg-gray-800 border border-gray-600 rounded text-white text-sm"
        />
        <input
          type="number"
          step="0.1"
          placeholder="Weight"
          value={editData.intensity || ''}
          onChange={(e) => setEditData({ ...editData, intensity: e.target.value ? parseFloat(e.target.value) : undefined })}
          className="w-24 p-2 bg-gray-800 border border-gray-600 rounded text-white text-sm"
        />
        <input
          type="number"
          placeholder="Rest (s)"
          value={editData.rest_time_seconds || ''}
          onChange={(e) => setEditData({ ...editData, rest_time_seconds: e.target.value ? parseInt(e.target.value) : undefined })}
          className="w-20 p-2 bg-gray-800 border border-gray-600 rounded text-white text-sm"
        />
        <label className="flex items-center space-x-2 text-white text-sm">
          <input
            type="checkbox"
            checked={editData.done}
            onChange={(e) => setEditData({ ...editData, done: e.target.checked })}
            className="text-blue-500"
          />
          <span>Done</span>
        </label>
        <button
          onClick={handleSave}
          className="px-3 py-1 bg-blue-600 text-white rounded text-sm hover:bg-blue-700"
        >
          Save
        </button>
        <button
          onClick={() => setIsEditing(false)}
          className="px-3 py-1 bg-gray-600 text-white rounded text-sm hover:bg-gray-700"
        >
          Cancel
        </button>
      </div>
    );
  }

  return (
    <div className={`border rounded-lg p-3 flex items-center justify-between ${
      exerciseSet.done ? 'bg-green-900/20 border-green-700' : 'bg-gray-700 border-gray-600'
    }`}>
      <div className="flex items-center space-x-4">
        <button
          onClick={toggleDone}
          className={`w-6 h-6 rounded-full border-2 flex items-center justify-center ${
            exerciseSet.done
              ? 'bg-green-600 border-green-600 text-white'
              : 'border-gray-500 hover:border-green-500'
          }`}
        >
          {exerciseSet.done && '✓'}
        </button>
        <div className="flex space-x-6 text-sm">
          <div className="text-white">
            <span className="text-gray-400">Reps:</span> {exerciseSet.reps || '-'}
          </div>
          <div className="text-white">
            <span className="text-gray-400">Weight:</span> {exerciseSet.intensity || '-'}
          </div>
          {exerciseSet.rest_time_seconds && (
            <div className="text-white">
              <span className="text-gray-400">Rest:</span> {exerciseSet.rest_time_seconds}s
            </div>
          )}
        </div>
      </div>
      <div className="flex items-center space-x-2">
        <button
          onClick={() => setIsEditing(true)}
          className="text-blue-400 hover:text-blue-300 text-sm"
        >
          Edit
        </button>
        <button
          onClick={handleDelete}
          className="text-red-400 hover:text-red-300 text-sm"
        >
          Delete
        </button>
      </div>
    </div>
  );
};

export default ExerciseSetRow;