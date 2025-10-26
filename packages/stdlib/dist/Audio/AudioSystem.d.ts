import type { Vec3 } from '@engine/core/math';
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
export declare class SpatialAudioSource implements AudioPlaybackHandle {
    private readonly context;
    private buffer;
    private readonly panner;
    private readonly gain;
    private readonly output;
    private readonly onDispose;
    private source;
    private disposed;
    private loop;
    private playbackRate;
    constructor(context: AudioContext, buffer: AudioBuffer, panner: PannerNode, gain: GainNode, output: GainNode, onDispose: () => void, options: {
        loop?: boolean;
        volume?: number;
        playbackRate?: number;
        position?: Vec3;
        orientation?: Vec3;
    });
    play(): Promise<void>;
    stop(): void;
    dispose(): void;
    isPlaying(): boolean;
    setPosition(position: Vec3): void;
    setOrientation(direction: Vec3, up?: Vec3): void;
    setVolume(volume: number): void;
    setLoop(loop: boolean): void;
    setPlaybackRate(rate: number): void;
    updateBuffer(buffer: AudioBuffer): void;
    getBuffer(): AudioBuffer;
}
export declare class SfxManager {
    private readonly system;
    private readonly clips;
    private readonly active;
    constructor(system: AudioSystem);
    registerClip(definition: SfxClipDefinition): void;
    unregisterClip(key: string): void;
    hasClip(key: string): boolean;
    playClip(key: string, overrides?: PlaySfxOptions): Promise<AudioPlaybackHandle | null>;
    play(options: PlaySfxOptions): Promise<AudioPlaybackHandle | null>;
    createSpatialSource(options: {
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
    }): Promise<SpatialAudioSource | null>;
    stopAll(): void;
    private trackOneShot;
}
export declare class MusicManager {
    private readonly system;
    private readonly tracks;
    private active;
    constructor(system: AudioSystem);
    registerTrack(definition: MusicTrackDefinition): void;
    unregisterTrack(key: string): void;
    hasTrack(key: string): boolean;
    play(keyOrOptions: string | PlayMusicOptions, overrides?: PlayMusicOptions): Promise<AudioPlaybackHandle | null>;
    stop(fadeSeconds?: number): void;
    clear(): void;
    private fadeOutAndStop;
}
export declare class AudioSystem {
    private readonly contextFactory;
    private readonly contextDetector;
    private readonly fetcher;
    private readonly debug;
    private contextPromise;
    private context;
    private graph;
    private masterVolume;
    private musicVolume;
    private sfxVolume;
    private muted;
    private readonly bufferCache;
    private readonly bufferPromises;
    private listenerPosition;
    private listenerForward;
    private listenerUp;
    readonly sfx: SfxManager;
    readonly music: MusicManager;
    constructor(options?: AudioSystemOptions);
    isSupported(): boolean;
    getContext(): AudioContext | null;
    ready(): Promise<boolean>;
    resume(): Promise<void>;
    suspend(): Promise<void>;
    dispose(): Promise<void>;
    loadBuffer(url: string): Promise<AudioBuffer>;
    setMasterVolume(volume: number): void;
    getMasterVolume(): number;
    setMusicVolume(volume: number): void;
    getMusicVolume(): number;
    setSfxVolume(volume: number): void;
    getSfxVolume(): number;
    setMuted(muted: boolean): void;
    isMuted(): boolean;
    updateListener(position: Vec3, forward?: Vec3, up?: Vec3): Promise<void>;
    ensureGraph(): Promise<AudioGraph | null>;
    private ensureContext;
}
export declare const audioSystem: AudioSystem;
//# sourceMappingURL=AudioSystem.d.ts.map