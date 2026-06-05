import { Flame, Moon, Sun, Waves } from "lucide-react";
import { Button } from "@/shared/components/ui/button";
import { useTheme } from "@/shared/components/theme/theme-provider";

export function ModeToggle() {
  const { setTheme, theme } = useTheme();

  const cycleTheme = () => {
    if (theme === "light") {
      setTheme("dark");
    } else if (theme === "dark") {
      setTheme("energetic");
    } else if (theme === "energetic") {
      setTheme("performance");
    } else {
      setTheme("light");
    }
  };

  return (
    <Button variant="glass" size="icon" onClick={cycleTheme} className="rounded-xl" title="Change theme">
      {theme === "light" && <Sun className="h-[1.2rem] w-[1.2rem]" />}
      {theme === "dark" && <Moon className="h-[1.2rem] w-[1.2rem]" />}
      {theme === "energetic" && <Flame className="h-[1.2rem] w-[1.2rem] text-primary" />}
      {theme === "performance" && <Waves className="h-[1.2rem] w-[1.2rem] text-primary" />}
      {theme === "system" && <Sun className="h-[1.2rem] w-[1.2rem] opacity-70" />}
      <span className="sr-only">Toggle theme</span>
    </Button>
  );
}
