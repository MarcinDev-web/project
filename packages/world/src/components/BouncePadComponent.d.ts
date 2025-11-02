import { Component } from './Component';
export interface BouncePadComponentJSON {
    bounceForce?: number;
    minBounceVelocity?: number;
}
/**
 * BouncePadComponent - Bounces player upward with force
 *
 * Usage:
 * - Place for vertical jumping mechanics
 * - Automatically bounces players landing on it
 */
export declare class BouncePadComponent extends Component {
    static readonly type = "BouncePad";
    /**
     * Bounce force applied upward
     */
    bounceForce: number;
    /**
     * Minimum downward velocity to trigger bounce
     */
    minBounceVelocity: number;
    getType(): string;
    clone(): BouncePadComponent;
    toJSON(): BouncePadComponentJSON;
    static fromJSON(data: BouncePadComponentJSON): BouncePadComponent;
}
//# sourceMappingURL=BouncePadComponent.d.ts.map