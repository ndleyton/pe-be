import React from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi } from 'vitest';
import HomeLogo from './HomeLogo';

describe('HomeLogo', () => {
  it('renders as a non-interactive element when no onClick is provided', () => {
    render(<HomeLogo />);
    
    const logo = screen.getByTestId('home-logo');
    expect(logo).not.toHaveAttribute('role');
    expect(logo).not.toHaveAttribute('tabIndex');
    expect(logo).not.toHaveClass('cursor-pointer');
    
    // Check that both text parts are rendered
    expect(screen.getByText('Personal')).toBeInTheDocument();
    expect(screen.getByText('Bestie')).toBeInTheDocument();
  });

  it('renders as an interactive button when onClick is provided', () => {
    const mockOnClick = vi.fn();
    render(<HomeLogo onClick={mockOnClick} />);
    
    const logo = screen.getByRole('button', { name: 'Go to home page' });
    expect(logo).toHaveAttribute('tabIndex', '0');
    expect(logo).toHaveClass('cursor-pointer');
  });

  it('calls onClick when clicked with mouse', async () => {
    const user = userEvent.setup();
    const mockOnClick = vi.fn();
    render(<HomeLogo onClick={mockOnClick} />);
    
    const logo = screen.getByRole('button', { name: 'Go to home page' });
    await user.click(logo);
    
    expect(mockOnClick).toHaveBeenCalledTimes(1);
  });

  it('calls onClick when Enter key is pressed', async () => {
    const user = userEvent.setup();
    const mockOnClick = vi.fn();
    render(<HomeLogo onClick={mockOnClick} />);
    
    const logo = screen.getByRole('button', { name: 'Go to home page' });
    logo.focus();
    await user.keyboard('{Enter}');
    
    expect(mockOnClick).toHaveBeenCalledTimes(1);
  });

  it('calls onClick when Space key is pressed', async () => {
    const user = userEvent.setup();
    const mockOnClick = vi.fn();
    render(<HomeLogo onClick={mockOnClick} />);
    
    const logo = screen.getByRole('button', { name: 'Go to home page' });
    logo.focus();
    await user.keyboard(' ');
    
    expect(mockOnClick).toHaveBeenCalledTimes(1);
  });

  it('does not call onClick for other keys', async () => {
    const user = userEvent.setup();
    const mockOnClick = vi.fn();
    render(<HomeLogo onClick={mockOnClick} />);
    
    const logo = screen.getByRole('button', { name: 'Go to home page' });
    logo.focus();
    await user.keyboard('{Escape}');
    await user.keyboard('{Tab}');
    await user.keyboard('a');
    
    expect(mockOnClick).not.toHaveBeenCalled();
  });

  it('is focusable and has visible focus styles', () => {
    const mockOnClick = vi.fn();
    render(<HomeLogo onClick={mockOnClick} />);
    
    const logo = screen.getByRole('button', { name: 'Go to home page' });
    expect(logo).toHaveClass('focus:ring-2', 'focus:ring-ring');
  });

  it('renders the logo image with correct attributes', () => {
    render(<HomeLogo />);
    
    const logoImage = screen.getByAltText('PBestie Logo');
    expect(logoImage).toBeInTheDocument();
    expect(logoImage).toHaveAttribute('src', '/assets/logo.svg');
    expect(logoImage).toHaveClass('w-8', 'h-8');
  });
});