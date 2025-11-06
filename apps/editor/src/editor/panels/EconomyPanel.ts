import { EconomyApiClient, type GetWalletResponse } from '@engine/economy';

export class EconomyPanel {
  readonly element: HTMLElement;
  private readonly client: EconomyApiClient;
  private balancesContainer: HTMLElement;

  constructor() {
    this.client = new EconomyApiClient({
      baseUrl: '/api',
      getAuthToken: () => {
        // Get auth token from localStorage (using same key as platform app)
        return localStorage.getItem('forge_token') || null;
      },
    });
    this.element = document.createElement('div');
    this.element.className = 'economy-panel';

    const header = document.createElement('div');
    header.className = 'panel-header';
    header.innerHTML = `<span class="panel-title">Economy</span>`;

    const content = document.createElement('div');
    content.className = 'panel-section';

    const refreshBtn = document.createElement('button');
    refreshBtn.className = 'panel-button panel-button-secondary';
    refreshBtn.textContent = 'Refresh Wallet';
    refreshBtn.addEventListener('click', () => void this.refresh());

    this.balancesContainer = document.createElement('div');
    this.balancesContainer.className = 'panel-list';

    content.appendChild(refreshBtn);
    content.appendChild(this.balancesContainer);

    this.element.appendChild(header);
    this.element.appendChild(content);

    void this.refresh();
  }

  async refresh(): Promise<void> {
    try {
      const data: GetWalletResponse = await this.client.getWallet();
      this.renderBalances(data);
    } catch (e) {
      // Silently handle 401 (unauthorized) - user is not logged in
      // This is expected behavior, no need to log to console
      this.balancesContainer.innerHTML = `<div class="panel-hint">Login to view wallet</div>`;
    }
  }

  private renderBalances(data: GetWalletResponse): void {
    this.balancesContainer.innerHTML = '';
    if (!data.balances || data.balances.length === 0) {
      this.balancesContainer.innerHTML = `<div class="panel-hint">No balances</div>`;
      return;
    }
    for (const b of data.balances) {
      const row = document.createElement('div');
      row.className = 'panel-list-row';
      row.textContent = `${b.currency}: ${b.balance}`;
      this.balancesContainer.appendChild(row);
    }
  }
}


