/**
 * Snapshot testing utilities for serialization
 */

import { expect } from 'vitest';

/**
 * Snapshot serialization options
 */
export interface SnapshotOptions {
  /**
   * Properties to exclude from snapshot
   */
  exclude?: string[];
  /**
   * Replace dynamic values (like timestamps, UUIDs)
   */
  replacements?: Record<string, unknown>;
  /**
   * Sort arrays before snapshotting for consistency
   */
  sortArrays?: boolean;
}

/**
 * Normalize an object for snapshot testing
 * Removes non-deterministic fields and sorts data
 */
export function normalizeForSnapshot<T>(obj: T, options: SnapshotOptions = {}): unknown {
  const { exclude = [], replacements = {}, sortArrays = true } = options;

  if (obj === null || obj === undefined) {
    return obj;
  }

  if (Array.isArray(obj)) {
    const normalized = obj.map((item) => normalizeForSnapshot(item, options));
    return sortArrays ? normalized.sort() : normalized;
  }

  if (obj instanceof Date) {
    const dateReplacement = replacements.Date;
    return typeof dateReplacement === 'string' ? dateReplacement : '<Date>';
  }

  if (typeof obj === 'object') {
    const normalized: Record<string, unknown> = {};

    for (const [key, value] of Object.entries(obj as Record<string, unknown>)) {
      // Skip excluded properties
      if (exclude.includes(key)) {
        continue;
      }

      // Apply replacements
      if (key in replacements) {
        normalized[key] = replacements[key];
        continue;
      }

      // Handle special cases
      if (key.toLowerCase().includes('timestamp') || key.toLowerCase().includes('time')) {
        normalized[key] = '<timestamp>';
        continue;
      }

      if (key.toLowerCase().includes('id') && typeof value === 'string' && value.length > 20) {
        normalized[key] = '<uuid>';
        continue;
      }

      // Recursively normalize
      normalized[key] = normalizeForSnapshot(value, options);
    }

    return normalized;
  }

  return obj;
}

/**
 * Create a snapshot matcher for complex objects
 */
export function expectToMatchSnapshot<T>(value: T, options?: SnapshotOptions) {
  const normalized = normalizeForSnapshot(value, options);
  expect(normalized).toMatchSnapshot();
}

/**
 * Inline snapshot matcher
 */
export function expectToMatchInlineSnapshot<T>(
  value: T,
  options?: SnapshotOptions,
  snapshot?: string
) {
  const normalized = normalizeForSnapshot(value, options);
  if (snapshot) {
    expect(normalized).toMatchInlineSnapshot(snapshot);
  } else {
    expect(normalized).toMatchInlineSnapshot();
  }
}

/**
 * Snapshot testing for JSON serialization
 */
export function expectJsonToMatchSnapshot(obj: unknown, options?: SnapshotOptions): void {
  const json = JSON.stringify(normalizeForSnapshot(obj, options), null, 2);
  expect(json).toMatchSnapshot();
}

/**
 * Snapshot testing for scene serialization
 */
export function expectSceneToMatchSnapshot(scene: unknown, options: SnapshotOptions = {}): void {
  const defaultOptions: SnapshotOptions = {
    exclude: ['_internal', '__proto__'],
    replacements: {},
    sortArrays: true,
    ...options,
  };

  const normalized = normalizeForSnapshot(scene, defaultOptions);
  expect(normalized).toMatchSnapshot();
}

/**
 * Compare two serializations for equality (useful for versioning tests)
 */
export function expectSerializationToEqual<T>(v1: T, v2: T, options?: SnapshotOptions): void {
  const normalized1 = normalizeForSnapshot(v1, options);
  const normalized2 = normalizeForSnapshot(v2, options);
  expect(normalized1).toEqual(normalized2);
}

/**
 * Test that serialization is stable (serialize -> deserialize -> serialize again)
 */
export function expectSerializationToBeStable<T>(
  value: T,
  serialize: (v: T) => string,
  deserialize: (s: string) => T
) {
  const serialized1 = serialize(value);
  const deserialized = deserialize(serialized1);
  const serialized2 = serialize(deserialized);

  expect(serialized1).toBe(serialized2);
}
