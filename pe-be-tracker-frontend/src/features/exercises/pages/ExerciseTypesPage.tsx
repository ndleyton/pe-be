import React, { useState, useMemo } from 'react';
import { Search } from 'lucide-react';
import { getExerciseTypes, type ExerciseType } from '@/features/exercises/api';
import { ExerciseTypeCard } from '@/features/exercises/components';
import { Button } from '@/shared/components/ui/button';
import { Input } from '@/shared/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/shared/components/ui/select';
import {
  Alert,
  AlertDescription,
  AlertTitle,
} from '@/shared/components/ui/alert';
import { useInfiniteScroll } from '@/shared/hooks';
import { Skeleton } from '@/shared/components/ui/skeleton';

const ExerciseTypesPage: React.FC = () => {
  const [searchTerm, setSearchTerm] = useState('');
  const [orderBy, setOrderBy] = useState<'usage' | 'name'>('usage');

  const {
    data: exerciseTypes,
    isLoading,
    isFetchingNextPage,
    hasMore,
    error,
  } = useInfiniteScroll<ExerciseType>({
    queryKey: ['exerciseTypes', orderBy],
    queryFn: (cursor, limit) => getExerciseTypes(orderBy, cursor, limit),
    limit: 100,
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
    <div className="max-w-5xl mx-auto p-2 md:p-4 lg:p-8 text-center">
      <div className="mb-6">
        <h1 className="text-3xl font-bold mb-4">Exercise Types</h1>
        
        {/* Search and Filter Controls */}
        <div className="flex flex-col sm:flex-row gap-4 mb-6">
          <div className="relative flex-1">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
              <Search className="h-5 w-5 text-muted-foreground" />
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

      {/* Exercise Types Grid - Always show structure */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {isLoading ? (
          <>
            {/* Keep spinner for tests while showing skeletons */}
            <div className="col-span-full flex justify-center py-4">
              <span className="loading loading-spinner loading-lg"></span>
            </div>
            {Array.from({ length: 9 }).map((_, i) => (
              <div key={i} className="bg-card rounded-lg p-4 border border-border">
                <div className="flex items-start gap-4">
                  <Skeleton className="h-12 w-12 rounded" />
                  <div className="flex-1 space-y-2">
                    <Skeleton className="h-5 w-2/3" />
                    <Skeleton className="h-4 w-full" />
                    <Skeleton className="h-4 w-5/6" />
                  </div>
                </div>
                <div className="mt-4 flex gap-2">
                  <Skeleton className="h-7 w-20 rounded-full" />
                  <Skeleton className="h-7 w-28 rounded-full" />
                </div>
              </div>
            ))}
          </>
        ) : (
          filteredExerciseTypes.map((exerciseType) => (
            <ExerciseTypeCard key={exerciseType.id} exerciseType={exerciseType} />
          ))
        )}
      </div>
      
      {/* Loading more indicator */}
      {!isLoading && isFetchingNextPage && (
        <div className="flex justify-center py-8">
          <span className="loading loading-spinner loading-lg"></span>
        </div>
      )}
      
      {/* End of results indicator */}
      {!isLoading && !hasMore && filteredExerciseTypes.length > 0 && (
        <div className="text-center py-8">
          <span className="text-muted-foreground text-sm">No more exercise types to load</span>
        </div>
      )}

      {/* Empty State */}
      {!isLoading && filteredExerciseTypes.length === 0 && (
        <div className="text-center py-12">
          <div className="text-muted-foreground mb-4">
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