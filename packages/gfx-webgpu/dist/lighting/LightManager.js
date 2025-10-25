/**
 * LightManager - Manages lights in the scene and prepares lighting data for shaders
 */
import { LightComponent } from '../../scene/components/LightComponent';
/**
 * Maximum number of lights supported by the shader (directional + point + spot)
 */
export const MAX_LIGHTS = 8;
export const MAX_DIRECTIONAL_LIGHTS = 2;
export const MAX_POINT_LIGHTS = 4;
export const MAX_SPOT_LIGHTS = 4;
/**
 * Manages scene lighting and prepares data for rendering
 */
export class LightManager {
    scene;
    cachedLightingData = null;
    lastUpdateFrame = -1;
    constructor(scene) {
        this.scene = scene;
    }
    /**
     * Gathers all light entities from the scene
     */
    gatherLights() {
        const lights = [];
        this.scene.traverse((entity) => {
            const lightComp = entity.getComponent(LightComponent);
            if (lightComp && lightComp.enabled && entity.active) {
                lights.push(entity);
            }
        });
        return lights;
    }
    /**
     * Converts LightComponent to PackedLight format
     */
    packLight(entity, lightComp) {
        const worldPos = entity.transform.getWorldPosition();
        // Normalize direction
        const dir = [...lightComp.direction];
        const dirLen = Math.sqrt(dir[0] * dir[0] + dir[1] * dir[1] + dir[2] * dir[2]) || 1;
        dir[0] /= dirLen;
        dir[1] /= dirLen;
        dir[2] /= dirLen;
        // Calculate color * intensity
        const color = [
            lightComp.color[0] * lightComp.intensity,
            lightComp.color[1] * lightComp.intensity,
            lightComp.color[2] * lightComp.intensity,
        ];
        // Map light type to numeric value
        const typeMap = { directional: 0, point: 1, spot: 2, ambient: 3 };
        const type = typeMap[lightComp.lightType];
        return {
            type,
            position: worldPos,
            color,
            range: lightComp.range,
            direction: dir,
            spotInnerCos: Math.cos(lightComp.innerConeAngle),
            spotOuterCos: Math.cos(lightComp.outerConeAngle),
        };
    }
    /**
     * Gets lighting data for the current frame
     * Results are cached per frame to avoid redundant computation
     */
    getLightingData(frameId) {
        // Return cached data if already computed this frame
        if (this.cachedLightingData && this.lastUpdateFrame === frameId) {
            return this.cachedLightingData;
        }
        const lights = this.gatherLights();
        const packedLights = [];
        const ambientColor = [0, 0, 0];
        let ambientIntensity = 0;
        // Separate lights by type and respect limits
        let dirCount = 0;
        let pointCount = 0;
        let spotCount = 0;
        for (const entity of lights) {
            const lightComp = entity.getComponent(LightComponent);
            if (!lightComp)
                continue;
            // Handle ambient separately
            if (lightComp.lightType === 'ambient') {
                // Accumulate ambient (we can have multiple ambient lights)
                ambientColor[0] += lightComp.color[0] * lightComp.intensity;
                ambientColor[1] += lightComp.color[1] * lightComp.intensity;
                ambientColor[2] += lightComp.color[2] * lightComp.intensity;
                ambientIntensity += lightComp.intensity;
                continue;
            }
            // Check limits for other light types
            if (lightComp.lightType === 'directional' && dirCount >= MAX_DIRECTIONAL_LIGHTS)
                continue;
            if (lightComp.lightType === 'point' && pointCount >= MAX_POINT_LIGHTS)
                continue;
            if (lightComp.lightType === 'spot' && spotCount >= MAX_SPOT_LIGHTS)
                continue;
            const packed = this.packLight(entity, lightComp);
            packedLights.push(packed);
            // Increment counters
            if (lightComp.lightType === 'directional')
                dirCount++;
            if (lightComp.lightType === 'point')
                pointCount++;
            if (lightComp.lightType === 'spot')
                spotCount++;
            // Stop if we've hit the max total lights
            if (packedLights.length >= MAX_LIGHTS)
                break;
        }
        // Normalize ambient if we have multiple ambient lights
        if (ambientIntensity > 1.0) {
            ambientColor[0] /= ambientIntensity;
            ambientColor[1] /= ambientIntensity;
            ambientColor[2] /= ambientIntensity;
            ambientIntensity = 1.0;
        }
        this.cachedLightingData = {
            lightCount: packedLights.length,
            lights: packedLights,
            ambientColor,
            ambientIntensity,
        };
        this.lastUpdateFrame = frameId;
        return this.cachedLightingData;
    }
    /**
     * Creates default lighting setup for a scene
     * Call this when initializing a new scene
     */
    static createDefaultLights(scene) {
        // Add a main directional light (sun)
        const sunEntity = scene.createEntity('Sun');
        const sunLight = new LightComponent();
        sunLight.lightType = 'directional';
        sunLight.direction = [0.3, -0.7, -0.5]; // Angled from top-front
        sunLight.color = [1.0, 0.98, 0.95]; // Warm white
        sunLight.intensity = 1.6;
        sunEntity.addComponent(sunLight);
        sunEntity.transform.position = [0, 10, 0]; // Position doesn't matter for directional
        // Add ambient light for base illumination
        const ambientEntity = scene.createEntity('Ambient Light');
        const ambientLight = new LightComponent();
        ambientLight.lightType = 'ambient';
        ambientLight.color = [0.6, 0.65, 0.75]; // Brighter, neutral-cool ambient
        ambientLight.intensity = 0.6;
        ambientEntity.addComponent(ambientLight);
    }
    /**
     * Invalidates the cache (call when lights are added/removed/modified)
     */
    invalidateCache() {
        this.cachedLightingData = null;
        this.lastUpdateFrame = -1;
    }
}
//# sourceMappingURL=LightManager.js.map