import { Home, User, MessageCircle, Grid3X3 } from 'lucide-react';
import React from 'react';
import { NAV_KEYS, NAV_PATHS, type NavKey } from './constants';

export interface NavItem {
  to: string;
  key: NavKey;
  icon: React.ComponentType<{ className?: string }>;
  label: string;
}

export const navItems: NavItem[] = [
  { to: NAV_PATHS.WORKOUTS, key: NAV_KEYS.WORKOUTS, icon: Home, label: 'Workouts' },
  { to: NAV_PATHS.EXERCISES, key: NAV_KEYS.EXERCISES, icon: Grid3X3, label: 'Exercises' },
  { to: NAV_PATHS.PROFILE, key: NAV_KEYS.PROFILE, icon: User, label: 'Profile' },
  { to: NAV_PATHS.CHAT, key: NAV_KEYS.CHAT, icon: MessageCircle, label: 'Chat' },
]; 