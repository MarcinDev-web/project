# SkyBox Updates - v2.0.0

**Data:** 2025-01-26  
**Status:** Implementacja zakończona

---

## 🆕 Nowe Funkcje

### 1. Cubemap Support
- **EnvironmentComponent**: Dodane pola `cubemapTexture`, `cubemapPath`
- **Metody**: `setCubemap()`, `clearCubemap()`
- **Rendering**: Nowy shader `SKYBOX_CUBEMAP_FRAGMENT_SHADER`
- **UI**: File picker dla 6 obrazów cubemap w PropertiesPanel

### 2. HDR Loading & Conversion
- **HdrLoader.ts**: Parser dla formatu Radiance RGBE (.hdr)
  - `parseHdrFile()`: Konwersja RGBE → Float32Array RGBA
  - `loadHdrFile()`: Ładowanie z URL lub File
- **EnvironmentRenderer.convertHdrToCubemap()**: Konwersja HDR equirectangular → cubemap (6 faces)
  - Rendering każdej ścianki przez GPU
  - Wykorzystuje WGSL shader do equirectangular projection
- **Editor UI**: File picker dla plików .hdr

### 3. IBL Caching
- **Cache system**: LRU eviction dla IBL resources
- **Hash function**: `hashEnvironmentParams()` generuje unikalny klucz
- **Cache hit/miss**: Automatyczne wykrywanie i ponowne wykorzystanie zasobów
- **Cleanup**: Automatyczne zwalnianie najstarszych zasobów przy limitach

### 4. Validation & Dirty Flags
- **EnvironmentComponent**: Auto-normalizacja `sunDirection`, clamping dla `sunIntensity`, `ambientIntensity`, `exposure`
- **EnvironmentRenderer**: Walidacja parametrów w `updateParams()`
  - `validateColor()`, `validateSunDirection()`, `validateSunIntensity()`
- **Dirty flags**: `uniformsDirty`, `paramsDirty` - update tylko gdy potrzeba

### 5. Shader Deduplication
- **ATMOSPHERIC_SCATTERING_FUNCTION**: Wyodrębniona funkcja wspólna
- **Użycie**: W procedural sky shader i IBL environment capture shader
- **Korzyść**: Konsystencja wizualna, łatwiejsze utrzymanie

### 6. Pipeline Descriptor Cache
- **Struktura**: `pipelineDescriptorsCache` dla szybszej reinicjalizacji
- **Status**: Zaimplementowana struktura (gotowa do użycia)

---

## 🔧 Zmiany Techniczne

### EnvironmentComponent.ts
```typescript
// Nowe pola
cubemapTexture?: GPUTexture;
cubemapPath?: string;

// Nowe metody
setCubemap(texture: GPUTexture | undefined, path?: string): void
clearCubemap(): void

// Getters/setters z walidacją
get sunDirection(): Vec3
set sunDirection(value: Vec3)  // Auto-normalizacja
get sunIntensity(): number
set sunIntensity(value: number)  // Clamp [0, 10]
// ... i podobnie dla ambientIntensity, exposure
```

### EnvironmentRenderer.ts
```typescript
// Nowe metody
loadCubemapFromFaces(faces: ImageBitmap[], path?: string): Promise<GPUTexture>
loadHdrCubemap(source: string | File | ArrayBuffer, resolution?: number, path?: string): Promise<GPUTexture>
convertHdrToCubemap(hdrData, resolution, path?): Promise<GPUTexture>
hashEnvironmentParams(env: EnvironmentComponent): string
getCachedIBLResources(env, hash): { brdfLut, envCube } | null
evictOldestIBLCache(): void
clearCubemapCache(path: string): void

// Walidacja
validateColor(color: Vec3): Vec3
validateSunDirection(dir: Vec3): Vec3
validateSunIntensity(intensity: number): number
```

### HdrLoader.ts (nowy plik)
```typescript
export function parseHdrFile(arrayBuffer: ArrayBuffer): {
  width: number;
  height: number;
  data: Float32Array;
}

export async function loadHdrFile(source: string | File): Promise<{
  width: number;
  height: number;
  data: Float32Array;
}>
```

---

## 📊 Performance Improvements

1. **IBL Cache**: Eliminuje regenerację BRDF LUT i environment cubemap dla tych samych parametrów
2. **Dirty Flags**: Redukuje zbędne update'y GPU buffers
3. **Cubemap Cache**: Ponowne wykorzystanie załadowanych texture'ów
4. **Shader Deduplication**: Mniejszy rozmiar kodu shaderów, lepsze cache'owanie GPU

