/**
 * Animation state names for character animations
 *
 * These names correspond to animation clips that should be loaded
 * into AnimationComponent for character controllers.
 */
export enum AnimationStateName {
  Idle = 'idle',
  Walk = 'walk',
  Run = 'run',
  Jump = 'jump',
  Fall = 'fall',
  Land = 'land',
}
