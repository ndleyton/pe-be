import { StrictMode } from "react";
import ReactDOM from "react-dom/client";
import { AppProviders } from "@/app/providers";
import { AppRouter } from "@/app/router";
import {
  createSentryReactErrorHandler,
  scheduleSentryInit,
} from "@/instrument";
import "./index.css";
import { ThemeProvider } from "./shared/components/theme/theme-provider";

scheduleSentryInit();

const root = ReactDOM.createRoot(document.getElementById("root")!, {
  onUncaughtError: createSentryReactErrorHandler(),
  onCaughtError: createSentryReactErrorHandler(),
  onRecoverableError: createSentryReactErrorHandler(),
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
