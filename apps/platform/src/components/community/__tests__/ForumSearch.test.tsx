import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { ForumSearch } from '../ForumSearch';
import { MemoryRouter } from 'react-router-dom';

// Mock useNavigate
const mockNavigate = vi.fn();
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return {
    ...actual,
    useNavigate: () => mockNavigate,
  };
});

describe('ForumSearch', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
  });

  it('renders search input', () => {
    render(
      <MemoryRouter>
        <ForumSearch />
      </MemoryRouter>
    );

    expect(screen.getByPlaceholderText(/Search threads/i)).toBeInTheDocument();
  });

  it('shows recent searches from localStorage', () => {
    localStorage.setItem('forum-recent-searches', JSON.stringify(['test query', 'another query']));
    
    render(
      <MemoryRouter>
        <ForumSearch />
      </MemoryRouter>
    );

    const input = screen.getByPlaceholderText(/Search threads/i);
    fireEvent.focus(input);

    expect(screen.getByText('Recent Searches')).toBeInTheDocument();
    expect(screen.getByText('test query')).toBeInTheDocument();
  });

  it('saves search to localStorage on submit', async () => {
    render(
      <MemoryRouter>
        <ForumSearch />
      </MemoryRouter>
    );

    const input = screen.getByPlaceholderText(/Search threads/i);
    fireEvent.change(input, { target: { value: 'new search' } });
    fireEvent.submit(input.closest('form')!);

    await waitFor(() => {
      const saved = localStorage.getItem('forum-recent-searches');
      expect(saved).toBeTruthy();
      const searches = JSON.parse(saved!);
      expect(searches).toContain('new search');
    });
  });
});

