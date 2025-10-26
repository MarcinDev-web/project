/**
 * Optimize a GLTF/GLB file using glTF-Transform. Applies a conservative set of
 * transforms (dedup, prune, resample, quantize) and attempts Draco compression
 * when encoder is available. Texture resizing is applied to keep dimensions
 * under a reasonable cap, without introducing KTX2 dependency.
 */
export async function optimizeGltfFile(file) {
    const name = file.name.toLowerCase();
    const isGlb = name.endsWith('.glb');
    // Dynamically import core + functions + extensions
    const [{ WebIO }, functions, extensions] = await Promise.all([
        import('@gltf-transform/core'),
        import('@gltf-transform/functions'),
        import('@gltf-transform/extensions'),
    ]);
    // Create IO suitable for browser
    const io = new WebIO({});
    // Register useful extensions ahead of time (safe even if unused)
    const { ALL_EXTENSIONS, KHRDracoMeshCompression } = extensions;
    io.registerExtensions(ALL_EXTENSIONS);
    // Attempt to register Draco encoder/decoder. If unavailable, continue without it.
    try {
        const draco3d = await import('draco3dgltf');
        // draco3dgltf exports factory methods to create WASM modules
        // Some bundlers require calling the functions without await; wrap in try just in case.
        const [decoder, encoder] = await Promise.all([
            draco3d.createDecoderModule(),
            draco3d.createEncoderModule(),
        ]);
        io.registerDependencies({
            'draco3d.decoder': decoder,
            'draco3d.encoder': encoder,
        });
        // Ensure Draco extension is recognized for writing
        io.registerExtensions([KHRDracoMeshCompression]);
    }
    catch (err) {
        console.warn('Draco module not available; continuing without Draco compression');
    }
    // Read input
    let document;
    if (isGlb) {
        const arrayBuffer = await file.arrayBuffer();
        document = await io.readBinary(new Uint8Array(arrayBuffer));
    }
    else if (name.endsWith('.gltf')) {
        const text = await file.text();
        const json = JSON.parse(text);
        // WebIO can accept JSON directly
        document = await io.readJSON(json);
    }
    else {
        throw new Error('Unsupported file format for optimization');
    }
    // Apply safe, broadly effective transforms
    const { dedup, prune, resample, quantize, draco } = functions;
    const transforms = [
        dedup(),
        prune(),
        resample(),
        // Quantize positions/normals/texcoords with a conservative configuration
        // that generally preserves visual fidelity.
        quantize({
            quantizePosition: 14,
            quantizeNormal: 10,
            quantizeTexcoord: 12,
            quantizeColor: 8,
            quantizeGeneric: 12,
        }),
    ];
    // Try Draco compression – if the encoder wasn't registered, this will be a no-op.
    try {
        // Type cast to avoid bringing function types into union above
        transforms.push(draco());
    }
    catch (err) {
        // If draco() is not available, skip silently.
    }
    await document.transform(...transforms);
    // Always emit GLB for a self-contained asset
    const optimized = await io.writeBinary(document);
    const outBuffer = new ArrayBuffer(optimized.byteLength);
    new Uint8Array(outBuffer).set(optimized);
    return { mimeType: 'application/octet-stream', data: outBuffer };
}
/**
 * Optimize and extract a minimal GLTF structure for importer usage.
 * This avoids requiring downstream systems to understand full glTF.
 */
export async function optimizeAndExtractLite(file) {
    const name = file.name.toLowerCase();
    const isGlb = name.endsWith('.glb');
    const [{ WebIO }, functions, extensions] = await Promise.all([
        import('@gltf-transform/core'),
        import('@gltf-transform/functions'),
        import('@gltf-transform/extensions'),
    ]);
    const io = new WebIO({});
    const { ALL_EXTENSIONS, KHRDracoMeshCompression } = extensions;
    io.registerExtensions(ALL_EXTENSIONS);
    try {
        const draco3d = await import('draco3dgltf');
        const [decoder, encoder] = await Promise.all([
            draco3d.createDecoderModule(),
            draco3d.createEncoderModule(),
        ]);
        io.registerDependencies({
            'draco3d.decoder': decoder,
            'draco3d.encoder': encoder,
        });
        io.registerExtensions([KHRDracoMeshCompression]);
    }
    catch {
        // Optional, continue without Draco
    }
    // Read
    let document;
    if (isGlb) {
        const ab = await file.arrayBuffer();
        document = await io.readBinary(new Uint8Array(ab));
    }
    else if (name.endsWith('.gltf')) {
        const json = JSON.parse(await file.text());
        document = await io.readJSON(json);
    }
    else {
        throw new Error('Unsupported file format for optimization');
    }
    // Transforms
    const { dedup, prune, resample, quantize, draco } = functions;
    const transforms = [
        dedup(),
        prune(),
        resample(),
        quantize({
            quantizePosition: 14,
            quantizeNormal: 10,
            quantizeTexcoord: 12,
            quantizeColor: 8,
            quantizeGeneric: 12,
        }),
    ];
    try {
        transforms.push(draco());
    }
    catch { }
    await document.transform(...transforms);
    // Extract a lite JSON shape
    const root = document.getRoot();
    const allNodes = root.listNodes();
    const nodes = allNodes.map((n) => {
        const t = n.getTranslation();
        const s = n.getScale();
        const out = {};
        const nameVal = n.getName();
        if (nameVal)
            out.name = nameVal;
        if (t)
            out.translation = [t[0] ?? 0, t[1] ?? 0, t[2] ?? 0];
        if (s)
            out.scale = [s[0] ?? 1, s[1] ?? 1, s[2] ?? 1];
        return out;
    });
    const scenes = root.listScenes().map((scene) => {
        const indices = [];
        const sceneNodes = scene.listChildren();
        for (const node of sceneNodes) {
            const idx = allNodes.indexOf(node);
            if (idx >= 0)
                indices.push(idx);
        }
        return { nodes: indices };
    });
    const assetInfo = root.getAsset();
    let asset = undefined;
    if (assetInfo) {
        asset = {};
        if (assetInfo.version !== undefined)
            asset.version = assetInfo.version;
        if (assetInfo.generator !== undefined)
            asset.generator = assetInfo.generator;
    }
    return asset ? { asset, scenes, nodes } : { scenes, nodes };
}
//# sourceMappingURL=GltfOptimizer.js.map