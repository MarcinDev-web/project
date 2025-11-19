import type { Vec3 } from '@engine/core/math';
import { FOV_RADIANS } from '@engine/gfx-webgpu/config';
import type { Scene, Entity } from '@engine/world';
import type { OrbitControls } from '@engine/camera';
import type { EditorCameraController } from '@engine/camera';
import { ensureWasmCollisionInit, getWasmCollisionSync } from '../../wasm/collision';

export interface SceneBounds {
	min: Vec3;
	max: Vec3;
}

function isExcludedEntity(entity: Entity): boolean {
	// Exclude editor/runtime helper entities by name or known flags
	const name = entity.name || '';
	if (name === 'EditorCamera' || name === 'PlayerAvatarVisual') return true;
	// Exclude runtime-only helpers if present
	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	const ud: any = entity.userData || {};
	if (ud.isPlayModePlayer === true || ud.isPlayerAvatarVisual === true) return true;
	return false;
}

export function computeSceneBounds(scene: Scene): SceneBounds | null {
	const entities = scene.getAllEntities();
	if (entities.length === 0) return null;

	ensureWasmCollisionInit();
	const wasm = getWasmCollisionSync();
	const useWasm = Boolean(wasm);
	const worldMatrices = useWasm ? new Float32Array(entities.length * 16) : null;
	const halfExtents = useWasm ? new Float32Array(entities.length * 3) : null;
	let soaCount = 0;

	let hasAny = false;
	let minX = Number.POSITIVE_INFINITY;
	let minY = Number.POSITIVE_INFINITY;
	let minZ = Number.POSITIVE_INFINITY;
	let maxX = Number.NEGATIVE_INFINITY;
	let maxY = Number.NEGATIVE_INFINITY;
	let maxZ = Number.NEGATIVE_INFINITY;

	for (const e of entities) {
		// Skip inactive or excluded helpers
		if (!e.active || isExcludedEntity(e)) continue;
		const world = e.transform.getWorldMatrix();
		// Local half extents from scale (assume unit cube scaled)
		const sx = Math.abs(e.transform.scale[0] ?? 1);
		const sy = Math.abs(e.transform.scale[1] ?? 1);
		const sz = Math.abs(e.transform.scale[2] ?? 1);
		const hx = 0.5 * sx;
		const hy = 0.5 * sy;
		const hz = 0.5 * sz;

		// Extract 3x3 rotation-scale and compute world-space AABB extents
		// Column-major mat4: rows are (0,4,8), (1,5,9), (2,6,10)
		const ex =
			Math.abs(world[0] ?? 0) * hx +
			Math.abs(world[4] ?? 0) * hy +
			Math.abs(world[8] ?? 0) * hz;
		const ey =
			Math.abs(world[1] ?? 0) * hx +
			Math.abs(world[5] ?? 0) * hy +
			Math.abs(world[9] ?? 0) * hz;
		const ez =
			Math.abs(world[2] ?? 0) * hx +
			Math.abs(world[6] ?? 0) * hy +
			Math.abs(world[10] ?? 0) * hz;

		const cx = world[12] ?? 0;
		const cy = world[13] ?? 0;
		const cz = world[14] ?? 0;

		const aMinX = cx - ex;
		const aMinY = cy - ey;
		const aMinZ = cz - ez;
		const aMaxX = cx + ex;
		const aMaxY = cy + ey;
		const aMaxZ = cz + ez;

		if (aMinX < minX) minX = aMinX;
		if (aMinY < minY) minY = aMinY;
		if (aMinZ < minZ) minZ = aMinZ;
		if (aMaxX > maxX) maxX = aMaxX;
		if (aMaxY > maxY) maxY = aMaxY;
		if (aMaxZ > maxZ) maxZ = aMaxZ;
		hasAny = true;

		if (useWasm && worldMatrices && halfExtents) {
			const matBase = soaCount * 16;
			worldMatrices[matBase + 0] = world[0] ?? 1;
			worldMatrices[matBase + 1] = world[1] ?? 0;
			worldMatrices[matBase + 2] = world[2] ?? 0;
			worldMatrices[matBase + 3] = world[3] ?? 0;
			worldMatrices[matBase + 4] = world[4] ?? 0;
			worldMatrices[matBase + 5] = world[5] ?? 1;
			worldMatrices[matBase + 6] = world[6] ?? 0;
			worldMatrices[matBase + 7] = world[7] ?? 0;
			worldMatrices[matBase + 8] = world[8] ?? 0;
			worldMatrices[matBase + 9] = world[9] ?? 0;
			worldMatrices[matBase + 10] = world[10] ?? 1;
			worldMatrices[matBase + 11] = world[11] ?? 0;
			worldMatrices[matBase + 12] = world[12] ?? 0;
			worldMatrices[matBase + 13] = world[13] ?? 0;
			worldMatrices[matBase + 14] = world[14] ?? 0;
			worldMatrices[matBase + 15] = world[15] ?? 1;

			const halfBase = soaCount * 3;
			halfExtents[halfBase + 0] = hx;
			halfExtents[halfBase + 1] = hy;
			halfExtents[halfBase + 2] = hz;
			soaCount++;
		}
	}

	if (!hasAny || !Number.isFinite(minX)) {
		return null;
	}

	if (useWasm && wasm && worldMatrices && halfExtents && soaCount > 0) {
		try {
			const wasmBounds = wasm.computeSceneBounds(
				worldMatrices.subarray(0, soaCount * 16),
				halfExtents.subarray(0, soaCount * 3)
			);
			if (wasmBounds && wasmBounds.length >= 6) {
				const min: Vec3 = [wasmBounds[0], wasmBounds[1], wasmBounds[2]];
				const max: Vec3 = [wasmBounds[3], wasmBounds[4], wasmBounds[5]];
				if (
					min.every(Number.isFinite) &&
					max.every(Number.isFinite)
				) {
					return { min, max };
				}
			}
		} catch (error) {
			// eslint-disable-next-line no-console
			console.warn('[cameraFraming] WASM scene bounds failed, falling back to TS:', error);
		}
	}

	return {
		min: [minX, minY, minZ],
		max: [maxX, maxY, maxZ],
	};
}

