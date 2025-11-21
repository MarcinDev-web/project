/**
 * WeaponHUD - Play mode weapon HUD overlay
 * 
 * Features:
 * - Display current weapon and ammo count
 * - Show attachment icons
 * - Display reload progress
 * - Show weapon inventory slots
 * - Update in real-time from weapon events
 */

import type { Scene, Entity } from '@engine/world';
import { WeaponComponent } from '@engine/world/components/WeaponComponent';
import { InventoryComponent } from '@engine/world/components/InventoryComponent';
import { AttachmentComponent } from '@engine/world/components/AttachmentComponent';
import type { WeaponFireEvent, WeaponReloadEvent, InventoryUpdatedEvent } from '@engine/world/types/weapon';
import { getEffectiveWeaponStats } from '@engine/world';
import { getAttachment } from '@engine/world/data/attachments';

export interface WeaponHUDConfig {
  /** Scene to listen for events */
  scene: Scene;
  /** Player entity (entity with weapon/inventory) */
  playerEntity: Entity | null;
  /** Container to mount HUD into */
  container: HTMLElement;
}

/**
 * WeaponHUD - Displays weapon information in play mode
 */
export class WeaponHUD {
  private root: HTMLElement | null = null;
  private config: WeaponHUDConfig;
  private currentWeapon: WeaponComponent | null = null;
  private inventory: InventoryComponent | null = null;
  private attachmentComp: AttachmentComponent | null = null;
  private isVisible = false;
  private eventCleanup: Array<() => void> = [];

  // UI elements
  private weaponNameEl: HTMLElement | null = null;
  private ammoCountEl: HTMLElement | null = null;
  private maxAmmoEl: HTMLElement | null = null;
  private reloadBarEl: HTMLElement | null = null;
  private attachmentsListEl: HTMLElement | null = null;
  private inventorySlotsEl: HTMLElement | null = null;

  constructor(config: WeaponHUDConfig) {
    this.config = config;
  }

  /**
   * Shows the HUD
   */
  show(): void {
    if (this.isVisible) return;
    this.isVisible = true;

    if (!this.root) {
      this.createHUD();
    }

    if (this.root && !this.root.parentElement) {
      this.config.container.appendChild(this.root);
    }

    if (this.root) {
      this.root.classList.add('visible');
    }

    this.setupEventListeners();
    this.updatePlayerEntity(this.config.playerEntity);
  }

  /**
   * Hides the HUD
   */
  hide(): void {
    if (!this.isVisible) return;
    this.isVisible = false;

    if (this.root) {
      this.root.classList.remove('visible');
    }

    this.cleanupEventListeners();
  }

  /**
   * Updates the player entity
   */
  updatePlayerEntity(entity: Entity | null): void {
    this.config.playerEntity = entity;
    
    if (!entity) {
      this.currentWeapon = null;
      this.inventory = null;
      this.attachmentComp = null;
      this.updateDisplay();
      return;
    }

    // Get inventory or single weapon
    this.inventory = entity.getComponent(InventoryComponent) ?? null;
    if (this.inventory) {
      this.currentWeapon = this.inventory.getActiveWeapon();
    } else {
      this.currentWeapon = entity.getComponent(WeaponComponent) ?? null;
    }

    this.attachmentComp = entity.getComponent(AttachmentComponent) ?? null;

    this.updateDisplay();
  }

  /**
   * Disposes the HUD
   */
  dispose(): void {
    this.hide();
    this.cleanupEventListeners();
    
    if (this.root && this.root.parentElement) {
      this.root.parentElement.removeChild(this.root);
    }
    
    this.root = null;
  }

