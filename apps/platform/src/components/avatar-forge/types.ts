/**
 * Avatar Forge - Type Definitions
 */

import type { AvatarSlot, AvatarLoadout, AvatarAnimation } from '@engine/avatar';

/**
 * Avatar category definition
 */
export interface AvatarCategory {
  id: string;
  icon: string;
  label: string;
  slots: AvatarSlot[];
  subCategories?: {
    id: string;
    label: string;
    slots?: AvatarSlot[];
  }[];
}

/**
 * Gallery item representing a customization option
 */
export interface GalleryItem {
  id: string;
  name: string;
  category: string;
  slot: AvatarSlot;
  meshId: string;
  thumbnail?: string;
  previewEmoji?: string;
  status: 'owned' | 'locked' | 'shop' | 'premium';
  price?: number;
  requiredLevel?: number;
  rarity?: 'common' | 'uncommon' | 'rare' | 'epic' | 'legendary';
  isNew?: boolean;
}

/**
 * Avatar preset saved by user
 */
export interface AvatarPreset {
  id: string;
  name: string;
  loadout: AvatarLoadout;
  thumbnail?: string;
  previewEmoji?: string;
  isDefault?: boolean;
  createdAt: number;
  updatedAt: number;
}

/**
 * Filter options for gallery
 */
export interface GalleryFilters {
  search: string;
  status: 'all' | 'owned' | 'shop' | 'new';
  rarity: 'all' | 'common' | 'uncommon' | 'rare' | 'epic' | 'legendary';
  sortBy: 'name' | 'rarity' | 'newest' | 'price';
}

/**
 * Animation definition for preview
 */
export interface AnimationOption {
  animation: AvatarAnimation;
  icon: string;
  label: string;
}

/**
 * Color preset for quick selection
 */
export interface ColorPreset {
  id: string;
  color: [number, number, number, number]; // RGBA
  name: string;
}

/**
 * Avatar Forge state
 */
export interface AvatarForgeState {
  // Current loadout
  loadout: AvatarLoadout;
  
  // UI state
  activeCategory: string;
  activeSubCategory: string | null;
  selectedItemId: string | null;
  
  // Gallery
  galleryItems: GalleryItem[];
  galleryFilters: GalleryFilters;
  
  // Presets
  presets: AvatarPreset[];
  activePresetId: string | null;
  
  // History for undo/redo
  history: AvatarLoadout[];
  historyIndex: number;
  
  // Animation preview
  currentAnimation: AvatarAnimation | null;
  isAnimationPlaying: boolean;
  
  // Loading states
  isLoading: boolean;
  isSaving: boolean;
}

/**
 * Category definitions
 */
export const AVATAR_CATEGORIES: AvatarCategory[] = [
  {
    id: 'body',
    icon: '👤',
    label: 'Body',
    slots: ['torso', 'leftUpperArm', 'rightUpperArm', 'leftLowerArm', 'rightLowerArm', 
            'leftUpperLeg', 'rightUpperLeg', 'leftLowerLeg', 'rightLowerLeg'],
    subCategories: [
      { id: 'torso', label: 'Torso', slots: ['torso'] },
      { id: 'arms', label: 'Arms', slots: ['leftUpperArm', 'rightUpperArm', 'leftLowerArm', 'rightLowerArm'] },
      { id: 'legs', label: 'Legs', slots: ['leftUpperLeg', 'rightUpperLeg', 'leftLowerLeg', 'rightLowerLeg'] },
    ],
  },
  {
    id: 'head',
    icon: '🗣️',
    label: 'Head',
    slots: ['head'],
    subCategories: [
      { id: 'face', label: 'Face Shape' },
      { id: 'eyes', label: 'Eyes' },
      { id: 'mouth', label: 'Mouth' },
    ],
  },
  {
    id: 'hair',
    icon: '💇',
    label: 'Hair',
    slots: ['hair'],
    subCategories: [
      { id: 'style', label: 'Style' },
      { id: 'color', label: 'Color' },
    ],
  },
  {
    id: 'skin',
    icon: '🎨',
    label: 'Skin',
    slots: ['torso', 'head', 'leftUpperArm', 'rightUpperArm', 'leftLowerArm', 'rightLowerArm',
            'leftHand', 'rightHand', 'leftUpperLeg', 'rightUpperLeg', 'leftLowerLeg', 'rightLowerLeg',
            'leftFoot', 'rightFoot'],
  },
  {
    id: 'outfit',
    icon: '👕',
    label: 'Outfit',
    slots: ['torso', 'leftUpperArm', 'rightUpperArm', 'leftUpperLeg', 'rightUpperLeg'],
    subCategories: [
      { id: 'tops', label: 'Tops' },
      { id: 'bottoms', label: 'Bottoms' },
      { id: 'footwear', label: 'Footwear' },
    ],
  },
  {
    id: 'accessories',
    icon: '🎒',
    label: 'Gear',
    slots: ['head', 'torso'],
    subCategories: [
      { id: 'hats', label: 'Hats' },
      { id: 'glasses', label: 'Glasses' },
      { id: 'backpacks', label: 'Backpacks' },
    ],
  },
  {
    id: 'effects',
    icon: '✨',
    label: 'Effects',
    slots: [],
    subCategories: [
      { id: 'aura', label: 'Aura' },
      { id: 'trail', label: 'Trail' },
      { id: 'particles', label: 'Particles' },
    ],
  },
];

/**
 * Default gallery filters
 */
export const DEFAULT_GALLERY_FILTERS: GalleryFilters = {
  search: '',
  status: 'all',
  rarity: 'all',
  sortBy: 'name',
};

/**
 * Skin tone presets
 */
export const SKIN_TONE_PRESETS: ColorPreset[] = [
  { id: 'fair', color: [1.0, 0.87, 0.77, 1], name: 'Fair' },
  { id: 'light', color: [0.96, 0.80, 0.69, 1], name: 'Light' },
  { id: 'medium-light', color: [0.87, 0.68, 0.55, 1], name: 'Medium Light' },
  { id: 'medium', color: [0.78, 0.58, 0.44, 1], name: 'Medium' },
  { id: 'medium-dark', color: [0.62, 0.43, 0.31, 1], name: 'Medium Dark' },
  { id: 'dark', color: [0.45, 0.30, 0.22, 1], name: 'Dark' },
  { id: 'deep', color: [0.32, 0.20, 0.14, 1], name: 'Deep' },
];

/**
 * Common color presets
 */
export const COLOR_PRESETS: ColorPreset[] = [
  { id: 'red', color: [0.9, 0.2, 0.2, 1], name: 'Red' },
  { id: 'orange', color: [0.95, 0.55, 0.15, 1], name: 'Orange' },
  { id: 'yellow', color: [0.95, 0.85, 0.2, 1], name: 'Yellow' },
  { id: 'green', color: [0.2, 0.8, 0.35, 1], name: 'Green' },
  { id: 'teal', color: [0.2, 0.75, 0.75, 1], name: 'Teal' },
  { id: 'blue', color: [0.25, 0.45, 0.9, 1], name: 'Blue' },
  { id: 'purple', color: [0.6, 0.3, 0.85, 1], name: 'Purple' },
  { id: 'pink', color: [0.9, 0.4, 0.6, 1], name: 'Pink' },
  { id: 'brown', color: [0.55, 0.35, 0.2, 1], name: 'Brown' },
  { id: 'black', color: [0.1, 0.1, 0.1, 1], name: 'Black' },
  { id: 'gray', color: [0.5, 0.5, 0.5, 1], name: 'Gray' },
  { id: 'white', color: [0.95, 0.95, 0.95, 1], name: 'White' },
];

