const DEFAULT_MAX_EDGE_PX = 1600;
const DEFAULT_QUALITY = 0.82;
const PREFERRED_OUTPUT_MIME_TYPE = "image/webp";
const FALLBACK_OUTPUT_MIME_TYPE = "image/jpeg";

type LoadedImage = {
  source: CanvasImageSource;
  width: number;
  height: number;
  close?: () => void;
};

type CanvasExporter = {
  drawImage: (image: CanvasImageSource) => void;
  toBlob: (mimeType: string, quality: number) => Promise<Blob | null>;
};

type PrepareWorkoutPhotoOptions = {
  maxEdgePx?: number;
  quality?: number;
  loadImage?: (file: File) => Promise<LoadedImage>;
  createCanvas?: (width: number, height: number) => CanvasExporter;
};

const SKIPPED_INPUT_MIME_TYPES = new Set(["image/gif", "image/svg+xml"]);

const shouldPrepareImage = (file: File): boolean =>
  file.type.startsWith("image/") && !SKIPPED_INPUT_MIME_TYPES.has(file.type);

export const calculateResizedDimensions = (
  width: number,
  height: number,
  maxEdgePx: number,
): { width: number; height: number; resized: boolean } => {
  if (width <= 0 || height <= 0 || maxEdgePx <= 0) {
    return { width, height, resized: false };
  }

  const longestEdge = Math.max(width, height);
  if (longestEdge <= maxEdgePx) {
    return { width, height, resized: false };
  }

  const scale = maxEdgePx / longestEdge;
  return {
    width: Math.max(1, Math.round(width * scale)),
    height: Math.max(1, Math.round(height * scale)),
    resized: true,
  };
};

const extensionForMimeType = (mimeType: string): string =>
  mimeType === FALLBACK_OUTPUT_MIME_TYPE ? "jpg" : "webp";

const filenameWithExtension = (filename: string, mimeType: string): string => {
  const extension = extensionForMimeType(mimeType);
  const baseName = filename.replace(/\.[^.]*$/, "");
  return `${baseName || "workout-photo"}.${extension}`;
};

const createPreparedFile = (
  blob: Blob,
  originalFile: File,
  mimeType: string,
): File =>
  new File([blob], filenameWithExtension(originalFile.name, mimeType), {
    type: mimeType,
    lastModified: originalFile.lastModified,
  });

const exportCanvas = async (
  canvas: CanvasExporter,
  mimeType: string,
  quality: number,
): Promise<{ blob: Blob; mimeType: string } | null> => {
  const blob = await canvas.toBlob(mimeType, quality);
  if (!blob) {
    return null;
  }

  const blobMimeType = blob.type || mimeType;
  if (blobMimeType !== mimeType) {
    return null;
  }

  return { blob, mimeType };
};

const createBrowserCanvas = (width: number, height: number): CanvasExporter => {
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;

  const context = canvas.getContext("2d");
  if (!context || typeof canvas.toBlob !== "function") {
    throw new Error("Canvas image export is unavailable.");
  }

  return {
    drawImage: (image) => {
      context.drawImage(image, 0, 0, width, height);
    },
    toBlob: (mimeType, quality) =>
      new Promise((resolve) => {
        canvas.toBlob(resolve, mimeType, quality);
      }),
  };
};

const loadImageBitmap = async (file: File): Promise<LoadedImage | null> => {
  if (typeof createImageBitmap !== "function") {
    return null;
  }

  const bitmap = await createImageBitmap(file);
  return {
    source: bitmap,
    width: bitmap.width,
    height: bitmap.height,
    close: () => bitmap.close(),
  };
};

const loadHtmlImage = async (file: File): Promise<LoadedImage | null> => {
  if (
    typeof Image !== "function" ||
    typeof HTMLImageElement === "undefined" ||
    typeof HTMLImageElement.prototype.decode !== "function" ||
    typeof URL.createObjectURL !== "function"
  ) {
    return null;
  }

  const objectUrl = URL.createObjectURL(file);
  const image = new Image();
  image.decoding = "async";
  image.src = objectUrl;

  try {
    await image.decode();
    return {
      source: image,
      width: image.naturalWidth || image.width,
      height: image.naturalHeight || image.height,
      close: () => URL.revokeObjectURL(objectUrl),
    };
  } catch (error) {
    URL.revokeObjectURL(objectUrl);
    throw error;
  }
};

const loadBrowserImage = async (file: File): Promise<LoadedImage> => {
  const bitmap = await loadImageBitmap(file);
  if (bitmap) {
    return bitmap;
  }

  const image = await loadHtmlImage(file);
  if (image) {
    return image;
  }

  throw new Error("Browser image decoding is unavailable.");
};

export const prepareWorkoutPhotoFile = async (
  file: File,
  options: PrepareWorkoutPhotoOptions = {},
): Promise<File> => {
  if (!shouldPrepareImage(file)) {
    return file;
  }

  const maxEdgePx = options.maxEdgePx ?? DEFAULT_MAX_EDGE_PX;
  const quality = options.quality ?? DEFAULT_QUALITY;
  let loadedImage: LoadedImage | null = null;

  try {
    loadedImage = await (options.loadImage ?? loadBrowserImage)(file);
    const dimensions = calculateResizedDimensions(
      loadedImage.width,
      loadedImage.height,
      maxEdgePx,
    );
    if (dimensions.width <= 0 || dimensions.height <= 0) {
      return file;
    }

    const createCanvas = options.createCanvas ?? createBrowserCanvas;
    const canvas = createCanvas(dimensions.width, dimensions.height);
    canvas.drawImage(loadedImage.source);

    const exported =
      (await exportCanvas(canvas, PREFERRED_OUTPUT_MIME_TYPE, quality)) ??
      (await exportCanvas(canvas, FALLBACK_OUTPUT_MIME_TYPE, quality));
    if (!exported) {
      return file;
    }

    const preparedFile = createPreparedFile(
      exported.blob,
      file,
      exported.mimeType,
    );

    if (!dimensions.resized && preparedFile.size >= file.size) {
      return file;
    }

    return preparedFile;
  } catch {
    return file;
  } finally {
    loadedImage?.close?.();
  }
};
