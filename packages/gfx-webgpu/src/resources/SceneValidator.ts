/**
 * SceneValidator - Validates materials and textures when loading scenes
 * 
 * Provides:
 * - Pre-load validation of scene materials
 * - Automatic fallback assignment for missing materials
 * - Detailed validation reports
 */

import type { MaterialRegistry, MaterialDefinition, MaterialCategory } from '../materials/MaterialRegistry';
import type { ResourceDiagnostics } from './ResourceDiagnostics';

// ============================================================================
// Types
// ============================================================================

export interface SceneMaterialReference {
  /** Entity ID or name */
  entityId: string;
  /** Material reference (string ID) */
  materialRef: string;
  /** Material ID (numeric, legacy) */
  materialId?: number;
}

export interface SceneValidationResult {
  /** Whether all materials are valid */
  valid: boolean;
  /** Total materials checked */
  totalMaterials: number;
  /** Valid materials count */
  validMaterials: number;
  /** Missing material references */
  missingMaterials: MissingMaterialInfo[];
  /** Materials with errors */
  errorMaterials: ErrorMaterialInfo[];
  /** Warnings (non-critical issues) */
  warnings: ValidationWarning[];
  /** Suggested fallbacks for missing materials */
  suggestedFallbacks: Map<string, string>;
}

export interface MissingMaterialInfo {
  /** The missing material reference */
  materialRef: string;
  /** Entities using this material */
  usedBy: string[];
  /** Suggested fallback material */
  suggestedFallback: string;
}

export interface ErrorMaterialInfo {
  /** Material reference */
  materialRef: string;
  /** Error message */
  error: string;
  /** Entities using this material */
  usedBy: string[];
}

export interface ValidationWarning {
  /** Warning type */
  type: 'deprecated' | 'performance' | 'compatibility' | 'general';
  /** Warning message */
  message: string;
  /** Related material (if any) */
  materialRef?: string;
}

// ============================================================================
// SceneValidator
// ============================================================================

export class SceneValidator {
  private materialRegistry: MaterialRegistry;
  private diagnostics: ResourceDiagnostics | null;

  constructor(
    materialRegistry: MaterialRegistry,
    diagnostics?: ResourceDiagnostics
  ) {
    this.materialRegistry = materialRegistry;
    this.diagnostics = diagnostics ?? null;
  }

  // -------------------------------------------------------------------------
  // Validation
  // -------------------------------------------------------------------------

