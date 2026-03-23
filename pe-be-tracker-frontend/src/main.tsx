import "@/instrument";
import { StrictMode } from "react";
import ReactDOM from "react-dom/client";
import { Sentry } from "@/instrument";
import { AppProviders } from "@/app/providers";
import { AppRouter } from "@/app/router";
import "./index.css";
import { ThemeProvider } from "./shared/components/theme/theme-provider";

const root = ReactDOM.createRoot(document.getElementById("root")!, {
  onUncaughtError: Sentry.reactErrorHandler(),
  onCaughtError: Sentry.reactErrorHandler(),
  onRecoverableError: Sentry.reactErrorHandler(),
});

root.render(
  <StrictMode>
    <ThemeProvider defaultTheme="dark" storageKey="vite-ui-theme">
      <AppProviders>
        <AppRouter />
      </AppProviders>
    </ThemeProvider>
  </StrictMode>,
);
