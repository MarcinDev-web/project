/**
 * AvatarForgePage - Main Avatar Customization Studio
 * A modern, visual avatar builder with categories, presets, and real-time preview
 */

import { useState, useCallback, useEffect, useMemo, useDeferredValue } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useToast } from '../contexts/ToastContext';
import { Layout } from '../components/layout/Layout';
import {
  CategoryNav,
  ItemGallery,
  AvatarViewport,
  PresetsPanel,
  ColorPickerAdvanced,
  CommunityPresetsPanel,
  PurchaseModal,
  AVATAR_CATEGORIES,
  DEFAULT_GALLERY_FILTERS,
  type GalleryItem,
  type AvatarPreset,
  type MaterialCategory,
} from '../components/avatar-forge';
import { profilesApi } from '../api/profiles';
import { DEFAULT_AVATAR_LOADOUT, DEFAULT_AVATAR_PART_LIBRARY, AVATAR_SLOTS, type AvatarLoadout, type AvatarSlot, type AvatarPartLibrary } from '@engine/avatar';
import { AvatarLoadoutMigrator } from '../components/avatar-builder/AvatarLoadoutMigrator';
import type { AvatarBuilderCore } from '../components/avatar-builder/AvatarBuilderCore';
import '../styles/avatar-forge.css';

/**
 * Generate gallery items from part library
 */
function generateGalleryItems(categoryId: string): GalleryItem[] {
  const category = AVATAR_CATEGORIES.find((c) => c.id === categoryId);
  if (!category) return [];

  const items: GalleryItem[] = [];
  
  // Get meshes from default part library for the category's slots
  for (const slot of category.slots) {
    const slotMeshes = DEFAULT_AVATAR_PART_LIBRARY[slot as AvatarSlot];
    if (slotMeshes) {
      for (const meshId of Object.keys(slotMeshes)) {
        items.push({
          id: `${slot}-${meshId}`,
          name: formatMeshName(meshId),
          category: categoryId,
          slot: slot as AvatarSlot,
          meshId,
          previewEmoji: getSlotEmoji(slot as AvatarSlot),
          status: 'owned', // All default items are owned
          rarity: 'common',
        });
      }
    }
  }

  return items;
}

function formatMeshName(meshId: string): string {
  return meshId
    .replace(/_/g, ' ')
    .replace(/([A-Z])/g, ' $1')
    .replace(/^./, (str) => str.toUpperCase())
    .trim();
}

function getSlotEmoji(slot: AvatarSlot): string {
  const emojiMap: Partial<Record<AvatarSlot, string>> = {
    head: '🗣️',
    torso: '👕',
    leftUpperArm: '💪',
    rightUpperArm: '💪',
    leftLowerArm: '🤲',
    rightLowerArm: '🤲',
    leftHand: '✋',
    rightHand: '✋',
    leftUpperLeg: '🦵',
    rightUpperLeg: '🦵',
    leftLowerLeg: '🦿',
    rightLowerLeg: '🦿',
    leftFoot: '👟',
    rightFoot: '👟',
    hair: '💇',
  };
  return emojiMap[slot] ?? '🎭';
}

/**
 * Default presets
 */
const DEFAULT_PRESETS: AvatarPreset[] = [
  {
    id: 'default',
    name: 'Default',
    loadout: DEFAULT_AVATAR_LOADOUT,
    previewEmoji: '👤',
    isDefault: true,
    createdAt: Date.now(),
    updatedAt: Date.now(),
  },
];

/**
 * Get available meshes for a slot from the part library
 */
function getAvailableMeshesForSlot(slot: AvatarSlot, library: AvatarPartLibrary): string[] {
  const meshes: string[] = [];
  for (const [partId, definition] of Object.entries(library)) {
    if (definition.slot === slot) {
      meshes.push(partId);
    }
  }
  return meshes;
}

/**
 * Generate a random HSL color with controlled saturation and lightness
 */
