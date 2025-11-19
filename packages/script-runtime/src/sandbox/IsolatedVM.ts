import { Script, createContext, type Context } from 'node:vm';

export interface IsolatedVMOptions {
  allowedApi?: Record<string, unknown>;
  timeoutMs?: number;
  codeSizeLimitKb?: number;
}

/**
 * IsolatedVM executes untrusted bytecode in a hardened Node vm context.
 * No DOM, network, or file system APIs are exposed; only the provided API surface exists.
 */
export class IsolatedVM {
  private readonly context: Context;
  private disposed = false;
  private readonly timeout: number;
  private readonly codeLimit: number;

  constructor(options?: IsolatedVMOptions) {
    const sandbox = Object.create(null);
    sandbox.global = sandbox;
    sandbox.globalThis = sandbox;
    sandbox.self = sandbox;

    if (options?.allowedApi) {
      for (const [key, value] of Object.entries(options.allowedApi)) {
        sandbox[key] = value;
      }
    }

    this.context = createContext(sandbox, {
      name: 'ScriptSandbox',
      codeGeneration: { strings: false, wasm: false },
    });
    this.timeout = options?.timeoutMs ?? 25;
    this.codeLimit = (options?.codeSizeLimitKb ?? 64) * 1024;
  }

  evaluate(code: string): unknown {
    if (this.disposed) {
      throw new Error('IsolatedVM: already disposed');
    }
    if (Buffer.byteLength(code, 'utf-8') > this.codeLimit) {
      throw new Error('IsolatedVM: code exceeds sandbox limit');
    }

    const script = new Script(code);
    return script.runInContext(this.context, { timeout: this.timeout, displayErrors: true });
  }

  dispose(): void {
    this.disposed = true;
  }
}

