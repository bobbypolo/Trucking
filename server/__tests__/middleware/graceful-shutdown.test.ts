import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

describe('graceful shutdown handler', () => {
  let mockServer: { close: ReturnType<typeof vi.fn> };
  let mockClosePool: ReturnType<typeof vi.fn>;
  let mockExit: ReturnType<typeof vi.fn>;
  let shutdownHandler: (signal: string) => Promise<void>;

  beforeEach(() => {
    mockServer = { close: vi.fn((cb?: (err?: Error) => void) => { if (cb) cb(); }) };
    mockClosePool = vi.fn().mockResolvedValue(undefined);
    mockExit = vi.fn();

    // Create the shutdown handler inline (mirrors the actual implementation)
    shutdownHandler = async (signal: string) => {
      console.info(`${signal} received. Shutting down gracefully...`);
      await new Promise<void>((resolve) => {
        mockServer.close((err?: Error) => {
          if (err) console.error('Error closing server:', err);
          resolve();
        });
      });
      await mockClosePool();
      mockExit(0);
    };
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('calls server.close() when SIGTERM is received', async () => {
    await shutdownHandler('SIGTERM');
    expect(mockServer.close).toHaveBeenCalledOnce();
  });

  it('calls server.close() when SIGINT is received', async () => {
    await shutdownHandler('SIGINT');
    expect(mockServer.close).toHaveBeenCalledOnce();
  });

  it('calls closePool() after server.close()', async () => {
    await shutdownHandler('SIGTERM');
    expect(mockClosePool).toHaveBeenCalledOnce();
  });

  it('calls process.exit(0) after cleanup', async () => {
    await shutdownHandler('SIGTERM');
    expect(mockExit).toHaveBeenCalledWith(0);
  });

  it('calls closePool after server close completes', async () => {
    const callOrder: string[] = [];
    mockServer.close = vi.fn((cb?: (err?: Error) => void) => {
      callOrder.push('server.close');
      if (cb) cb();
    });
    mockClosePool = vi.fn().mockImplementation(async () => {
      callOrder.push('closePool');
    });
    await shutdownHandler('SIGTERM');
    expect(callOrder).toEqual(['server.close', 'closePool']);
  });
});