export function frameEditorCameraToScene(opts: {
	scene: Scene;
	canvas: HTMLCanvasElement;
	editorCamera: EditorCameraController;
	controls: OrbitControls;
	margin?: number;
	fovRadians?: number;
}): void {
	const { scene, canvas, editorCamera, controls } = opts;
	const margin = opts.margin ?? 0.8;
	const vfov = opts.fovRadians ?? FOV_RADIANS;
	const bounds = computeSceneBounds(scene);
	if (!bounds) {
		// Default gentle oblique view at origin
		const defaultYaw = Math.PI / 4; // 45°
		const defaultPitch = -0.35;
		const defaultDistance = 12;
		const forward: Vec3 = [
			Math.sin(defaultYaw) * Math.cos(-defaultPitch),
			Math.sin(-defaultPitch),
			-Math.cos(defaultYaw) * Math.cos(-defaultPitch),
		];
		const pos: Vec3 = [
			- forward[0] * defaultDistance,
			- forward[1] * defaultDistance,
			- forward[2] * defaultDistance,
		];
		editorCamera.setPosition(pos);
		editorCamera.setOrientation(defaultYaw, defaultPitch);
		controls.setState({ yaw: defaultYaw, pitch: defaultPitch, distance: defaultDistance });
		return;
	}

	const cx = (bounds.min[0] + bounds.max[0]) * 0.5;
	const cy = (bounds.min[1] + bounds.max[1]) * 0.5;
	const cz = (bounds.min[2] + bounds.max[2]) * 0.5;
	const sx = (bounds.max[0] - bounds.min[0]) || 0.0001;
	const sy = (bounds.max[1] - bounds.min[1]) || 0.0001;
	const sz = (bounds.max[2] - bounds.min[2]) || 0.0001;
	// Bounding sphere radius (half of diagonal)
	const r = 0.5 * Math.hypot(sx, sy, sz);

	const aspect = Math.max(0.01, (canvas.width || canvas.clientWidth || 1) / (canvas.height || canvas.clientHeight || 1));
	const tanV = Math.tan(vfov * 0.5);
	const hFov = 2 * Math.atan(tanV * aspect);
	const tanH = Math.tan(hFov * 0.5);
	const dV = r / Math.max(0.001, tanV);
	const dH = r / Math.max(0.001, tanH);
	const distance = Math.max(dV, dH) * margin;

	// Choose a pleasant oblique direction (front-right-above)
	let dir: Vec3 = [0.6, 0.45, 0.6];
	const len = Math.hypot(dir[0], dir[1], dir[2]) || 1;
	dir = [dir[0] / len, dir[1] / len, dir[2] / len];

	// Camera position = center + dir * distance
	const camX = cx + dir[0] * distance;
	const camY = cy + dir[1] * distance;
	const camZ = cz + dir[2] * distance;
	editorCamera.setPosition([camX, camY, camZ]);

	// Forward vector from camera to center
	const fx = cx - camX;
	const fy = cy - camY;
	const fz = cz - camZ;
	const fl = Math.hypot(fx, fy, fz) || 1;
	const fwd: Vec3 = [fx / fl, fy / fl, fz / fl];
	// Map forward to yaw/pitch used by editor camera
	const yaw = Math.atan2(fwd[0], -(fwd[2]));
	const clampedFy = Math.max(-1, Math.min(1, fwd[1]));
	const pitch = Math.asin(clampedFy);
	editorCamera.setOrientation(yaw, pitch);

	// Keep orbit controls state roughly in sync for persistence
	controls.setState({ yaw, pitch, distance });
}


