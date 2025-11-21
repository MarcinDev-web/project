/**
 * Custom Profile Editor Modal
 * 
 * Modal dialog for creating and editing custom movement profiles
 */

import { MovementProfile, MovementProfileRegistry } from '@engine/stdlib/MovementProfiles';
import type { MovementProfileData } from '@engine/stdlib/MovementProfiles';
import type { CharacterControllerConfig } from '@engine/world';
import { DEFAULT_CHARACTER_CONFIG } from '@engine/world';
import { createIcon } from '../../utils/icons';

export interface CustomProfileEditorOptions {
  initialProfile?: MovementProfileData;
  onSave?: (profile: MovementProfile) => void;
  onCancel?: () => void;
}

/**
 * Create and show custom profile editor modal
 */
export function showCustomProfileEditor(options: CustomProfileEditorOptions = {}): void {
  const modal = document.createElement('div');
  modal.className = 'modal-overlay';
  modal.style.cssText = `
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background: rgba(0, 0, 0, 0.7);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 10000;
  `;

  const dialog = document.createElement('div');
  dialog.className = 'modal-dialog';
  dialog.style.cssText = `
    background: #1e293b;
    border-radius: 8px;
    padding: 24px;
    min-width: 500px;
    max-width: 600px;
    max-height: 80vh;
    overflow-y: auto;
    box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.5);
  `;

  const header = document.createElement('div');
  header.style.cssText = `
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-bottom: 20px;
  `;

  const title = document.createElement('h2');
  title.textContent = options.initialProfile ? 'Edit Profile' : 'Create Custom Profile';
  title.style.cssText = `
    margin: 0;
    font-size: 18px;
    font-weight: 600;
    color: #f1f5f9;
  `;

  const closeBtn = document.createElement('button');
  closeBtn.type = 'button';
  closeBtn.appendChild(createIcon('close', 20));
  closeBtn.style.cssText = `
    background: transparent;
    border: none;
    color: #94a3b8;
    cursor: pointer;
    padding: 4px;
  `;
  closeBtn.addEventListener('click', () => {
    document.body.removeChild(modal);
    options.onCancel?.();
  });

  header.appendChild(title);
  header.appendChild(closeBtn);
  dialog.appendChild(header);

  // Form fields
  const form = document.createElement('form');
  
  // Profile Name
  const nameRow = document.createElement('div');
  nameRow.style.marginBottom = '16px';
  const nameLabel = document.createElement('label');
  nameLabel.textContent = 'Profile Name *';
  nameLabel.style.cssText = `
    display: block;
    margin-bottom: 6px;
    font-size: 13px;
    color: #cbd5e1;
  `;
  const nameInput = document.createElement('input');
  nameInput.type = 'text';
  nameInput.required = true;
  nameInput.value = options.initialProfile?.name || '';
  nameInput.style.cssText = `
    width: 100%;
    padding: 8px;
    background: #0f172a;
    border: 1px solid #334155;
    border-radius: 4px;
    color: #f1f5f9;
    font-size: 14px;
  `;
  nameRow.appendChild(nameLabel);
  nameRow.appendChild(nameInput);
  form.appendChild(nameRow);

  // Description
  const descRow = document.createElement('div');
  descRow.style.marginBottom = '16px';
  const descLabel = document.createElement('label');
  descLabel.textContent = 'Description';
  descLabel.style.cssText = `
    display: block;
    margin-bottom: 6px;
    font-size: 13px;
    color: #cbd5e1;
  `;
  const descInput = document.createElement('textarea');
  descInput.value = options.initialProfile?.description || '';
  descInput.rows = 2;
  descInput.style.cssText = `
    width: 100%;
    padding: 8px;
    background: #0f172a;
    border: 1px solid #334155;
    border-radius: 4px;
    color: #f1f5f9;
    font-size: 14px;
    resize: vertical;
  `;
  descRow.appendChild(descLabel);
  descRow.appendChild(descInput);
  form.appendChild(descRow);

  // Config parameters (simplified - full editor would have all fields)
  const configLabel = document.createElement('div');
  configLabel.textContent = 'Movement Parameters';
  configLabel.style.cssText = `
    margin-top: 20px;
    margin-bottom: 12px;
    font-size: 14px;
    font-weight: 600;
    color: #f1f5f9;
  `;
  form.appendChild(configLabel);

  const config: CharacterControllerConfig = options.initialProfile?.config 
    ? { ...options.initialProfile.config }
    : { ...DEFAULT_CHARACTER_CONFIG };

  const configFields = [
    { key: 'moveSpeed' as const, label: 'Move Speed', min: 0.1, max: 50, step: 0.5 },
    { key: 'sprintMultiplier' as const, label: 'Sprint Multiplier', min: 1, max: 5, step: 0.1 },
    { key: 'jumpForce' as const, label: 'Jump Force', min: 0, max: 30, step: 0.5 },
    { key: 'gravityMultiplier' as const, label: 'Gravity Multiplier', min: 0, max: 5, step: 0.1 },
    { key: 'airControlMultiplier' as const, label: 'Air Control', min: 0, max: 1, step: 0.1 },
    { key: 'rotationSpeed' as const, label: 'Rotation Speed', min: 0, max: 50, step: 1 },
  ];

  configFields.forEach(field => {
    const fieldRow = document.createElement('div');
    fieldRow.style.marginBottom = '12px';
    const fieldLabel = document.createElement('label');
    fieldLabel.textContent = field.label;
    fieldLabel.style.cssText = `
      display: block;
      margin-bottom: 4px;
      font-size: 12px;
      color: #cbd5e1;
    `;
    const fieldInput = document.createElement('input');
    fieldInput.type = 'number';
    fieldInput.min = String(field.min);
    fieldInput.max = String(field.max);
    fieldInput.step = String(field.step);
    fieldInput.value = String(config[field.key]);
    fieldInput.style.cssText = `
      width: 100%;
      padding: 6px;
      background: #0f172a;
      border: 1px solid #334155;
      border-radius: 4px;
      color: #f1f5f9;
      font-size: 13px;
    `;
    fieldInput.addEventListener('input', () => {
      const value = parseFloat(fieldInput.value);
      if (!isNaN(value)) {
        (config as any)[field.key] = value;
      }
    });
    fieldRow.appendChild(fieldLabel);
    fieldRow.appendChild(fieldInput);
    form.appendChild(fieldRow);
  });

  // Action buttons
  const buttonsRow = document.createElement('div');
  buttonsRow.style.cssText = `
    display: flex;
    gap: 12px;
    margin-top: 24px;
    justify-content: flex-end;
  `;

  const cancelBtn = document.createElement('button');
  cancelBtn.type = 'button';
  cancelBtn.textContent = 'Cancel';
  cancelBtn.style.cssText = `
    padding: 8px 16px;
    background: #334155;
    border: none;
    border-radius: 4px;
    color: #f1f5f9;
    cursor: pointer;
    font-size: 13px;
  `;
  cancelBtn.addEventListener('click', () => {
    document.body.removeChild(modal);
    options.onCancel?.();
  });

  const saveBtn = document.createElement('button');
  saveBtn.type = 'submit';
  saveBtn.textContent = options.initialProfile ? 'Save Changes' : 'Create Profile';
  saveBtn.style.cssText = `
    padding: 8px 16px;
    background: #3b82f6;
    border: none;
    border-radius: 4px;
    color: white;
    cursor: pointer;
    font-size: 13px;
    font-weight: 500;
  `;

  buttonsRow.appendChild(cancelBtn);
  buttonsRow.appendChild(saveBtn);
  form.appendChild(buttonsRow);

  form.addEventListener('submit', (e) => {
    e.preventDefault();
    
    if (!nameInput.value.trim()) {
      alert('Profile name is required');
      return;
    }

    const profileId = options.initialProfile?.id || `custom-${Date.now()}`;
    const trimmedDesc = descInput.value.trim();
    const profile = MovementProfile.create({
      id: profileId,
      name: nameInput.value.trim(),
      ...(trimmedDesc && { description: trimmedDesc }),
      config: { ...config },
    });

    // Register in registry
    const registry = MovementProfileRegistry.getInstance();
    registry.register(profile);

    document.body.removeChild(modal);
    options.onSave?.(profile);
  });

  dialog.appendChild(form);
  modal.appendChild(dialog);
  document.body.appendChild(modal);

  // Focus name input
  nameInput.focus();
}

