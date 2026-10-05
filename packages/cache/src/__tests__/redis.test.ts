import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import net from 'node:net';
import type { AddressInfo } from 'node:net';

// U11: the shared ioredis client against a minimal fake Redis (RESP over TCP), so the real
// client code paths run without a Redis server: the ready check is answered, GET never is
// (a stalled Redis), and the server can be stopped and restarted on the same port.

class FakeRedis {
  private server: net.Server | null = null;
  private sockets = new Set<net.Socket>();
  port = 0;

  async start(port = 0): Promise<void> {
    this.server = net.createServer((socket) => {
      this.sockets.add(socket);
      socket.on('close', () => this.sockets.delete(socket));
      let buffer = '';
      socket.on('data', (chunk) => {
        buffer += chunk.toString('utf8');
        let command: string | null;
        while ((command = takeCommand())) reply(socket, command);
      });
      // Pull one complete RESP array off the buffer and return its first element (the name).
      function takeCommand(): string | null {
        const lines = buffer.split('\r\n');
        if (!lines[0].startsWith('*')) return null;
        const argc = Number(lines[0].slice(1));
        if (lines.length < 1 + argc * 2 + 1) return null;
        const name = lines[2].toUpperCase();
        buffer = lines.slice(1 + argc * 2).join('\r\n');
        return name;
      }
    });
    await new Promise<void>((resolve) => this.server!.listen(port, '127.0.0.1', resolve));
    this.port = (this.server!.address() as AddressInfo).port;
  }

  async stop(): Promise<void> {
    for (const socket of this.sockets) socket.destroy();
    await new Promise<void>((resolve) => this.server?.close(() => resolve()) ?? resolve());
    this.server = null;
  }
}

function reply(socket: net.Socket, command: string): void {
  if (command === 'INFO') {
    const info = '# Server\r\nredis_version:7.4.11\r\nloading:0\r\n';
    socket.write(`$${Buffer.byteLength(info)}\r\n${info}\r\n`);
  } else if (command === 'GET') {
    // stalled: never answer
  } else if (command === 'QUIT') {
    socket.end('+OK\r\n');
  } else {
    socket.write('+OK\r\n'); // CLIENT SETINFO, QUIT, …
  }
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

let fake: FakeRedis;
let redis: typeof import('../redis');

beforeEach(async () => {
  vi.spyOn(console, 'log').mockImplementation(() => {});
  vi.spyOn(console, 'warn').mockImplementation(() => {});
  vi.spyOn(console, 'error').mockImplementation(() => {});
  fake = new FakeRedis();
  await fake.start();
  process.env.REDIS_URL = `redis://127.0.0.1:${fake.port}`;
  vi.resetModules();
  redis = await import('../redis');
});

afterEach(async () => {
  await redis.closeRedisClient();
  await fake.stop();
  delete process.env.REDIS_URL;
  vi.restoreAllMocks();
});

describe('REDIS_CLIENT_OPTIONS', () => {
  it('never gives up reconnecting and caps the backoff at 5 s', () => {
    const { retryStrategy } = redis.REDIS_CLIENT_OPTIONS;
    for (const attempt of [1, 2, 3, 4, 10, 100, 10_000]) {
      const delay = retryStrategy(attempt);
      expect(typeof delay).toBe('number');
      expect(delay).toBeGreaterThan(0);
      expect(delay).toBeLessThanOrEqual(5000);
    }
  });

  it('fails commands fast while disconnected and bounds connect/command time', () => {
    expect(redis.REDIS_CLIENT_OPTIONS).toMatchObject({
      enableOfflineQueue: false,
      maxRetriesPerRequest: 1,
      connectTimeout: 2000,
      commandTimeout: 500,
    });
  });
});

describe('getRedisClient', () => {
  it('returns null without REDIS_URL', async () => {
    delete process.env.REDIS_URL;
    expect(await redis.getRedisClient()).toBeNull();
  });

  it('returns one shared, ready client', async () => {
    const a = await redis.getRedisClient();
    const b = await redis.getRedisClient();

    expect(a).not.toBeNull();
    expect(a).toBe(b);
    expect(a!.status).toBe('ready');
  });

  it('a stalled Redis fails a command after ~500 ms instead of hanging', async () => {
    const client = await redis.getRedisClient();
    const started = Date.now();

    await expect(client!.get('fotbalfm:any')).rejects.toThrow(/timed out/i);
    const elapsed = Date.now() - started;
    expect(elapsed).toBeGreaterThanOrEqual(450);
    expect(elapsed).toBeLessThan(1500);
  });

  it('after the client ends, the next call creates a new one', async () => {
    const first = await redis.getRedisClient();
    const ended = new Promise((resolve) => first!.once('end', resolve));
    first!.disconnect(); // simulated `end`
    await ended;
    await sleep(1050); // RECREATE_AFTER_MS

    const second = await redis.getRedisClient();
    expect(second).not.toBeNull();
    expect(second).not.toBe(first);
    expect(second!.status).toBe('ready');
  });

  it('keeps reconnecting through a Redis restart longer than the old 3-attempt limit', async () => {
    const client = await redis.getRedisClient();
    const port = fake.port;
    let reconnectAttempts = 0;
    client!.on('reconnecting', () => reconnectAttempts++);

    await fake.stop();
    await vi.waitFor(() => expect(client!.status).not.toBe('ready'));
    expect(await redis.getRedisClient()).toBeNull(); // no cache while Redis is away

    await sleep(1600); // retries at ~200, 600, 1200, 2000 ms: more than the old limit of 3
    await fake.start(port);
    await vi.waitFor(() => expect(client!.status).toBe('ready'), { timeout: 5000, interval: 50 });

    expect(reconnectAttempts).toBeGreaterThan(3);
    expect(client!.status).toBe('ready');
    expect(await redis.getRedisClient()).toBe(client); // same client, recovered by itself
  }, 15_000);

  it('closeRedisClient lets a CLI exit (no further reconnects)', async () => {
    const client = await redis.getRedisClient();
    let reconnects = 0;
    client!.on('reconnecting', () => reconnects++);
    await redis.closeRedisClient();

    await vi.waitFor(() => expect(client!.status).toBe('end'));
    await sleep(300); // past the first retry delay
    expect(reconnects).toBe(0);
  });
});
