export class AnimationWorld {
  constructor() {}
  free() {}
  add_skeleton() {}
  create_instance() {
    return true;
  }
  remove_instance() {}
  get_output_buffer() {
    return new Float32Array(0);
  }
  set_instance_bone() {}
  set_instance_state() {}
  get_output_buffer_len() {
    return 0;
  }
  get_output_buffer_ptr() {
    return 0;
  }
  get_instance_joint_count() {
    return 0;
  }
  get_instance_local_scales_ptr() {
    return 0;
  }
  get_instance_local_rotations_ptr() {
    return 0;
  }
  get_instance_local_translations_ptr() {
    return 0;
  }
  step() {}
  add_clip() {}
  [Symbol.dispose]() {}
}

export function init() {
  return Promise.resolve();
}

export default init;
