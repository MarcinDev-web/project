import { Component } from './Component';
import { registerComponent } from './registry';
import { WeaponComponent } from './WeaponComponent';

/**
 * Inventory component data
 */
export interface InventoryComponentData {
  /** Maximum number of weapons that can be carried */
  maxWeapons?: number;
  /** Initial weapons (will be cloned) */
  initialWeapons?: WeaponComponent[];
}

/**
 * InventoryComponent manages weapon inventory and active weapon selection
 */
export class InventoryComponent extends Component {
  static readonly type = 'Inventory';

  /** Maximum number of weapons */
  maxWeapons: number = 9;

  /** List of weapons in inventory */
  private weapons: WeaponComponent[] = [];

  /** Index of currently active weapon (-1 if none) */
  private activeWeaponIndex: number = -1;

  /** Time when weapon switch started */
  private switchStartTime: number = -Infinity;

  /** Weapon switch duration in seconds */
  switchDuration: number = 0.5;

  /** Whether currently switching weapons */
  get isSwitching(): boolean {
    return this.switchStartTime > -Infinity;
  }

  constructor(data?: InventoryComponentData) {
    super();
    if (data) {
      this.maxWeapons = data.maxWeapons ?? this.maxWeapons;
      if (data.initialWeapons) {
        for (const weapon of data.initialWeapons) {
          this.addWeapon(weapon);
        }
        // Activate first weapon if available
        if (this.weapons.length > 0) {
          this.activeWeaponIndex = 0;
        }
      }
    }
  }

  getType(): string {
    return InventoryComponent.type;
  }

  /**
   * Add a weapon to inventory
   * @param weapon - Weapon to add (will be cloned)
   * @returns true if added successfully, false if inventory is full
   */
  addWeapon(weapon: WeaponComponent): boolean {
    if (this.weapons.length >= this.maxWeapons) {
      return false;
    }

    // Clone weapon to avoid sharing state
    const cloned = weapon.clone();
    this.weapons.push(cloned);

    // Activate if this is the first weapon
    if (this.activeWeaponIndex === -1 && this.weapons.length === 1) {
      this.activeWeaponIndex = 0;
    }

    return true;
  }

  /**
   * Remove weapon at index
   * @param index - Weapon index to remove
   * @returns Removed weapon, or undefined if index invalid
   */
  removeWeapon(index: number): WeaponComponent | undefined {
    if (index < 0 || index >= this.weapons.length) {
      return undefined;
    }

    const removed = this.weapons.splice(index, 1)[0];

    // Adjust active weapon index
    if (this.weapons.length === 0) {
      this.activeWeaponIndex = -1;
    } else if (this.activeWeaponIndex >= this.weapons.length) {
      this.activeWeaponIndex = this.weapons.length - 1;
    } else if (this.activeWeaponIndex > index) {
      this.activeWeaponIndex--;
    }

    return removed;
  }

  /**
   * Switch to weapon at index
   * @param index - Weapon index to switch to
   * @param currentTime - Current time in seconds
   * @returns true if switch initiated successfully
   */
  switchWeapon(index: number, currentTime: number): boolean {
    if (index < 0 || index >= this.weapons.length) {
      return false;
    }

    if (index === this.activeWeaponIndex) {
      return false; // Already active
    }

    // Start switch
    this.switchStartTime = currentTime;
    this.activeWeaponIndex = index;

    return true;
  }

  /**
   * Update weapon switch state (called each frame)
   * @param currentTime - Current time in seconds
   * @returns true if switch just completed
   */
  updateSwitch(currentTime: number): boolean {
    if (!this.isSwitching) {
      return false;
    }

    const elapsed = currentTime - this.switchStartTime;
    if (elapsed >= this.switchDuration) {
      // Switch complete
      this.switchStartTime = -Infinity;
      return true;
    }

    return false;
  }

  /**
   * Get active weapon
   * @returns Active weapon, or undefined if none
   */
  getActiveWeapon(): WeaponComponent | undefined {
    if (this.activeWeaponIndex < 0 || this.activeWeaponIndex >= this.weapons.length) {
      return undefined;
    }
    return this.weapons[this.activeWeaponIndex];
  }

  /**
   * Get weapon at index
   * @param index - Weapon index
   * @returns Weapon, or undefined if index invalid
   */
  getWeapon(index: number): WeaponComponent | undefined {
    if (index < 0 || index >= this.weapons.length) {
      return undefined;
    }
    return this.weapons[index];
  }

  /**
   * Get all weapons
   * @returns Array of all weapons
   */
  getAllWeapons(): WeaponComponent[] {
    return [...this.weapons];
  }

  /**
   * Get active weapon index
   * @returns Active weapon index (-1 if none)
   */
  getActiveWeaponIndex(): number {
    return this.activeWeaponIndex;
  }

  /**
   * Get number of weapons in inventory
   */
  getWeaponCount(): number {
    return this.weapons.length;
  }

  /**
   * Check if inventory is full
   */
  isFull(): boolean {
    return this.weapons.length >= this.maxWeapons;
  }

  /**
   * Clear all weapons
   */
  clear(): void {
    this.weapons = [];
    this.activeWeaponIndex = -1;
    this.switchStartTime = -Infinity;
  }

  clone(): InventoryComponent {
    const copy = new InventoryComponent();
    copy.maxWeapons = this.maxWeapons;
    copy.switchDuration = this.switchDuration;
    copy.activeWeaponIndex = this.activeWeaponIndex;
    copy.switchStartTime = this.switchStartTime;
    // Clone all weapons
    for (const weapon of this.weapons) {
      copy.weapons.push(weapon.clone());
    }
    return copy;
  }

  toJSON(): {
    maxWeapons: number;
    switchDuration: number;
    activeWeaponIndex: number;
    weapons: Array<ReturnType<WeaponComponent['toJSON']>>;
  } {
    return {
      maxWeapons: this.maxWeapons,
      switchDuration: this.switchDuration,
      activeWeaponIndex: this.activeWeaponIndex,
      weapons: this.weapons.map((w) => w.toJSON()),
    };
  }

  fromJSON(data: {
    maxWeapons?: number;
    switchDuration?: number;
    activeWeaponIndex?: number;
    weapons?: Array<Parameters<WeaponComponent['fromJSON']>[0]>;
  }): void {
    if (typeof data.maxWeapons === 'number') this.maxWeapons = data.maxWeapons;
    if (typeof data.switchDuration === 'number') this.switchDuration = data.switchDuration;
    
    this.weapons = [];
    if (data.weapons) {
      for (const weaponData of data.weapons) {
        const weapon = new WeaponComponent();
        weapon.fromJSON(weaponData);
        this.weapons.push(weapon);
      }
    }

    if (typeof data.activeWeaponIndex === 'number') {
      if (data.activeWeaponIndex >= 0 && data.activeWeaponIndex < this.weapons.length) {
        this.activeWeaponIndex = data.activeWeaponIndex;
      } else {
        this.activeWeaponIndex = this.weapons.length > 0 ? 0 : -1;
      }
    } else {
      this.activeWeaponIndex = this.weapons.length > 0 ? 0 : -1;
    }

    this.switchStartTime = -Infinity;
  }
}

registerComponent(InventoryComponent.type, InventoryComponent);
