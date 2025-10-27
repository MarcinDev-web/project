export interface LoadingProgress {
  /** Human-readable step name, e.g. "Build runtime world" */
  step: string;
  /** Current work units completed within the step (e.g. processed entities) */
  current: number;
  /** Total work units in the step */
  total: number;
  /** 0-100 aggregated percentage across all steps (rounded) */
  percentage: number;
  /** Optional user-facing message for finer-grained updates */
  message: string;
}

export type ProgressCallback = (progress: LoadingProgress) => void;

export function clampPercentage(value: number): number {
  if (Number.isNaN(value)) return 0;
  if (value < 0) return 0;
  if (value > 100) return 100;
  return Math.round(value);
}


