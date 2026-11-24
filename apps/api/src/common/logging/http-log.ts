/**
 * What an HTTP log line keeps of a request and its response. Logs end up in Cloud Logging, where
 * anyone with log access can read them, so they never carry a header (cookies, session cookie
 * sent back in Set-Cookie, tokens), a query string (search terms are names) or a body.
 */

/** Pino's standard request shape, as handed to a custom serializer by pino-http. */
interface SerializedRequest {
  id?: unknown;
  method?: string;
  url?: string;
}

/** Pino's standard response shape, as handed to a custom serializer by pino-http. */
interface SerializedResponse {
  statusCode?: number;
}

/** The URL without its query string (and fragment). */
export function pathOnly(url: string | undefined): string | undefined {
  if (url === undefined) return undefined;
  const end = url.search(/[?#]/);
  return end === -1 ? url : url.slice(0, end);
}

export function requestLog(req: SerializedRequest) {
  return { id: req.id, method: req.method, url: pathOnly(req.url) };
}

export function responseLog(res: SerializedResponse) {
  return { statusCode: res.statusCode };
}