  /**
   * Validate all material references in a scene.
   */
  validateSceneMaterials(materialRefs: SceneMaterialReference[]): SceneValidationResult {
    const result: SceneValidationResult = {
      valid: true,
      totalMaterials: 0,
      validMaterials: 0,
      missingMaterials: [],
      errorMaterials: [],
      warnings: [],
      suggestedFallbacks: new Map(),
    };

    // Group references by material
    const materialUsage = new Map<string, string[]>();
    const numericIdUsage = new Map<number, string[]>();

    for (const ref of materialRefs) {
      // Track string references
      if (ref.materialRef) {
        const existing = materialUsage.get(ref.materialRef) ?? [];
        existing.push(ref.entityId);
        materialUsage.set(ref.materialRef, existing);
      }

      // Track numeric IDs (legacy)
      if (ref.materialId !== undefined) {
        const existing = numericIdUsage.get(ref.materialId) ?? [];
        existing.push(ref.entityId);
        numericIdUsage.set(ref.materialId, existing);
      }
    }

    result.totalMaterials = materialUsage.size;

    // Validate each unique material reference
    for (const [materialRef, usedBy] of materialUsage) {
      const material = this.materialRegistry.get(materialRef);

      if (!material) {
        // Material not found
        result.valid = false;
        const fallback = this.suggestFallback(materialRef);
        
        result.missingMaterials.push({
          materialRef,
          usedBy,
          suggestedFallback: fallback,
        });
        result.suggestedFallbacks.set(materialRef, fallback);

        this.diagnostics?.recordWarning({
          type: 'missing_texture',
          id: materialRef,
          message: `Material "${materialRef}" not found, used by ${usedBy.length} entities`,
        });

      } else if (material.status === 'error') {
        // Material has error
        result.valid = false;
        
        result.errorMaterials.push({
          materialRef,
          error: material.error ?? 'Unknown error',
          usedBy,
        });

        this.diagnostics?.recordError({
          type: 'material',
          id: materialRef,
          message: `Material "${materialRef}" in error state: ${material.error}`,
        });

      } else {
        // Material is valid
        result.validMaterials++;

        // Check for warnings
        this.checkMaterialWarnings(material, usedBy, result.warnings);
      }
    }

    // Warn about legacy numeric ID usage
    if (numericIdUsage.size > 0) {
      let hasUnresolvedNumericId = false;
      
      for (const [numericId, usedBy] of numericIdUsage) {
        const material = this.materialRegistry.getByAtlasIndex(numericId);
        if (!material) {
          hasUnresolvedNumericId = true;
          result.warnings.push({
            type: 'deprecated',
            message: `Numeric material ID ${numericId} used by ${usedBy.length} entities. Consider migrating to string materialRef.`,
          });
        }
      }

      if (!hasUnresolvedNumericId && numericIdUsage.size > 0) {
        result.warnings.push({
          type: 'deprecated',
          message: `${numericIdUsage.size} entities use numeric materialId. Consider migrating to string materialRef for better maintainability.`,
        });
      }
    }

    return result;
  }

  /**
   * Validate a single material reference.
   */
  validateMaterialRef(materialRef: string): {
    valid: boolean;
    material?: MaterialDefinition;
    error?: string;
    suggestedFallback?: string;
  } {
    const material = this.materialRegistry.get(materialRef);

    if (!material) {
      return {
        valid: false,
        error: `Material "${materialRef}" not found`,
        suggestedFallback: this.suggestFallback(materialRef),
      };
    }

    if (material.status === 'error') {
      return {
        valid: false,
        material,
        error: material.error ?? 'Material in error state',
        suggestedFallback: 'default',
      };
    }

    return { valid: true, material };
  }

  /**
   * Check if a material ID (numeric) is valid.
   */
  validateMaterialId(materialId: number): {
    valid: boolean;
    material?: MaterialDefinition;
    error?: string;
  } {
    const material = this.materialRegistry.getByAtlasIndex(materialId);

    if (!material) {
      return {
        valid: false,
        error: `No material registered for atlas index ${materialId}`,
      };
    }

    return { valid: true, material };
  }

  // -------------------------------------------------------------------------
  // Fallback Suggestions
  // -------------------------------------------------------------------------

  /**
   * Suggest a fallback material for a missing reference.
   */
  suggestFallback(materialRef: string): string {
    // Try to find a similar material by name
    const similar = this.findSimilarMaterial(materialRef);
    if (similar) return similar;

    // Try to determine category from name
    const category = this.guessCategoryFromName(materialRef);
    if (category) {
      const categoryMaterials = this.materialRegistry.getByCategory(category as MaterialCategory);
      if (categoryMaterials.length > 0) {
        return categoryMaterials[0]!.id;
      }
    }

    // Return default fallback
    return 'default';
  }

  /**
   * Find a similar material by name.
   */
  private findSimilarMaterial(materialRef: string): string | null {
    const lowerRef = materialRef.toLowerCase();
    const allMaterials = this.materialRegistry.listAll();

    // Exact substring match
    for (const mat of allMaterials) {
      if (mat.id.toLowerCase().includes(lowerRef) || lowerRef.includes(mat.id.toLowerCase())) {
        return mat.id;
      }
    }

    // Word overlap
    const refWords = lowerRef.split(/[_\s-]+/);
    for (const mat of allMaterials) {
      const matWords = mat.id.toLowerCase().split(/[_\s-]+/);
      const overlap = refWords.filter(w => matWords.includes(w));
      if (overlap.length > 0) {
        return mat.id;
      }
    }

    return null;
  }

