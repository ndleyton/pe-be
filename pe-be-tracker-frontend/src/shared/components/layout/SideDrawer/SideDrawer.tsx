
import { NavLink } from "react-router-dom";
import { useUIStore, useAuthStore } from "@/stores";
import { navItems } from "@/shared/navigation/navItems";
import { Button } from "@/shared/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/shared/components/ui/sheet";
import { useGoogleSignIn } from "@/features/auth/hooks";

const SideDrawer = () => {
  const isOpen = useUIStore((state) => state.isDrawerOpen);
  const closeDrawer = useUIStore((state) => state.closeDrawer);
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);
  const initialized = useAuthStore((state) => state.initialized);
  const signOut = useAuthStore((state) => state.signOut);
  const googleSignIn = useGoogleSignIn();

  return (
    <Sheet open={isOpen} onOpenChange={closeDrawer}>
      <SheetContent
        side="left"
        className="bg-background flex w-64 flex-col p-4"
      >
        <SheetHeader>
          <SheetTitle className="text-lg font-semibold">Menu</SheetTitle>
          <SheetDescription className="sr-only">
            Navigation menu
          </SheetDescription>
        </SheetHeader>
        <nav
          className="mt-6 flex-1 overflow-y-auto"
          aria-label="Secondary navigation"
        >
          <ul className="space-y-2">
            {navItems.map((item) => {
              const Icon = item.icon;
              return (
                <li key={item.to}>
                  <NavLink
                    to={item.to}
                    onClick={closeDrawer}
                    className={({ isActive }) =>
                      `flex items-center space-x-3 rounded-lg p-3 transition-colors ${
                        isActive
                          ? "bg-primary text-primary-foreground"
                          : "text-muted-foreground hover:bg-accent hover:text-accent-foreground"
                      }`
                    }
                  >
                    <Icon className="h-5 w-5" />
                    <span>{item.label}</span>
                  </NavLink>
                </li>
              );
            })}
          </ul>
        </nav>
        <div className="mt-auto border-t pt-4">
          <div className="space-y-2">
            {isAuthenticated ? (
              <>
                <NavLink to="/about" className="w-full">
                  <Button
                    variant="ghost"
                    className="w-full justify-start"
                    onClick={closeDrawer}
                  >
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
