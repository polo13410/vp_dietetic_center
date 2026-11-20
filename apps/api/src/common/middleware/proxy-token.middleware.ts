import { timingSafeEqual } from 'crypto';

import type { NextFunction, Request, Response } from 'express';

const HEADER = 'x-proxy-token';
/** Cloud Run's startup probe and CD call it directly; it reveals nothing. */
const OPEN_PATHS = new Set(['/api/v1/health']);

/**
 * Only the frontend's nginx may call the API: it adds a shared secret header to every
 * request it forwards. Anything else reaching the API's own address is refused before any
 * other work (it also stops forged X-Forwarded-For headers from dodging the rate limits).
 * Without PROXY_TOKEN (development) every request is accepted.
 */
export function proxyTokenMiddleware(expected: string | undefined) {
  if (!expected) return (_req: Request, _res: Response, next: NextFunction) => next();
  const secret = Buffer.from(expected);

  return (req: Request, res: Response, next: NextFunction) => {
    if (OPEN_PATHS.has(req.path)) return next();
    const sent = Buffer.from(String(req.headers[HEADER] ?? ''));
    if (sent.length === secret.length && timingSafeEqual(sent, secret)) {
      delete req.headers[HEADER]; // never logged nor passed on
      return next();
    }
    res.status(403).json({ statusCode: 403, message: 'Accès direct à l’API refusé' });
  };
}
