import { CallHandler, ExecutionContext, Injectable, Logger, NestInterceptor } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { Request } from 'express';
import { Observable, tap } from 'rxjs';

import { AuditService } from './audit.service';
import { AUDITED_KEY, type AuditedOptions } from './audited.decorator';

/**
 * Writes an audit entry after each successful call to a route marked @Audited. Writing never
 * delays nor fails the response: a failed write is only logged.
 */
@Injectable()
export class AuditInterceptor implements NestInterceptor {
  private readonly logger = new Logger(AuditInterceptor.name);

  constructor(
    private readonly reflector: Reflector,
    private readonly audit: AuditService,
  ) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const options = this.reflector.get<AuditedOptions | undefined>(AUDITED_KEY, context.getHandler());
    if (!options) return next.handle();
    const req = context.switchToHttp().getRequest<Request & { user?: { id: string } }>();

    return next.handle().pipe(
      tap((result) => {
        const pick = (source?: string) => resolve(source, req, result);
        const userId = req.user?.id ?? pick(options.userId);
        if (!userId) return; // nobody to attribute it to (e.g. failed sign-in)
        this.audit
          .log({
            userId,
            action: options.action,
            entity: options.entity,
            entityId: pick(options.entityId) ?? pick('param:id') ?? pick('result:id'),
            patientId: pick(options.patientId),
            metadata: { method: req.method, route: routeOf(req) },
            ipAddress: req.ip,
            userAgent: req.headers['user-agent'],
          })
          .catch((error) => this.logger.error(`Audit entry not written: ${error}`));
      }),
    );
  }
}

/** Reads `param:x`, `body:x` or `result:a.b` from the request or the handler's result. */
function resolve(source: string | undefined, req: Request, result: unknown): string | undefined {
  if (!source) return undefined;
  const [where, path] = source.split(':') as ['param' | 'body' | 'result', string];
  const root: unknown = where === 'param' ? req.params : where === 'body' ? req.body : result;
  const value = path.split('.').reduce<unknown>((obj, key) => (obj as Record<string, unknown>)?.[key], root);
  return typeof value === 'string' ? value : undefined;
}

/** The route pattern (/api/v1/patients/:id), not the actual ids. */
function routeOf(req: Request): string {
  return `${req.baseUrl ?? ''}${(req.route as { path?: string } | undefined)?.path ?? req.path}`;
}
