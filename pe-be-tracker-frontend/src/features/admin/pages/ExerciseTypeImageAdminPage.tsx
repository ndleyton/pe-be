import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, Check, ImagePlus, RefreshCcw } from "lucide-react";

import {
  applyExerciseImageOption,
  generateExerciseImageOptions,
  getExerciseImageOptions,
  type ExerciseImageOption,
} from "@/features/admin/api/exerciseImageOptions";
import { useAuthStore } from "@/stores";
import { Alert, AlertDescription, AlertTitle } from "@/shared/components/ui/alert";
import { Button } from "@/shared/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/shared/components/ui/card";
import { Skeleton } from "@/shared/components/ui/skeleton";

const ImageGrid = ({
  title,
  images,
}: {
  title: string;
  images: string[];
}) => (
  <div className="space-y-3">
    <h3 className="text-sm font-medium tracking-wide uppercase">{title}</h3>
    {images.length > 0 ? (
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        {images.map((imageUrl, index) => (
          <div
            key={`${title}-${imageUrl}-${index}`}
            className="bg-muted/30 border-border/60 overflow-hidden rounded-xl border"
          >
            <img
              src={imageUrl}
              alt={`${title} ${index + 1}`}
              className="h-56 w-full object-contain"
              loading="lazy"
            />
          </div>
        ))}
      </div>
    ) : (
      <div className="text-muted-foreground border-border/60 rounded-xl border border-dashed p-6 text-sm">
        No images available.
      </div>
    )}
  </div>
);

const OptionCard = ({
  option,
  onApply,
  isApplying,
}: {
  option: ExerciseImageOption;
  onApply: (optionKey: string) => void;
  isApplying: boolean;
}) => (
  <Card className={option.is_current ? "border-primary shadow-md" : undefined}>
    <CardHeader>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="space-y-1">
          <CardTitle className="flex items-center gap-2">
            {option.label}
            {option.option_source === "phase_generated" ? (
              <span className="bg-secondary text-secondary-foreground rounded-full px-2 py-0.5 text-xs font-medium">
                No reference source
              </span>
            ) : null}
            {option.is_current ? (
              <span className="bg-primary/10 text-primary rounded-full px-2 py-0.5 text-xs font-medium">
                Live
              </span>
            ) : null}
          </CardTitle>
          <CardDescription>{option.description}</CardDescription>
        </div>
        <Button
          onClick={() => onApply(option.key)}
          disabled={option.is_current || isApplying}
        >
          {option.is_current ? (
            <>
              <Check className="mr-2 h-4 w-4" />
              Applied
            </>
          ) : (
            "Apply option"
          )}
        </Button>
      </div>
    </CardHeader>
    <CardContent>
      <ImageGrid title="Generated images" images={option.images} />
    </CardContent>
  </Card>
);

const OptionSelector = ({
  options,
  selectedKey,
  onSelect,
}: {
  options: ExerciseImageOption[];
  selectedKey: string;
  onSelect: (optionKey: string) => void;
}) => (
  <div className="space-y-3">
    <div>
      <h3 className="text-sm font-medium tracking-wide uppercase">
        Choose a generated style
      </h3>
      <p className="text-muted-foreground text-sm">
        Switch between the generated reference styles and apply the one you want live.
      </p>
    </div>
    <div className="flex flex-wrap gap-3">
      {options.map((option) => {
        const isSelected = option.key === selectedKey;

        return (
          <Button
            key={option.key}
            type="button"
            variant={isSelected ? "default" : "outline"}
            aria-pressed={isSelected}
            onClick={() => onSelect(option.key)}
            className="h-auto min-h-16 max-w-full justify-start px-4 py-3 text-left"
          >
            <span className="flex flex-col items-start gap-1">
              <span className="flex flex-wrap items-center gap-2">
                <span>{option.label}</span>
                {option.is_current ? (
                  <span className="bg-background/70 text-foreground rounded-full px-2 py-0.5 text-[11px] font-medium">
                    Live
                  </span>
                ) : null}
                {option.option_source === "phase_generated" ? (
                  <span className="bg-background/70 text-foreground rounded-full px-2 py-0.5 text-[11px] font-medium">
                    Fallback
                  </span>
                ) : null}
              </span>
              <span className="text-current/80 line-clamp-2 text-xs font-normal">
                {option.description}
              </span>
            </span>
          </Button>
        );
      })}
    </div>
  </div>
);

