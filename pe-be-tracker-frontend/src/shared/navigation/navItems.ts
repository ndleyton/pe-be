import { BookOpen, Home, User, MessageCircle, Search } from "lucide-react";
import type { ComponentType } from "react";
import { NAV_KEYS, NAV_PATHS, type NavKey } from "./constants";

export interface NavItem {
  to: string;
  key: NavKey;
  icon: ComponentType<{ className?: string }>;
  label: string;
}

export const navItems: NavItem[] = [
  {
    to: NAV_PATHS.WORKOUTS,
    key: NAV_KEYS.WORKOUTS,
    icon: Home,
    label: "Workouts",
  },
  {
    to: NAV_PATHS.ROUTINES,
    key: NAV_KEYS.ROUTINES,
    icon: BookOpen,
    label: "Routines",
  },
  {
    to: NAV_PATHS.EXERCISES,
    key: NAV_KEYS.EXERCISES,
    icon: Search,
    label: "Exercises",
  },
  {
    to: NAV_PATHS.CHAT,
    key: NAV_KEYS.CHAT,
    icon: MessageCircle,
    label: "Chat",
  },
  {
    to: NAV_PATHS.PROFILE,
    key: NAV_KEYS.PROFILE,
    icon: User,
    label: "Profile",
  },
];
