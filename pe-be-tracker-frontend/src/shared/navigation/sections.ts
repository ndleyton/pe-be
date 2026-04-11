import { NAV_KEYS, NAV_PATHS, type NavKey } from "./constants";

export interface NavigationSection {
  key: NavKey;
  rootPath: string;
  matchesPath: (pathname: string) => boolean;
  isRootPath: (pathname: string) => boolean;
  sanitizePath: (pathname?: string | null) => string;
}

const matchesPrefix = (pathname: string, prefix: string) =>
  pathname === prefix || pathname.startsWith(`${prefix}/`);

const createSection = ({
  key,
  rootPath,
  prefixes = [rootPath],
}: {
  key: NavKey;
  rootPath: string;
  prefixes?: string[];
}): NavigationSection => ({
  key,
  rootPath,
  matchesPath: (pathname) => prefixes.some((prefix) => matchesPrefix(pathname, prefix)),
  isRootPath: (pathname) => pathname === rootPath,
  sanitizePath: (pathname) =>
    pathname && prefixes.some((prefix) => matchesPrefix(pathname, prefix))
      ? pathname
      : rootPath,
});

export const navigationSections: NavigationSection[] = [
  createSection({
    key: NAV_KEYS.WORKOUTS,
    rootPath: NAV_PATHS.WORKOUTS,
  }),
  createSection({
    key: NAV_KEYS.ROUTINES,
    rootPath: NAV_PATHS.ROUTINES,
  }),
  createSection({
    key: NAV_KEYS.EXERCISES,
    rootPath: NAV_PATHS.EXERCISES,
  }),
  createSection({
    key: NAV_KEYS.CHAT,
    rootPath: NAV_PATHS.CHAT,
  }),
  createSection({
    key: NAV_KEYS.PROFILE,
    rootPath: NAV_PATHS.PROFILE,
  }),
];

export const getNavigationSectionByKey = (navKey: NavKey) =>
  navigationSections.find((section) => section.key === navKey);

export const getNavigationSectionForPath = (pathname: string) =>
  navigationSections.find((section) => section.matchesPath(pathname)) ?? null;
