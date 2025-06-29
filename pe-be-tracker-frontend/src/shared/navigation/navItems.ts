import { HiOutlineHome, HiOutlineUser, HiOutlineChatBubbleLeftRight, HiOutlineRectangleGroup } from 'react-icons/hi2';
import { IoFitnessOutline } from 'react-icons/io5';
import React from 'react';

export interface NavItem {
  to: string;
  icon: React.ComponentType<{ className?: string }>;
  label: string;
}

export const navItems: NavItem[] = [
  { to: '/dashboard', icon: HiOutlineHome, label: 'Home' },
  { to: '/workouts', icon: IoFitnessOutline, label: 'Workouts' },
  { to: '/exercise-types', icon: HiOutlineRectangleGroup, label: 'Exercises' },
  { to: '/profile', icon: HiOutlineUser, label: 'Profile' },
  { to: '/chat', icon: HiOutlineChatBubbleLeftRight, label: 'Chat' },
]; 