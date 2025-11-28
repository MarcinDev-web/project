import { describe, it, expect } from 'vitest';
import { Result, EngineError, StructuredError } from '../../src/result';

describe('Result', () => {
  describe('ok/err creation', () => {
    it('should create Ok result', () => {
      const result = Result.ok(42);
      expect(result.ok).toBe(true);
      expect(Result.isOk(result)).toBe(true);
      expect(Result.isErr(result)).toBe(false);
      if (result.ok) {
        expect(result.value).toBe(42);
      }
    });

    it('should create Err result', () => {
      const error = new Error('test error');
      const result = Result.err(error);
      expect(result.ok).toBe(false);
      expect(Result.isOk(result)).toBe(false);
      expect(Result.isErr(result)).toBe(true);
      if (!result.ok) {
        expect(result.error).toBe(error);
      }
    });
  });

  describe('unwrap', () => {
    it('should unwrap Ok value', () => {
      const result = Result.ok('hello');
      expect(Result.unwrap(result)).toBe('hello');
    });

    it('should throw on Err unwrap', () => {
      const result = Result.err(new Error('fail'));
      expect(() => Result.unwrap(result)).toThrow('fail');
    });

    it('should return default value for Err', () => {
      const result = Result.err<string, Error>(new Error('fail'));
      expect(Result.unwrapOr(result, 'default')).toBe('default');
    });

    it('should return value for Ok with unwrapOr', () => {
      const result = Result.ok('value');
      expect(Result.unwrapOr(result, 'default')).toBe('value');
    });
  });

  describe('match', () => {
    it('should match Ok', () => {
      const result = Result.ok(10);
      const output = Result.match(result, {
        ok: (v) => v * 2,
        err: () => 0,
      });
      expect(output).toBe(20);
    });

    it('should match Err', () => {
      const result = Result.err<number, string>('error');
      const output = Result.match(result, {
        ok: (v) => v * 2,
        err: (e) => e.length,
      });
      expect(output).toBe(5);
    });
  });

  describe('map', () => {
    it('should map Ok value', () => {
      const result = Result.ok(5);
      const mapped = Result.map(result, (v) => v * 2);
      expect(Result.unwrap(mapped)).toBe(10);
    });

    it('should pass through Err', () => {
      const result = Result.err<number, string>('error');
      const mapped = Result.map(result, (v) => v * 2);
      expect(Result.isErr(mapped)).toBe(true);
      if (!mapped.ok) {
        expect(mapped.error).toBe('error');
      }
    });
  });

  describe('mapErr', () => {
    it('should map Err', () => {
      const result = Result.err<number, string>('error');
      const mapped = Result.mapErr(result, (e) => e.toUpperCase());
      if (!mapped.ok) {
        expect(mapped.error).toBe('ERROR');
      }
    });

    it('should pass through Ok', () => {
      const result = Result.ok<number, string>(42);
      const mapped = Result.mapErr(result, (e) => e.toUpperCase());
      expect(Result.unwrap(mapped)).toBe(42);
    });
  });

  describe('andThen (flatMap)', () => {
    it('should chain Ok results', () => {
      const result = Result.ok(5);
      const chained = Result.andThen(result, (v) => Result.ok(v * 2));
      expect(Result.unwrap(chained)).toBe(10);
    });

    it('should short-circuit on Err', () => {
      const result = Result.err<number, string>('first error');
      const chained = Result.andThen(result, (v) => Result.ok(v * 2));
      expect(Result.isErr(chained)).toBe(true);
    });

    it('should propagate error from chain', () => {
      const result = Result.ok(5);
      const chained = Result.andThen(result, () => 
        Result.err<number, string>('chain error')
      );
      expect(Result.isErr(chained)).toBe(true);
    });
  });

  describe('orElse', () => {
    it('should recover from Err', () => {
      const result = Result.err<number, string>('error');
      const recovered = Result.orElse(result, () => Result.ok(42));
      expect(Result.unwrap(recovered)).toBe(42);
    });

    it('should pass through Ok', () => {
      const result = Result.ok<number, string>(10);
      const recovered = Result.orElse(result, () => Result.ok(42));
      expect(Result.unwrap(recovered)).toBe(10);
    });
  });

  describe('fromPromise', () => {
    it('should wrap resolved promise', async () => {
      const result = await Result.fromPromise(Promise.resolve(42));
      expect(Result.unwrap(result)).toBe(42);
    });

    it('should wrap rejected promise', async () => {
      const result = await Result.fromPromise(Promise.reject(new Error('fail')));
      expect(Result.isErr(result)).toBe(true);
    });

    it('should map error with custom mapper', async () => {
      const result = await Result.fromPromise(
        Promise.reject(new Error('fail')),
        (e) => `Wrapped: ${(e as Error).message}`
      );
      if (!result.ok) {
        expect(result.error).toBe('Wrapped: fail');
      }
    });
  });

  describe('fromTry', () => {
    it('should wrap successful function', () => {
      const result = Result.fromTry(() => JSON.parse('{"a":1}'));
      expect(Result.unwrap(result)).toEqual({ a: 1 });
    });

    it('should wrap throwing function', () => {
      const result = Result.fromTry(() => JSON.parse('invalid'));
      expect(Result.isErr(result)).toBe(true);
    });
  });

  describe('all', () => {
    it('should collect all Ok values', () => {
      const results = [Result.ok(1), Result.ok(2), Result.ok(3)];
      const collected = Result.all(results);
      expect(Result.unwrap(collected)).toEqual([1, 2, 3]);
    });

    it('should return first Err', () => {
      const results = [
        Result.ok(1),
        Result.err<number, string>('error'),
        Result.ok(3),
      ];
      const collected = Result.all(results);
      expect(Result.isErr(collected)).toBe(true);
      if (!collected.ok) {
        expect(collected.error).toBe('error');
      }
    });
  });

  describe('partition', () => {
    it('should separate Ok and Err values', () => {
      const results = [
        Result.ok<number, string>(1),
        Result.err<number, string>('a'),
        Result.ok<number, string>(2),
        Result.err<number, string>('b'),
      ];
      const { ok, err } = Result.partition(results);
      expect(ok).toEqual([1, 2]);
      expect(err).toEqual(['a', 'b']);
    });
  });
});

