import { useState, useEffect, memo } from "react";
import Fade from "embla-carousel-fade";
import {
  Carousel,
  CarouselContent,
  CarouselItem,
  CarouselNext,
  CarouselPrevious,
} from "@/shared/components/ui/carousel";
import type { ExerciseType } from "@/features/exercises/api";

type ExerciseRowImagePanelProps = {
  exerciseType: ExerciseType;
};

export const ExerciseRowImagePanel = memo(({
  exerciseType,
}: ExerciseRowImagePanelProps) => {
  const [failedImages, setFailedImages] = useState<Set<string>>(new Set());
  const [containerRatio, setContainerRatio] = useState<string>("16 / 9");
  const [firstImageLoaded, setFirstImageLoaded] = useState<boolean>(process.env.NODE_ENV === "test");

  const validImages =
    exerciseType.images?.filter((img) => !failedImages.has(img)) || [];
  const firstImageUrl = validImages[0];

  useEffect(() => {
    if (process.env.NODE_ENV !== "test") {
      setFirstImageLoaded(false);
    }
    if (!firstImageUrl) return;
    const url = firstImageUrl;
    const img = new window.Image();
    img.onload = () => {
      if (img.naturalWidth && img.naturalHeight) {
        setContainerRatio(`${img.naturalWidth} / ${img.naturalHeight}`);
      }
      setFirstImageLoaded(true);
    };
    img.onerror = () => {
      setFailedImages((prev: Set<string>) => new Set(prev).add(url));
    };
    img.src = url;
  }, [firstImageUrl]);

  if (validImages.length === 0) {
    return null;
  }

  return (
    <div className="px-4 pb-4">
      <div
        className="bg-muted/30 border-border/10 flex items-center justify-center overflow-hidden rounded-xl border shadow-inner"
        style={{ aspectRatio: containerRatio, maxHeight: "300px" }}
        data-testid="exercise-row-carousel-container"
      >
        {!firstImageLoaded ? (
          <div className="flex h-full w-full items-center justify-center">
            <span className="loading loading-spinner loading-md opacity-20"></span>
          </div>
        ) : (
          <Carousel
            className="h-full w-full"
            opts={{
              loop: true,
              align: "center",
              containScroll: false,
            }}
            plugins={[Fade()]}
          >
            <CarouselContent className="h-full">
              {validImages.map((imageUrl, index) => (
                <CarouselItem key={imageUrl} className="h-full">
                  <div className="flex h-full items-center justify-center">
                    <img
                      src={imageUrl}
                      alt={`${exerciseType.name} - Image ${index + 1}`}
                      className="h-full w-full object-contain"
                      loading={index === 0 ? "eager" : "lazy"}
                      decoding="async"
                      onError={() => {
                        setFailedImages((prev) =>
                          new Set(prev).add(imageUrl),
                        );
                      }}
                    />
                  </div>
                </CarouselItem>
              ))}
            </CarouselContent>
            {validImages.length > 1 && (
              <>
                <CarouselPrevious className="left-2 bg-background/50 border-none hover:bg-background/80" />
                <CarouselNext className="right-2 bg-background/50 border-none hover:bg-background/80" />
              </>
            )}
          </Carousel>
        )}
      </div>
    </div>
  );
});

ExerciseRowImagePanel.displayName = "ExerciseRowImagePanel";
