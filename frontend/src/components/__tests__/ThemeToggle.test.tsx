import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ThemeToggle } from '../ThemeToggle';
import * as AppContext from '../../App';

describe('ThemeToggle', () => {
  it('renders correctly with default dark mode icon', () => {
    vi.spyOn(AppContext, 'useAuth').mockReturnValue({
      token: 'fake-token',
      user: null,
      login: vi.fn(),
      logout: vi.fn(),
      theme: 'dark',
      toggleTheme: vi.fn(),
    });

    render(<ThemeToggle />);
    const button = screen.getByRole('button', { name: /switch to light mode/i });
    expect(button).toBeInTheDocument();
    expect(button).toHaveAttribute('title', 'Switch to light mode');
  });

  it('renders light mode state and responds to click', async () => {
    const toggleThemeMock = vi.fn();
    vi.spyOn(AppContext, 'useAuth').mockReturnValue({
      token: 'fake-token',
      user: null,
      login: vi.fn(),
      logout: vi.fn(),
      theme: 'light',
      toggleTheme: toggleThemeMock,
    });

    render(<ThemeToggle showLabel />);
    const button = screen.getByRole('button', { name: /switch to dark mode/i });
    expect(button).toBeInTheDocument();
    expect(screen.getByText(/light mode/i)).toBeInTheDocument();

    await userEvent.click(button);
    expect(toggleThemeMock).toHaveBeenCalledTimes(1);
  });
});
