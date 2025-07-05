export const DEFAULT_MUSCLE_COLOR = '#E0E0E0'; // A light grey color

export const MUSCLE_GROUP_MAPPING: Record<string, string[]> = {
  'Chest': ['path55', 'path56', 'chest-upper', 'chest-lower'],
  'Back': ['latissimus', 'trapezius', 'rhomboids'],
  'Legs': ['quadriceps', 'hamstrings', 'calves', 'glutes'],
  'Shoulders': ['anterior-left-deltoid', 'anterior-right-deltoid', 'posterior-left-deltoid', 'posterior-right-deltoid', 'lateral-left-deltoid', 'lateral-right-deltoid'],
  'Arms': ['biceps', 'triceps', 'forearms'],
  'Core': ['abdominals', 'obliques'],
  // Add more mappings as needed based on your SVG IDs
};

export const getMuscleGroupColor = (intensity: number): string => {
  // Interpolate from a light blue to a royal blue
  const startR = 173; // Light blue R
  const startG = 216; // Light blue G
  const startB = 230; // Light blue B

  const endR = 65;  // Royal blue R
  const endG = 105; // Royal blue G
  const endB = 225; // Royal blue B

  const r = Math.floor(startR + (endR - startR) * intensity);
  const g = Math.floor(startG + (endG - startG) * intensity);
  const b = Math.floor(startB + (endB - startB) * intensity);

  return `rgb(${r}, ${g}, ${b})`;
};