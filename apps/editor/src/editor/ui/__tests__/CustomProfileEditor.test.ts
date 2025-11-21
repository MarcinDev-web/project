/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { showCustomProfileEditor } from '../features/CustomProfileEditor';
import { MovementProfileRegistry } from '@engine/stdlib/MovementProfiles';

describe.skip('CustomProfileEditor', () => {
  beforeEach(() => {
    // Reset registry
    (MovementProfileRegistry as any).instance = null;
    document.body.innerHTML = '';
  });

  afterEach(() => {
    // Cleanup modals
    const modals = document.querySelectorAll('.modal-overlay');
    modals.forEach(modal => modal.remove());
  });

  it('shows modal dialog when called', () => {
    showCustomProfileEditor();

    const modal = document.querySelector('.modal-overlay');
    expect(modal).toBeTruthy();

    const dialog = document.querySelector('.modal-dialog');
    expect(dialog).toBeTruthy();
  });

  it('displays form fields for profile creation', () => {
    showCustomProfileEditor();

    const nameInput = document.querySelector('input[type="text"]') as HTMLInputElement;
    expect(nameInput).toBeTruthy();
    expect(nameInput.required).toBe(true);

    const descInput = document.querySelector('textarea') as HTMLTextAreaElement;
    expect(descInput).toBeTruthy();

    const numberInputs = document.querySelectorAll('input[type="number"]');
    expect(numberInputs.length).toBeGreaterThan(0);
  });

  it('calls onSave with created profile when form submitted', () => {
    const onSave = vi.fn();
    showCustomProfileEditor({ onSave });

    const nameInput = document.querySelector('input[type="text"]') as HTMLInputElement;
    nameInput.value = 'Test Profile';

    const form = document.querySelector('form') as HTMLFormElement;
    form.dispatchEvent(new Event('submit', { cancelable: true }));

    expect(onSave).toHaveBeenCalled();
    const savedProfile = onSave.mock.calls[0]![0];
    expect(savedProfile.name).toBe('Test Profile');
    expect(savedProfile.id).toContain('custom-');
  });

  it('does not save if name is empty', () => {
    const onSave = vi.fn();
    const alertSpy = vi.spyOn(window, 'alert').mockImplementation(() => {});

    showCustomProfileEditor({ onSave });

    const form = document.querySelector('form') as HTMLFormElement;
    form.dispatchEvent(new Event('submit', { cancelable: true }));

    expect(alertSpy).toHaveBeenCalled();
    expect(onSave).not.toHaveBeenCalled();

    alertSpy.mockRestore();
  });

  it('registers profile in registry when saved', () => {
    const registry = MovementProfileRegistry.getInstance();
    const initialCount = registry.getAll().length;

    showCustomProfileEditor({
      onSave: () => {
        // Profile should be registered
        const profiles = registry.getAll();
        expect(profiles.length).toBeGreaterThan(initialCount);
      },
    });

    const nameInput = document.querySelector('input[type="text"]') as HTMLInputElement;
    nameInput.value = 'Test Profile';

    const form = document.querySelector('form') as HTMLFormElement;
    form.dispatchEvent(new Event('submit', { cancelable: true }));
  });

  it('calls onCancel when cancel button clicked', () => {
    const onCancel = vi.fn();
    showCustomProfileEditor({ onCancel });

    const cancelBtn = Array.from(document.querySelectorAll('button')).find(
      btn => btn.textContent === 'Cancel'
    ) as HTMLButtonElement;
    expect(cancelBtn).toBeTruthy();

    cancelBtn.click();

    expect(onCancel).toHaveBeenCalled();
    expect(document.querySelector('.modal-overlay')).toBeFalsy();
  });

  it('closes modal when close button clicked', () => {
    showCustomProfileEditor();

    const closeBtn = document.querySelector('.modal-dialog button[type="button"]') as HTMLButtonElement;
    expect(closeBtn).toBeTruthy();

    closeBtn.click();

    expect(document.querySelector('.modal-overlay')).toBeFalsy();
  });

  it('pre-fills form when editing existing profile', () => {
    const initialProfile = {
      id: 'existing-profile',
      name: 'Existing Profile',
      description: 'Test description',
      config: {
        moveSpeed: 10.0,
        sprintMultiplier: 2.0,
        jumpForce: 12.0,
        gravityMultiplier: 1.0,
        maxSlopeAngle: 45,
        stepHeight: 0.3,
        groundCheckDistance: 0.1,
        airControlMultiplier: 0.5,
        rotationSpeed: 15,
        autoRotate: true,
      },
    };

    showCustomProfileEditor({ initialProfile });

    const nameInput = document.querySelector('input[type="text"]') as HTMLInputElement;
    expect(nameInput.value).toBe('Existing Profile');

    const descInput = document.querySelector('textarea') as HTMLTextAreaElement;
    expect(descInput.value).toBe('Test description');
  });
});


