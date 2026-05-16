import { describe, expect, it, vi } from "vitest";

import {
  calculateResizedDimensions,
  prepareWorkoutPhotoFile,
} from "./workoutPhotoPreparation";

describe("calculateResizedDimensions", () => {
  it("scales the longest edge down while preserving aspect ratio", () => {
    expect(calculateResizedDimensions(8000, 6000, 1600)).toEqual({
      width: 1600,
      height: 1200,
      resized: true,
    });
  });

  it("keeps dimensions that are already within the target edge", () => {
    expect(calculateResizedDimensions(1024, 768, 1600)).toEqual({
      width: 1024,
      height: 768,
      resized: false,
    });
  });
});

describe("prepareWorkoutPhotoFile", () => {
  const imageSource = {} as CanvasImageSource;

  it("downscales and re-encodes large photos before upload", async () => {
    const close = vi.fn();
    const drawImage = vi.fn();
    const toBlob = vi.fn().mockResolvedValue(
      new Blob(["prepared"], {
        type: "image/webp",
      }),
    );
    const original = new File(["original-original"], "progress.jpg", {
      type: "image/jpeg",
      lastModified: 123,
    });

    const prepared = await prepareWorkoutPhotoFile(original, {
      maxEdgePx: 1600,
      loadImage: async () => ({
        source: imageSource,
        width: 8000,
        height: 6000,
        close,
      }),
      createCanvas: (width, height) => {
        expect(width).toBe(1600);
        expect(height).toBe(1200);
        return { drawImage, toBlob };
      },
    });

    expect(prepared).not.toBe(original);
    expect(prepared.name).toBe("progress.webp");
    expect(prepared.type).toBe("image/webp");
    expect(prepared.lastModified).toBe(123);
    expect(drawImage).toHaveBeenCalledWith(imageSource);
    expect(toBlob).toHaveBeenCalledWith("image/webp", 0.82);
    expect(close).toHaveBeenCalled();
  });

  it("keeps the original when re-encoding would make an unresized image larger", async () => {
    const original = new File(["small"], "small.png", { type: "image/png" });

    const prepared = await prepareWorkoutPhotoFile(original, {
      maxEdgePx: 1600,
      loadImage: async () => ({
        source: imageSource,
        width: 100,
        height: 100,
      }),
      createCanvas: () => ({
        drawImage: vi.fn(),
        toBlob: vi.fn().mockResolvedValue(
          new Blob(["larger-than-original"], {
            type: "image/webp",
          }),
        ),
      }),
    });

    expect(prepared).toBe(original);
  });

  it("falls back to jpeg when webp export is unavailable", async () => {
    const original = new File(["original-original"], "progress.png", {
      type: "image/png",
    });
    const toBlob = vi
      .fn()
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce(new Blob(["jpeg"], { type: "image/jpeg" }));

    const prepared = await prepareWorkoutPhotoFile(original, {
      maxEdgePx: 1600,
      loadImage: async () => ({
        source: imageSource,
        width: 3200,
        height: 1600,
      }),
      createCanvas: () => ({
        drawImage: vi.fn(),
        toBlob,
      }),
    });

    expect(prepared).not.toBe(original);
    expect(prepared.name).toBe("progress.jpg");
    expect(prepared.type).toBe("image/jpeg");
    expect(toBlob).toHaveBeenNthCalledWith(1, "image/webp", 0.82);
    expect(toBlob).toHaveBeenNthCalledWith(2, "image/jpeg", 0.82);
  });

  it("keeps unsupported image types on the existing backend validation path", async () => {
    const loadImage = vi.fn();
    const original = new File(["gif"], "progress.gif", { type: "image/gif" });

    const prepared = await prepareWorkoutPhotoFile(original, { loadImage });

    expect(prepared).toBe(original);
    expect(loadImage).not.toHaveBeenCalled();
  });
});
