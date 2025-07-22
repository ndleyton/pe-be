import { Home, User, MessageCircle, Grid3X3 } from 'lucide-react';
import React from 'react';

export interface NavItem {
  to: string;
  icon: React.ComponentType<{ className?: string }>;
  label: string;
}

export const navItems: NavItem[] = [
  { to: '/dashboard', icon: Home, label: 'Dashboard' },
  { to: '/exercise-types', icon: Grid3X3, label: 'Exercises' },
  { to: '/profile', icon: User, label: 'Profile' },
  { to: '/chat', icon: MessageCircle, label: 'Chat' },
]; 