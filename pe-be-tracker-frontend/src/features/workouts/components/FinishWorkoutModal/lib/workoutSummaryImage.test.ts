import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  buildWorkoutSummaryFilename,
  createWorkoutSummaryPng,
  createWorkoutSummaryFile,
  downloadWorkoutSummaryImage
} from "./workoutSummaryImage";
import * as htmlToImage from "html-to-image";

vi.mock("html-to-image", () => ({
  toPng: vi.fn(),
}));

describe("workoutSummaryImage helper", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("buildWorkoutSummaryFilename", () => {
    it("should return a filename with the correct format", () => {
      const date = new Date(2026, 4, 10); // May 10, 2026
      const filename = buildWorkoutSummaryFilename(date);
      // Depending on locale in test env, this might vary slightly,
      // but the helper uses "en-US" explicitly.
      expect(filename).toBe("Workout Summary May 10.png");
    });
  });

  describe("createWorkoutSummaryPng", () => {
    it("should call toPng with correct options", async () => {
      const mockNode = document.createElement("div");
      // Mock getBoundingClientRect to return non-zero size
      mockNode.getBoundingClientRect = vi.fn().mockReturnValue({
        width: 100,
        height: 100,
        top: 0,
        left: 0,
        right: 100,
        bottom: 100,
      });
      // Add node to body so getBoundingClientRect works (somewhat)
      document.body.appendChild(mockNode);

      vi.mocked(htmlToImage.toPng).mockResolvedValue("data:image/png;base64,test");

      const result = await createWorkoutSummaryPng(mockNode);

      expect(result).toBe("data:image/png;base64,test");
      expect(htmlToImage.toPng).toHaveBeenCalledWith(mockNode, expect.objectContaining({
        backgroundColor: expect.any(String),
      }));

      document.body.removeChild(mockNode);
    });
  });

  describe("createWorkoutSummaryFile", () => {
    it("should return a File object", async () => {
      const mockNode = document.createElement("div");
      mockNode.getBoundingClientRect = vi.fn().mockReturnValue({
        width: 100,
        height: 100,
        top: 0,
        left: 0,
        right: 100,
        bottom: 100,
      });
      document.body.appendChild(mockNode);
      vi.mocked(htmlToImage.toPng).mockResolvedValue("data:image/png;base64,test");

      // Mock fetch for data URL
      global.fetch = vi.fn().mockResolvedValue({
        blob: () => Promise.resolve(new Blob(["test"], { type: "image/png" })),
      });

      const file = await createWorkoutSummaryFile(mockNode, "test.png");

      expect(file).toBeInstanceOf(File);
      expect(file.name).toBe("test.png");
      expect(file.type).toBe("image/png");

      document.body.removeChild(mockNode);
    });
  });

  describe("downloadWorkoutSummaryImage", () => {
    it("should create a link and click it for data URL", () => {
      const dataUrl = "data:image/png;base64,test";
      const appendSpy = vi.spyOn(document.body, "appendChild").mockImplementation(() => ({} as any));
      const removeSpy = vi.spyOn(document.body, "removeChild").mockImplementation(() => ({} as any));

      const clickSpy = vi.fn();
      const mockLink = {
        href: "",
        download: "",
        click: clickSpy,
      };

      vi.spyOn(document, "createElement").mockImplementation((tagName) => {
        if (tagName === "a") return mockLink as any;
        return document.createElement(tagName);
      });

      downloadWorkoutSummaryImage(dataUrl, "test.png");

      expect(mockLink.href).toBe(dataUrl);
      expect(mockLink.download).toBe("test.png");
      expect(clickSpy).toHaveBeenCalled();
      expect(appendSpy).toHaveBeenCalled();
      expect(removeSpy).toHaveBeenCalled();
    });
  });
});
