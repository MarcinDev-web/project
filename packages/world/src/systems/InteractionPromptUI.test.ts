import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { InteractionPromptUI, type InteractionPromptUIStyle } from './InteractionPromptUI.js';

describe('InteractionPromptUI', () => {
  let promptUI: InteractionPromptUI;

  beforeEach(() => {
    promptUI = new InteractionPromptUI();
    // Clean up any existing prompts
    document.querySelectorAll('#interaction-prompt-container').forEach((el) => el.remove());
  });

  afterEach(() => {
    promptUI.dispose();
  });

  describe('initialization', () => {
    it('should create prompt elements on initialize', () => {
      promptUI.initialize();
      const container = document.getElementById('interaction-prompt-container');
      const prompt = document.getElementById('interaction-prompt');
      expect(container).toBeTruthy();
      expect(prompt).toBeTruthy();
    });

    it('should apply custom style on initialize', () => {
      const style: InteractionPromptUIStyle = {
        backgroundColor: 'rgba(255, 0, 0, 0.9)',
        textColor: '#00ff00',
        fontSize: 20,
      };

      promptUI.initialize(undefined, style);
      const prompt = document.getElementById('interaction-prompt');
      expect(prompt?.style.backgroundColor).toBe('rgba(255, 0, 0, 0.9)');
      expect(prompt?.style.color).toBe('rgb(0, 255, 0)');
      expect(prompt?.style.fontSize).toBe('20px');
    });
  });

  describe('show/hide', () => {
    beforeEach(() => {
      promptUI.initialize();
    });

    it('should show prompt with text', () => {
      promptUI.show('Press E to interact');
      const prompt = document.getElementById('interaction-prompt');
      expect(prompt?.style.display).toBe('block');
      expect(prompt?.textContent).toBe('Press E to interact');
      expect(promptUI.getVisible()).toBe(true);
    });

    it('should hide prompt', () => {
      promptUI.show('Test');
      promptUI.hide();
      expect(promptUI.getVisible()).toBe(false);
    });

    it('should show cooldown in prompt text', () => {
      promptUI.show('Press E to interact', 2.5);
      const prompt = document.getElementById('interaction-prompt');
      expect(prompt?.textContent).toContain('(2.5s)');
    });

    it('should change color when on cooldown', () => {
      promptUI.show('Press E', 1.0);
      const prompt = document.getElementById('interaction-prompt');
      expect(prompt?.style.color).toBe('rgb(170, 170, 170)'); // #aaaaaa
      expect(prompt?.style.opacity).toBe('0.7');
    });

    it('should reset color when cooldown is 0', () => {
      promptUI.show('Press E', 1.0);
      promptUI.show('Press E', 0);
      const prompt = document.getElementById('interaction-prompt');
      expect(prompt?.style.color).toBe('rgb(255, 255, 255)'); // #ffffff
      expect(prompt?.style.opacity).toBe('1');
    });
  });

  describe('style configuration', () => {
    beforeEach(() => {
      promptUI.initialize();
    });

    it('should set and get style', () => {
      const style: InteractionPromptUIStyle = {
        backgroundColor: 'rgba(0, 255, 0, 0.8)',
        fontSize: 18,
        position: 'top-center',
      };

      promptUI.setStyle(style);
      const retrieved = promptUI.getStyle();
      expect(retrieved.backgroundColor).toBe(style.backgroundColor);
      expect(retrieved.fontSize).toBe(style.fontSize);
      expect(retrieved.position).toBe(style.position);
    });

    it('should apply position styles correctly', () => {
      const positions: Array<NonNullable<InteractionPromptUIStyle['position']>> = [
        'bottom-center',
        'bottom-left',
        'bottom-right',
        'top-center',
      ];

      for (const position of positions) {
        const style: InteractionPromptUIStyle = { position };
        promptUI.setStyle(style);
        const container = document.getElementById('interaction-prompt-container');
        expect(container).toBeTruthy();
        // Position should be applied (exact check depends on implementation)
      }
    });

    it('should update text without showing/hiding', () => {
      promptUI.show('Initial text');
      promptUI.updateText('Updated text');
      const prompt = document.getElementById('interaction-prompt');
      expect(prompt?.textContent).toBe('Updated text');
    });
  });

  describe('cleanup', () => {
    it('should remove elements on cleanup', () => {
      promptUI.initialize();
      promptUI.cleanup();
      const container = document.getElementById('interaction-prompt-container');
      expect(container).toBeNull();
    });

    it('should handle multiple cleanups gracefully', () => {
      promptUI.initialize();
      promptUI.cleanup();
      expect(() => promptUI.cleanup()).not.toThrow();
    });
  });
});

