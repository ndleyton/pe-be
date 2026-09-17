const DASH_SUFFIX_REGEX = /^(.+?)\s+[-–—]\s+(.+)$/;
const PAREN_SUFFIX_REGEX = /^([^()]+?)\s*\(([^()]+)\)$/;

/** Only separate explicit suffixes; never infer equipment, grip, or stance. */
export function parseExerciseName(name: string) {
  const suffix = name.match(DASH_SUFFIX_REGEX)
    ?? name.match(PAREN_SUFFIX_REGEX);

  if (!suffix || !suffix[1].trim() || !suffix[2].trim()) {
    return { baseName: name, variation: null };
  }

  return { baseName: suffix[1].trim(), variation: suffix[2].trim() };
}