---

## 🧪 Testy

### Nowe testy:
- `HdrLoader.test.ts`: Parser HDR, konwersja RGBE, edge cases
- Rozszerzone `EnvironmentRenderer.test.ts`:
  - Cubemap loading i pipeline creation
  - IBL cache hash generation
  - Validation functions
  - Cleanup resources

### Coverage:
- ✅ HDR parsing (valid/invalid formats, RGBE conversion)
- ✅ Cubemap loading (6 images, caching)
- ✅ IBL cache (hash generation, parameter acceptance)
- ✅ Resource cleanup (texture destruction)

---

## 🎨 Editor Integration

### PropertiesPanel.ts
- **Cubemap UI**: File picker dla 6 obrazów, preview status, clear button
- **HDR UI**: File picker dla .hdr, loading status, integration placeholder
- **Info tekst**: Dynamiczny feedback o załadowanych zasobach

---

## 📝 API Documentation

### EnvironmentComponent

#### setCubemap()
```typescript
setCubemap(texture: GPUTexture | undefined, path?: string): void
```
Ustawia cubemap texture. Jeśli texture jest podane, automatycznie zmienia `skyboxType` na `'cubemap'`.

#### clearCubemap()
```typescript
clearCubemap(): void
```
Czyści cubemap i przywraca domyślny typ skybox (`'procedural-sky'`).

#### sunDirection (getter/setter)
```typescript
get sunDirection(): Vec3
set sunDirection(value: Vec3): void
```
Kierunek słońca. Automatyczna normalizacja przy ustawianiu.

#### sunIntensity (getter/setter)
```typescript
get sunIntensity(): number
set sunIntensity(value: number): void
```
Intensywność słońca. Automatyczny clamp do [0, 10].

---

### EnvironmentRenderer

#### loadCubemapFromFaces()
```typescript
async loadCubemapFromFaces(
  faces: ImageBitmap[],
  path?: string
): Promise<GPUTexture>
```
Ładuje cubemap z 6 ImageBitmap (kolejność: +X, -X, +Y, -Y, +Z, -Z). Cache'uje wyniki.

#### loadHdrCubemap()
```typescript
async loadHdrCubemap(
  source: string | File | ArrayBuffer,
  resolution?: number,
  path?: string
): Promise<GPUTexture>
```
Ładuje HDR plik i konwertuje do cubemap. Resolution domyślnie 512.

#### convertHdrToCubemap()
```typescript
async convertHdrToCubemap(
  hdrData: { width: number; height: number; data: Float32Array },
  resolution?: number,
  path?: string
): Promise<GPUTexture>
```
Konwertuje HDR equirectangular do cubemap przez GPU rendering. Zwraca `rgba16float` texture.

#### prepareIBLResources()
```typescript
async prepareIBLResources(
  environment: EnvironmentComponent,
  resolution?: number
): Promise<{ brdfLut: GPUTexture; envCube: GPUTexture }>
```
Generuje IBL resources. Używa cache dla `procedural-sky` typu.

---

## 🔮 Future Improvements

1. **Pipeline Cache Implementation**: Wykorzystanie `pipelineDescriptorsCache` dla reinicjalizacji
2. **RLE Compression**: Obsługa RLE-compressed HDR files
3. **HDR Streaming**: Progressive loading dla dużych HDR
4. **IBL Precomputation**: Background thread dla heavy IBL generation
5. **Cubemap Compression**: BC6H/BC7 compression dla cubemap textures
6. **Editor Preview**: Canvas preview dla cubemap/HDR przed ładowaniem

---

## ✅ Checklist Implementacji

- [x] Iteracja 1: Walidacja parametrów
- [x] Iteracja 2: Cubemap support
- [x] Iteracja 3: IBL cache, dirty flags
- [x] Iteracja 4: HDR loading & conversion
- [x] Iteracja 5: Shader deduplication
- [x] Iteracja 5: Pipeline cache structure
- [x] Dokumentacja
- [ ] Iteracja 5: Benchmarks (opcjonalne)
- [ ] Iteracja 5: E2E integration tests (opcjonalne)

---

## 📚 Referencje

- [Radiance RGBE Format](https://en.wikipedia.org/wiki/RGBE_image_format)
- [WebGPU Texture Formats](https://www.w3.org/TR/webgpu/#texture-formats)
- [Equirectangular to Cubemap Conversion](https://en.wikipedia.org/wiki/Equirectangular_projection)

