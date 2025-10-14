import React, { useState, useMemo } from "react";
import { Search } from "lucide-react";
import { getExerciseTypes, type ExerciseType } from "@/features/exercises/api";
import { ExerciseTypeCard } from "@/features/exercises/components";
import { Button } from "@/shared/components/ui/button";
import { Input } from "@/shared/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/shared/components/ui/select";
import {
  Alert,
  AlertDescription,
  AlertTitle,
} from "@/shared/components/ui/alert";
import { useInfiniteScroll } from "@/shared/hooks";
import { Skeleton } from "@/shared/components/ui/skeleton";

const ExerciseTypesPage: React.FC = () => {
  const [searchTerm, setSearchTerm] = useState("");
  const [orderBy, setOrderBy] = useState<"usage" | "name">("usage");

  const {
    data: exerciseTypes,
    isPending,
    isFetchingNextPage,
    hasMore,
    error,
  } = useInfiniteScroll<ExerciseType>({
    queryKey: ["exerciseTypes", orderBy],
    queryFn: (cursor, limit) => getExerciseTypes(orderBy, cursor, limit),
    limit: 100,
  });

  const filteredExerciseTypes = useMemo(() => {
    if (!searchTerm) return exerciseTypes;

    return exerciseTypes.filter(
      (exerciseType) =>
        exerciseType.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (exerciseType.description &&
          exerciseType.description
            .toLowerCase()
            .includes(searchTerm.toLowerCase())),
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
    <div className="mx-auto max-w-5xl p-8 text-center">
      <div className="mx-auto max-w-4xl">
        <div className="mb-6">
          <h1 className="text-2xl font-semibold">Exercises</h1>
        </div>

        {/* Search and Filter Controls */}
        <div className="mb-8 flex flex-col gap-3 sm:flex-row">
          <div className="relative flex-1">
            <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-4">
              <Search className="text-muted-foreground h-5 w-5" />
            </div>
            <Input
              type="text"
              placeholder="Search exercises..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="border-border/30 bg-card h-12 w-full rounded-xl pl-11 shadow-sm transition-all focus:shadow-md"
            />
          </div>

          <Select
            value={orderBy}
            onValueChange={(value) => setOrderBy(value as "usage" | "name")}
          >
            <SelectTrigger className="border-border/30 bg-card h-12 w-full rounded-xl shadow-sm sm:w-[180px]">
              <SelectValue placeholder="Order By" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="usage">Most Used</SelectItem>
              <SelectItem value="name">Alphabetical</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Exercise Types Grid - Always show structure */}
        <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
          {isPending ? (
            <>
              {Array.from({ length: 9 }).map((_, i) => (
                <div
                  key={i}
                  className="bg-card border-border/20 rounded-2xl border p-6 shadow-md"
                >
                  <Skeleton className="mb-3 h-6 w-3/4" />
                  <Skeleton className="mb-2 h-4 w-full" />
                  <Skeleton className="mb-4 h-4 w-5/6" />
                  <div className="mb-4 flex gap-2">
                    <Skeleton className="h-7 w-20 rounded-full" />
                    <Skeleton className="h-7 w-28 rounded-full" />
                  </div>
                  <div className="flex justify-between">
                    <Skeleton className="h-5 w-24" />
                    <Skeleton className="h-5 w-24" />
                  </div>
                </div>
              ))}
            </>
          ) : (
            filteredExerciseTypes.map((exerciseType) => (
              <ExerciseTypeCard
                key={exerciseType.id}
                exerciseType={exerciseType}
              />
            ))
          )}
        </div>

        {/* Loading more indicator */}
        {!isPending && isFetchingNextPage && (
          <div className="flex justify-center py-8">
            <span className="loading loading-spinner loading-lg"></span>
          </div>
        )}

        {/* End of results indicator */}
        {!isPending && !hasMore && filteredExerciseTypes.length > 0 && (
          <div className="py-8 text-center">
            <span className="text-muted-foreground text-sm">
              No more exercise types to load
            </span>
          </div>
        )}

        {/* Empty State */}
        {!isPending && filteredExerciseTypes.length === 0 && (
          <div className="py-12 text-center">
            <div className="text-muted-foreground mb-4">
              {searchTerm
                ? "No exercise types found matching your search."
                : "No exercise types available."}
            </div>
            {searchTerm && (
              <Button
                onClick={() => setSearchTerm("")}
                variant="outline"
                size="sm"
              >
                Clear Search
              </Button>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default ExerciseTypesPage;
