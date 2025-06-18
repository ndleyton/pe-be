import React, { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { getExerciseTypes, createExerciseType, type ExerciseType, type CreateExerciseTypeData } from '../api/exercises';

interface ExerciseTypeModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelect: (exerciseType: ExerciseType) => void;
}

const ExerciseTypeModal: React.FC<ExerciseTypeModalProps> = ({ isOpen, onClose, onSelect }) => {
  const [searchTerm, setSearchTerm] = useState('');
  const queryClient = useQueryClient();
  
  const { data: exerciseTypes = [], isLoading, error } = useQuery({
    queryKey: ['exerciseTypes'],
    queryFn: () => getExerciseTypes('usage'), // Use usage-based ordering by default
  });
  
  const createMutation = useMutation({
    mutationFn: createExerciseType,
    onSuccess: (newExerciseType) => {
      queryClient.invalidateQueries({ queryKey: ['exerciseTypes'] });
      handleSelect(newExerciseType);
    },
  });
  
  const filteredExerciseTypes = useMemo(() => {
    if (!searchTerm.trim()) return exerciseTypes;
    const term = searchTerm.toLowerCase().trim();
    return exerciseTypes.filter(type => 
      type.name.toLowerCase().includes(term) || 
      type.description.toLowerCase().includes(term)
    );
  }, [exerciseTypes, searchTerm]);
  
  const showCreateButton = searchTerm.trim() && filteredExerciseTypes.length === 0;

  const handleSelect = (exerciseType: ExerciseType) => {
    // Optimistically update the times_used count in the cache
    queryClient.setQueryData(['exerciseTypes'], (oldData: ExerciseType[] | undefined) => {
      if (!oldData) return oldData;
      
      const updatedTypes = oldData.map(type => 
        type.id === exerciseType.id 
          ? { ...type, times_used: type.times_used + 1 }
          : type
      );
      
      // Re-sort by times_used DESC, then by name ASC to maintain the expected order
      return updatedTypes.sort((a, b) => {
        if (a.times_used !== b.times_used) {
          return b.times_used - a.times_used; // DESC
        }
        return a.name.localeCompare(b.name); // ASC
      });
    });
    
    onSelect(exerciseType);
  };
  
  const handleCreateExerciseType = () => {
    if (!searchTerm.trim()) return;
    createMutation.mutate({
      name: searchTerm.trim(),
      description: 'Custom exercise',
      default_intensity_unit: 1,
    });
  };
  
  const handleSearchKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && filteredExerciseTypes.length > 0) {
      handleSelect(filteredExerciseTypes[0]);
    } else if (e.key === 'Escape') {
      setSearchTerm('');
    }
  };

  const handleBackdropClick = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget) {
      onClose();
    }
  };

  const SkeletonCard = () => (
    <div className="bg-gray-800 rounded-lg p-4 border border-gray-600 animate-pulse">
      <div className="flex items-center space-x-3">
        <div className="w-10 h-10 bg-gray-700 rounded-lg"></div>
        <div className="flex-1">
          <div className="h-4 bg-gray-700 rounded w-3/4 mb-2"></div>
          <div className="h-3 bg-gray-700 rounded w-full"></div>
        </div>
      </div>
    </div>
  );

  const renderContent = () => {
    if (isLoading) {
      return (
        <div className="grid gap-3">
          {Array.from({ length: 5 }).map((_, index) => (
            <SkeletonCard key={index} />
          ))}
        </div>
      );
    }

    if (error) {
      return (
        <div className="text-center py-8">
          <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <span className="text-red-600 text-2xl">⚠</span>
          </div>
          <h4 className="text-white font-medium mb-2">Failed to load exercise types</h4>
          <p className="text-gray-400 text-sm">Please try again later</p>
        </div>
      );
    }

    if (exerciseTypes.length === 0) {
      return (
        <div className="text-center py-8">
          <div className="w-16 h-16 bg-gray-700 rounded-full flex items-center justify-center mx-auto mb-4">
            <span className="text-gray-400 text-2xl">💪</span>
          </div>
          <h4 className="text-white font-medium mb-2">No exercise types available</h4>
          <p className="text-gray-400 text-sm">Contact support if this persists</p>
        </div>
      );
    }

    if (searchTerm.trim() && filteredExerciseTypes.length === 0) {
      return (
        <div className="text-center py-8">
          <div className="w-16 h-16 bg-gray-700 rounded-full flex items-center justify-center mx-auto mb-4">
            <span className="text-gray-400 text-2xl">🔍</span>
          </div>
          <h4 className="text-white font-medium mb-2">No results found</h4>
          <p className="text-gray-400 text-sm">Try a different search term or create a new exercise type</p>
        </div>
      );
    }

    return (
      <div className="grid gap-3">
        {filteredExerciseTypes.map((exerciseType) => (
          <div
            key={exerciseType.id}
            onClick={() => handleSelect(exerciseType)}
            className="bg-gray-800 rounded-lg p-4 cursor-pointer hover:bg-gray-700 transition-colors border border-gray-600"
          >
            <div className="flex items-center space-x-3">
              <div className="w-10 h-10 bg-green-600 rounded-lg flex items-center justify-center">
                <span className="text-white font-bold">
                  {exerciseType.name.charAt(0)}
                </span>
              </div>
              <div className="flex-1">
                <div className="flex items-center justify-between">
                  <h4 className="text-white font-medium">{exerciseType.name}</h4>
                  {exerciseType.times_used > 0 && (
                    <span className="text-xs text-gray-400 bg-gray-700 px-2 py-1 rounded-full">
                      {exerciseType.times_used} time{exerciseType.times_used !== 1 ? 's' : ''}
                    </span>
                  )}
                </div>
                <p className="text-gray-400 text-sm mt-1">{exerciseType.description}</p>
              </div>
            </div>
          </div>
        ))}
      </div>
    );
  };

  if (!isOpen) return null;

  return (
    <div 
      className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50"
      onClick={handleBackdropClick}
    >
      <div className="bg-gray-900 rounded-lg p-6 max-w-2xl w-full max-h-96 overflow-hidden flex flex-col">
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-lg font-semibold text-white">Select Exercise Type</h3>
          <button
            onClick={onClose}
            aria-label="Close modal"
            className="text-gray-400 hover:text-white"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
        
        <div className="mb-4">
          <div className="relative">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
              <svg className="h-5 w-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
            </div>
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              onKeyDown={handleSearchKeyDown}
              placeholder="Search exercise types..."
              disabled={createMutation.isPending}
              className="block w-full pl-10 pr-12 py-2 border border-gray-600 bg-gray-800 text-white placeholder-gray-400 rounded-md focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent disabled:opacity-50"
            />
            {showCreateButton && (
              <button
                onClick={handleCreateExerciseType}
                disabled={createMutation.isPending}
                className="absolute inset-y-0 right-0 pr-3 flex items-center text-green-500 hover:text-green-400 disabled:opacity-50 disabled:cursor-not-allowed"
                title={`Create "${searchTerm.trim()}"`}
              >
                {createMutation.isPending ? (
                  <svg className="animate-spin h-5 w-5" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                ) : (
                  <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                  </svg>
                )}
              </button>
            )}
            {searchTerm && !showCreateButton && (
              <button
                onClick={() => setSearchTerm('')}
                className="absolute inset-y-0 right-0 pr-3 flex items-center text-gray-400 hover:text-white"
                title="Clear search"
              >
                <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            )}
          </div>
          {createMutation.error && (
            <p className="mt-2 text-sm text-red-400">
              Failed to create exercise type. Please try again.
            </p>
          )}
        </div>
        
        <div className="flex-1 overflow-y-auto">
          {renderContent()}
        </div>
      </div>
    </div>
  );
};

export default ExerciseTypeModal;
export type { ExerciseType };