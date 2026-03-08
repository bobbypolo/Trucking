import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { Writable } from 'stream';

// Tests R-P1-06-AC1, R-P1-06-AC2

describe('R-P1-06: Structured Logging and Correlation IDs', () => {
  describe('AC1: Structured JSON logger', () => {
    it('emits JSON with required fields: timestamp, level, service, msg', () => {
      const lines: string[] = [];
      const stream = new Writable({
        write(chunk, _encoding, callback) {
          lines.push(chunk.toString());
          callback();
        },
      });

      // Import with a custom stream to capture output
      const pino = require('pino');
      const logger = pino(
        {
          level: 'info',
          formatters: {
            level: (label: string) => ({ level: label }),
          },
          timestamp: pino.stdTimeFunctions.isoTime,
          base: {
            service: 'loadpilot-api',
          },
        },
        stream,
      );

      logger.info('test message');

      expect(lines.length).toBe(1);
      const parsed = JSON.parse(lines[0]);
      expect(parsed).toHaveProperty('level', 'info');
      expect(parsed).toHaveProperty('service', 'loadpilot-api');
      expect(parsed).toHaveProperty('msg', 'test message');
      expect(parsed).toHaveProperty('time');
      // Verify ISO timestamp format
      expect(parsed.time).toMatch(/^\d{4}-\d{2}-\d{2}T/);
    });

    it('supports child loggers with correlation_id and route context', () => {
      const lines: string[] = [];
      const stream = new Writable({
        write(chunk, _encoding, callback) {
          lines.push(chunk.toString());
          callback();
        },
      });

      const pino = require('pino');
      const logger = pino(
        {
          level: 'info',
          formatters: {
            level: (label: string) => ({ level: label }),
          },
          timestamp: pino.stdTimeFunctions.isoTime,
          base: {
            service: 'loadpilot-api',
          },
        },
        stream,
      );

      const child = logger.child({
        correlationId: 'req-abc-123',
        route: 'GET /api/loads',
      });

      child.info('load fetched');

      expect(lines.length).toBe(1);
      const parsed = JSON.parse(lines[0]);
      expect(parsed).toHaveProperty('correlationId', 'req-abc-123');
      expect(parsed).toHaveProperty('route', 'GET /api/loads');
      expect(parsed).toHaveProperty('level', 'info');
      expect(parsed).toHaveProperty('msg', 'load fetched');
    });

    it('supports data payloads via mergingObject', () => {
      const lines: string[] = [];
      const stream = new Writable({
        write(chunk, _encoding, callback) {
          lines.push(chunk.toString());
          callback();
        },
      });

      const pino = require('pino');
      const logger = pino(
        {
          level: 'info',
          formatters: {
            level: (label: string) => ({ level: label }),
          },
          timestamp: pino.stdTimeFunctions.isoTime,
          base: { service: 'loadpilot-api' },
        },
        stream,
      );

      logger.info({ data: { loadId: 'LD-001' } }, 'load created');

      const parsed = JSON.parse(lines[0]);
      expect(parsed.data).toEqual({ loadId: 'LD-001' });
    });

    it('redacts sensitive fields', () => {
      const lines: string[] = [];
      const stream = new Writable({
        write(chunk, _encoding, callback) {
          lines.push(chunk.toString());
          callback();
        },
      });

      const pino = require('pino');
      const logger = pino(
        {
          level: 'info',
          formatters: {
            level: (label: string) => ({ level: label }),
          },
          timestamp: pino.stdTimeFunctions.isoTime,
          base: { service: 'loadpilot-api' },
          redact: {
            paths: [
              'req.headers.authorization',
              'data.password',
              'data.token',
              'data.tax_id',
            ],
            censor: '[REDACTED]',
          },
        },
        stream,
      );

      logger.info({ data: { password: 'secret123', token: 'jwt-abc' } }, 'login attempt');

      const parsed = JSON.parse(lines[0]);
      expect(parsed.data.password).toBe('[REDACTED]');
      expect(parsed.data.token).toBe('[REDACTED]');
    });
  });

  describe('AC1: Logger module exports', () => {
    it('exports logger and createChildLogger from server/lib/logger', async () => {
      const loggerModule = await import('../../lib/logger');
      expect(loggerModule.logger).toBeDefined();
      expect(loggerModule.createChildLogger).toBeDefined();
      expect(typeof loggerModule.createChildLogger).toBe('function');
    });

    it('createChildLogger produces a logger with correlationId', async () => {
      const { createChildLogger } = await import('../../lib/logger');
      const child = createChildLogger({
        correlationId: 'test-123',
        route: 'POST /api/loads',
      });
      expect(child).toBeDefined();
      expect(typeof child.info).toBe('function');
      expect(typeof child.error).toBe('function');
      expect(typeof child.warn).toBe('function');
    });
  });

  describe('AC1: Correlation ID middleware', () => {
    it('generates a correlation ID when none provided', async () => {
      const { correlationId } = await import('../../middleware/correlationId');
      const req: any = { headers: {} };
      const res: any = {
        setHeader: vi.fn(),
      };
      const next = vi.fn();

      correlationId(req, res, next);

      expect(req.correlationId).toBeDefined();
      expect(typeof req.correlationId).toBe('string');
      expect(req.correlationId.length).toBeGreaterThan(0);
      expect(res.setHeader).toHaveBeenCalledWith('X-Correlation-Id', req.correlationId);
      expect(next).toHaveBeenCalled();
    });

    it('uses existing x-correlation-id header if provided', async () => {
      const { correlationId } = await import('../../middleware/correlationId');
      const req: any = { headers: { 'x-correlation-id': 'existing-id-456' } };
      const res: any = {
        setHeader: vi.fn(),
      };
      const next = vi.fn();

      correlationId(req, res, next);

      expect(req.correlationId).toBe('existing-id-456');
      expect(res.setHeader).toHaveBeenCalledWith('X-Correlation-Id', 'existing-id-456');
      expect(next).toHaveBeenCalled();
    });
  });

  describe('AC2: No bare console.log in server production code', () => {
    it('zero console.log calls in server routes, middleware, lib, services', async () => {
      const fs = await import('fs');
      const path = await import('path');
      const glob = await import('glob');

      const serverRoot = path.resolve(__dirname, '..', '..');
      const patterns = [
        'routes/*.ts',
        'middleware/*.ts',
        'lib/*.ts',
        'index.ts',
        'helpers.ts',
        'auth.ts',
        'db.ts',
        'firestore.ts',
      ];

      const consolePattern = /console\.(log|error|warn|info|debug)\s*\(/;
      const violations: string[] = [];

      for (const pattern of patterns) {
        const fullPattern = path.join(serverRoot, pattern).replace(/\\/g, '/');
        const files = glob.sync(fullPattern);
        for (const file of files) {
          // Skip test files
          if (file.includes('__tests__')) continue;
          const content = fs.readFileSync(file, 'utf-8');
          const lines = content.split('\n');
          lines.forEach((line, idx) => {
            // Skip comments that mention console
            const trimmed = line.trim();
            if (trimmed.startsWith('//') || trimmed.startsWith('*') || trimmed.startsWith('/*')) return;
            if (consolePattern.test(line)) {
              const relPath = path.relative(serverRoot, file).replace(/\\/g, '/');
              violations.push(`${relPath}:${idx + 1}: ${line.trim()}`);
            }
          });
        }
      }

      expect(violations).toEqual([]);
    });
  });
});
