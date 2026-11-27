/**
 * What an HTTP log line keeps of a request and its response. Logs end up in Cloud Logging, where
 * anyone with log access can read them, so they never carry a header (cookies, session cookie
 * sent back in Set-Cookie, tokens), a query string (search terms are names) or a body.
 */

/** Pino's standard request shape, as handed to a custom serializer by pino-http. */
interface SerializedRequest {
  id?: unknown;
  method?: string;
  raw?: { route?: { path?: string } };
}

/** Pino's standard response shape, as handed to a custom serializer by pino-http. */
interface SerializedResponse {
  statusCode?: number;
}

/** Only the server's matched route template may reach general-purpose logs. */
export function requestLog(req: SerializedRequest) {
  return { id: req.id, method: req.method, route: req.raw?.route?.path };
}

export function responseLog(res: SerializedResponse) {
  return { statusCode: res.statusCode };
}
