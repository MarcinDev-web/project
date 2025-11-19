import { PvPScoreboard, PlayerStats } from '@engine/world';

export class ScoreboardHUD {
  private container: HTMLElement;
  private miniScoreboard: HTMLElement;
  private fullScoreboard: HTMLElement;
  private scoreboard: PvPScoreboard;
  private unsubscribe: () => void;

  constructor(scoreboard: PvPScoreboard, parentContainer: HTMLElement) {
    this.scoreboard = scoreboard;
    this.container = document.createElement('div');
    this.container.id = 'scoreboard-hud';
    this.container.style.position = 'absolute';
    this.container.style.top = '0';
    this.container.style.left = '0';
    this.container.style.width = '100%';
    this.container.style.height = '100%';
    this.container.style.pointerEvents = 'none';
    this.container.style.zIndex = '50';
    this.container.style.fontFamily = 'ui-sans-serif, system-ui, sans-serif';

    this.miniScoreboard = this.createMiniScoreboard();
    this.fullScoreboard = this.createFullScoreboard();
    
    this.container.appendChild(this.miniScoreboard);
    this.container.appendChild(this.fullScoreboard);
    parentContainer.appendChild(this.container);

    this.unsubscribe = this.scoreboard.subscribe((stats) => {
      this.update(stats);
    });

    window.addEventListener('keydown', this.handleKeyDown);
    window.addEventListener('keyup', this.handleKeyUp);
  }

  dispose(): void {
    this.unsubscribe();
    window.removeEventListener('keydown', this.handleKeyDown);
    window.removeEventListener('keyup', this.handleKeyUp);
    this.container.remove();
  }

  private handleKeyDown = (e: KeyboardEvent) => {
    if (e.code === 'Tab') {
      e.preventDefault();
      this.fullScoreboard.style.display = 'flex';
    }
  };

  private handleKeyUp = (e: KeyboardEvent) => {
    if (e.code === 'Tab') {
      e.preventDefault();
      this.fullScoreboard.style.display = 'none';
    }
  };

  private createMiniScoreboard(): HTMLElement {
    const el = document.createElement('div');
    el.style.position = 'absolute';
    el.style.top = '20px';
    el.style.right = '20px';
    el.style.backgroundColor = 'rgba(0, 0, 0, 0.5)';
    el.style.color = 'white';
    el.style.padding = '10px';
    el.style.borderRadius = '8px';
    el.style.display = 'flex';
    el.style.flexDirection = 'column';
    el.style.gap = '5px';
    el.style.minWidth = '150px';
    return el;
  }

  private createFullScoreboard(): HTMLElement {
    const el = document.createElement('div');
    el.style.position = 'absolute';
    el.style.top = '0';
    el.style.left = '0';
    el.style.width = '100%';
    el.style.height = '100%';
    el.style.backgroundColor = 'rgba(0, 0, 0, 0.7)';
    el.style.display = 'none'; // Hidden by default
    el.style.justifyContent = 'center';
    el.style.alignItems = 'center';
    el.style.flexDirection = 'column';
    el.style.color = 'white';
    
    const content = document.createElement('div');
    content.style.backgroundColor = '#1a1a1a';
    content.style.padding = '20px';
    content.style.borderRadius = '12px';
    content.style.minWidth = '600px';
    content.style.boxShadow = '0 4px 6px rgba(0, 0, 0, 0.3)';

    const title = document.createElement('h2');
    title.textContent = 'Scoreboard';
    title.style.margin = '0 0 20px 0';
    title.style.textAlign = 'center';
    title.style.borderBottom = '1px solid #333';
    title.style.paddingBottom = '10px';

    const table = document.createElement('table');
    table.style.width = '100%';
    table.style.borderCollapse = 'collapse';
    table.id = 'scoreboard-table';

    const thead = document.createElement('thead');
    thead.innerHTML = `
      <tr style="text-align: left; color: #888;">
        <th style="padding: 10px;">Player</th>
        <th style="padding: 10px;">Kills</th>
        <th style="padding: 10px;">Deaths</th>
        <th style="padding: 10px;">Assists</th>
        <th style="padding: 10px;">Damage</th>
        <th style="padding: 10px;">Score</th>
      </tr>
    `;
    table.appendChild(thead);

    const tbody = document.createElement('tbody');
    tbody.id = 'scoreboard-body';
    table.appendChild(tbody);

    content.appendChild(title);
    content.appendChild(table);
    el.appendChild(content);

    return el;
  }

  private update(stats: PlayerStats[]): void {
    this.updateMiniScoreboard(stats);
    this.updateFullScoreboard(stats);
  }

  private updateMiniScoreboard(stats: PlayerStats[]): void {
    this.miniScoreboard.innerHTML = '';
    
    // Show top 3 players or just local player + leader?
    // For now, show top 5
    const topStats = stats.slice(0, 5);
    
    topStats.forEach((stat, index) => {
      const row = document.createElement('div');
      row.style.display = 'flex';
      row.style.justifyContent = 'space-between';
      row.style.fontSize = '14px';
      
      const name = document.createElement('span');
      name.textContent = `${index + 1}. ${stat.name}`;
      name.style.fontWeight = 'bold';
      
      const score = document.createElement('span');
      score.textContent = stat.score.toString();
      
      row.appendChild(name);
      row.appendChild(score);
      this.miniScoreboard.appendChild(row);
    });
  }

  private updateFullScoreboard(stats: PlayerStats[]): void {
    const tbody = this.fullScoreboard.querySelector('#scoreboard-body');
    if (!tbody) return;

    tbody.innerHTML = '';

    stats.forEach((stat, index) => {
      const tr = document.createElement('tr');
      tr.style.borderBottom = '1px solid #333';
      tr.style.backgroundColor = index % 2 === 0 ? 'rgba(255, 255, 255, 0.05)' : 'transparent';

      tr.innerHTML = `
        <td style="padding: 10px; font-weight: bold;">${stat.name}</td>
        <td style="padding: 10px;">${stat.kills}</td>
        <td style="padding: 10px;">${stat.deaths}</td>
        <td style="padding: 10px;">${stat.assists}</td>
        <td style="padding: 10px;">${stat.damageDealt}</td>
        <td style="padding: 10px; color: #fbbf24; font-weight: bold;">${stat.score}</td>
      `;
      tbody.appendChild(tr);
    });
  }
}

