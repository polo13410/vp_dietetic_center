import { describe, expect, it } from 'vitest';

import { pathOnly, requestLog, responseLog } from './http-log';

describe('HTTP log lines', () => {
  it('drop the query string and fragment of the URL', () => {
    expect(pathOnly('/api/v1/patients?search=Dupont&page=2')).toBe('/api/v1/patients');
    expect(pathOnly('/api/v1/patients#x')).toBe('/api/v1/patients');
    expect(pathOnly('/api/v1/health')).toBe('/api/v1/health');
    expect(pathOnly(undefined)).toBeUndefined();
  });

  it('keep only the id, method and path of a request', () => {
    const line = requestLog({
      id: 7,
      method: 'GET',
      url: '/api/v1/search?q=Martine',
      headers: { cookie: '__session=secret', authorization: 'Bearer secret' },
      query: { q: 'Martine' },
      remoteAddress: '203.0.113.9',
    } as never);

    expect(line).toEqual({ id: 7, method: 'GET', url: '/api/v1/search' });
    expect(JSON.stringify(line)).not.toMatch(/secret|Martine|203\.0\.113/);
  });

  it('keep only the status of a response, never its headers', () => {
    const line = responseLog({
      statusCode: 200,
      headers: { 'set-cookie': '__session=secret; HttpOnly' },
    } as never);

    expect(line).toEqual({ statusCode: 200 });
    expect(JSON.stringify(line)).not.toContain('secret');
  });
});