const LoadingState = () => (
  <div className="mx-auto max-w-6xl space-y-6 p-4 md:p-6 lg:p-8">
    <Skeleton className="h-8 w-72" />
    <Skeleton className="h-24 w-full rounded-xl" />
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
      <Skeleton className="h-96 w-full rounded-xl" />
      <Skeleton className="h-96 w-full rounded-xl" />
    </div>
    <Skeleton className="h-96 w-full rounded-xl" />
  </div>
);

const ExerciseTypeImageAdminPage = () => {
  const { exerciseTypeId } = useParams<{ exerciseTypeId: string }>();
  const user = useAuthStore((state) => state.user);
  const initialized = useAuthStore((state) => state.initialized);
  const isAdmin = Boolean(user?.is_superuser);
  const queryClient = useQueryClient();
  const [selectedOptionKey, setSelectedOptionKey] = useState<string | null>(null);

  const optionsQuery = useQuery({
    queryKey: ["adminExerciseImageOptions", exerciseTypeId],
    queryFn: () => getExerciseImageOptions(exerciseTypeId!),
    enabled: initialized && isAdmin && !!exerciseTypeId,
    retry: false,
  });

  const generateMutation = useMutation({
    mutationFn: () => generateExerciseImageOptions(exerciseTypeId!),
    onSuccess: (data) => {
      queryClient.setQueryData(["adminExerciseImageOptions", exerciseTypeId], data);
      queryClient.invalidateQueries({
        queryKey: ["exerciseType", exerciseTypeId],
      });
    },
  });

  const applyMutation = useMutation({
    mutationFn: (selection: { option_key?: string; use_reference?: boolean }) =>
      applyExerciseImageOption(exerciseTypeId!, selection),
    onSuccess: (data) => {
      queryClient.setQueryData(["adminExerciseImageOptions", exerciseTypeId], data);
      queryClient.invalidateQueries({
        queryKey: ["exerciseType", exerciseTypeId],
      });
    },
  });

  const data = optionsQuery.data;
  const selectedOption =
    data?.options.find((option) => option.key === selectedOptionKey) ??
    data?.options[0] ??
    null;

  useEffect(() => {
    if (!data?.options.length) {
      if (selectedOptionKey !== null) {
        setSelectedOptionKey(null);
      }
      return;
    }

    if (!selectedOption) {
      setSelectedOptionKey(data.options[0].key);
    }
  }, [data, selectedOption, selectedOptionKey]);

  if (!initialized) {
    return <LoadingState />;
  }

  if (!isAdmin) {
    return (
      <div className="mx-auto max-w-4xl p-4 md:p-6 lg:p-8">
        <Alert variant="warning">
          <AlertTitle>Admin access required</AlertTitle>
          <AlertDescription>
            This screen is only available to superusers.
          </AlertDescription>
        </Alert>
      </div>
    );
  }

  if (optionsQuery.isLoading) {
    return <LoadingState />;
  }

  if (optionsQuery.isError || !data) {
    return (
      <div className="mx-auto max-w-4xl p-4 md:p-6 lg:p-8">
        <Alert variant="destructive">
          <AlertTitle>Could not load image options</AlertTitle>
          <AlertDescription>
            Try again in a moment. If the problem persists, check the admin API response.
          </AlertDescription>
        </Alert>
      </div>
    );
  }

  const hasReferenceSource = data.supports_revert_to_reference;
  const headerDescription = hasReferenceSource
    ? "Generate reference-based replacements, compare option sets, and choose which set becomes the live exercise imagery."
    : "This exercise has no preserved reference images. Generating options will create a fallback phase pair for the start/eccentric and end/concentric positions.";
  const generationErrorDescription = hasReferenceSource
    ? "The reference pipeline could not create image options for this exercise."
    : "The phase fallback pipeline could not create images for this exercise.";
  const emptyOptionsDescription = hasReferenceSource
    ? "Run the reference pipeline to create candidate replacements from the preserved source images."
    : "Generate a fallback phase pair to create the first image set for this exercise.";

  return (
    <div className="mx-auto max-w-6xl space-y-6 p-4 md:p-6 lg:p-8">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="space-y-2">
          <Button variant="ghost" asChild className="px-0">
            <Link to={`/exercise-types/${exerciseTypeId}`}>
              <ArrowLeft className="mr-2 h-4 w-4" />
              Back to exercise
            </Link>
          </Button>
          <div>
            <h1 className="text-3xl font-semibold tracking-tight">
              {data.exercise_name} image options
            </h1>
            <p className="text-muted-foreground max-w-2xl text-sm">
              {headerDescription}
            </p>
          </div>
        </div>
        <Button
          onClick={() => generateMutation.mutate()}
          disabled={generateMutation.isPending}
          className="min-w-44"
        >
          {generateMutation.isPending ? (
            <>
              <RefreshCcw className="mr-2 h-4 w-4 animate-spin" />
              Generating
            </>
          ) : (
            <>
              <ImagePlus className="mr-2 h-4 w-4" />
              Generate options
            </>
          )}
        </Button>
      </div>

      {generateMutation.isError ? (
        <Alert variant="destructive">
          <AlertTitle>Generation failed</AlertTitle>
          <AlertDescription>{generationErrorDescription}</AlertDescription>
        </Alert>
      ) : null}

      {applyMutation.isError ? (
        <Alert variant="destructive">
          <AlertTitle>Apply failed</AlertTitle>
          <AlertDescription>
            The selected option could not be applied to the exercise type.
          </AlertDescription>
        </Alert>
      ) : null}

      <Card>
        <CardHeader>
          <CardTitle>Current live set</CardTitle>
          <CardDescription>
            These are the images the product currently serves for this exercise type.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ImageGrid title="Live images" images={data.current_images} />
        </CardContent>
      </Card>

      {hasReferenceSource ? (
        <Card>
          <CardHeader>
            <CardTitle>Reference source set</CardTitle>
            <CardDescription>
              This source set is preserved so regenerated options stay anchored to the original
              library imagery even after you switch the live set.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <ImageGrid title="Reference images" images={data.reference_images} />
          </CardContent>
          <CardFooter>
            <Button
              variant="outline"
              onClick={() => applyMutation.mutate({ use_reference: true })}
              disabled={applyMutation.isPending}
            >
              Revert live set to reference
            </Button>
          </CardFooter>
        </Card>
      ) : (
        <Card>
          <CardHeader>
            <CardTitle>No reference source set</CardTitle>
            <CardDescription>
              This exercise does not have preserved source imagery yet. The fallback generator
              creates a two-image phase pair instead of redrawing an existing set.
            </CardDescription>
          </CardHeader>
        </Card>
      )}

      {data.options.length > 0 ? (
        <div className="space-y-4">
          <div>
            <h2 className="text-2xl font-semibold tracking-tight">Generated options</h2>
            <p className="text-muted-foreground text-sm">
              The pipeline is idempotent. Re-running generation returns existing options for
              the same reference inputs and prompt version.
            </p>
          </div>
          {selectedOption ? (
            <>
              <OptionSelector
                options={data.options}
                selectedKey={selectedOption.key}
                onSelect={setSelectedOptionKey}
              />
              <OptionCard
                key={selectedOption.key}
                option={selectedOption}
                onApply={(optionKey) => applyMutation.mutate({ option_key: optionKey })}
                isApplying={applyMutation.isPending}
              />
            </>
          ) : null}
        </div>
      ) : (
        <Card>
          <CardHeader>
            <CardTitle>No generated options yet</CardTitle>
            <CardDescription>{emptyOptionsDescription}</CardDescription>
          </CardHeader>
        </Card>
      )}
    </div>
  );
};

export default ExerciseTypeImageAdminPage;