  /**
   * Guess material category from name.
   */
  private guessCategoryFromName(name: string): string | null {
    const lowerName = name.toLowerCase();

    const categoryKeywords: Record<string, string[]> = {
      stone: ['stone', 'rock', 'cobble', 'granite', 'andesite', 'diorite', 'brick'],
      wood: ['wood', 'plank', 'log', 'oak', 'birch', 'spruce', 'jungle'],
      metal: ['iron', 'gold', 'copper', 'metal', 'steel'],
      glass: ['glass'],
      fabric: ['wool', 'carpet', 'cloth'],
      organic: ['dirt', 'grass', 'sand', 'gravel', 'clay'],
      decorative: ['concrete', 'terracotta'],
      special: ['glow', 'obsidian', 'bedrock'],
    };

    for (const [category, keywords] of Object.entries(categoryKeywords)) {
      if (keywords.some(kw => lowerName.includes(kw))) {
        return category;
      }
    }

    return null;
  }

  // -------------------------------------------------------------------------
  // Warnings
  // -------------------------------------------------------------------------

  /**
   * Check for material-specific warnings.
   */
  private checkMaterialWarnings(
    material: MaterialDefinition,
    usedBy: string[],
    warnings: ValidationWarning[]
  ): void {
    // Warn about loading materials
    if (material.status === 'loading') {
      warnings.push({
        type: 'performance',
        message: `Material "${material.id}" is still loading, used by ${usedBy.length} entities`,
        materialRef: material.id,
      });
    }

    // Warn about materials without textures (non-procedural)
    if (!material.isProcedural && !material.textures.albedo) {
      warnings.push({
        type: 'general',
        message: `Material "${material.id}" has no albedo texture defined`,
        materialRef: material.id,
      });
    }

    // Warn about transparent materials (performance)
    if (material.properties.alphaMode === 'blend' && usedBy.length > 100) {
      warnings.push({
        type: 'performance',
        message: `Transparent material "${material.id}" used by ${usedBy.length} entities (may impact performance)`,
        materialRef: material.id,
      });
    }
  }

  // -------------------------------------------------------------------------
  // Batch Operations
  // -------------------------------------------------------------------------

  /**
   * Apply fallbacks for all missing materials.
   */
  applyFallbacks(
    result: SceneValidationResult,
    onApply: (original: string, fallback: string) => void
  ): void {
    for (const missing of result.missingMaterials) {
      const fallback = result.suggestedFallbacks.get(missing.materialRef) ?? 'default';
      onApply(missing.materialRef, fallback);
    }
  }

  /**
   * Get a summary string of validation results.
   */
  getSummary(result: SceneValidationResult): string {
    const lines: string[] = [];

    lines.push(`Material Validation: ${result.valid ? 'PASSED' : 'FAILED'}`);
    lines.push(`  Total: ${result.totalMaterials}, Valid: ${result.validMaterials}`);

    if (result.missingMaterials.length > 0) {
      lines.push(`  Missing: ${result.missingMaterials.length}`);
      for (const m of result.missingMaterials.slice(0, 5)) {
        lines.push(`    - "${m.materialRef}" -> fallback: "${m.suggestedFallback}"`);
      }
      if (result.missingMaterials.length > 5) {
        lines.push(`    ... and ${result.missingMaterials.length - 5} more`);
      }
    }

    if (result.errorMaterials.length > 0) {
      lines.push(`  Errors: ${result.errorMaterials.length}`);
      for (const e of result.errorMaterials.slice(0, 3)) {
        lines.push(`    - "${e.materialRef}": ${e.error}`);
      }
    }

    if (result.warnings.length > 0) {
      lines.push(`  Warnings: ${result.warnings.length}`);
    }

    return lines.join('\n');
  }
}

