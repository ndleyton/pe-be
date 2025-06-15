export const toUTCISOString = (local: string): string => {
  // If value already ends with 'Z' or contains timezone info, return as ISO directly.
  if (!local) return '';
  if (/Z$/i.test(local) || /[+-]\d{2}:?\d{2}$/.test(local)) {
    return new Date(local).toISOString();
  }

  // Append 'Z' to treat as UTC and preserve the local time digits.
  // Ensure seconds component exists (HTML datetime-local omits seconds).
  const normalized = local.length === 16 ? `${local}:00Z` : `${local}Z`;
  return new Date(normalized).toISOString();
}; 