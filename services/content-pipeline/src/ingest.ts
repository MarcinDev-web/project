import { createHash } from 'node:crypto';

export interface PipelineFile {
  name: string;
  buffer: ArrayBuffer;
  kind: 'script' | 'asset';
}

export interface IngestJob {
  assetId: string;
  authorId: string;
  files: PipelineFile[];
  metadata?: Record<string, unknown>;
}

export interface CompiledModule {
  name: string;
  hash: string;
  bytecode: Uint8Array;
}

export interface SandboxManifest {
  assetId: string;
  version: number;
  modules: Array<{ name: string; hash: string }>;
  capabilities: Array<{ name: string; scope: string }>;
  generatedAt: number;
}

export interface IngestResult {
  assetId: string;
  manifest: SandboxManifest;
  bundle: Map<string, Uint8Array>;
  warnings: string[];
}

export interface ContentPipelineConfig {
  maxBundleSizeBytes?: number;
}

export class ContentIngestPipeline {
  private readonly encoder = new TextEncoder();
  private readonly maxBundleSize: number;

  constructor(config?: ContentPipelineConfig) {
    this.maxBundleSize = config?.maxBundleSizeBytes ?? 5 * 1024 * 1024;
  }

  async ingest(job: IngestJob): Promise<IngestResult> {
    if (!job.files.length) {
      throw new Error('ContentIngestPipeline: job must include files');
    }
    const warnings: string[] = [];
    const bundle = new Map<string, Uint8Array>();
    const modules: CompiledModule[] = [];
    let bundleSize = 0;

    for (const file of job.files) {
      const fileWarnings = this.scanFile(file);
      warnings.push(...fileWarnings);
      if (file.kind === 'script') {
        const module = this.compileScript(file);
        modules.push(module);
        bundle.set(`${file.name}.wasm`, module.bytecode);
        bundleSize += module.bytecode.byteLength;
      } else {
        const payload = new Uint8Array(file.buffer);
        bundle.set(file.name, payload);
        bundleSize += payload.byteLength;
      }

      if (bundleSize > this.maxBundleSize) {
        throw new Error(`ContentIngestPipeline: bundle exceeds ${this.maxBundleSize} bytes`);
      }
    }

    const manifest: SandboxManifest = {
      assetId: job.assetId,
      version: 1,
      modules: modules.map((module) => ({ name: module.name, hash: module.hash })),
      capabilities: this.deriveCapabilities(job.metadata),
      generatedAt: Date.now(),
    };

    return {
      assetId: job.assetId,
      manifest,
      bundle,
      warnings,
    };
  }

  private scanFile(file: PipelineFile): string[] {
    if (file.kind !== 'script') {
      return [];
    }
    const source = new TextDecoder().decode(file.buffer);
    const warnings: string[] = [];
    if (/window\.location|document\.cookie/i.test(source)) {
      warnings.push(`${file.name}: Detected access to restricted browser API`);
    }
    if (/fetch\s*\(/i.test(source)) {
      warnings.push(`${file.name}: Network egress attempt detected`);
    }
    if (/eval\s*\(/i.test(source)) {
      warnings.push(`${file.name}: eval is not permitted in sandbox`);
    }
    return warnings;
  }

  private compileScript(file: PipelineFile): CompiledModule {
    const source = new TextDecoder().decode(file.buffer);
    const hash = createHash('sha256').update(source).digest('hex');
    const preamble = this.encoder.encode(`// sandbox:${file.name}:${hash}\n`);
    const bytecode = new Uint8Array(preamble.length + file.buffer.byteLength);
    bytecode.set(preamble, 0);
    bytecode.set(new Uint8Array(file.buffer), preamble.length);
    return {
      name: file.name,
      hash,
      bytecode,
    };
  }

  private deriveCapabilities(metadata?: Record<string, unknown>): Array<{ name: string; scope: string }> {
    const declared = Array.isArray(metadata?.capabilities)
      ? (metadata?.capabilities as string[])
      : [];
    const capabilities = new Set<string>(declared);
    capabilities.add('platform.move_player');
    capabilities.add('platform.emit_event');
    return Array.from(capabilities).map((name) => ({
      name,
      scope: name.startsWith('platform.') ? 'platform' : 'custom',
    }));
  }
}

