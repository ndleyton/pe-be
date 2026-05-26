import { Moon, Sun, Zap } from "lucide-react";
import { Button } from "@/shared/components/ui/button";
import { useTheme } from "@/shared/components/theme/theme-provider";

export function ModeToggle() {
  const { setTheme, theme } = useTheme();

  const cycleTheme = () => {
    if (theme === "light") {
      setTheme("dark");
    } else if (theme === "dark") {
      setTheme("energetic");
    } else {
      setTheme("light");
    }
  };

  return (
    <Button variant="glass" size="icon" onClick={cycleTheme} className="rounded-xl" title="Change theme">
      {theme === "light" && <Sun className="h-[1.2rem] w-[1.2rem]" />}
      {theme === "dark" && <Moon className="h-[1.2rem] w-[1.2rem]" />}
      {theme === "energetic" && <Zap className="h-[1.2rem] w-[1.2rem] text-primary" />}
      {theme === "system" && <Sun className="h-[1.2rem] w-[1.2rem] opacity-70" />}
      <span className="sr-only">Toggle theme</span>
    </Button>
  );
}
