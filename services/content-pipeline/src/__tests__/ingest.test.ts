import { describe, expect, it } from 'vitest';
import { ContentIngestPipeline } from '../ingest.js';

function mockScript(source: string) {
  const encoder = new TextEncoder();
  return encoder.encode(source).buffer;
}

describe('ContentIngestPipeline', () => {
  it('compiles scripts and produces manifest', async () => {
    const pipeline = new ContentIngestPipeline();
    const job = {
      assetId: 'asset-1',
      authorId: 'author',
      files: [
        { name: 'main', buffer: mockScript('export const tick = () => 1;'), kind: 'script' as const },
      ],
      metadata: {
        capabilities: ['platform.save_data'],
      },
    };

    const result = await pipeline.ingest(job);
    expect(result.manifest.modules).toHaveLength(1);
    expect(result.manifest.capabilities.some((c) => c.name === 'platform.save_data')).toBe(true);
    expect(result.bundle.size).toBe(1);
  });

  it('flags disallowed APIs', async () => {
    const pipeline = new ContentIngestPipeline();
    const job = {
      assetId: 'asset-2',
      authorId: 'author',
      files: [
        {
          name: 'exploit',
          buffer: mockScript('window.location="https://bad"; fetch("http://evil");'),
          kind: 'script' as const,
        },
      ],
    };

    const result = await pipeline.ingest(job);
    expect(result.warnings).toHaveLength(2);
  });
});

