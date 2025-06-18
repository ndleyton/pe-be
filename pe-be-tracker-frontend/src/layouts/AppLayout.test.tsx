import React from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { BrowserRouter } from 'react-router-dom';
import AppLayout from './AppLayout';

const MockComponent = () => <div>Mock Content</div>;

const AppLayoutWrapper = ({ children }: { children: React.ReactNode }) => (
  <BrowserRouter>
    <AppLayout />
    {children}
  </BrowserRouter>
);

describe('AppLayout', () => {
  it('should have skip to content link as first focusable element', async () => {
    const user = userEvent.setup();
    
    render(
      <AppLayoutWrapper>
        <MockComponent />
      </AppLayoutWrapper>
    );

    // Tab to the first focusable element
    await user.tab();

    // Should focus the skip link
    const skipLink = screen.getByRole('link', { name: /skip to content/i });
    expect(skipLink).toHaveFocus();
  });

  it('should open and close drawer with keyboard', async () => {
    const user = userEvent.setup();
    
    render(
      <AppLayoutWrapper>
        <MockComponent />
      </AppLayoutWrapper>
    );

    // Find and click the hamburger menu button
    const hamburgerButton = screen.getByRole('button', { name: /open navigation menu/i });
    await user.click(hamburgerButton);

    // Drawer should be visible
    const drawer = screen.getByRole('dialog');
    expect(drawer).toBeInTheDocument();

    // Press Escape to close
    await user.keyboard('{Escape}');

    // Drawer should be gone
    expect(drawer).not.toBeInTheDocument();
  });

  it('should have proper ARIA labels on navigation elements', () => {
    render(
      <AppLayoutWrapper>
        <MockComponent />
      </AppLayoutWrapper>
    );

    // Check AppBar has proper role and aria-label
    const banner = screen.getByRole('banner');
    expect(banner).toHaveAttribute('aria-label', 'Primary');

    // Check bottom navigation has proper role and aria-label
    const bottomNav = screen.getByRole('navigation', { name: /bottom navigation/i });
    expect(bottomNav).toBeInTheDocument();
  });
});