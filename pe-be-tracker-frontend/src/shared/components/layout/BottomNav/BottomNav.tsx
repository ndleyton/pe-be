
import { NavLink } from "react-router-dom";
import { navItems, NavItem } from "@/shared/navigation/navItems";
import { useNavigation } from "@/shared/hooks/useNavigation";

const NavItemLink = ({ item }: { item: NavItem }) => {
  const lastVisited = useNavigation(item.key, item.to);
  const IconComponent = item.icon;

  return (
    <NavLink
      to={lastVisited}
      aria-label={item.label}
      className={({ isActive }) =>
        `flex h-full w-full flex-col items-center justify-center gap-0.5 py-2 ${
          isActive ? "text-primary" : "text-muted-foreground"
        }`
      }
    >
      <IconComponent className="h-6 w-6" />
      <span className="text-xs">{item.label}</span>
    </NavLink>
  );
};

const BottomNav = () => (
  <nav
    className="bg-background/80 fixed inset-x-0 bottom-0 z-50 flex items-center justify-around border-t backdrop-blur-md md:hidden"
    style={{ bottom: "env(safe-area-inset-bottom)" }}
    aria-label="Bottom navigation"
  >
    {navItems.map((item) => (
      <NavItemLink key={item.key} item={item} />
    ))}
  </nav>
);

export default BottomNav;
