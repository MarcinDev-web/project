import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { StudioHealthCard } from '../StudioHealthCard';

vi.mock('../../../api/studio', () => ({
  studioApi: {
    getScore: vi.fn().mockResolvedValue({ score: 72, breakdown: { revenueVelocity: 60, shippingCadence: 80, customerLove: 50, portfolioBreadth: 70, communityImpact: 0 } }),
  },
}));

describe('StudioHealthCard', () => {
  it('renders score and breakdown tiles', async () => {
    render(<StudioHealthCard />);
    const scoreEl = await screen.findByText('72');
    expect(scoreEl).toBeInTheDocument();
  });
});


