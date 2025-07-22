export const DEFAULT_MUSCLE_COLOR = '#E0E0E0'; // A light grey color

export const MUSCLE_GROUP_MAPPING: Record<string, string[]> = {
  'Chest': [
    'anterior-left-pectoralis',
    'anterior-right-pectoralis'
  ],
  'Back': [
    'posterior-left-shoulder',
    'posterior-right-shoulder'
  ],
  'Shoulders': [
    'anterior-left-deltoid',
    'anterior-right-deltoid',
    'posterior-left-shoulder',
    'posterior-right-shoulder'
  ],
  'Arms': [
    // Biceps
    'anterior-left-bicep',
    'anterior-right-bicep',
    // Triceps
    'anterior-left-triceps',
    'anterior-right-triceps',
    'posterior-left-triceps-1',
    'posterior-left-triceps-2'
  ],
  'Forearms': [
    'anterior-left-forearm-1',
    'anterior-left-forearm-2',
    'anterior-right-forearm-1',
    'anterior-right-forearm-2',
    'anterior-left-brachialis',
    'anterior-right-brachialis',
    'posterior-left-forearm-1',
    'posterior-left-forearm-2',
    'posterior-left-brachialis'
  ],
  'Core': [
    'anterior-left-abs-1',
    'anterior-left-abs-2',
    'anterior-left-abs-3',
    'anterior-left-abs-4',
    'anterior-right-abs-1',
    'anterior-right-abs-2',
    'anterior-right-abs-3',
    'anterior-right-abs-4',
    'anterior-abs-1'
  ],
  'Legs': [
    // Quadriceps
    'anterior-left-quadriceps-1',
    'anterior-left-quadriceps-2',
    'anterior-left-quadriceps-3',
    'anterior-right-quadriceps-1',
    'anterior-right-quadriceps-2',
    'anterior-right-quadriceps-3',
    'posterior-left-quadriceps-1',
    'posterior-left-quadriceps-2',
    'posterior-right-quadriceps-1',
    'posterior-right-quadriceps-2',
    // Hamstrings
    'posterior-left-hamstrings-1',
    'posterior-left-hamstrings-2',
    'posterior-right-hamstrings-1',
    'posterior-right-hamstrings-2',
    // Adductors
    'anterior-left-adductors',
    'anterior-right-adductors',
    // Calves
    'anterior-left-calves-1',
    'anterior-left-calves-2',
    'anterior-right-calves-1',
    'anterior-right-calves-2',
    'posterior-left-calves-1',
    'posterior-left-calves-2',
    'posterior-right-calves-1',
    'posterior-right-calves-2'
  ],
  'Glutes': [
    'posterior-left-glute',
    'posterior-right-glute'
  ],
  'Neck': [
    'anterior-left-neck',
    'anterior-right-neck'
  ]
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