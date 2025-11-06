export interface FrameLimits {
  maxControlBytes: number;
  maxStateBytes: number;
}

export function validateControlFrameLength(len: number, limits: FrameLimits): boolean {
  return len >= 0 && len <= limits.maxControlBytes;
}

export function validateStateFrameLength(len: number, limits: FrameLimits): boolean {
  return len >= 0 && len <= limits.maxStateBytes;
}
