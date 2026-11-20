import { describe, expect, it, vi } from 'vitest';

import { proxyTokenMiddleware } from './proxy-token.middleware';

const run = (expected: string | undefined, path: string, header?: string) => {
  const req = { path, headers: header === undefined ? {} : { 'x-proxy-token': header } } as any;
  const res = { status: vi.fn().mockReturnThis(), json: vi.fn() } as any;
  const next = vi.fn();
  proxyTokenMiddleware(expected)(req, res, next);
  return { req, res, next };
};

describe('proxyTokenMiddleware', () => {
  it('lets requests from the frontend through, without passing the secret on', () => {
    const { next, req } = run('s3cret-value', '/api/v1/patients', 's3cret-value');
    expect(next).toHaveBeenCalled();
    expect(req.headers['x-proxy-token']).toBeUndefined();
  });

  it('refuses direct calls, with a wrong or missing secret', () => {
    for (const header of [undefined, '', 'wrong', 's3cret-valuE']) {
      const { next, res } = run('s3cret-value', '/api/v1/auth/login', header);
      expect(next).not.toHaveBeenCalled();
      expect(res.status).toHaveBeenCalledWith(403);
    }
  });

  it('keeps the health check open (startup probe, deploy check)', () => {
    expect(run('s3cret-value', '/api/v1/health').next).toHaveBeenCalled();
  });

  it('accepts everything when no secret is configured (development)', () => {
    expect(run(undefined, '/api/v1/patients').next).toHaveBeenCalled();
  });
});
