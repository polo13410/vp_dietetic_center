import { describe, expect, it } from 'vitest';

import { requestLog, responseLog } from './http-log';

describe('HTTP log lines', () => {
  it('omits the URL before routing or for an unrecognised path', () => {
    expect(requestLog({ method: 'GET', url: '/private/secret' } as never)).toEqual({ method: 'GET' });
  });

  it('keep only the id, method and path of a request', () => {
    const line = requestLog({
      id: 7,
      method: 'GET',
      url: '/api/v1/patients/patient-uuid/invoices?search=Martine',
      raw: { route: { path: '/api/v1/patients/:patientId/invoices' } },
      headers: { cookie: '__session=secret', authorization: 'Bearer secret' },
      query: { q: 'Martine' },
      remoteAddress: '203.0.113.9',
    } as never);

    expect(line).toEqual({ id: 7, method: 'GET', route: '/api/v1/patients/:patientId/invoices' });
    expect(JSON.stringify(line)).not.toMatch(/secret|patient-uuid|Martine|203\.0\.113/);
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
