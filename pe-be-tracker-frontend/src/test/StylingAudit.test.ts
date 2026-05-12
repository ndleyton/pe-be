import { describe, it, expect } from "vitest";
import { execSync } from "child_process";
import path from "path";

/**
 * This test audits the codebase for hardcoded Tailwind colors (e.g., text-rose-500, bg-blue-400).
 * Standardizing on semantic theme variables (primary, secondary, accent, etc.) ensures
 * the application is compatible with future theming.
 */
describe("Styling Standardization Audit", () => {
  const srcPath = path.resolve(__dirname, "..");

  // List of hardcoded colors to avoid (excluding gray/neutral tones which are often used for structural elements)
  // but even those should ideally be mapped to 'muted', 'border', etc.
  const forbiddenColors = [
    "rose", "pink", "fuchsia", "purple", "violet", "indigo", "blue",
    "sky", "cyan", "teal", "emerald", "green", "lime", "yellow",
    "amber", "orange", "red"
  ];

  it("should not contain hardcoded color classes in components", () => {
    // Search for patterns like 'text-rose-', 'bg-blue-', etc.
    // We use grep to find these in .tsx and .ts files
    const pattern = forbiddenColors.map(color => `(text|bg|border|ring|fill|stroke)-${color}-`).join("|");

    try {
      // Grep for the pattern, excluding node_modules and test files themselves
      const command = `grep -rE "${pattern}" "${srcPath}" --include="*.tsx" --include="*.ts" --exclude-dir="test" --exclude="StylingAudit.test.ts"`;
      const output = execSync(command, { encoding: "utf8" });

      if (output) {
        const lines = output.trim().split("\n");
        const failureMessage = `Found ${lines.length} instances of hardcoded colors:\n${output}`;
        expect(lines.length, failureMessage).toBe(0);
      }
    } catch (error: any) {
      // grep returns exit code 1 if no matches are found, which is what we want
      if (error.status === 1) {
        return;
      }
      throw error;
    }
  });
});
