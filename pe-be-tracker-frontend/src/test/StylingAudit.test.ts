import { describe, it, expect } from "vitest";
import fs from "fs";
import path from "path";

/**
 * This test audits the codebase for hardcoded Tailwind colors (e.g., text-rose-500, bg-blue-400).
 * Standardizing on semantic theme variables (primary, secondary, accent, highlight, etc.)
 * ensures the application is compatible with future theming.
 */
describe("Styling Standardization Audit", () => {
  const srcPath = path.resolve(__dirname, "..");

  // List of hardcoded colors to avoid
  const forbiddenColors = [
    "rose", "pink", "fuchsia", "purple", "violet", "indigo", "blue",
    "sky", "cyan", "teal", "emerald", "green", "lime", "yellow",
    "amber", "orange", "red"
  ];

  // Regex to match patterns like 'text-rose-500', 'bg-blue-400/50', etc.
  const colorPattern = new RegExp(
    `(text|bg|border|ring|fill|stroke)-(${forbiddenColors.join("|")})-\\d+`,
    "g"
  );

  /**
   * Recursively get all .ts and .tsx files in a directory
   */
  const getFiles = (dir: string): string[] => {
    const files: string[] = [];
    const items = fs.readdirSync(dir, { withFileTypes: true });

    for (const item of items) {
      const fullPath = path.join(dir, item.name);
      if (item.isDirectory()) {
        // Skip test directories and node_modules
        if (item.name !== "test" && item.name !== "__tests__" && item.name !== "node_modules") {
          files.push(...getFiles(fullPath));
        }
      } else if (
        (item.name.endsWith(".ts") || item.name.endsWith(".tsx")) &&
        !/\.(test|spec)\.(ts|tsx)$/.test(item.name)
      ) {
        files.push(fullPath);
      }
    }

    return files;
  };

  it("should not contain hardcoded color classes in components", () => {
    const files = getFiles(srcPath);
    const violations: string[] = [];

    for (const file of files) {
      const content = fs.readFileSync(file, "utf8");
      const matches = content.match(colorPattern);

      if (matches) {
        // Extract unique matches for this file
        const uniqueMatches = Array.from(new Set(matches));
        const relativePath = path.relative(srcPath, file);
        violations.push(`${relativePath}: ${uniqueMatches.join(", ")}`);
      }
    }

    if (violations.length > 0) {
      const failureMessage = `Found ${violations.length} files with hardcoded colors:\n\n${violations.join("\n")}\n\n` +
        `Please use semantic theme variables (e.g., primary, secondary, accent, highlight, activity, destructive) ` +
        `instead of hardcoded Tailwind colors.`;

      expect(violations.length, failureMessage).toBe(0);
    }
  });
});
