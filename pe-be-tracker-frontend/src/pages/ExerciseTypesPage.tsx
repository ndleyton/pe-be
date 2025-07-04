import React, { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Search } from 'lucide-react';
import { getExerciseTypes, type ExerciseType } from '@/api/exercises';
import { ExerciseTypeCard } from '@/features/exercises/components';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Alert,
  AlertDescription,
  AlertTitle,
} from '@/components/ui/alert';

const ExerciseTypesPage: React.FC = () => {
  const [searchTerm, setSearchTerm] = useState('');
  const [orderBy, setOrderBy] = useState<'usage' | 'name'>('usage');

  const { data: exerciseTypes = [], isLoading, error } = useQuery({
    queryKey: ['exerciseTypes', orderBy],
    queryFn: () => getExerciseTypes(orderBy),
  });

  const filteredExerciseTypes = useMemo(() => {
    if (!searchTerm) return exerciseTypes;
    
    return exerciseTypes.filter((exerciseType) =>
      exerciseType.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (exerciseType.description && exerciseType.description.toLowerCase().includes(searchTerm.toLowerCase()))
    );
  }, [exerciseTypes, searchTerm]);

  if (error) {
    return (
      <div className="container mx-auto px-4 py-6">
        <Alert variant="destructive">
          <AlertTitle>Error</AlertTitle>
          <AlertDescription>
            Error loading exercise types. Please try again.
          </AlertDescription>
        </Alert>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-6">
      <div className="mb-6">
        <h1 className="text-3xl font-bold mb-4">Exercise Types</h1>
        
        {/* Search and Filter Controls */}
        <div className="flex flex-col sm:flex-row gap-4 mb-6">
          <div className="relative flex-1">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
              <Search className="h-5 w-5 text-gray-400" />
            </div>
            <Input
              type="text"
              placeholder="Search exercise types..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10"
            />
          </div>
          
          <Select
            value={orderBy}
            onValueChange={(value) => setOrderBy(value as 'usage' | 'name')}
          >
            <SelectTrigger className="w-full sm:w-auto">
              <SelectValue placeholder="Order By" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="usage">Most Used</SelectItem>
              <SelectItem value="name">Alphabetical</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Loading State */}
      {isLoading && (
        <div className="flex justify-center py-8">
          <span className="loading loading-spinner loading-lg"></span>
        </div>
      )}

      {/* Exercise Types Grid */}
      {!isLoading && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredExerciseTypes.map((exerciseType) => (
            <ExerciseTypeCard key={exerciseType.id} exerciseType={exerciseType} />
          ))}
        </div>
      )}

      {/* Empty State */}
      {!isLoading && filteredExerciseTypes.length === 0 && (
        <div className="text-center py-12">
          <div className="text-gray-500 mb-4">
            {searchTerm ? 'No exercise types found matching your search.' : 'No exercise types available.'}
          </div>
          {searchTerm && (
            <Button
              onClick={() => setSearchTerm('')}
              variant="outline"
              size="sm"
            >
              Clear Search
            </Button>
          )}
        </div>
      )}
    </div>
  );
};

export default ExerciseTypesPage;