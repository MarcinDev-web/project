import type { Vec3 } from '../math';

interface AudioContextConstructor {
  new (contextOptions?: AudioContextOptions): AudioContext;
}

interface GlobalAudioScope {
  AudioContext?: AudioContextConstructor;
  webkitAudioContext?: AudioContextConstructor;
}

const DEFAULT_FORWARD: Vec3 = [0, 0, -1];
const DEFAULT_UP: Vec3 = [0, 1, 0];

function toParamValue(param: AudioParam, value: number): void {
  if (Number.isFinite(value)) {
    try {
      if (typeof param.cancelScheduledValues === 'function') {
        param.cancelScheduledValues(0);
      }
      if (typeof param.setValueAtTime === 'function') {
        param.setValueAtTime(value, 0);
      } else {
        param.value = value;
      }
    } catch {
      param.value = value;
    }
  } else {
    param.value = value;
  }
}

function getGlobalScope(): GlobalAudioScope | null {
  if (typeof globalThis === 'undefined') {
    return null;
  }
  return globalThis as GlobalAudioScope;
}

function hasNativeAudioContext(): boolean {
  const scope = getGlobalScope();
  if (!scope) {
    return false;
  }
  return Boolean(scope.AudioContext ?? scope.webkitAudioContext);
}

function createNativeContext(): AudioContext | null {
  const scope = getGlobalScope();
  if (!scope) {
    return null;
  }
  const Ctor = scope.AudioContext ?? scope.webkitAudioContext;
  if (!Ctor) {
    return null;
  }
  try {
    return new Ctor();
  } catch {
    return null;
  }
}