describe('StructuredError', () => {
  it('should create error with all fields', () => {
    const error = new StructuredError('TestError', 'TEST_CODE', 'Test message', {
      foo: 'bar',
      retryable: true,
    });

    expect(error.name).toBe('TestError');
    expect(error.code).toBe('TEST_CODE');
    expect(error.message).toBe('Test message');
    expect(error.retryable).toBe(true);
    expect(error.context.foo).toBe('bar');
    expect(error.timestamp).toBeGreaterThan(0);
  });

  it('should serialize to JSON', () => {
    const error = new StructuredError('TestError', 'CODE', 'msg');
    const json = error.toJSON();

    expect(json.name).toBe('TestError');
    expect(json.code).toBe('CODE');
    expect(json.message).toBe('msg');
  });

  it('should have meaningful toString', () => {
    const error = new StructuredError('TestError', 'CODE', 'message');
    expect(error.toString()).toBe('[TestError] CODE: message');
  });
});

describe('EngineError', () => {
  it('should create network error as retryable', () => {
    const error = EngineError.networkError('Connection failed');
    expect(error.code).toBe('NETWORK_ERROR');
    expect(error.retryable).toBe(true);
  });

  it('should create timeout error', () => {
    const error = EngineError.timeout('fetch', 5000);
    expect(error.code).toBe('TIMEOUT');
    expect(error.message).toContain('5000ms');
    expect(error.retryable).toBe(true);
  });

  it('should create not found error as non-retryable', () => {
    const error = EngineError.notFound('texture.png');
    expect(error.code).toBe('NOT_FOUND');
    expect(error.retryable).toBe(false);
  });

  it('should create invalid input error', () => {
    const error = EngineError.invalidInput('URL cannot be empty');
    expect(error.code).toBe('INVALID_INPUT');
    expect(error.retryable).toBe(false);
  });

  it('should create internal error with cause', () => {
    const cause = new Error('original');
    const error = EngineError.internal('Something went wrong', cause);
    expect(error.code).toBe('INTERNAL_ERROR');
    expect(error.cause).toBe(cause);
  });

  it('should create cancelled error', () => {
    const error = EngineError.cancelled('texture loading');
    expect(error.code).toBe('CANCELLED');
    expect(error.message).toContain('texture loading');
  });
});

describe('Result with StructuredError', () => {
  it('should work together for typed error handling', async () => {
    // Simulate async operation that returns Result
    async function loadResource(url: string): Promise<Result<string, EngineError>> {
      if (url === '') {
        return Result.err(EngineError.invalidInput('URL cannot be empty'));
      }
      if (url.startsWith('404:')) {
        return Result.err(EngineError.notFound(url.slice(4)));
      }
      return Result.ok(`Content of ${url}`);
    }

    // Test success case
    const success = await loadResource('test.txt');
    expect(Result.isOk(success)).toBe(true);
    expect(Result.unwrap(success)).toBe('Content of test.txt');

    // Test validation error
    const validation = await loadResource('');
    expect(Result.isErr(validation)).toBe(true);
    if (!validation.ok) {
      expect(validation.error.code).toBe('INVALID_INPUT');
      expect(validation.error.retryable).toBe(false);
    }

    // Test not found error
    const notFound = await loadResource('404:missing.txt');
    expect(Result.isErr(notFound)).toBe(true);
    if (!notFound.ok) {
      expect(notFound.error.code).toBe('NOT_FOUND');
    }

    // Pattern matching
    const message = Result.match(notFound, {
      ok: (content) => `Loaded: ${content}`,
      err: (error) => `Error [${error.code}]: ${error.message}`,
    });
    expect(message).toContain('NOT_FOUND');
  });
});

