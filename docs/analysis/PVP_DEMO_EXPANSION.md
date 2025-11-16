# PvP Demo Expansion Plan

## Goals
- Make the PvP demo feel like a miniature playable mode.
- Showcase best practices for respawns, temporary buffs, and scoreboard UI.
- Keep everything opt-in so demos stay lightweight in automated tests.

> **Update (2025-11-16):** PvPRespawnManager now lives in `@engine/world/utils`, so demos and runtime can reuse the same helper.

## Respawn & Power-Up Roadmap
1. **Server-authoritative respawn queues**
   - ✅ Move `PvPRespawnManager` to @engine/world (or @engine/stdlib) so net-server can reuse it.
   - Track killer/victim metadata to feed analytics and scoreboard events.
2. **Power-up component set**
   - `PowerUpComponent` describing buff type, magnitude, duration, stack rules.
   - `PowerUpSystem` applying timed modifiers to `CharacterController` profiles (speed, jump, damage, shield).
   - World authoring helpers (`createPowerUpPickup`) similar to current weapon pickup factory.
3. **Checkpoint-aware spawns**
   - Optional link between SpawnPointComponent and CheckpointComponent so respawns respect map progression.
   - Configurable spawn weighting (safe spawn, symmetric spawn rotation, sudden-death spawn tables).

## Scoreboard & Telemetry
- Create `PvPScoreboardService` (app-level) that listens to:
  - `weapon:hitscan:hit`, `weapon:fire`, `character:respawn`, `powerup:collected`.
  - Tracks kills, assists, deaths, objective score, damage dealt.
- Provide HUD widgets:
  - Compact overlay (`ScoreboardHUD`) wired into existing WeaponHUD container.
  - Modal scoreboard for pause menu / TAB key.
- Expose hooks for analytics/export so tournaments or automated tests can scrape end-of-match data.

## Networking Considerations
- Add replication messages for:
  - Power-up spawn/despawn state.
  - Scoreboard deltas (avoid full dumps on every kill).
- Ensure `MultiplayerGameplayManager` can inject authoritative respawn decisions.
- Simulate lag compensation for power-up pickup + weapon fire in tests (reuse InputReplicator buffering).

## Milestones
1. **Foundations (Week 1)**
   - Extract respawn manager to reusable module.
   - Add scoreboard data model + basic HUD panel.
2. **Power-Ups (Week 2)**
   - Implement component + system + demo pickups.
   - Write behavior tests covering stack rules and cleanup.
3. **Networking (Week 3)**
   - Wire replication for scores + power-ups.
   - Add e2e smoke test (two simulated clients) verifying synchronized score updates.
4. **Polish (Week 4)**
   - Editor UX: scoreboard overlay toggle, power-up palette entries.
   - Documentation + new tutorial entry describing PvP best practices.