async function defaultFetchArrayBuffer(url: string): Promise<ArrayBuffer> {
  if (typeof fetch === 'undefined') {
    throw new Error('fetch is not available in this environment');
  }
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Failed to load audio: ${response.status} ${response.statusText}`);
  }
  return await response.arrayBuffer();
}

function applyPosition(node: AudioListener | PannerNode, position: Vec3): void {
  const [x, y, z] = position;
  if ('positionX' in node && node.positionX) {
    toParamValue(node.positionX, x ?? 0);
    toParamValue(node.positionY!, y ?? 0);
    toParamValue(node.positionZ!, z ?? 0);
  } else if ('setPosition' in node && typeof node.setPosition === 'function') {
    node.setPosition(x ?? 0, y ?? 0, z ?? 0);
  }
}

function applyOrientation(node: AudioListener | PannerNode, forward: Vec3, up: Vec3 | null = null): void {
  const [fx, fy, fz] = forward;
  if ('forwardX' in node && node.forwardX) {
    toParamValue(node.forwardX, fx ?? 0);
    toParamValue(node.forwardY!, fy ?? 0);
    toParamValue(node.forwardZ!, fz ?? 0);
    const upVec = up ?? DEFAULT_UP;
    toParamValue(node.upX!, upVec[0] ?? 0);
    toParamValue(node.upY!, upVec[1] ?? 0);
    toParamValue(node.upZ!, upVec[2] ?? 0);
  } else if ('setOrientation' in node && typeof node.setOrientation === 'function') {
    const upVec = up ?? DEFAULT_UP;
    node.setOrientation(fx ?? 0, fy ?? 0, fz ?? 0, upVec[0] ?? 0, upVec[1] ?? 0, upVec[2] ?? 0);
  }
}

export interface AudioGraph {
  context: AudioContext;
  masterGain: GainNode;
  musicGain: GainNode;
  sfxGain: GainNode;
}

export interface AudioSystemOptions {
  contextFactory?: () => AudioContext | null;
  contextDetector?: () => boolean;
  fetcher?: (url: string) => Promise<ArrayBuffer>;
  debug?: boolean;
}

export interface SfxClipDefinition {
  key: string;
  url?: string;
  buffer?: AudioBuffer;
  loop?: boolean;
  volume?: number;
  spatial?: boolean;
  playbackRate?: number;
  refDistance?: number;
  maxDistance?: number;
  rolloffFactor?: number;
  distanceModel?: DistanceModelType;
}

export interface PlaySfxOptions {
  buffer?: AudioBuffer;
  url?: string;
  volume?: number;
  loop?: boolean;
  playbackRate?: number;
  position?: Vec3;
  orientation?: Vec3;
  spatial?: boolean;
  refDistance?: number;
  maxDistance?: number;
  rolloffFactor?: number;
  distanceModel?: DistanceModelType;
  onEnded?: () => void;
}

export interface PlayMusicOptions {
  buffer?: AudioBuffer;
  url?: string;
  loop?: boolean;
  volume?: number;
  fadeSeconds?: number;
  playbackRate?: number;
  onEnded?: () => void;
}

export interface MusicTrackDefinition {
  key: string;
  url?: string;
  buffer?: AudioBuffer;
  loop?: boolean;
  volume?: number;
  playbackRate?: number;
}

export interface AudioPlaybackHandle {
  stop(): void;
  isPlaying(): boolean;
}

class OneShotHandle implements AudioPlaybackHandle {
  private stopped = false;

  constructor(private readonly source: AudioBufferSourceNode, private readonly cleanup: () => void) {}

  stop(): void {
    if (this.stopped) return;
    this.stopped = true;
    try {
      this.source.stop();
    } catch {
      // ignore stop errors during cleanup
    }
    this.cleanup();
  }

  isPlaying(): boolean {
    return !this.stopped;
  }
}

class MusicInstance implements AudioPlaybackHandle {
  private stopped = false;

  constructor(
    public readonly key: string | null,
    private readonly source: AudioBufferSourceNode,
    private readonly gain: GainNode,
    private readonly onDispose: () => void
  ) {}

  stop(): void {
    if (this.stopped) return;
    this.stopped = true;
    try {
      this.source.stop();
    } catch {
      // ignore
    }
    this.onDispose();
  }

  isPlaying(): boolean {
    return !this.stopped;
  }

  getGain(): GainNode {
    return this.gain;
  }
}

export class SpatialAudioSource implements AudioPlaybackHandle {
  private source: AudioBufferSourceNode | null = null;
  private disposed = false;
  private loop = false;
  private playbackRate = 1;

  constructor(
    private readonly context: AudioContext,
    private buffer: AudioBuffer,
    private readonly panner: PannerNode,
    private readonly gain: GainNode,
    private readonly output: GainNode,
    private readonly onDispose: () => void,
    options: { loop?: boolean; volume?: number; playbackRate?: number; position?: Vec3; orientation?: Vec3; }
  ) {
    this.loop = options.loop ?? false;
    this.playbackRate = options.playbackRate ?? 1;
    const volume = options.volume ?? 1;
    toParamValue(this.gain.gain, volume);
    this.panner.connect(this.gain);
    this.gain.connect(this.output);
    if (options.position) {
      this.setPosition(options.position);
    }
    if (options.orientation) {
      this.setOrientation(options.orientation);
    }
  }

  async play(): Promise<void> {
    if (this.disposed) {
      throw new Error('SpatialAudioSource has been disposed');
    }
    this.stop();
    const source = this.context.createBufferSource();
    source.buffer = this.buffer;
    source.loop = this.loop;
    toParamValue(source.playbackRate, this.playbackRate);
    source.connect(this.panner);
    source.start();
    source.onended = () => {
      if (this.source === source) {
        this.source = null;
      }
    };
    this.source = source;
  }

  stop(): void {
    if (!this.source) return;
    try {
      this.source.stop();
    } catch {
      // ignore stop errors for already stopped nodes
    }
    this.source.disconnect();
    this.source = null;
  }

  dispose(): void {
    if (this.disposed) return;
    this.stop();
    this.panner.disconnect();
    this.gain.disconnect();
    try {
      this.onDispose();
    } catch {
      // ignore callback errors
    }
    this.disposed = true;
  }

  isPlaying(): boolean {
    return !!this.source;
  }

  setPosition(position: Vec3): void {
    applyPosition(this.panner, position);
  }

  setOrientation(direction: Vec3, up?: Vec3): void {
    applyOrientation(this.panner, direction, up ?? DEFAULT_UP);
  }

  setVolume(volume: number): void {
    toParamValue(this.gain.gain, Math.max(0, Math.min(1, volume)));
  }

  setLoop(loop: boolean): void {
    this.loop = loop;
    if (this.source) {
      this.source.loop = loop;
    }
  }

  setPlaybackRate(rate: number): void {
    this.playbackRate = rate;
    if (this.source) {
      toParamValue(this.source.playbackRate, rate);
    }
  }

  updateBuffer(buffer: AudioBuffer): void {
    this.buffer = buffer;
    if (this.source) {
      this.stop();
    }
  }

  getBuffer(): AudioBuffer {
    return this.buffer;
  }
}

export class SfxManager {
  private readonly clips = new Map<string, SfxClipDefinition>();
  private readonly active = new Set<AudioPlaybackHandle>();

  constructor(private readonly system: AudioSystem) {}

  registerClip(definition: SfxClipDefinition): void {
    this.clips.set(definition.key, definition);
  }

  unregisterClip(key: string): void {
    this.clips.delete(key);
  }

  hasClip(key: string): boolean {
    return this.clips.has(key);
  }

  async playClip(key: string, overrides: PlaySfxOptions = {}): Promise<AudioPlaybackHandle | null> {
    const clip = this.clips.get(key);
    if (!clip) {
      return null;
    }
    const merged: PlaySfxOptions = { ...overrides };
    if (clip.url !== undefined) merged.url = clip.url;
    if (clip.buffer !== undefined) merged.buffer = clip.buffer;
    if (clip.loop !== undefined) merged.loop = clip.loop;
    if (clip.volume !== undefined) merged.volume = clip.volume;
    if (clip.spatial !== undefined) merged.spatial = clip.spatial;
    if (clip.playbackRate !== undefined) merged.playbackRate = clip.playbackRate;
    if (clip.refDistance !== undefined) merged.refDistance = clip.refDistance;
    if (clip.maxDistance !== undefined) merged.maxDistance = clip.maxDistance;
    if (clip.rolloffFactor !== undefined) merged.rolloffFactor = clip.rolloffFactor;
    if (clip.distanceModel !== undefined) merged.distanceModel = clip.distanceModel;
    return await this.play(merged);
  }

  async play(options: PlaySfxOptions): Promise<AudioPlaybackHandle | null> {
    const graph = await this.system.ensureGraph();
    if (!graph) {
      return null;
    }
    const buffer = options.buffer ?? (options.url ? await this.system.loadBuffer(options.url) : null);
    if (!buffer) {
      return null;
    }
    await this.system.resume();

    const source = graph.context.createBufferSource();
    source.buffer = buffer;
    source.loop = options.loop ?? false;
    toParamValue(source.playbackRate, options.playbackRate ?? 1);

    const gain = graph.context.createGain();
    const volume = Math.max(0, Math.min(1, options.volume ?? 1));
    toParamValue(gain.gain, volume);

    let lastNode: AudioNode = source;
    if (options.spatial || options.position) {
      const panner = graph.context.createPanner();
      panner.panningModel = options.distanceModel ? 'HRTF' : panner.panningModel;
      if (options.distanceModel) {
        panner.distanceModel = options.distanceModel;
      }
      if (typeof options.refDistance === 'number') {
        panner.refDistance = options.refDistance;
      }
      if (typeof options.maxDistance === 'number') {
        panner.maxDistance = options.maxDistance;
      }
      if (typeof options.rolloffFactor === 'number') {
        panner.rolloffFactor = options.rolloffFactor;
      }
      applyPosition(panner, options.position ?? [0, 0, 0]);
      if (options.orientation) {
        applyOrientation(panner, options.orientation, DEFAULT_UP);
      }
      lastNode.connect(panner);
      lastNode = panner;
    }

    lastNode.connect(gain);
    gain.connect(graph.sfxGain);

    return this.trackOneShot(source, gain, options.onEnded);
  }

  async createSpatialSource(
    options: {
      buffer?: AudioBuffer;
      url?: string;
      loop?: boolean;
      volume?: number;
      playbackRate?: number;
      position?: Vec3;
      orientation?: Vec3;
      refDistance?: number;
      maxDistance?: number;
      rolloffFactor?: number;
      distanceModel?: DistanceModelType;
    }
  ): Promise<SpatialAudioSource | null> {
    const graph = await this.system.ensureGraph();
    if (!graph) {
      return null;
    }
    const buffer = options.buffer ?? (options.url ? await this.system.loadBuffer(options.url) : null);
    if (!buffer) {
      return null;
    }
    const panner = graph.context.createPanner();
    if (options.distanceModel) {
      panner.distanceModel = options.distanceModel;
    }
    if (typeof options.refDistance === 'number') {
      panner.refDistance = options.refDistance;
    }
    if (typeof options.rolloffFactor === 'number') {
      panner.rolloffFactor = options.rolloffFactor;
    }
    if (typeof options.maxDistance === 'number') {
      panner.maxDistance = options.maxDistance;
    }
    const gain = graph.context.createGain();
    let created: SpatialAudioSource | null = null;
    const onDispose = () => {
      if (created) {
        this.active.delete(created);
      }
    };
    const source = new SpatialAudioSource(
      graph.context,
      buffer,
      panner,
      gain,
      graph.sfxGain,
      onDispose,
      options
    );
    created = source;
    this.active.add(source);
    return source;
  }

  stopAll(): void {
    for (const handle of this.active) {
      handle.stop();
    }
    this.active.clear();
  }

  private trackOneShot(source: AudioBufferSourceNode, gain: GainNode, onEnded?: () => void): AudioPlaybackHandle {
    const handle = new OneShotHandle(source, () => {
      source.onended = null;
      try {
        source.disconnect();
      } catch {
        // ignore
      }
      try {
        gain.disconnect();
      } catch {
        // ignore
      }
      this.active.delete(handle);
      if (onEnded) {
        onEnded();
      }
    });
    source.onended = () => handle.stop();
    this.active.add(handle);
    source.start();
    return handle;
  }
}

export class MusicManager {
  private readonly tracks = new Map<string, MusicTrackDefinition>();
  private active: MusicInstance | null = null;

  constructor(private readonly system: AudioSystem) {}

  registerTrack(definition: MusicTrackDefinition): void {
    this.tracks.set(definition.key, definition);
  }

  unregisterTrack(key: string): void {
    this.tracks.delete(key);
  }

  hasTrack(key: string): boolean {
    return this.tracks.has(key);
  }

  async play(keyOrOptions: string | PlayMusicOptions, overrides: PlayMusicOptions = {}): Promise<AudioPlaybackHandle | null> {
    let options: PlayMusicOptions & { key?: string };
    if (typeof keyOrOptions === 'string') {
      const track = this.tracks.get(keyOrOptions);
      if (!track) {
        return null;
      }
      const base: PlayMusicOptions & { key?: string } = { key: track.key };
      if (track.url !== undefined) base.url = track.url;
      if (track.buffer !== undefined) base.buffer = track.buffer;
      if (track.loop !== undefined) base.loop = track.loop;
      if (track.volume !== undefined) base.volume = track.volume;
      if (track.playbackRate !== undefined) base.playbackRate = track.playbackRate;
      options = { ...base, ...overrides };
    } else {
      options = { ...keyOrOptions, ...overrides };
    }

    const graph = await this.system.ensureGraph();
    if (!graph) {
      return null;
    }

    const buffer = options.buffer ?? (options.url ? await this.system.loadBuffer(options.url) : null);
    if (!buffer) {
      return null;
    }

    await this.system.resume();

    const source = graph.context.createBufferSource();
    source.buffer = buffer;
    source.loop = options.loop ?? false;
    toParamValue(source.playbackRate, options.playbackRate ?? 1);

    const gain = graph.context.createGain();
    const volume = Math.max(0, Math.min(1, options.volume ?? this.system.getMusicVolume()));
    toParamValue(gain.gain, volume);
    source.connect(gain);
    gain.connect(graph.musicGain);

    const previous = this.active;
    if (previous) {
      this.fadeOutAndStop(previous, options.fadeSeconds ?? 0.3);
    }

    const instance = new MusicInstance(options.key ?? null, source, gain, () => {
      source.onended = null;
      try {
        source.disconnect();
      } catch {
        // ignore
      }
      try {
        gain.disconnect();
      } catch {
        // ignore
      }
      if (this.active === instance) {
        this.active = null;
      }
      if (options.onEnded) {
        options.onEnded();
      }
    });

    source.onended = () => instance.stop();
    this.active = instance;
    source.start();
    return instance;
  }

  stop(fadeSeconds = 0.2): void {
    if (!this.active) return;
    this.fadeOutAndStop(this.active, fadeSeconds);
  }

  clear(): void {
    this.stop(0);
    this.tracks.clear();
  }

  private fadeOutAndStop(instance: MusicInstance, fadeSeconds: number): void {
    const gainNode = instance.getGain();
    const param = gainNode.gain;
    if (fadeSeconds > 0 && typeof param.linearRampToValueAtTime === 'function') {
      try {
        const context = gainNode.context ?? this.system.getContext();
        const startTime = context?.currentTime ?? 0;
        if (typeof param.cancelScheduledValues === 'function') {
          param.cancelScheduledValues(startTime);
        }
        if (typeof param.setValueAtTime === 'function') {
          param.setValueAtTime(param.value, startTime);
        }
        param.linearRampToValueAtTime(0, startTime + fadeSeconds);
        setTimeout(() => instance.stop(), fadeSeconds * 1000);
        return;
      } catch {
        // fall back to immediate stop below
      }
    }
    instance.stop();
  }
}

export class AudioSystem {
  private readonly contextFactory: () => AudioContext | null;
  private readonly contextDetector: () => boolean;
  private readonly fetcher: (url: string) => Promise<ArrayBuffer>;
  private readonly debug: boolean;

  private contextPromise: Promise<AudioContext | null> | null = null;
  private context: AudioContext | null = null;
  private graph: AudioGraph | null = null;

  private masterVolume = 1;
  private musicVolume = 0.8;
  private sfxVolume = 1;
  private muted = false;

  private readonly bufferCache = new Map<string, AudioBuffer>();
  private readonly bufferPromises = new Map<string, Promise<AudioBuffer>>();

  private listenerPosition: Vec3 = [0, 0, 0];
  private listenerForward: Vec3 = [...DEFAULT_FORWARD];
  private listenerUp: Vec3 = [...DEFAULT_UP];

  public readonly sfx: SfxManager;
  public readonly music: MusicManager;

  constructor(options: AudioSystemOptions = {}) {
    this.contextFactory = options.contextFactory ?? createNativeContext;
    this.contextDetector = options.contextDetector ?? hasNativeAudioContext;
    this.fetcher = options.fetcher ?? defaultFetchArrayBuffer;
    this.debug = options.debug ?? false;
    this.sfx = new SfxManager(this);
    this.music = new MusicManager(this);
  }

  isSupported(): boolean {
    return this.context !== null || this.contextDetector();
  }

  getContext(): AudioContext | null {
    return this.context;
  }

  async ready(): Promise<boolean> {
    const context = await this.ensureContext();
    return Boolean(context);
  }

  async resume(): Promise<void> {
    const context = await this.ensureContext();
    if (!context) {
      return;
    }
    if (context.state === 'suspended') {
      try {
        await context.resume();
      } catch (error) {
        if (this.debug) {
          console.warn('[AudioSystem] resume failed', error);
        }
      }
    }
  }

  async suspend(): Promise<void> {
    const context = await this.ensureContext();
    if (!context) {
      return;
    }
    if (context.state === 'running') {
      try {
        await context.suspend();
      } catch (error) {
        if (this.debug) {
          console.warn('[AudioSystem] suspend failed', error);
        }
      }
    }
  }

  async dispose(): Promise<void> {
    if (this.graph) {
      try {
        this.graph.masterGain.disconnect();
      } catch {
        // ignore
      }
      try {
        this.graph.musicGain.disconnect();
      } catch {
        // ignore
      }
      try {
        this.graph.sfxGain.disconnect();
      } catch {
        // ignore
      }
      this.graph = null;
    }
    const context = this.context;
    if (context) {
      try {
        await context.close();
      } catch {
        // ignore
      }
    }
    this.context = null;
    this.contextPromise = null;
    this.bufferCache.clear();
    this.bufferPromises.clear();
  }

  async loadBuffer(url: string): Promise<AudioBuffer> {
    if (this.bufferCache.has(url)) {
      return this.bufferCache.get(url)!;
    }
    if (this.bufferPromises.has(url)) {
      return await this.bufferPromises.get(url)!;
    }

    const promise = (async () => {
      const context = await this.ensureContext();
      if (!context) {
        throw new Error('AudioContext unavailable');
      }
      const data = await this.fetcher(url);
      const buffer = await context.decodeAudioData(data.slice(0));
      this.bufferCache.set(url, buffer);
      this.bufferPromises.delete(url);
      return buffer;
    })();

    this.bufferPromises.set(url, promise);
    return await promise;
  }

  setMasterVolume(volume: number): void {
    this.masterVolume = Math.max(0, Math.min(1, volume));
    if (this.graph) {
      const value = this.muted ? 0 : this.masterVolume;
      toParamValue(this.graph.masterGain.gain, value);
    }
  }

  getMasterVolume(): number {
    return this.masterVolume;
  }

  setMusicVolume(volume: number): void {
    this.musicVolume = Math.max(0, Math.min(1, volume));
    if (this.graph) {
      toParamValue(this.graph.musicGain.gain, this.musicVolume);
    }
  }

  getMusicVolume(): number {
    return this.musicVolume;
  }

  setSfxVolume(volume: number): void {
    this.sfxVolume = Math.max(0, Math.min(1, volume));
    if (this.graph) {
      toParamValue(this.graph.sfxGain.gain, this.sfxVolume);
    }
  }

  getSfxVolume(): number {
    return this.sfxVolume;
  }

  setMuted(muted: boolean): void {
    this.muted = muted;
    if (this.graph) {
      const value = this.muted ? 0 : this.masterVolume;
      toParamValue(this.graph.masterGain.gain, value);
    }
  }

  isMuted(): boolean {
    return this.muted;
  }

  async updateListener(position: Vec3, forward: Vec3 = this.listenerForward, up: Vec3 = this.listenerUp): Promise<void> {
    this.listenerPosition = [...position];
    this.listenerForward = [...forward];
    this.listenerUp = [...up];

    const graph = await this.ensureGraph();
    if (!graph) {
      return;
    }
    const listener = graph.context.listener;
    if (!listener) {
      return;
    }
    applyPosition(listener, position);
    applyOrientation(listener, forward, up);
  }

  async ensureGraph(): Promise<AudioGraph | null> {
    if (this.graph) {
      return this.graph;
    }
    const context = await this.ensureContext();
    if (!context) {
      return null;
    }
    const masterGain = context.createGain();
    const musicGain = context.createGain();
    const sfxGain = context.createGain();
    masterGain.connect(context.destination);
    musicGain.connect(masterGain);
    sfxGain.connect(masterGain);

    toParamValue(masterGain.gain, this.muted ? 0 : this.masterVolume);
    toParamValue(musicGain.gain, this.musicVolume);
    toParamValue(sfxGain.gain, this.sfxVolume);

    const graph: AudioGraph = {
      context,
      masterGain,
      musicGain,
      sfxGain,
    };
    this.graph = graph;

    if (context.listener) {
      applyPosition(context.listener, this.listenerPosition);
      applyOrientation(context.listener, this.listenerForward, this.listenerUp);
    }

    return graph;
  }

  private async ensureContext(): Promise<AudioContext | null> {
    if (this.context) {
      return this.context;
    }
    if (!this.contextPromise) {
      this.contextPromise = (async () => {
        if (!this.isSupported()) {
          return null;
        }
        const context = this.contextFactory();
        this.context = context;
        return context;
      })();
    }
    return await this.contextPromise;
  }
}

export const audioSystem = new AudioSystem();