  /**
   * Creates the HUD DOM structure
   */
  private createHUD(): void {
    this.root = document.createElement('div');
    this.root.className = 'weapon-hud';

    // Main weapon info (bottom-right)
    const weaponInfo = document.createElement('div');
    weaponInfo.className = 'weapon-hud-info';

    const weaponName = document.createElement('div');
    weaponName.className = 'weapon-hud-name';
    this.weaponNameEl = weaponName;
    weaponInfo.appendChild(weaponName);

    const ammoInfo = document.createElement('div');
    ammoInfo.className = 'weapon-hud-ammo';
    
    const ammoCount = document.createElement('span');
    ammoCount.className = 'weapon-hud-ammo-current';
    this.ammoCountEl = ammoCount;
    
    const ammoSeparator = document.createElement('span');
    ammoSeparator.className = 'weapon-hud-ammo-separator';
    ammoSeparator.textContent = ' / ';
    
    const maxAmmo = document.createElement('span');
    maxAmmo.className = 'weapon-hud-ammo-max';
    this.maxAmmoEl = maxAmmo;
    
    ammoInfo.appendChild(ammoCount);
    ammoInfo.appendChild(ammoSeparator);
    ammoInfo.appendChild(maxAmmo);
    weaponInfo.appendChild(ammoInfo);

    // Reload progress bar
    const reloadBar = document.createElement('div');
    reloadBar.className = 'weapon-hud-reload';
    const reloadBarFill = document.createElement('div');
    reloadBarFill.className = 'weapon-hud-reload-fill';
    reloadBar.appendChild(reloadBarFill);
    this.reloadBarEl = reloadBarFill;
    weaponInfo.appendChild(reloadBar);

    // Attachments list
    const attachmentsList = document.createElement('div');
    attachmentsList.className = 'weapon-hud-attachments';
    this.attachmentsListEl = attachmentsList;
    weaponInfo.appendChild(attachmentsList);

    this.root.appendChild(weaponInfo);

    // Inventory slots (bottom-center)
    const inventorySlots = document.createElement('div');
    inventorySlots.className = 'weapon-hud-inventory';
    this.inventorySlotsEl = inventorySlots;
    this.root.appendChild(inventorySlots);

    // Add CSS if not already added
    this.injectStyles();
  }

  /**
   * Injects HUD styles
   */
  private injectStyles(): void {
    if (document.getElementById('weapon-hud-styles')) return;

    const style = document.createElement('style');
    style.id = 'weapon-hud-styles';
    style.textContent = `
      .weapon-hud {
        position: fixed;
        bottom: 20px;
        right: 20px;
        z-index: 10000;
        pointer-events: none;
        opacity: 0;
        transition: opacity 0.3s ease;
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      }

      .weapon-hud.visible {
        opacity: 1;
      }

      .weapon-hud-info {
        background: rgba(0, 0, 0, 0.7);
        backdrop-filter: blur(10px);
        border-radius: 8px;
        padding: 12px 16px;
        min-width: 200px;
        border: 1px solid rgba(255, 255, 255, 0.1);
      }

      .weapon-hud-name {
        font-size: 18px;
        font-weight: 600;
        color: #fff;
        margin-bottom: 4px;
        text-transform: capitalize;
      }

      .weapon-hud-ammo {
        font-size: 24px;
        font-weight: 700;
        color: #fff;
        margin-bottom: 8px;
      }

      .weapon-hud-ammo-current {
        color: #4ade80;
      }

      .weapon-hud-ammo-separator {
        color: rgba(255, 255, 255, 0.5);
      }

      .weapon-hud-ammo-max {
        color: rgba(255, 255, 255, 0.7);
      }

      .weapon-hud-reload {
        width: 100%;
        height: 4px;
        background: rgba(255, 255, 255, 0.2);
        border-radius: 2px;
        overflow: hidden;
        margin-bottom: 8px;
        display: none;
      }

      .weapon-hud-reload.reloading {
        display: block;
      }

      .weapon-hud-reload-fill {
        height: 100%;
        background: #3b82f6;
        width: 0%;
        transition: width 0.1s linear;
      }

      .weapon-hud-attachments {
        display: flex;
        gap: 6px;
        flex-wrap: wrap;
        margin-top: 8px;
      }

      .weapon-hud-attachment {
        background: rgba(255, 255, 255, 0.15);
        border-radius: 4px;
        padding: 4px 8px;
        font-size: 11px;
        color: rgba(255, 255, 255, 0.9);
        text-transform: uppercase;
        letter-spacing: 0.5px;
      }

      .weapon-hud-inventory {
        position: fixed;
        bottom: 20px;
        left: 50%;
        transform: translateX(-50%);
        display: flex;
        gap: 8px;
        z-index: 10000;
      }

      .weapon-hud-slot {
        width: 60px;
        height: 60px;
        background: rgba(0, 0, 0, 0.6);
        backdrop-filter: blur(10px);
        border-radius: 8px;
        border: 2px solid rgba(255, 255, 255, 0.2);
        display: flex;
        align-items: center;
        justify-content: center;
        font-size: 18px;
        font-weight: 600;
        color: rgba(255, 255, 255, 0.5);
        transition: all 0.2s ease;
      }

      .weapon-hud-slot.has-weapon {
        border-color: rgba(255, 255, 255, 0.4);
        color: rgba(255, 255, 255, 0.8);
      }

      .weapon-hud-slot.active {
        border-color: #3b82f6;
        background: rgba(59, 130, 246, 0.2);
        color: #fff;
        transform: scale(1.1);
      }
    `;
    document.head.appendChild(style);
  }

