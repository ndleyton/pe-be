import React from 'react';
import ReactDOM from 'react-dom/client';
import { AppProviders } from '@/app/providers';
import { AppRouter } from '@/app/router';
import './index.css';
import { ThemeProvider } from './shared/components/theme/theme-provider';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <ThemeProvider defaultTheme="dark" storageKey="vite-ui-theme">
      <AppProviders>
        <AppRouter />
      </AppProviders>
    </ThemeProvider>
  </React.StrictMode>,
)
