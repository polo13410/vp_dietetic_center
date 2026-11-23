import { describe, expect, it } from 'vitest';

import nginxConf from '../../nginx.conf?raw';

/** The directives of the Content-Security-Policy header served by nginx in staging and production. */
function cspDirectives(): Map<string, string[]> {
  const header = nginxConf.match(/add_header Content-Security-Policy "([^"]+)"/);
  if (!header) throw new Error('No Content-Security-Policy header in nginx.conf');
  return new Map(
    header[1]
      .split(';')
      .map((d) => d.trim().split(/\s+/))
      .filter(([name]) => name)
      .map(([name, ...sources]) => [name, sources]),
  );
}

describe('nginx Content-Security-Policy', () => {
  it('lets the PDF renderer compile its WebAssembly layout engine, without allowing eval()', () => {
    // Without it, invoices, credit notes, GP reports and the patient file export fail to render
    // in staging and production, while working locally where Vite sends no CSP (REFONTE lot 12).
    const scriptSrc = cspDirectives().get('script-src');
    expect(scriptSrc).toContain("'wasm-unsafe-eval'");
    expect(scriptSrc).not.toContain("'unsafe-eval'");
  });

  it('lets documents be previewed from memory', () => {
    expect(cspDirectives().get('frame-src')).toContain('blob:');
  });
});
