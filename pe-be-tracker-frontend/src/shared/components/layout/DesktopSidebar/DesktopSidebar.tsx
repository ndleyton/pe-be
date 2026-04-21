import { Link, NavLink } from "react-router-dom";
import { useAuthStore } from "@/stores";
import { navItems, NavItem } from "@/shared/navigation/navItems";
import { Button } from "@/shared/components/ui/button";
import { Skeleton } from "@/shared/components/ui/skeleton";
import HomeLogo from "../HomeLogo";
import { useGoogleSignIn } from "@/features/auth/hooks";
import { useHomeNavigation, useNavigation } from "@/shared/hooks";
import FirstWorkoutCTA from "../FirstWorkoutCTA";

const NavItemLink = ({ item }: { item: NavItem }) => {
  const { href, isActive, handleClick } = useNavigation(item.key);
  const IconComponent = item.icon;

  return (
    <Link
      to={href}
      onClick={handleClick}
      className={`flex items-center rounded-lg px-4 py-3 text-sm font-medium transition-colors duration-200 ${
        isActive
          ? "bg-primary text-primary-foreground"
          : "text-muted-foreground hover:bg-accent hover:text-accent-foreground"
      }`}
    >
      <IconComponent className="mr-3 h-5 w-5" />
      {item.label}
    </Link>
  );
};

const DesktopSidebar = () => {
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);
  const initialized = useAuthStore((state) => state.initialized);
  const signOut = useAuthStore((state) => state.signOut);
  const googleSignIn = useGoogleSignIn();
  const { href, handleClick } = useHomeNavigation();

  return (
    <aside className="lg:bg-background hidden lg:fixed lg:inset-y-0 lg:left-0 lg:flex lg:w-64 lg:flex-col lg:border-r">
      <div className="flex min-h-0 flex-1 flex-col">
        <div className="flex h-16 items-center border-b px-6">
          <Link
            to={href}
            onClick={handleClick}
            aria-label="Go to workouts"
            className="rounded-md focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none"
          >
            <HomeLogo />
          </Link>
        </div>
        <nav
          className="flex-1 space-y-2 px-4 py-6"
          aria-label="Sidebar navigation"
        >
          {navItems.map((item) => (
            <NavItemLink key={item.key} item={item} />
          ))}
        </nav>
        <div className="px-4 py-2">
          <FirstWorkoutCTA />
        </div>
        <div className="border-t p-4">
          <div className="space-y-2">
            <NavLink to="/about" className="w-full">
              <Button variant="ghost" className="w-full justify-start">
                About
              </Button>
            </NavLink>
            <div className="min-h-9">
              {isAuthenticated ? (
                <Button
                  variant="destructive"
                  className="w-full justify-start"
                  onClick={signOut}
                >
                  Sign Out
                </Button>
              ) : initialized ? (
                <Button onClick={googleSignIn} className="w-full">
                  Sign In with Google
                </Button>
              ) : (
                <Skeleton className="h-9 w-full" />
              )}
            </div>
          </div>
        </div>
      </div>
    </aside>
  );
};

export default DesktopSidebar;
