import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { StudioFocusGoals } from '../StudioFocusGoals';
import { ToastProvider } from '../../../contexts/ToastContext';

vi.mock('../../../api/studio', () => {
  const getSettings = vi.fn().mockResolvedValue({
    userId: 'u1',
    focus: 'balanced',
    goals: {},
    cadenceTarget: 2,
    showRevenue: true,
    createdAt: Date.now(),
    updatedAt: Date.now(),
  });
  const updateSettings = vi.fn().mockResolvedValue({
    userId: 'u1',
    focus: 'assets',
    goals: { monthlyRevenueTarget: 100 },
    cadenceTarget: 3,
    showRevenue: true,
    createdAt: Date.now(),
    updatedAt: Date.now(),
  });

  return {
    studioApi: {
      getSettings,
      updateSettings,
    },
  };
});

import { studioApi } from '../../../api/studio';
const mockedStudioApi = vi.mocked(studioApi);

describe('StudioFocusGoals', () => {
  it('loads and saves settings', async () => {
    render(
      <ToastProvider>
        <StudioFocusGoals />
      </ToastProvider>
    );

    const label = await screen.findByText(/Focus & Goals/i);
    expect(label).toBeInTheDocument();

    // Change radio to assets
    const assetsRadio = screen.getByLabelText(/assets/i) as HTMLInputElement;
    fireEvent.click(assetsRadio);

    const saveBtn = screen.getByText(/Zapisz ustawienia/i);
    fireEvent.click(saveBtn);

    await waitFor(() => {
      expect(mockedStudioApi.updateSettings).toHaveBeenCalled();
    });
  });
});


