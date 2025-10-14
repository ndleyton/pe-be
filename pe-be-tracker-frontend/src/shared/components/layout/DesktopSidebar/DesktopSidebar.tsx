
import { NavLink } from "react-router-dom";
import { useAuthStore } from "@/stores";
import { navItems, NavItem } from "@/shared/navigation/navItems";
import { Button } from "@/shared/components/ui/button";
import HomeLogo from "../HomeLogo";
import { useGoogleSignIn } from "@/features/auth/hooks";
import { useNavigation } from "@/shared/hooks/useNavigation";

const NavItemLink = ({ item }: { item: NavItem }) => {
  const lastVisited = useNavigation(item.key, item.to);
  const IconComponent = item.icon;

  return (
    <NavLink
      to={lastVisited}
      className={({ isActive }) =>
        `flex items-center rounded-lg px-4 py-3 text-sm font-medium transition-colors duration-200 ${
          isActive
            ? "bg-primary text-primary-foreground"
            : "text-muted-foreground hover:bg-accent hover:text-accent-foreground"
        }`
      }
    >
      <IconComponent className="mr-3 h-5 w-5" />
      {item.label}
    </NavLink>
  );
};

const DesktopSidebar = () => {
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);
  const initialized = useAuthStore((state) => state.initialized);
  const signOut = useAuthStore((state) => state.signOut);
  const googleSignIn = useGoogleSignIn();

  return (
    <aside className="lg:bg-background hidden lg:fixed lg:inset-y-0 lg:left-0 lg:flex lg:w-64 lg:flex-col lg:border-r">
      <div className="flex min-h-0 flex-1 flex-col">
        <div className="flex h-16 items-center border-b px-6">
          <HomeLogo />
        </div>
        <nav
          className="flex-1 space-y-2 px-4 py-6"
          aria-label="Sidebar navigation"
        >
          {navItems.map((item) => (
            <NavItemLink key={item.key} item={item} />
          ))}
        </nav>
        <div className="border-t p-4">
          {isAuthenticated ? (
            <div className="space-y-2">
              <NavLink to="/about" className="w-full">
                <Button variant="ghost" className="w-full justify-start">
                  About
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
          ) : initialized ? (
            <Button onClick={googleSignIn} className="w-full">
              Sign In with Google
            </Button>
          ) : null}
        </div>
      </div>
    </aside>
  );
};

export default DesktopSidebar;
