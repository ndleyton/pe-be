import { HiOutlineHome, HiOutlineUser, HiOutlineChatBubbleLeftRight } from 'react-icons/hi2';
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
  { to: '/profile', icon: HiOutlineUser, label: 'Profile' },
  { to: '/chat', icon: HiOutlineChatBubbleLeftRight, label: 'Chat' },
]; 