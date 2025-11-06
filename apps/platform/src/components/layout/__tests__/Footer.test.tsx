/**
 * Tests for Footer component
 */

import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { Footer } from '../Footer';

describe('Footer', () => {
  it('should render footer element', () => {
    const { container } = render(<Footer />);
    const footer = container.querySelector('footer');
    expect(footer).toBeInTheDocument();
    expect(footer).toHaveClass('footer');
  });

  it('should display copyright text', () => {
    render(<Footer />);
    const copyrightText = screen.getByText(/2025 Forge World/i);
    expect(copyrightText).toBeInTheDocument();
  });

  it('should display powered by text', () => {
    render(<Footer />);
    const poweredByText = screen.getByText(/Powered by Forge Engine/i);
    expect(poweredByText).toBeInTheDocument();
  });

  it('should not re-render unnecessarily (memo check)', () => {
    const { rerender } = render(<Footer />);
    const firstRender = screen.getByText(/2025 Forge World/i);
    
    // Re-render with same props (should use memoized version)
    rerender(<Footer />);
    const secondRender = screen.getByText(/2025 Forge World/i);
    
    expect(firstRender).toBe(secondRender);
  });
});

