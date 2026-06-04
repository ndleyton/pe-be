import { createContext, useContext, useEffect, useMemo, useState } from "react";

type Theme = "dark" | "light" | "system" | "energetic" | "performance";

const themeClasses = ["light", "dark", "energetic", "performance"] as const;
const themes = [...themeClasses, "system"] as const;

const isTheme = (value: unknown): value is Theme =>
  typeof value === "string" && themes.includes(value as Theme);

const getStoredTheme = (storageKey: string, fallback: Theme): Theme => {
  if (typeof window === "undefined") {
    return fallback;
  }

  try {
    const item = window.localStorage.getItem(storageKey);
    if (!item) {
      return fallback;
    }

    const parsed = JSON.parse(item);
    return isTheme(parsed) ? parsed : fallback;
  } catch {
    return fallback;
  }
};

type ThemeProviderProps = {
  children: React.ReactNode;
  defaultTheme?: Theme;
  storageKey?: string;
};

type ThemeProviderState = {
  theme: Theme;
  setTheme: (theme: Theme) => void;
};

const initialState: ThemeProviderState = {
  theme: "system",
  setTheme: () => null,
};

const ThemeProviderContext = createContext<ThemeProviderState>(initialState);

export function ThemeProvider({
  children,
  defaultTheme = "system",
  storageKey = "vite-ui-theme",
  ...props
}: ThemeProviderProps) {
  const [theme, setThemeState] = useState<Theme>(() =>
    getStoredTheme(storageKey, defaultTheme),
  );

  useEffect(() => {
    const root = window.document.documentElement;

    root.classList.remove(...themeClasses);

    if (theme === "system") {
      const systemTheme = window.matchMedia("(prefers-color-scheme: dark)")
        .matches
        ? "dark"
        : "light";

      root.classList.add(systemTheme);
      return;
    }

    root.classList.add(theme);
  }, [theme]);

  const value = useMemo(
    () => ({
      theme,
      setTheme: (theme: Theme) => {
        setThemeState(theme);

        try {
          window.localStorage.setItem(storageKey, JSON.stringify(theme));
        } catch {
          // Ignore private browsing issues.
        }
      },
    }),
    [storageKey, theme],
  );

  return (
    <ThemeProviderContext.Provider {...props} value={value}>
      {children}
    </ThemeProviderContext.Provider>
  );
}

export const useTheme = () => {
  const context = useContext(ThemeProviderContext);

  if (context === undefined)
    throw new Error("useTheme must be used within a ThemeProvider");

  return context;
};