function randomHslColor(
  hueMin = 0,
  hueMax = 360,
  satMin = 40,
  satMax = 80,
  lightMin = 30,
  lightMax = 70
): [number, number, number, number] {
  const h = Math.random() * (hueMax - hueMin) + hueMin;
  const s = Math.random() * (satMax - satMin) + satMin;
  const l = Math.random() * (lightMax - lightMin) + lightMin;
  
  // Convert HSL to RGB
  const sNorm = s / 100;
  const lNorm = l / 100;
  
  const c = (1 - Math.abs(2 * lNorm - 1)) * sNorm;
  const x = c * (1 - Math.abs((h / 60) % 2 - 1));
  const m = lNorm - c / 2;
  
  let r = 0, g = 0, b = 0;
  
  if (h < 60) {
    r = c; g = x; b = 0;
  } else if (h < 120) {
    r = x; g = c; b = 0;
  } else if (h < 180) {
    r = 0; g = c; b = x;
  } else if (h < 240) {
    r = 0; g = x; b = c;
  } else if (h < 300) {
    r = x; g = 0; b = c;
  } else {
    r = c; g = 0; b = x;
  }
  
  return [r + m, g + m, b + m, 1];
}

/**
 * Generate a random skin tone
 */
function randomSkinTone(): [number, number, number, number] {
  const skinTones: [number, number, number, number][] = [
    [1.0, 0.87, 0.77, 1],  // Fair
    [0.96, 0.80, 0.69, 1], // Light
    [0.87, 0.68, 0.55, 1], // Medium Light
    [0.78, 0.58, 0.44, 1], // Medium
    [0.62, 0.43, 0.31, 1], // Medium Dark
    [0.45, 0.30, 0.22, 1], // Dark
    [0.32, 0.20, 0.14, 1], // Deep
  ];
  return skinTones[Math.floor(Math.random() * skinTones.length)];
}

/**
 * Generate a random hair color
 */
function randomHairColor(): [number, number, number, number] {
  const hairColors: [number, number, number, number][] = [
    [0.1, 0.08, 0.05, 1],   // Black
    [0.2, 0.12, 0.06, 1],   // Dark Brown
    [0.45, 0.30, 0.15, 1],  // Brown
    [0.65, 0.50, 0.30, 1],  // Light Brown
    [0.85, 0.75, 0.55, 1],  // Blonde
    [0.6, 0.2, 0.1, 1],     // Auburn
    [0.8, 0.3, 0.1, 1],     // Ginger
    [0.3, 0.3, 0.35, 1],    // Gray
    [0.95, 0.95, 0.95, 1],  // White/Platinum
    // Fun colors (20% chance)
    [0.9, 0.2, 0.4, 1],     // Pink
    [0.2, 0.5, 0.9, 1],     // Blue
    [0.5, 0.2, 0.8, 1],     // Purple
    [0.2, 0.8, 0.4, 1],     // Green
  ];
  return hairColors[Math.floor(Math.random() * hairColors.length)];
}

/**
 * Generate a completely random loadout
 */
