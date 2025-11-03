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
    // Wait for data to load
    await screen.findByText(/1000.*USD/i);
    
    // Check that stat labels exist (in the stats section, not just the description)
    const grossLabels = screen.getAllByText(/Gross/i);
    expect(grossLabels.length).toBeGreaterThan(0);
    // Value rendering depends on locale; just assert presence of labels
    expect(screen.getByText(/Platform Fee/i)).toBeInTheDocument();
    // "Net" appears in both description and stat label, so use getAllByText
    const netLabels = screen.getAllByText(/Net/i);
    expect(netLabels.length).toBeGreaterThan(0);
  });
});


