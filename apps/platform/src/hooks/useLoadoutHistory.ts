/**
 * useLoadoutHistory hook - Manage undo/redo history for avatar loadouts
 */

import { useState, useCallback, useRef } from 'react';
import type { AvatarLoadout } from '@engine/avatar';

export interface LoadoutHistoryState {
  history: AvatarLoadout[];
  currentIndex: number;
  canUndo: boolean;
  canRedo: boolean;
}

const MAX_HISTORY_SIZE = 50;

/**
 * Hook for managing undo/redo history of avatar loadouts
 */
export function useLoadoutHistory(initialLoadout: AvatarLoadout) {
  const [history, setHistory] = useState<AvatarLoadout[]>([initialLoadout]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const isPushingRef = useRef(false);

  const canUndo = currentIndex > 0;
  const canRedo = currentIndex < history.length - 1;

  /**
   * Push a new loadout to history
   * This will truncate any "future" history if we're not at the end
   */
  const pushToHistory = useCallback((loadout: AvatarLoadout) => {
    // Prevent pushing during undo/redo operations
    if (isPushingRef.current) {
      return;
    }

    let newIndex: number;
    setHistory((prevHistory) => {
      const newHistory = prevHistory.slice(0, currentIndex + 1);
      newHistory.push(loadout);

      // Limit history size
      const willExceedMax = newHistory.length > MAX_HISTORY_SIZE;
      if (willExceedMax) {
        newHistory.shift();
        // Index stays the same when we remove first item
        newIndex = currentIndex;
      } else {
        newIndex = currentIndex + 1;
      }

      return newHistory;
    });

    setCurrentIndex(newIndex);
  }, [currentIndex]);

  /**
   * Undo - go back one step in history
   */
  const undo = useCallback((): AvatarLoadout | null => {
    if (!canUndo) {
      return null;
    }

    isPushingRef.current = true;
    const newIndex = currentIndex - 1;
    setCurrentIndex(newIndex);
    const loadout = history[newIndex];
    isPushingRef.current = false;

    return loadout;
  }, [canUndo, currentIndex, history]);

  /**
   * Redo - go forward one step in history
   */
  const redo = useCallback((): AvatarLoadout | null => {
    if (!canRedo) {
      return null;
    }

    isPushingRef.current = true;
    const newIndex = currentIndex + 1;
    setCurrentIndex(newIndex);
    const loadout = history[newIndex];
    isPushingRef.current = false;

    return loadout;
  }, [canRedo, currentIndex, history]);

  /**
   * Reset history with a new initial loadout
   */
  const resetHistory = useCallback((loadout: AvatarLoadout) => {
    setHistory([loadout]);
    setCurrentIndex(0);
  }, []);

  /**
   * Get current loadout from history
   */
  const getCurrentLoadout = useCallback((): AvatarLoadout => {
    return history[currentIndex];
  }, [history, currentIndex]);

  return {
    pushToHistory,
    undo,
    redo,
    resetHistory,
    getCurrentLoadout,
    canUndo,
    canRedo,
    historyLength: history.length,
    currentIndex,
  };
}

