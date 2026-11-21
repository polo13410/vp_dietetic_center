import { beforeEach, describe, expect, it, vi } from 'vitest';

const sendMail = vi.fn().mockResolvedValue({});
const createTransport = vi.fn(() => ({ sendMail }));
vi.mock('nodemailer', () => ({ createTransport: (...args: unknown[]) => createTransport(...(args as [])) }));

import { MailService } from './mail.service';

const config = (values: Record<string, unknown>) =>
  ({ get: (key: string, fallback?: unknown) => (key in values ? values[key] : fallback) }) as any;

describe('MailService', () => {
  beforeEach(() => vi.clearAllMocks());

  it('talks to the local test server in development, without credentials', () => {
    new MailService(config({}));
    expect(createTransport).toHaveBeenCalledWith(
      expect.objectContaining({ host: 'localhost', port: 1025, requireTLS: false, auth: undefined }),
    );
  });

  it('requires TLS and authenticates when credentials are set (Brevo)', () => {
    new MailService(
      config({ 'smtp.host': 'smtp-relay.brevo.com', 'smtp.port': 587, 'smtp.user': 'login', 'smtp.pass': 'key' }),
    );
    expect(createTransport).toHaveBeenCalledWith(
      expect.objectContaining({ requireTLS: true, auth: { user: 'login', pass: 'key' } }),
    );
  });

  it('sends a reset link to the app, with the name escaped', async () => {
    const mail = new MailService(
      config({ appUrl: 'https://app.example.fr', 'smtp.from': 'VP <noreply@example.fr>' }),
    );
    await mail.sendPasswordReset('jane@example.com', 'tok123', '<b>Jane</b>');
    const sent = sendMail.mock.calls[0][0];
    expect(sent).toMatchObject({ from: 'VP <noreply@example.fr>', to: 'jane@example.com' });
    expect(sent.html).toContain('https://app.example.fr/reset-password?token=tok123');
    expect(sent.html).toContain('&#60;b&#62;Jane&#60;/b&#62;');
    expect(sent.html).not.toContain('<b>Jane</b>');
  });
});
