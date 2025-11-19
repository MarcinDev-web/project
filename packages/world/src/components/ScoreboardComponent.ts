import { Component } from './Component.js';
import { registerComponent } from './registry.js';
import type { PlayerStats } from '../utils/PvPScoreboard.js';

export interface ScoreboardComponentJSON {
  stats: PlayerStats[];
}

/**
 * ScoreboardComponent holds the state of the PvP scoreboard.
 * Used for network replication.
 */
export class ScoreboardComponent extends Component {
  static readonly type = 'Scoreboard';

  /** List of player stats */
  stats: PlayerStats[] = [];

  getType(): string {
    return ScoreboardComponent.type;
  }

  clone(): ScoreboardComponent {
    const copy = new ScoreboardComponent();
    copy.stats = JSON.parse(JSON.stringify(this.stats));
    return copy;
  }

  toJSON(): ScoreboardComponentJSON {
    return {
      stats: this.stats
    };
  }

  fromJSON(data: Partial<ScoreboardComponentJSON>): void {
    if (data.stats) {
      this.stats = data.stats;
    }
  }
}

registerComponent(ScoreboardComponent.type, ScoreboardComponent);