function generateRandomLoadout(library: AvatarPartLibrary): AvatarLoadout {
  const parts: AvatarLoadout['parts'] = {};
  
  // Core body slots that should always have parts
  const coreSlots: AvatarSlot[] = [
    'HeadSlot', 'NeckSlot', 'TorsoSlot',
    'UpperArmSlotL', 'UpperArmSlotR',
    'LowerArmSlotL', 'LowerArmSlotR',
    'HandSlotL', 'HandSlotR',
    'UpperLegSlotL', 'UpperLegSlotR',
    'LowerLegSlotL', 'LowerLegSlotR',
    'FootSlotL', 'FootSlotR',
  ];
  
  // Optional slots (50% chance each)
  const optionalSlots: AvatarSlot[] = [
    'HairSlot', 'FaceOverlaySlot', 'BackSlot', 'HeadFXSlot',
  ];
  
  // Generate consistent color palette for this avatar
  const skinColor = randomSkinTone();
  const hairColor = randomHairColor();
  const outfitColor = randomHslColor(0, 360, 50, 90, 30, 60);
  const pantsColor = randomHslColor(0, 360, 20, 60, 15, 40);
  const shoeColor = randomHslColor(0, 360, 10, 30, 10, 30);
  const accentColor = randomHslColor(0, 360, 70, 100, 40, 60);
  
  // Slot to color mapping
  const slotColorMap: Partial<Record<AvatarSlot, [number, number, number, number]>> = {
    HeadSlot: skinColor,
    NeckSlot: skinColor,
    LowerArmSlotL: skinColor,
    LowerArmSlotR: skinColor,
    HandSlotL: skinColor,
    HandSlotR: skinColor,
    TorsoSlot: outfitColor,
    UpperArmSlotL: outfitColor,
    UpperArmSlotR: outfitColor,
    UpperLegSlotL: pantsColor,
    UpperLegSlotR: pantsColor,
    LowerLegSlotL: pantsColor,
    LowerLegSlotR: pantsColor,
    FootSlotL: shoeColor,
    FootSlotR: shoeColor,
    HairSlot: hairColor,
    FaceOverlaySlot: accentColor,
    BackSlot: outfitColor,
    HeadFXSlot: accentColor,
  };
  
  // Fill core slots
  for (const slot of coreSlots) {
    const availableMeshes = getAvailableMeshesForSlot(slot, library);
    if (availableMeshes.length > 0) {
      const randomMesh = availableMeshes[Math.floor(Math.random() * availableMeshes.length)];
      parts[slot] = {
        mesh: randomMesh,
        color: slotColorMap[slot],
      };
    }
  }
  
  // Fill optional slots (50% chance each)
  for (const slot of optionalSlots) {
    if (Math.random() > 0.5) {
      const availableMeshes = getAvailableMeshesForSlot(slot, library);
      if (availableMeshes.length > 0) {
        const randomMesh = availableMeshes[Math.floor(Math.random() * availableMeshes.length)];
        parts[slot] = {
          mesh: randomMesh,
          color: slotColorMap[slot],
        };
      }
    }
  }
  
  return {
    version: 2,
    parts,
  };
}

/**
 * Main Avatar Forge Page
 */
