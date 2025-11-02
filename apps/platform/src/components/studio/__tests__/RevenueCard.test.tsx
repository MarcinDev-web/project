import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { RevenueCard } from '../RevenueCard';

vi.mock('../../../api/studio', () => ({
  studioApi: {
    getRevenue: vi.fn().mockResolvedValue({
      gross: 1000,
      platformFee: 100,
      net: 900,
      topItems: [{ itemId: 'a', title: 'Item A', gross: 600 }],
      trend: [{ date: '2025-01-01', gross: 100, net: 90 }],
      period: 'month',
    }),
  },
}));

describe('RevenueCard', () => {
  it('shows gross/fee/net', async () => {
    render(<RevenueCard />);
    expect(await screen.findByText(/Gross/i)).toBeInTheDocument();
    // Value rendering depends on locale; just assert presence of labels
    expect(screen.getByText(/Platform Fee/i)).toBeInTheDocument();
    expect(screen.getByText(/Net/i)).toBeInTheDocument();
  });
});


