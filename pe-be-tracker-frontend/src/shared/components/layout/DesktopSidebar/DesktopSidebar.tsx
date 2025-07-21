import React from 'react';
import { NavLink } from 'react-router-dom';
import { useAuth } from '@/hooks';
import { navItems } from '@/shared/navigation/navItems';
import { Button } from '@/components/ui/button';
import HomeLogo from '../HomeLogo';
import { useGoogleSignIn } from '@/features/auth/hooks';

const DesktopSidebar: React.FC = () => {
  // Temporarily disabled to fix infinite loop
  // const { isAuthenticated, signOut } = useAuth();
  const isAuthenticated = () => false;
  const signOut = async () => {};
  const googleSignIn = useGoogleSignIn();

  return (
    <aside className="hidden lg:flex lg:flex-col lg:w-64 lg:fixed lg:inset-y-0 lg:left-0 lg:bg-background lg:border-r">
      <div className="flex flex-col flex-1 min-h-0">
        <div className="flex items-center h-16 px-6 border-b">
          <HomeLogo />
        </div>
        <nav className="flex-1 px-4 py-6 space-y-2" aria-label="Sidebar navigation">
          {navItems.map((item) => {
            const IconComponent = item.icon;
            return (
              <NavLink
                key={item.to}
                to={item.to}
                className={({ isActive }) =>
                  `flex items-center px-4 py-3 text-sm font-medium rounded-lg transition-colors duration-200 ${
                    isActive
                      ? 'bg-primary text-primary-foreground'
                      : 'text-muted-foreground hover:bg-accent hover:text-accent-foreground'
                  }`
                }
              >
                <IconComponent className="w-5 h-5 mr-3" />
                {item.label}
              </NavLink>
            );
          })}
        </nav>
        <div className="p-4 border-t">
          {isAuthenticated() ? (
            <div className="space-y-2">
              <NavLink to="/settings" className="w-full">
                <Button variant="ghost" className="w-full justify-start">
                  Settings
                </Button>
              </NavLink>
              <Button
                variant="destructive"
                className="w-full justify-start"
                onClick={signOut}
              >
                Sign Out
              </Button>
            </div>
          ) : (
            <Button onClick={googleSignIn} className="w-full">
              Sign In with Google
            </Button>
          )}
        </div>
      </div>
    </aside>
  );
};

export default DesktopSidebar; 