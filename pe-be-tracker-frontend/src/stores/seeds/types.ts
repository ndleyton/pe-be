// Types and helpers used by seed modules

export type ExerciseTypeIds = {
  pushUps: string;
  squats: string;
  benchPress: string;
  deadlift: string;
  pullUps: string;
  barbellRows: string;
  latPulldowns: string;
  facePulls: string;
  bicepCurls: string;
  hammerCurls: string;
  overheadPress: string;
  dips: string;
  inclineBenchPress: string;
  tricepExtensions: string;
  lateralRaises: string;
  bulgarianSplitSquats: string;
  romanianDeadlifts: string;
  walkingLunges: string;
  legPress: string;
  calfRaises: string;
  legCurls: string;
  legExtensions: string;
};

export const generateExerciseTypeIds = (
  generateId: () => string
): ExerciseTypeIds => ({
  pushUps: generateId(),
  squats: generateId(),
  benchPress: generateId(),
  deadlift: generateId(),
  pullUps: generateId(),
  barbellRows: generateId(),
  latPulldowns: generateId(),
  facePulls: generateId(),
  bicepCurls: generateId(),
  hammerCurls: generateId(),
  overheadPress: generateId(),
  dips: generateId(),
  inclineBenchPress: generateId(),
  tricepExtensions: generateId(),
  lateralRaises: generateId(),
  bulgarianSplitSquats: generateId(),
  romanianDeadlifts: generateId(),
  walkingLunges: generateId(),
  legPress: generateId(),
  calfRaises: generateId(),
  legCurls: generateId(),
  legExtensions: generateId(),
});
