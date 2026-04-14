const ROUTINE_SHARE_UTM_SOURCE = "copy_link";

export const buildRoutineShareUrl = (currentUrl: string): string => {
  const url = new URL(currentUrl);

  url.searchParams.set("utm_source", ROUTINE_SHARE_UTM_SOURCE);

  return url.toString();
};
