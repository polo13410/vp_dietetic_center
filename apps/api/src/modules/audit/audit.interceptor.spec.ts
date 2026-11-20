import { Reflector } from '@nestjs/core';
import { AuditAction } from '@prisma/client';
import { lastValueFrom, of, throwError } from 'rxjs';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { AuditInterceptor } from './audit.interceptor';
import { AUDITED_KEY, type AuditedOptions } from './audited.decorator';

describe('AuditInterceptor', () => {
  const audit = { log: vi.fn().mockResolvedValue({}) };
  const reflector = new Reflector();
  let interceptor: AuditInterceptor;

  const handler = (options?: AuditedOptions) => {
    const fn = () => undefined;
    if (options) Reflect.defineMetadata(AUDITED_KEY, options, fn);
    return fn;
  };
  const context = (fn: () => void, req: Record<string, unknown>) =>
    ({
      getHandler: () => fn,
      switchToHttp: () => ({ getRequest: () => req }),
    }) as any;
  const request = (extra: Record<string, unknown> = {}) => ({
    method: 'GET',
    baseUrl: '',
    route: { path: '/api/v1/patients/:id' },
    params: { id: 'p1' },
    body: {},
    ip: '203.0.113.7',
    headers: { 'user-agent': 'test' },
    user: { id: 'u1' },
    ...extra,
  });

  beforeEach(() => {
    vi.clearAllMocks();
    interceptor = new AuditInterceptor(reflector, audit as any);
  });

  it('records who read which patient, from where, without any content', async () => {
    const fn = handler({ action: AuditAction.READ, entity: 'patient', patientId: 'param:id' });
    await lastValueFrom(interceptor.intercept(context(fn, request()), { handle: () => of({ id: 'p1', allergies: 'secret' }) }));
    expect(audit.log).toHaveBeenCalledWith({
      userId: 'u1',
      action: 'READ',
      entity: 'patient',
      entityId: 'p1',
      patientId: 'p1',
      metadata: { method: 'GET', route: '/api/v1/patients/:id' },
      ipAddress: '203.0.113.7',
      userAgent: 'test',
    });
    expect(JSON.stringify(audit.log.mock.calls[0][0])).not.toContain('secret');
  });

  it('takes ids from the result or the body when asked', async () => {
    const fn = handler({ action: AuditAction.CREATE, entity: 'document', patientId: 'body:patientId', entityId: 'result:id' });
    const req = request({ method: 'POST', params: {}, body: { patientId: 'p9' } });
    await lastValueFrom(interceptor.intercept(context(fn, req), { handle: () => of({ id: 'd1' }) }));
    expect(audit.log.mock.calls[0][0]).toMatchObject({ entityId: 'd1', patientId: 'p9' });
  });

  it('attributes a sign-in to the user it returns', async () => {
    const fn = handler({ action: AuditAction.LOGIN, entity: 'session', userId: 'result:user.id' });
    const req = request({ user: undefined, params: {} });
    await lastValueFrom(interceptor.intercept(context(fn, req), { handle: () => of({ user: { id: 'u7' } }) }));
    expect(audit.log.mock.calls[0][0]).toMatchObject({ userId: 'u7', action: 'LOGIN' });
  });

  it('records nothing for unmarked routes or failed calls', async () => {
    await lastValueFrom(interceptor.intercept(context(handler(), request()), { handle: () => of({}) }));
    const fn = handler({ action: AuditAction.DELETE, entity: 'patient' });
    await expect(
      lastValueFrom(interceptor.intercept(context(fn, request()), { handle: () => throwError(() => new Error('403')) })),
    ).rejects.toThrow();
    expect(audit.log).not.toHaveBeenCalled();
  });

  it('never fails the response when the trail cannot be written', async () => {
    audit.log.mockRejectedValueOnce(new Error('db down'));
    const fn = handler({ action: AuditAction.READ, entity: 'patient' });
    await expect(
      lastValueFrom(interceptor.intercept(context(fn, request()), { handle: () => of({ ok: true }) })),
    ).resolves.toEqual({ ok: true });
  });
});