export function AvatarForgePage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { showToast } = useToast();

  // Core state
  const [loadout, setLoadout] = useState<AvatarLoadout>(DEFAULT_AVATAR_LOADOUT);
  const [builderCore, setBuilderCore] = useState<AvatarBuilderCore | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  // UI state
  const [activeCategory, setActiveCategory] = useState('body');
  const [selectedItemId, setSelectedItemId] = useState<string | null>(null);
  
  // Hover preview state
  const [hoverLoadout, setHoverLoadout] = useState<AvatarLoadout | null>(null);
  const deferredHoverLoadout = useDeferredValue(hoverLoadout);
  
  // Color picker state
  const [showColorPicker, setShowColorPicker] = useState(false);
  const [colorPickerCategory, setColorPickerCategory] = useState<MaterialCategory>('skin');
  const [currentColor, setCurrentColor] = useState<[number, number, number, number]>([0.78, 0.58, 0.44, 1]);
  
  // Community presets state
  const [showCommunityPresets, setShowCommunityPresets] = useState(false);
  
  // Purchase modal state
  const [purchaseItem, setPurchaseItem] = useState<GalleryItem | null>(null);
  const [userBalance] = useState(1000); // Mock balance - in real app, fetch from user profile

  // Presets
  const [presets, setPresets] = useState<AvatarPreset[]>(DEFAULT_PRESETS);
  const [activePresetId, setActivePresetId] = useState<string | null>('default');

  // History for undo/redo
  const [history, setHistory] = useState<AvatarLoadout[]>([DEFAULT_AVATAR_LOADOUT]);
  const [historyIndex, setHistoryIndex] = useState(0);

  // Gallery items based on active category
  const galleryItems = useMemo(() => {
    return generateGalleryItems(activeCategory);
  }, [activeCategory]);

  // Load saved loadout on mount
  useEffect(() => {
    const loadSavedLoadout = async () => {
      if (!user?.id) {
        setIsLoading(false);
        return;
      }

      try {
        const savedLoadout = await profilesApi.loadAvatarLoadout(user.id);
        if (savedLoadout) {
          const migrationResult = AvatarLoadoutMigrator.migrate(savedLoadout);
          const finalLoadout = migrationResult.loadout;
          setLoadout(finalLoadout);
          setHistory([finalLoadout]);
          setHistoryIndex(0);
        }
      } catch (error) {
        console.error('Failed to load saved avatar loadout:', error);
        // Use default loadout on error
      } finally {
        setIsLoading(false);
      }
    };

    loadSavedLoadout();
  }, [user?.id]);

  // Handle loadout change with history
  const handleLoadoutChange = useCallback((newLoadout: AvatarLoadout) => {
    setLoadout(newLoadout);
    
    // Add to history (truncate future history if we're not at the end)
    setHistory((prev) => {
      const newHistory = prev.slice(0, historyIndex + 1);
      newHistory.push(newLoadout);
      // Limit history to 50 items
      if (newHistory.length > 50) {
        newHistory.shift();
        return newHistory;
      }
      return newHistory;
    });
    setHistoryIndex((prev) => Math.min(prev + 1, 49));
    setActivePresetId(null); // Clear active preset when manually changing
  }, [historyIndex]);

  // Undo/Redo
  const canUndo = historyIndex > 0;
  const canRedo = historyIndex < history.length - 1;

  const handleUndo = useCallback(() => {
    if (canUndo) {
      const newIndex = historyIndex - 1;
      setHistoryIndex(newIndex);
      setLoadout(history[newIndex]);
    }
  }, [canUndo, historyIndex, history]);

  const handleRedo = useCallback(() => {
    if (canRedo) {
      const newIndex = historyIndex + 1;
      setHistoryIndex(newIndex);
      setLoadout(history[newIndex]);
    }
  }, [canRedo, historyIndex, history]);

  // Save loadout
  const handleSave = useCallback(async () => {
    if (!user?.id) {
      showToast('You must be logged in to save', 'error');
      return;
    }

    setIsSaving(true);
    try {
      await profilesApi.saveAvatarLoadout(user.id, loadout);
      showToast('Avatar saved successfully!', 'success');
    } catch (error) {
      console.error('Failed to save avatar:', error);
      showToast('Failed to save avatar', 'error');
    } finally {
      setIsSaving(false);
    }
  }, [user?.id, loadout, showToast]);

  // Randomize loadout
  const handleRandomize = useCallback(() => {
    const randomLoadout = generateRandomLoadout(DEFAULT_AVATAR_PART_LIBRARY);
    handleLoadoutChange(randomLoadout);
    showToast('Avatar randomized! 🎲', 'success');
  }, [handleLoadoutChange, showToast]);

  // Item selection
  const handleItemSelect = useCallback((item: GalleryItem) => {
    // Clear hover state when selecting
    setHoverLoadout(null);
    
    // Handle shop items - show purchase modal
    if (item.status === 'shop') {
      setPurchaseItem(item);
      return;
    }
    
    // Handle locked items - don't allow selection
    if (item.status === 'locked') {
      showToast('This item is locked', 'warning');
      return;
    }
    
    setSelectedItemId(item.id);
    
    // Apply item to loadout
    const currentPart = loadout.parts[item.slot];
    const updatedPart = currentPart
      ? { ...currentPart, mesh: item.meshId }
      : { mesh: item.meshId };

    handleLoadoutChange({
      ...loadout,
      parts: {
        ...loadout.parts,
        [item.slot]: updatedPart,
      },
    });
  }, [loadout, handleLoadoutChange, showToast]);

  // Hover preview handler
  const handleItemHover = useCallback((item: GalleryItem | null) => {
    if (!item) {
      setHoverLoadout(null);
      return;
    }
    
    // Don't preview locked items
    if (item.status === 'locked') {
      setHoverLoadout(null);
      return;
    }
    
    // Create temporary loadout with hovered item
    const currentPart = loadout.parts[item.slot];
    const updatedPart = currentPart
      ? { ...currentPart, mesh: item.meshId }
      : { mesh: item.meshId };

    setHoverLoadout({
      ...loadout,
      parts: {
        ...loadout.parts,
        [item.slot]: updatedPart,
      },
    });
  }, [loadout]);
  
  // Color picker handlers
  const handleColorChange = useCallback((color: [number, number, number, number]) => {
    setCurrentColor(color);
    
    // Apply color to all relevant slots based on category
    const slotsToUpdate = getSlotsForMaterialCategory(colorPickerCategory);
    const newParts = { ...loadout.parts };
    
    for (const slot of slotsToUpdate) {
      const currentPart = newParts[slot as AvatarSlot];
      if (currentPart) {
        newParts[slot as AvatarSlot] = {
          ...currentPart,
          color,
        };
      }
    }
    
    handleLoadoutChange({
      ...loadout,
      parts: newParts,
    });
  }, [loadout, colorPickerCategory, handleLoadoutChange]);

  // Get slots for material category
  function getSlotsForMaterialCategory(category: MaterialCategory): AvatarSlot[] {
    switch (category) {
      case 'skin':
        return ['head', 'torso', 'leftUpperArm', 'rightUpperArm', 'leftLowerArm', 'rightLowerArm',
                'leftHand', 'rightHand', 'leftUpperLeg', 'rightUpperLeg', 'leftLowerLeg', 'rightLowerLeg',
                'leftFoot', 'rightFoot'];
      case 'hair':
        return ['hair'];
      case 'outfit':
        return ['torso', 'leftUpperArm', 'rightUpperArm', 'leftUpperLeg', 'rightUpperLeg'];
      case 'accessories':
        return ['head'];
      default:
        return [];
    }
  }

  // Preset handling
  const handlePresetSelect = useCallback((preset: AvatarPreset) => {
    setActivePresetId(preset.id);
    handleLoadoutChange(preset.loadout);
  }, [handleLoadoutChange]);

  const handlePresetCreate = useCallback((name: string) => {
    const newPreset: AvatarPreset = {
      id: `preset-${Date.now()}`,
      name,
      loadout: { ...loadout },
      previewEmoji: '🎨',
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };
    setPresets((prev) => [...prev, newPreset]);
    setActivePresetId(newPreset.id);
    showToast(`Preset "${name}" created!`, 'success');
  }, [loadout, showToast]);

  const handlePresetDelete = useCallback((presetId: string) => {
    setPresets((prev) => prev.filter((p) => p.id !== presetId));
    if (activePresetId === presetId) {
      setActivePresetId(null);
    }
    showToast('Preset deleted', 'info');
  }, [activePresetId, showToast]);
  
  // Purchase success handler
  const handlePurchaseSuccess = useCallback((purchasedItem: GalleryItem) => {
    // Close the modal
    setPurchaseItem(null);
    
    // Apply the purchased item to loadout
    setSelectedItemId(purchasedItem.id);
    
    const currentPart = loadout.parts[purchasedItem.slot];
    const updatedPart = currentPart
      ? { ...currentPart, mesh: purchasedItem.meshId }
      : { mesh: purchasedItem.meshId };

    handleLoadoutChange({
      ...loadout,
      parts: {
        ...loadout.parts,
        [purchasedItem.slot]: updatedPart,
      },
    });
    
    showToast(`${purchasedItem.name} purchased!`, 'success');
  }, [loadout, handleLoadoutChange, showToast]);
  
  // Community preset apply handler
  const handleApplyCommunityPreset = useCallback((presetLoadout: AvatarLoadout) => {
    handleLoadoutChange(presetLoadout);
    setShowCommunityPresets(false);
    showToast('Community preset applied!', 'success');
  }, [handleLoadoutChange, showToast]);

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Ctrl+Z / Cmd+Z - Undo
      if ((e.ctrlKey || e.metaKey) && e.key === 'z' && !e.shiftKey) {
        e.preventDefault();
        handleUndo();
      }
      // Ctrl+Shift+Z / Cmd+Shift+Z / Ctrl+Y - Redo
      if (
        ((e.ctrlKey || e.metaKey) && e.key === 'z' && e.shiftKey) ||
        ((e.ctrlKey || e.metaKey) && e.key === 'y')
      ) {
        e.preventDefault();
        handleRedo();
      }
      // Ctrl+S / Cmd+S - Save
      if ((e.ctrlKey || e.metaKey) && e.key === 's') {
        e.preventDefault();
        handleSave();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleUndo, handleRedo, handleSave]);

  // Get active category info
  const activeCategoryInfo = AVATAR_CATEGORIES.find((c) => c.id === activeCategory);

  if (isLoading) {
    return (
      <Layout>
        <div className="avatar-forge">
          <div className="forge-loading" style={{ minHeight: '80vh' }}>
            <div className="forge-loading__spinner" />
            <span>Loading Avatar Forge...</span>
          </div>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="avatar-forge">
        {/* Header */}
        <header className="avatar-forge__header">
          <div className="avatar-forge__header-left">
            <button
              className="avatar-forge__back-btn"
              onClick={() => navigate(-1)}
            >
              ← Back
            </button>
            <h1 className="avatar-forge__title">Avatar Forge</h1>
          </div>

          <div className="avatar-forge__header-actions">
            <button
              className="avatar-forge__history-btn"
              onClick={handleUndo}
              disabled={!canUndo}
              title="Undo (Ctrl+Z)"
            >
              ↶
            </button>
            <button
              className="avatar-forge__history-btn"
              onClick={handleRedo}
              disabled={!canRedo}
              title="Redo (Ctrl+Y)"
            >
              ↷
            </button>
            <button
              className={`forge-btn forge-btn--secondary ${showColorPicker ? 'forge-btn--active' : ''}`}
              onClick={() => {
                setShowColorPicker(!showColorPicker);
                setShowCommunityPresets(false);
              }}
              title="Color Picker"
            >
              🎨 Colors
            </button>
            <button
              className={`forge-btn forge-btn--secondary ${showCommunityPresets ? 'forge-btn--active' : ''}`}
              onClick={() => {
                setShowCommunityPresets(!showCommunityPresets);
                setShowColorPicker(false);
              }}
              title="Community Presets"
            >
              🌍 Community
            </button>
            <button
              className="forge-btn forge-btn--secondary"
              onClick={handleRandomize}
              title="Randomize"
            >
              🎲 Random
            </button>
            <button
              className="forge-btn forge-btn--primary"
              onClick={handleSave}
              disabled={isSaving}
            >
              {isSaving ? '...' : '💾 Save'}
            </button>
          </div>
        </header>

        {/* Main content */}
        <div className="avatar-forge__main">
          {/* Left sidebar - Categories */}
          <CategoryNav
            activeCategory={activeCategory}
            onCategoryChange={setActiveCategory}
          />

          {/* Center - Viewport */}
          <div className="avatar-forge__viewport-container">
            <AvatarViewport
              loadout={deferredHoverLoadout ?? loadout}
              onLoadoutChange={handleLoadoutChange}
              onCoreReady={setBuilderCore}
            />
            
            {/* Hover indicator */}
            {hoverLoadout && (
              <div className="avatar-forge__hover-indicator">
                <span>👁️ Preview</span>
              </div>
            )}
          </div>

          {/* Right sidebar - Presets, Color Picker, or Community Presets */}
          {showColorPicker ? (
            <div className="avatar-forge__color-panel">
              <ColorPickerAdvanced
                color={currentColor}
                onChange={handleColorChange}
                activeCategory={colorPickerCategory}
                onCategoryChange={setColorPickerCategory}
                title="Avatar Colors"
                showMaterialTabs={true}
              />
            </div>
          ) : showCommunityPresets ? (
            <CommunityPresetsPanel
              currentLoadout={loadout}
              onApplyPreset={handleApplyCommunityPreset}
              onHoverPreset={setHoverLoadout}
              onClose={() => setShowCommunityPresets(false)}
            />
          ) : (
            <PresetsPanel
              presets={presets}
              activePresetId={activePresetId}
              onPresetSelect={handlePresetSelect}
              onPresetCreate={handlePresetCreate}
              onPresetDelete={handlePresetDelete}
            />
          )}
        </div>

        {/* Bottom - Item Gallery */}
        <ItemGallery
          items={galleryItems}
          selectedItemId={selectedItemId}
          onItemSelect={handleItemSelect}
          onItemHover={handleItemHover}
          categoryLabel={activeCategoryInfo?.label ?? 'Items'}
        />
        
        {/* Purchase Modal */}
        {purchaseItem && (
          <PurchaseModal
            item={purchaseItem}
            userBalance={userBalance}
            onPurchaseSuccess={handlePurchaseSuccess}
            onClose={() => setPurchaseItem(null)}
          />
        )}
      </div>
    </Layout>
  );
}

