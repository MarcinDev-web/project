import { Component } from './Component';
import { registerComponent } from './registry';
/**
 * EnvironmentComponent defines the skybox and atmospheric settings for a scene.
 * Only one environment component should be active per scene.
 */
export class EnvironmentComponent extends Component {
    static type = 'Environment';
    /** Type of skybox rendering */
    skyboxType = 'procedural-sky';
    /** Sky color (top) for gradient and procedural sky */
    skyColor = [0.4, 0.6, 0.9];
    /** Horizon color for gradient and procedural sky */
    horizonColor = [0.8, 0.85, 0.9];
    /** Ground color (bottom) for gradient mode */
    groundColor = [0.3, 0.35, 0.4];
    /** Sun direction (normalized) for procedural sky */
    sunDirection = [0.3, 0.7, 0.5];
    /** Sun color for procedural sky */
    sunColor = [1.0, 0.95, 0.8];
    /** Sun intensity multiplier */
    sunIntensity = 1.0;
    /** Fog rendering mode */
    fogMode = 'none';
    /** Fog color */
    fogColor = [0.7, 0.8, 0.9];
    /** Fog start distance (for linear fog) */
    fogNear = 10.0;
    /** Fog end distance (for linear fog) */
    fogFar = 100.0;
    /** Fog density (for exponential fog) */
    fogDensity = 0.02;
    /** Ambient light intensity from environment */
    ambientIntensity = 0.6;
    /** Exposure adjustment for HDR environments */
    exposure = 1.0;
    /** Whether environment rendering is enabled */
    enabled = true;
    getType() {
        return EnvironmentComponent.type;
    }
    /**
     * Normalizes the sun direction vector
     */
    normalizeSunDirection() {
        const len = Math.sqrt(this.sunDirection[0] * this.sunDirection[0] +
            this.sunDirection[1] * this.sunDirection[1] +
            this.sunDirection[2] * this.sunDirection[2]);
        if (len > 0.0001) {
            this.sunDirection[0] /= len;
            this.sunDirection[1] /= len;
            this.sunDirection[2] /= len;
        }
        else {
            // Default upward direction
            this.sunDirection = [0, 1, 0];
        }
    }
    /**
     * Sets time of day (0-24 hours) and updates sun position accordingly
     */
    setTimeOfDay(hours) {
        // Clamp to 0-24 range
        hours = ((hours % 24) + 24) % 24;
        // Convert hours to radians (0 = midnight at horizon, 12 = noon at zenith)
        const angle = ((hours - 6) / 12) * Math.PI; // -6 so that 6am = sunrise
        // Sun moves in an arc from east to west
        const elevation = Math.sin(angle);
        const azimuth = Math.cos(angle);
        this.sunDirection = [azimuth * 0.3, elevation, 0.5];
        this.normalizeSunDirection();
        // Adjust colors based on time of day
        if (hours < 6 || hours > 20) {
            // Night
            this.skyColor = [0.01, 0.02, 0.05];
            this.horizonColor = [0.05, 0.05, 0.1];
            this.sunIntensity = 0.0;
        }
        else if (hours < 8 || hours > 18) {
            // Dawn/Dusk
            const t = hours < 8 ? (hours - 6) / 2 : (20 - hours) / 2;
            this.skyColor = [0.4 * t, 0.3 * t, 0.5 * t];
            this.horizonColor = [1.0, 0.5 + 0.3 * t, 0.3 + 0.5 * t];
            this.sunIntensity = t * 0.8;
        }
        else {
            // Day
            this.skyColor = [0.4, 0.6, 0.9];
            this.horizonColor = [0.8, 0.85, 0.9];
            this.sunIntensity = 1.0;
        }
    }
    clone() {
        const clone = new EnvironmentComponent();
        clone.skyboxType = this.skyboxType;
        clone.skyColor = [...this.skyColor];
        clone.horizonColor = [...this.horizonColor];
        clone.groundColor = [...this.groundColor];
        clone.sunDirection = [...this.sunDirection];
        clone.sunColor = [...this.sunColor];
        clone.sunIntensity = this.sunIntensity;
        clone.fogMode = this.fogMode;
        clone.fogColor = [...this.fogColor];
        clone.fogNear = this.fogNear;
        clone.fogFar = this.fogFar;
        clone.fogDensity = this.fogDensity;
        clone.ambientIntensity = this.ambientIntensity;
        clone.exposure = this.exposure;
        clone.enabled = this.enabled;
        return clone;
    }
    toJSON() {
        return {
            skyboxType: this.skyboxType,
            skyColor: [...this.skyColor],
            horizonColor: [...this.horizonColor],
            groundColor: [...this.groundColor],
            sunDirection: [...this.sunDirection],
            sunColor: [...this.sunColor],
            sunIntensity: this.sunIntensity,
            fogMode: this.fogMode,
            fogColor: [...this.fogColor],
            fogNear: this.fogNear,
            fogFar: this.fogFar,
            fogDensity: this.fogDensity,
            ambientIntensity: this.ambientIntensity,
            exposure: this.exposure,
            enabled: this.enabled,
        };
    }
    fromJSON(data) {
        if (typeof data.skyboxType === 'string')
            this.skyboxType = data.skyboxType;
        if (Array.isArray(data.skyColor) && data.skyColor.length === 3) {
            this.skyColor = [...data.skyColor];
        }
        if (Array.isArray(data.horizonColor) && data.horizonColor.length === 3) {
            this.horizonColor = [...data.horizonColor];
        }
        if (Array.isArray(data.groundColor) && data.groundColor.length === 3) {
            this.groundColor = [...data.groundColor];
        }
        if (Array.isArray(data.sunDirection) && data.sunDirection.length === 3) {
            this.sunDirection = [...data.sunDirection];
        }
        if (Array.isArray(data.sunColor) && data.sunColor.length === 3) {
            this.sunColor = [...data.sunColor];
        }
        if (typeof data.sunIntensity === 'number')
            this.sunIntensity = data.sunIntensity;
        if (typeof data.fogMode === 'string')
            this.fogMode = data.fogMode;
        if (Array.isArray(data.fogColor) && data.fogColor.length === 3) {
            this.fogColor = [...data.fogColor];
        }
        if (typeof data.fogNear === 'number')
            this.fogNear = data.fogNear;
        if (typeof data.fogFar === 'number')
            this.fogFar = data.fogFar;
        if (typeof data.fogDensity === 'number')
            this.fogDensity = data.fogDensity;
        if (typeof data.ambientIntensity === 'number')
            this.ambientIntensity = data.ambientIntensity;
        if (typeof data.exposure === 'number')
            this.exposure = data.exposure;
        if (typeof data.enabled === 'boolean')
            this.enabled = data.enabled;
    }
}
registerComponent(EnvironmentComponent.type, EnvironmentComponent);
//# sourceMappingURL=EnvironmentComponent.js.map