import { describe, it, expect } from 'vitest';
import { Scene, Entity } from '@engine/world';
import type { Vec3 } from '@engine/core/math';
import { frameEditorCameraToScene, computeSceneBounds } from '../cameraFraming';
import { createOrbitControls } from '@engine/camera';
import { EditorCameraController } from '@engine/camera';

function makeCanvas(width = 1280, height = 720): HTMLCanvasElement {
	const canvas = document.createElement('canvas');
	canvas.width = width;
	canvas.height = height;
	return canvas;
}

describe('cameraFraming', () => {
	it('computes scene bounds for simple entities', () => {
		const scene = new Scene('Test');
		const a = new Entity('A');
		a.transform.position = [-2, 0, 0] as Vec3;
		a.transform.scale = [2, 1, 1] as Vec3; // half extents: 1,0.5,0.5
		scene.addEntity(a);

		const b = new Entity('B');
		b.transform.position = [3, 2, 1] as Vec3;
		b.transform.scale = [1, 3, 1] as Vec3; // half extents: 0.5,1.5,0.5
		scene.addEntity(b);

		const bounds = computeSceneBounds(scene);
		expect(bounds).not.toBeNull();
		expect(bounds!.min[0]).toBeLessThanOrEqual(-3); // -2 - 1
		expect(bounds!.max[0]).toBeGreaterThanOrEqual(3.5); // 3 + 0.5
		expect(bounds!.min[1]).toBeLessThanOrEqual(-0.5);
		expect(bounds!.max[1]).toBeGreaterThanOrEqual(3.5);
	});

	it('frames editor camera to look at scene center', () => {
		const scene = new Scene('Test');
		const e = new Entity('Block');
		e.transform.position = [0, 0, 0] as Vec3;
		e.transform.scale = [4, 2, 4] as Vec3;
		scene.addEntity(e);

		const canvas = makeCanvas(1200, 800);
		const controls = createOrbitControls(canvas, { initialDistance: 10 });
		const editorCam = new EditorCameraController(canvas, {
			initialPosition: [0, 3, 8],
			initialYaw: 0,
			initialPitch: -0.35,
		});

		frameEditorCameraToScene({
			scene,
			canvas,
			editorCamera: editorCam,
			controls,
			margin: 1.1,
		});

		const pos = editorCam.getPosition();
		const { yaw, pitch } = editorCam.getOrientation();
		// Compute forward from yaw/pitch the same way EditorModeManager maps it
		const cosPitch = Math.cos(pitch);
		const forward: Vec3 = [Math.sin(yaw) * cosPitch, Math.sin(pitch), -Math.cos(yaw) * cosPitch];
		const toCenter: Vec3 = [-pos[0], -pos[1], -pos[2]];
		const tl = Math.hypot(toCenter[0], toCenter[1], toCenter[2]) || 1;
		const tc: Vec3 = [toCenter[0] / tl, toCenter[1] / tl, toCenter[2] / tl];

		// The camera should be looking approximately toward the center
		const dot = forward[0] * tc[0] + forward[1] * tc[1] + forward[2] * tc[2];
		expect(dot).toBeGreaterThan(0.95);
	});
});


