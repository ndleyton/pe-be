export const MUSCLE_GROUP_MAPPING: Record<string, string[]> = {
  'Chest': ['pectorals', 'chest-upper', 'chest-lower'],
  'Back': ['latissimus', 'trapezius', 'rhomboids'],
  'Legs': ['quadriceps', 'hamstrings', 'calves', 'glutes'],
  'Shoulders': ['anterior-deltoid', 'posterior-deltoid', 'lateral-deltoid'],
  'Arms': ['biceps', 'triceps', 'forearms'],
  'Core': ['abdominals', 'obliques'],
  // Add more mappings as needed based on your SVG IDs
};

export const getMuscleGroupColor = (intensity: number): string => {
  // This function will return a color based on the intensity (0-1)
  // You can define your gradient here. For example, from light blue to dark blue.
  const r = Math.floor(0 + (100 * intensity));
  const g = Math.floor(150 + (100 * intensity));
  const b = Math.floor(255 - (100 * intensity));
  return `rgb(${r}, ${g}, ${b})`;
};