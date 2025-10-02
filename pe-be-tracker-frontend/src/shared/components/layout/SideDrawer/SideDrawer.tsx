import React from 'react';
import { NavLink } from 'react-router-dom';
import { useUIStore, useAuthStore } from '@/stores';
import { navItems } from '@/shared/navigation/navItems';
import { Button } from '@/shared/components/ui/button';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/shared/components/ui/sheet";
import { useGoogleSignIn } from '@/features/auth/hooks';

const SideDrawer: React.FC = () => {
  const isOpen = useUIStore(state => state.isDrawerOpen);
  const closeDrawer = useUIStore(state => state.closeDrawer);
  const isAuthenticated = useAuthStore(state => state.isAuthenticated);
  const initialized = useAuthStore(state => state.initialized);
  const signOut = useAuthStore(state => state.signOut);
  const googleSignIn = useGoogleSignIn();

  return (
    <Sheet open={isOpen} onOpenChange={closeDrawer}>
      <SheetContent side="left" className="w-64 bg-background p-4 flex flex-col">
        <SheetHeader>
          <SheetTitle className="text-lg font-semibold">Navigation</SheetTitle>
          <SheetDescription>
            Navigate between different sections of the application
          </SheetDescription>
        </SheetHeader>
        <nav className="flex-1 overflow-y-auto mt-6" aria-label="Secondary navigation">
          <ul className="space-y-2">
            {navItems.map((item) => {
              const Icon = item.icon;
              return (
                <li key={item.to}>
                  <NavLink
                    to={item.to}
                    onClick={closeDrawer}
                    className={({ isActive }) =>
                      `flex items-center space-x-3 p-3 rounded-lg transition-colors ${
                        isActive
                          ? 'bg-primary text-primary-foreground'
                          : 'text-muted-foreground hover:bg-accent hover:text-accent-foreground'
                      }`
                    }
                  >
                    <Icon className="w-5 h-5" />
                    <span>{item.label}</span>
                  </NavLink>
                </li>
              );
            })}
          </ul>
        </nav>
        <div className="mt-auto pt-4 border-t">
          <div className="space-y-2">
            {isAuthenticated ? (
              <>
                <NavLink to="/about" className="w-full">
                  <Button variant="ghost" className="w-full justify-start" onClick={closeDrawer}>
                    About
                  </Button>
                </NavLink>
                <Button
                  variant="destructive"
                  className="w-full justify-start"
                  onClick={() => {
                    closeDrawer();
                    signOut();
                  }}
                >
                  Sign Out
                </Button>
              </>
            ) : initialized ? (
              <Button onClick={googleSignIn} className="w-full">
                Sign In with Google
              </Button>
            ) : null}
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
};

export default SideDrawer;
