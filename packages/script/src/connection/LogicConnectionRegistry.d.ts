import type { Scene } from '@engine/world';
import type { LogicConnectionManager } from '../connection/LogicConnectionManager.js';
export declare function registerLogicConnectionManager(scene: Scene, manager: LogicConnectionManager): void;
export declare function unregisterLogicConnectionManager(scene: Scene, manager: LogicConnectionManager): void;
export declare function getLogicConnectionManager(scene: Scene | null | undefined): LogicConnectionManager | null;
//# sourceMappingURL=LogicConnectionRegistry.d.ts.map