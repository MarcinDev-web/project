import type { Vec3, Quat } from '@engine/core/math';

export type AnimationInterpolation = 'step' | 'linear' | 'cubic';

export type AnimationEasing = 'linear' | 'ease-in' | 'ease-out' | 'ease-in-out';

export type AnimationParameterType = 'bool' | 'number' | 'trigger';

export interface AnimationParameterBase {
  name: string;
  type: AnimationParameterType;
}

export interface BoolAnimationParameter extends AnimationParameterBase {
  type: 'bool';
  defaultValue?: boolean;
}

export interface NumberAnimationParameter extends AnimationParameterBase {
  type: 'number';
  defaultValue?: number;
  min?: number;
  max?: number;
}

export interface TriggerAnimationParameter extends AnimationParameterBase {
  type: 'trigger';
}

export type AnimationParameter =
  | BoolAnimationParameter
  | NumberAnimationParameter
  | TriggerAnimationParameter;

export type AnimationParameterValue = boolean | number | null;

export type AnimationParameters = Record<string, AnimationParameterValue>;

export type TransitionConditionOp =
  | '=='
  | '!='
  | '>'
  | '>='
  | '<'
  | '<='
  | 'triggered';

export interface TransitionCondition {
  parameter: string;
  operator: TransitionConditionOp;
  value?: boolean | number;
}

export interface AnimationKeyframe<T> {
  time: number;
  value: T;
  easing?: AnimationEasing;
}

export type TransformProperty = 'position' | 'rotation' | 'scale';

export interface TransformTarget {
  type: 'transform';
  property: TransformProperty;
}

export interface BoneTarget {
  type: 'bone';
  bone: string;
  property: TransformProperty;
}

export type AnimationTarget = TransformTarget | BoneTarget;

export type AnimationValue = number | Vec3 | Quat;

export type AnimationTrackType = 'number' | 'vec3' | 'quat';

export interface AnimationTrack<T extends AnimationValue = AnimationValue> {
  id: string;
  target: AnimationTarget;
  interpolation: AnimationInterpolation;
  valueType: AnimationTrackType;
  keyframes: AnimationKeyframe<T>[];
}

export interface AnimationSample {
  target: AnimationTarget;
  value: AnimationValue;
}

export interface AnimationTransitionJSON {
  to: string;
  conditions?: TransitionCondition[];
  blendDuration?: number;
  blendEasing?: AnimationEasing;
}

export interface AnimationClipJSON {
  name: string;
  duration: number;
  tracks: Array<{
    id: string;
    target: AnimationTarget;
    interpolation: AnimationInterpolation;
    valueType: AnimationTrackType;
    keyframes: AnimationKeyframe<AnimationValue>[];
  }>;
}

export interface AnimationStateJSON {
  name: string;
  clip: string;
  transitions?: AnimationTransitionJSON[];
}

export interface AnimationControllerJSON {
  clip: string;
  speed?: number;
  weight?: number;
  loop?: boolean;
}

export interface AnimationComponentJSON {
  clips: AnimationClipJSON[];
  controllers?: Record<string, AnimationControllerJSON>;
  states?: AnimationStateJSON[];
  parameters?: AnimationParameter[];
  parameterValues?: AnimationParameters;
  activeState?: string;
}

