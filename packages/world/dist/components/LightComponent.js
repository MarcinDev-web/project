import { Component } from './Component';
import { registerComponent } from './registry';
/**
 * Light component for entities that emit light
 */
export class LightComponent extends Component {
    static type = 'Light';
    /** Type of light source */
    lightType = 'directional';
    /** Light color (RGB, 0-1 range) */
    color = [1, 1, 1];
    /** Light intensity multiplier */
    intensity = 1.0;
    /** Range for point/spot lights (world units) */
    range = 10.0;
    /** Direction for directional/spot lights (normalized) */
    direction = [0, -1, 0];
    /** Inner cone angle for spot lights (radians) */
    innerConeAngle = Math.PI / 6; // 30 degrees
    /** Outer cone angle for spot lights (radians) */
    outerConeAngle = Math.PI / 4; // 45 degrees
    /** Whether this light is enabled */
    enabled = true;
    getType() {
        return LightComponent.type;
    }
    clone() {
        const clone = new LightComponent();
        clone.lightType = this.lightType;
        clone.color = [...this.color];
        clone.intensity = this.intensity;
        clone.range = this.range;
        clone.direction = [...this.direction];
        clone.innerConeAngle = this.innerConeAngle;
        clone.outerConeAngle = this.outerConeAngle;
        clone.enabled = this.enabled;
        return clone;
    }
    toJSON() {
        return {
            lightType: this.lightType,
            color: [...this.color],
            intensity: this.intensity,
            range: this.range,
            direction: [...this.direction],
            innerConeAngle: this.innerConeAngle,
            outerConeAngle: this.outerConeAngle,
            enabled: this.enabled,
        };
    }
    fromJSON(data) {
        if (typeof data.lightType === 'string')
            this.lightType = data.lightType;
        if (Array.isArray(data.color) && data.color.length === 3) {
            this.color = [...data.color];
        }
        if (typeof data.intensity === 'number')
            this.intensity = data.intensity;
        if (typeof data.range === 'number')
            this.range = data.range;
        if (Array.isArray(data.direction) && data.direction.length === 3) {
            this.direction = [...data.direction];
        }
        if (typeof data.innerConeAngle === 'number')
            this.innerConeAngle = data.innerConeAngle;
        if (typeof data.outerConeAngle === 'number')
            this.outerConeAngle = data.outerConeAngle;
        if (typeof data.enabled === 'boolean')
            this.enabled = data.enabled;
    }
}
registerComponent(LightComponent.type, LightComponent);
//# sourceMappingURL=LightComponent.js.map