import { Home, User, MessageCircle, Grid3X3, Dumbbell } from 'lucide-react';
import React from 'react';

export interface NavItem {
  to: string;
  icon: React.ComponentType<{ className?: string }>;
  label: string;
}

export const navItems: NavItem[] = [
  { to: '/dashboard', icon: Home, label: 'Home' },
  { to: '/workouts', icon: Dumbbell, label: 'Workouts' },
  { to: '/exercise-types', icon: Grid3X3, label: 'Exercises' },
  { to: '/profile', icon: User, label: 'Profile' },
  { to: '/chat', icon: MessageCircle, label: 'Chat' },
]; 