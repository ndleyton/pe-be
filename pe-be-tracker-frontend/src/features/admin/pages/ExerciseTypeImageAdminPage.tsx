import { useEffect, useState } from "react";
import axios from "axios";
import { useParams } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, Check, ImagePlus, RefreshCcw } from "lucide-react";

import {
  applyExerciseImageOption,
  type ExerciseImageAvailableOption,
  generateExerciseImageOptions,
  getExerciseImageOptions,
  type ExerciseImageOption,
} from "@/features/admin/api/exerciseImageOptions";
import { useAuthStore } from "@/stores";
import { useAppBackNavigation } from "@/shared/hooks/useAppBackNavigation";
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
  options: Array<
    ExerciseImageAvailableOption & {
      is_current?: boolean;
    }
  >;
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
            className="h-auto max-w-full justify-start px-4 py-3 text-left"
          >
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
  const handleBack = useAppBackNavigation(
    exerciseTypeId ? `/exercise-types/${exerciseTypeId}` : "/exercise-types",
  );
  const user = useAuthStore((state) => state.user);
  const initialized = useAuthStore((state) => state.initialized);
  const isAdmin = Boolean(user?.is_superuser);
  const queryClient = useQueryClient();
  const [selectedOptionKey, setSelectedOptionKey] = useState<string | null>(null);
  const [generationErrorMessage, setGenerationErrorMessage] = useState<string | null>(
    null,
  );

  const optionsQuery = useQuery({
    queryKey: ["adminExerciseImageOptions", exerciseTypeId],
    queryFn: () => getExerciseImageOptions(exerciseTypeId!),
    enabled: initialized && isAdmin && !!exerciseTypeId,
    retry: false,
  });

  const generateMutation = useMutation({
    mutationFn: (selection?: { option_key?: string }) =>
      generateExerciseImageOptions(exerciseTypeId!, selection),
    onMutate: () => {
      setGenerationErrorMessage(null);
    },
    onSuccess: (data, variables) => {
      queryClient.setQueryData(["adminExerciseImageOptions", exerciseTypeId], data);
      queryClient.invalidateQueries({
        queryKey: ["exerciseType", exerciseTypeId],
      });
      if (
        data.supports_revert_to_reference &&
        variables?.option_key &&
        !data.options.some((option) => option.key === variables.option_key)
      ) {
        const matchingOption = data.available_options.find(
          (option) => option.key === variables.option_key,
        );
        setGenerationErrorMessage(
          `Generation completed, but no preview images were returned for ${
            matchingOption?.label ?? variables.option_key
          }.`,
        );
      }
    },
    onError: (error) => {
      if (
        axios.isAxiosError(error) &&
        typeof error.response?.data?.detail === "string"
      ) {
        setGenerationErrorMessage(error.response.data.detail);
        return;
      }
      setGenerationErrorMessage("The selected image option could not be generated.");
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
  const selectedGenerationOption =
    data?.available_options.find((option) => option.key === selectedOptionKey) ??
    data?.available_options[0] ??
    null;
  const selectedOption =
    data?.options.find((option) => option.key === selectedGenerationOption?.key) ?? null;
  const selectorOptions =
    data?.available_options.map((option) => ({
      ...option,
      is_current: data.options.find((generated) => generated.key === option.key)?.is_current,
    })) ?? [];

  useEffect(() => {
    if (!data?.available_options.length) {
      if (selectedOptionKey !== null) {
        setSelectedOptionKey(null);
      }
      return;
    }

    if (!selectedGenerationOption) {
      setSelectedOptionKey(data.available_options[0].key);
    }
  }, [data, selectedGenerationOption, selectedOptionKey]);

  const selectedOptionDescription =
    selectedGenerationOption?.description ?? "Choose a generation style.";
  const selectedGenerationLabel =
    selectedGenerationOption?.label ?? "the selected style";

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
  const emptyOptionsDescription = hasReferenceSource
    ? "Run the reference pipeline to create candidate replacements from the preserved source images."
    : "Generate a fallback phase pair to create the first image set for this exercise.";

  return (
    <div className="mx-auto max-w-6xl space-y-6 p-4 md:p-6 lg:p-8">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="space-y-2">
          <Button variant="ghost" className="px-0" onClick={handleBack}>
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to exercise
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
          onClick={() =>
            generateMutation.mutate(
              hasReferenceSource && selectedGenerationOption
                ? { option_key: selectedGenerationOption.key }
                : undefined,
            )
          }
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
              {hasReferenceSource && selectedGenerationOption
                ? `Generate ${selectedGenerationOption.label}`
                : "Generate options"}
            </>
          )}
        </Button>
      </div>

      {generationErrorMessage ? (
        <Alert variant="destructive">
          <AlertTitle>Generation failed</AlertTitle>
          <AlertDescription>{generationErrorMessage}</AlertDescription>
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

      {hasReferenceSource && selectorOptions.length > 0 ? (
        <Card>
          <CardHeader>
            <CardTitle>Generation style</CardTitle>
            <CardDescription>
              Choose which reference option spec to generate next.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {selectedGenerationOption ? (
              <OptionSelector
                options={selectorOptions}
                selectedKey={selectedGenerationOption.key}
                onSelect={setSelectedOptionKey}
              />
            ) : null}
            <p className="text-muted-foreground text-sm">
              {selectedOptionDescription}
            </p>
          </CardContent>
        </Card>
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
            <OptionCard
              key={selectedOption.key}
              option={selectedOption}
              onApply={(optionKey) => applyMutation.mutate({ option_key: optionKey })}
              isApplying={applyMutation.isPending}
            />
          ) : selectedGenerationOption ? (
            <Card>
              <CardHeader>
                <CardTitle>{selectedGenerationOption.label} has not been generated yet</CardTitle>
                <CardDescription>
                  Generate {selectedGenerationLabel} to preview it and make it available to apply.
                </CardDescription>
              </CardHeader>
            </Card>
          ) : null}
        </div>
      ) : (
        <Card>
          <CardHeader>
            <CardTitle>No generated options yet</CardTitle>
            <CardDescription>
              {selectedGenerationOption
                ? `${emptyOptionsDescription} The selected style is ${selectedGenerationOption.label}.`
                : emptyOptionsDescription}
            </CardDescription>
          </CardHeader>
        </Card>
      )}
    </div>
  );
};

export default ExerciseTypeImageAdminPage;
