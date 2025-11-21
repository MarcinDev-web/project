
/**
 * SaveProjectDialog tests
 * @vitest-environment jsdom
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { SaveProjectDialog, SaveProjectDialogOptions, SaveProjectDialogResult, ValidationResult } from '../modals/SaveProjectDialog';
import { initBrowserPolyfills } from '../../../test/setup';

describe('SaveProjectDialog', () => {
  let dialog: SaveProjectDialog;

  beforeEach(() => {
    initBrowserPolyfills();
    dialog = new SaveProjectDialog();
  });

  afterEach(() => {
    // Cleanup any dialogs left in the DOM
    const dialogs = document.querySelectorAll('div[style*="position: fixed"][style*="z-index: 1000"]');
    dialogs.forEach(d => d.remove());
  });

  it('should render correctly with default values', async () => {
    const promise = dialog.show({ defaultName: 'Test Project' });
    
    const nameInput = document.querySelector('input[type="text"]') as HTMLInputElement;
    const descInput = document.querySelector('textarea') as HTMLTextAreaElement;
    const title = document.querySelector('h3');

    expect(nameInput).toBeTruthy();
    expect(nameInput.value).toBe('Test Project');
    expect(descInput).toBeTruthy();
    expect(descInput.value).toBe('');
    expect(title?.textContent).toBe('Save Project');

    // Close it
    const cancelBtn = document.querySelectorAll('button')[0] as HTMLElement;
    cancelBtn.click();
    await promise;
  });

  it('should return name and description on save', async () => {
    const promise = dialog.show();
    
    const nameInput = document.querySelector('input[type="text"]') as HTMLInputElement;
    const descInput = document.querySelector('textarea') as HTMLTextAreaElement;
    const saveBtn = document.querySelectorAll('button')[1] as HTMLElement;

    nameInput.value = 'New Project';
    descInput.value = 'My awesome project';

    saveBtn.click();
    
    const result = await promise;
    expect(result).toEqual({
      name: 'New Project',
      description: 'My awesome project',
    });
  });

  it('should return null on cancel', async () => {
    const promise = dialog.show();
    const cancelBtn = document.querySelectorAll('button')[0] as HTMLElement;
    cancelBtn.click();
    
    const result = await promise;
    expect(result).toBeNull();
  });

  it('should show error if name is empty', async () => {
    dialog.show();
    
    const nameInput = document.querySelector('input[type="text"]') as HTMLInputElement;
    const saveBtn = document.querySelectorAll('button')[1] as HTMLElement;
    const errorMsg = document.querySelector('div[style*="color: rgb(239, 68, 68)"]') as HTMLElement; // #ef4444

    nameInput.value = '';
    saveBtn.click();

    expect(errorMsg.textContent).toBe('Project name is required');
    expect(errorMsg.style.opacity).toBe('1');
  });

  it('should validate name asynchronously', async () => {
    const validator = vi.fn().mockResolvedValue({ error: 'Name taken' });
    const promise = dialog.show({ validator });

    const nameInput = document.querySelector('input[type="text"]') as HTMLInputElement;
    const saveBtn = document.querySelectorAll('button')[1] as HTMLElement;
    const errorMsg = document.querySelector('div[style*="color: rgb(239, 68, 68)"]') as HTMLElement;

    nameInput.value = 'Existing Name';
    saveBtn.click();

    // Wait for async validation
    await new Promise(resolve => setTimeout(resolve, 0));

    expect(validator).toHaveBeenCalledWith('Existing Name');
    expect(errorMsg.textContent).toBe('Name taken');
    expect(errorMsg.style.opacity).toBe('1');

    // Close dialog to finish test
    const cancelBtn = document.querySelectorAll('button')[0] as HTMLElement;
    cancelBtn.click();
    await promise;
  });

  it('should handle overwrite warning', async () => {
    const validator = vi.fn().mockResolvedValue({ 
      warning: 'Exists', 
      canOverwrite: true 
    });
    
    const promise = dialog.show({ validator });
    const saveBtn = document.querySelectorAll('button')[1] as HTMLElement;
    const errorMsg = document.querySelector('div[style*="color: rgb(239, 68, 68)"]') as HTMLElement;

    // First click - triggers warning
    saveBtn.click();
    await new Promise(resolve => setTimeout(resolve, 0)); // wait for validator

    expect(saveBtn.textContent).toBe('Overwrite');
    expect(errorMsg.textContent).toBe('Exists');
    
    // Second click - confirms overwrite
    saveBtn.click();
    
    const result = await promise;
    expect(result).not.toBeNull();
    expect(result?.name).toBe('My Project'); // default value
  });

  it('should reset overwrite state if name changes', async () => {
    const validator = vi.fn().mockResolvedValue({ 
      warning: 'Exists', 
      canOverwrite: true 
    });
    
    const promise = dialog.show({ validator });
    const nameInput = document.querySelector('input[type="text"]') as HTMLInputElement;
    const saveBtn = document.querySelectorAll('button')[1] as HTMLElement;

    // Trigger warning
    saveBtn.click();
    await new Promise(resolve => setTimeout(resolve, 0));
    expect(saveBtn.textContent).toBe('Overwrite');

    // Change name
    nameInput.value = 'New Name';
    nameInput.dispatchEvent(new Event('input'));

    expect(saveBtn.textContent).toBe('Save Project');
    
    // Close
    const cancelBtn = document.querySelectorAll('button')[0] as HTMLElement;
    cancelBtn.click();
    await promise;
  });
});

