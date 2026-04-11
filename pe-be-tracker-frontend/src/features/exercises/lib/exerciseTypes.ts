export const normalizeExerciseTypeName = (name: string) =>
  name.trim().toLowerCase();

export const getDefaultExerciseTypeUnit = (name: string) => {
  const normalizedName = normalizeExerciseTypeName(name);
  const cardioKeywords = [
    "walking",
    "running",
    "cycling",
    "swimming",
    "treadmill",
    "rowing",
    "elliptical",
    "jogging",
  ];

  return cardioKeywords.some((keyword) => normalizedName.includes(keyword))
    ? 3
    : 1;
};
