import { Home, User, MessageCircle, Grid3X3 } from 'lucide-react';
import React from 'react';

export interface NavItem {
  to: string;
  key: string;
  icon: React.ComponentType<{ className?: string }>;
  label: string;
}

export const navItems: NavItem[] = [
  { to: '/workouts', key: 'workouts', icon: Home, label: 'Workouts' },
  { to: '/exercise-types', key: 'exercises', icon: Grid3X3, label: 'Exercises' },
  { to: '/profile', key: 'profile', icon: User, label: 'Profile' },
  { to: '/chat', key: 'chat', icon: MessageCircle, label: 'Chat' },
]; 