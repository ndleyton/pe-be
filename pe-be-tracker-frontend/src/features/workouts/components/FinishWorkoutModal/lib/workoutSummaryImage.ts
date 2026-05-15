import { toPng } from "html-to-image";

const LAYOUT_STABILIZATION_DELAY_MS = 50;
const DEFAULT_DEVICE_PIXEL_RATIO_FALLBACK = 1;
const MIN_EXPORT_PIXEL_RATIO = 2;
const DEFAULT_EXPORT_BACKGROUND = "#ffffff";
const DATE_LABEL_LOCALE = "en-US";
const DATE_LABEL_OPTIONS: Intl.DateTimeFormatOptions = {
  month: "short",
  day: "2-digit",
};

export function buildWorkoutSummaryFilename(date = new Date()): string {
  const label = new Intl.DateTimeFormat(
    DATE_LABEL_LOCALE,
    DATE_LABEL_OPTIONS,
  ).format(date);
  return `Workout Summary ${label}.png`;
}

async function prepareNodeForExport(node: HTMLElement): Promise<string> {
  // Ensure layout and any async assets are fully ready
  await new Promise(requestAnimationFrame);
  await new Promise(requestAnimationFrame);
  await new Promise((resolve) =>
    setTimeout(resolve, LAYOUT_STABILIZATION_DELAY_MS),
  );

  const rect = node.getBoundingClientRect();
  if (rect.width === 0 || rect.height === 0) {
    throw new Error("Share area has zero size");
  }

  // Ensure fonts are loaded to prevent baseline/centering shifts
  if ("fonts" in document && (document as any).fonts?.ready) {
    await (document as any).fonts.ready;
  }

  // Resolve background to match Tailwind's bg-background (theme-aware)
  let resolvedBackground: string | undefined;
  try {
    const nodeBg = window.getComputedStyle(node).backgroundColor;
    if (
      nodeBg &&
      nodeBg !== "rgba(0, 0, 0, 0)" &&
      nodeBg !== "transparent"
    ) {
      resolvedBackground = nodeBg;
    } else {
      const rootStyles = window.getComputedStyle(document.documentElement);
      const varBg = rootStyles.getPropertyValue("--background").trim();
      if (varBg) {
        resolvedBackground = varBg;
      }
    }
  } catch (error) {
    console.warn(
      "Could not resolve computed background color; defaulting to white.",
      error,
    );
  }

  return resolvedBackground || DEFAULT_EXPORT_BACKGROUND;
}

export async function createWorkoutSummaryPng(node: HTMLElement): Promise<string> {
  const backgroundColor = await prepareNodeForExport(node);

  return toPng(node, {
    backgroundColor,
    filter: (domNode) =>
      !(domNode instanceof Element) ||
      domNode.getAttribute("data-export-ignore") !== "true",
    pixelRatio: Math.max(
      window.devicePixelRatio || DEFAULT_DEVICE_PIXEL_RATIO_FALLBACK,
      MIN_EXPORT_PIXEL_RATIO,
    ),
  });
}

export async function createWorkoutSummaryFile(
  node: HTMLElement,
  filename?: string,
): Promise<File> {
  const dataUrl = await createWorkoutSummaryPng(node);
  const res = await fetch(dataUrl);
  const blob = await res.blob();
  return new File([blob], filename || buildWorkoutSummaryFilename(), {
    type: "image/png",
  });
}

export function downloadWorkoutSummaryImage(
  fileOrDataUrl: File | string,
  filename?: string,
): void {
  const isFile = fileOrDataUrl instanceof File;
  const url = isFile ? URL.createObjectURL(fileOrDataUrl) : fileOrDataUrl;
  const name = filename || (isFile ? fileOrDataUrl.name : buildWorkoutSummaryFilename());

  const link = document.createElement("a");
  link.href = url;
  link.download = name;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);

  if (isFile) {
    URL.revokeObjectURL(url);
  }
}
