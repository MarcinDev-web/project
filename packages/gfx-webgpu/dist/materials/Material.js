export class Material {
    // Base PBR properties
    color = [1, 1, 1, 1];
    metallic = 0;
    roughness = 1;
    // Extended PBR maps
    texture; // baseColor/albedo atlas cell
    normalMap; // normal atlas cell or normal atlas
    metallicRoughnessMap;
    aoMap;
    emissiveMap;
    heightMap;
    // Emissive
    emissive = [0, 0, 0];
    emissiveIntensity = 0;
    // Transparency / sidedness
    opacity = 1;
    alphaMode = 'OPAQUE';
    alphaCutoff = 0.5;
    doubleSided = false;
}
//# sourceMappingURL=Material.js.map