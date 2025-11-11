import type { Vec3 } from '@engine/core/math';
import { FOV_RADIANS } from '@engine/gfx-webgpu/config';
import type { Scene, Entity } from '@engine/world';
import type { OrbitControls } from '@engine/camera';
import type { EditorCameraController } from '@engine/camera';

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
	}

	if (!hasAny || !Number.isFinite(minX)) {
		return null;
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


