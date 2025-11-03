import type { Scene } from '../core/Scene.js';

export interface RecipeIngredient { id: string; quantity: number }
export interface RecipeOutput { id: string; quantity: number }
export interface Recipe { id: string; inputs: RecipeIngredient[]; outputs: RecipeOutput[]; }

export class CraftingSystem {
  // @ts-expect-error - Reserved for future use
  private readonly _scene: Scene;
  private readonly recipes = new Map<string, Recipe>();

  constructor(scene: Scene, recipes: Recipe[] = []) {
    this._scene = scene;
    for (const r of recipes) this.recipes.set(r.id, r);
  }

  addRecipe(recipe: Recipe): void {
    this.recipes.set(recipe.id, recipe);
  }

  hasRecipe(id: string): boolean { return this.recipes.has(id); }
}


