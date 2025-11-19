export interface PlayerStats {
  id: string;
  name: string;
  kills: number;
  deaths: number;
  assists: number;
  score: number;
  damageDealt: number;
}

export interface ScoreboardEvents {
  onStatsChanged: (stats: PlayerStats[]) => void;
}

/**
 * Manages scoreboard state for PvP matches.
 * Tracks kills, deaths, assists, and damage.
 */
export class PvPScoreboard {
  private stats: Map<string, PlayerStats> = new Map();
  private listeners: Array<(stats: PlayerStats[]) => void> = [];

  constructor() {}

  /**
   * Registers a player in the scoreboard.
   */
  registerPlayer(id: string, name: string): void {
    if (this.stats.has(id)) {
      return;
    }

    this.stats.set(id, {
      id,
      name,
      kills: 0,
      deaths: 0,
      assists: 0,
      score: 0,
      damageDealt: 0,
    });
    this.notifyListeners();
  }

  /**
   * Records a kill event.
   * Updates killer's kills and score, and victim's deaths.
   */
  recordKill(killerId: string, victimId: string): void {
    const killer = this.stats.get(killerId);
    const victim = this.stats.get(victimId);

    if (killer) {
      killer.kills++;
      killer.score += 100; // Example score value
    }

    if (victim) {
      victim.deaths++;
    }

    this.notifyListeners();
  }

  /**
   * Records a death event (e.g. environmental).
   */
  recordDeath(victimId: string): void {
    const victim = this.stats.get(victimId);
    if (victim) {
      victim.deaths++;
      this.notifyListeners();
    }
  }

  /**
   * Records damage dealt by a player.
   */
  recordDamage(attackerId: string, amount: number): void {
    const attacker = this.stats.get(attackerId);
    if (attacker) {
      attacker.damageDealt += amount;
      // Optional: Add score for damage?
      // attacker.score += Math.floor(amount / 10);
      this.notifyListeners();
    }
  }

  /**
   * Gets stats for a specific player.
   */
  getStats(id: string): PlayerStats | undefined {
    return this.stats.get(id);
  }

  /**
   * Gets all player stats, sorted by score (descending).
   */
  getAllStats(): PlayerStats[] {
    return Array.from(this.stats.values()).sort((a, b) => b.score - a.score);
  }

  /**
   * Subscribes to scoreboard updates.
   * @returns Unsubscribe function
   */
  subscribe(callback: (stats: PlayerStats[]) => void): () => void {
    this.listeners.push(callback);
    // Immediate callback with current state
    callback(this.getAllStats());
    
    return () => {
      this.listeners = this.listeners.filter(l => l !== callback);
    };
  }

  private notifyListeners(): void {
    const allStats = this.getAllStats();
    this.listeners.forEach(listener => listener(allStats));
  }

  /**
   * Resets all stats.
   */
  reset(): void {
    for (const stats of this.stats.values()) {
      stats.kills = 0;
      stats.deaths = 0;
      stats.assists = 0;
      stats.score = 0;
      stats.damageDealt = 0;
    }
    this.notifyListeners();
  }
}

