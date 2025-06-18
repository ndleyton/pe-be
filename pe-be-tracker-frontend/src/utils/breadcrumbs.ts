export interface BreadcrumbItem {
  label: string;
  path?: string;
}

const pathLabels: Record<string, string> = {
  dashboard: 'Dashboard',
  workouts: 'Workouts',
  workout: 'Workout',
  profile: 'Profile',
  exercises: 'Exercises',
  settings: 'Settings',
};

export const generateBreadcrumbs = (pathname: string): BreadcrumbItem[] => {
  const segments = pathname.split('/').filter(Boolean);
  
  if (segments.length === 0) {
    return [{ label: 'Home', path: '/' }];
  }

  const breadcrumbs: BreadcrumbItem[] = [
    { label: 'Home', path: '/' }
  ];

  let currentPath = '';
  
  segments.forEach((segment, index) => {
    currentPath += `/${segment}`;
    
    // Handle dynamic segments (like workout IDs)
    if (segment.match(/^\d+$/)) {
      const parentSegment = segments[index - 1];
      if (parentSegment === 'workout') {
        breadcrumbs.push({
          label: `Workout #${segment}`,
          // Don't include path for the current page
          path: index === segments.length - 1 ? undefined : currentPath
        });
      } else {
        breadcrumbs.push({
          label: `#${segment}`,
          path: index === segments.length - 1 ? undefined : currentPath
        });
      }
    } else {
      // Regular segments
      const label = pathLabels[segment] || segment.charAt(0).toUpperCase() + segment.slice(1);
      breadcrumbs.push({
        label,
        // Don't include path for the current page
        path: index === segments.length - 1 ? undefined : currentPath
      });
    }
  });

  return breadcrumbs;
};