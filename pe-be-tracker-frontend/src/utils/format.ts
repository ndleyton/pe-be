/**
 * Format a numeric value for display, removing unnecessary trailing zeros
 * and showing integers without decimal points
 */
export const formatDecimal = (
  value: number | string | null | undefined,
): string => {
  if (value === null || value === undefined || value === "") {
    return "-";
  }

  const num = typeof value === "string" ? parseFloat(value) : value;

  if (isNaN(num) || num === 0) {
    return "-";
  }

  if (num % 1 === 0) {
    return num.toString();
  }

  return num.toString().replace(/\.?0+$/, "");
};

/**
 * Parse a decimal input string, handling comma decimals and edge cases
 */
export const parseDecimalInput = (input: string): number | null => {
  const normalized = input.trim().replace(/,/g, ".");

  if (
    normalized === "" ||
    normalized === "." ||
    normalized === "-" ||
    normalized === "-."
  ) {
    return null;
  }

  const parsed = parseFloat(normalized);
  return isNaN(parsed) ? null : parsed;
};
