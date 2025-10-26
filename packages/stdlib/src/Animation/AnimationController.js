import { signal } from '@preact/signals-core';
import { AnimationClip } from './AnimationClip';
export class AnimationController {
    clip;
    time;
    playing;
    speed;
    weight;
    loop;
    constructor(options) {
        if (!options || typeof options !== 'object') {
            throw new TypeError('AnimationController options must be an object');
        }
        this.clip = options.clip;
        this.time = signal(0);
        this.playing = signal(true);
        this.speed = signal(Number.isFinite(options.speed ?? 1) ? options.speed ?? 1 : 1);
        this.weight = signal(Number.isFinite(options.weight ?? 1) ? options.weight ?? 1 : 1);
        this.loop = signal(options.loop ?? true);
    }
    play() {
        this.playing.value = true;
    }
    pause() {
        this.playing.value = false;
    }
    stop() {
        this.playing.value = false;
        this.time.value = 0;
    }
    update(deltaTime) {
        if (!this.playing.value)
            return;
        if (!Number.isFinite(deltaTime))
            return;
        const speed = this.speed.value;
        const nextTime = this.time.value + deltaTime * speed;
        if (this.loop.value) {
            this.time.value = ((nextTime % this.clip.duration) + this.clip.duration) % this.clip.duration;
        }
        else {
            if (nextTime >= this.clip.duration) {
                this.time.value = this.clip.duration;
                this.playing.value = false;
            }
            else {
                this.time.value = Math.max(0, nextTime);
            }
        }
    }
    sample() {
        return this.clip.sample(this.time.value);
    }
}
//# sourceMappingURL=AnimationController.js.map