  /**
   * Updates the display with current weapon data
   */
  private updateDisplay(): void {
    if (!this.root) return;

    // Update weapon name
    if (this.weaponNameEl) {
      if (this.currentWeapon) {
        const preset = this.currentWeapon.weaponPreset ?? 'custom';
        this.weaponNameEl.textContent = preset.charAt(0).toUpperCase() + preset.slice(1);
      } else {
        this.weaponNameEl.textContent = 'No Weapon';
      }
    }

    // Update ammo count
    if (this.ammoCountEl && this.maxAmmoEl) {
      if (this.currentWeapon) {
        this.ammoCountEl.textContent = String(this.currentWeapon.ammo);
        this.maxAmmoEl.textContent = String(this.currentWeapon.getEffectiveMaxAmmo());
      } else {
        this.ammoCountEl.textContent = '0';
        this.maxAmmoEl.textContent = '0';
      }
    }

    // Update attachments
    if (this.attachmentsListEl) {
      this.attachmentsListEl.innerHTML = '';
      if (this.attachmentComp) {
        const attachments = this.attachmentComp.getAllAttachments();
        for (const attachment of attachments) {
          const attEl = document.createElement('div');
          attEl.className = 'weapon-hud-attachment';
          attEl.textContent = attachment.name;
          attEl.title = attachment.description ?? attachment.name;
          this.attachmentsListEl.appendChild(attEl);
        }
      }
    }

    // Update inventory slots
    if (this.inventorySlotsEl) {
      this.inventorySlotsEl.innerHTML = '';
      if (this.inventory) {
        const activeIndex = this.inventory.getActiveWeaponIndex();
        const weaponCount = this.inventory.getWeaponCount();
        const maxWeapons = this.inventory.maxWeapons;

        for (let i = 0; i < maxWeapons; i++) {
          const slot = document.createElement('div');
          slot.className = 'weapon-hud-slot';
          
          if (i < weaponCount) {
            slot.classList.add('has-weapon');
            const weapon = this.inventory.getWeapon(i);
            if (weapon) {
              const preset = weapon.weaponPreset ?? 'custom';
              slot.textContent = preset.charAt(0).toUpperCase();
            }
          } else {
            slot.textContent = String(i + 1);
          }

          if (i === activeIndex) {
            slot.classList.add('active');
          }

          this.inventorySlotsEl.appendChild(slot);
        }
      } else {
        // No inventory, hide slots
        this.inventorySlotsEl.style.display = 'none';
      }
    }
  }

  /**
   * Sets up event listeners for weapon events
   */
  private setupEventListeners(): void {
    this.cleanupEventListeners();

    if (!this.config.scene) return;

    const onFire = (event: WeaponFireEvent) => {
      if (event.entity === this.config.playerEntity) {
        this.updateDisplay();
      }
    };

    const onReload = (event: WeaponReloadEvent) => {
      if (event.entity === this.config.playerEntity) {
        this.updateReloadProgress(event.reloadDuration);
        this.updateDisplay();
      }
    };

    const onInventoryUpdate = (event: InventoryUpdatedEvent) => {
      if (event.entity === this.config.playerEntity) {
        this.updatePlayerEntity(event.entity);
      }
    };

    this.config.scene.events.on('weapon:fire', onFire);
    this.config.scene.events.on('weapon:reload', onReload);
    this.config.scene.events.on('inventory:updated', onInventoryUpdate);

    this.eventCleanup.push(() => {
      this.config.scene.events.off('weapon:fire', onFire);
      this.config.scene.events.off('weapon:reload', onReload);
      this.config.scene.events.off('inventory:updated', onInventoryUpdate);
    });

    // Update display periodically to catch ammo changes
    const updateInterval = setInterval(() => {
      this.updateDisplay();
    }, 100);
    this.eventCleanup.push(() => clearInterval(updateInterval));
  }

  /**
   * Updates reload progress bar
   */
  private updateReloadProgress(duration: number): void {
    if (!this.reloadBarEl || !this.root) return;

    const reloadContainer = this.reloadBarEl.parentElement;
    if (!reloadContainer) return;

    reloadContainer.classList.add('reloading');
    this.reloadBarEl.style.width = '0%';

    const startTime = performance.now();
    const updateProgress = () => {
      const elapsed = (performance.now() - startTime) / 1000;
      const progress = Math.min(elapsed / duration, 1);
      this.reloadBarEl!.style.width = `${progress * 100}%`;

      if (progress < 1) {
        requestAnimationFrame(updateProgress);
      } else {
        reloadContainer.classList.remove('reloading');
        this.reloadBarEl.style.width = '0%';
      }
    };

    requestAnimationFrame(updateProgress);
  }

  /**
   * Cleans up event listeners
   */
  private cleanupEventListeners(): void {
    for (const cleanup of this.eventCleanup) {
      cleanup();
    }
    this.eventCleanup = [];
  }
}

