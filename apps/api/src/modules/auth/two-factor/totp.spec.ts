import { describe, expect, it } from 'vitest';

import {
  base32Decode,
  base32Encode,
  codeAt,
  generateRecoveryCodes,
  generateSecret,
  hashRecoveryCode,
  otpauthUrl,
  stepAt,
  verifyCode,
} from './totp';

// RFC 6238 appendix B: the SHA-1 secret is the ASCII string "12345678901234567890"
const RFC_SECRET = base32Encode(Buffer.from('12345678901234567890'));

describe('TOTP', () => {
  it('round-trips base32', () => {
    const bytes = Buffer.from([0, 1, 2, 250, 251, 252, 253, 254, 255, 7]);
    expect(base32Decode(base32Encode(bytes))).toEqual(bytes);
    expect(base32Encode(Buffer.from('foobar'))).toBe('MZXW6YTBOI');
  });

  it('gives the RFC 6238 test codes', () => {
    // 8-digit vectors of the RFC, at T = 59 s, 1111111109 s and 2000000000 s
    expect(codeAt(RFC_SECRET, stepAt(59_000), 8)).toBe('94287082');
    expect(codeAt(RFC_SECRET, stepAt(1_111_111_109_000), 8)).toBe('07081804');
    expect(codeAt(RFC_SECRET, stepAt(2_000_000_000_000), 8)).toBe('69279037');
    // The 6 digits shown by an app are the last six
    expect(codeAt(RFC_SECRET, stepAt(59_000))).toBe('287082');
  });

  it('accepts the current code, and the one before or after', () => {
    const time = 1_800_000_000_000;
    const now = stepAt(time);
    expect(verifyCode(RFC_SECRET, codeAt(RFC_SECRET, now), null, time)).toBe(now);
    expect(verifyCode(RFC_SECRET, codeAt(RFC_SECRET, now - 1), null, time)).toBe(now - 1);
    expect(verifyCode(RFC_SECRET, codeAt(RFC_SECRET, now + 1), null, time)).toBe(now + 1);
    expect(verifyCode(RFC_SECRET, codeAt(RFC_SECRET, now - 2), null, time)).toBeNull();
  });

  it('accepts spaces in the code, refuses anything else than 6 digits', () => {
    const time = 1_800_000_000_000;
    const code = codeAt(RFC_SECRET, stepAt(time));
    expect(verifyCode(RFC_SECRET, `${code.slice(0, 3)} ${code.slice(3)}`, null, time)).not.toBeNull();
    expect(verifyCode(RFC_SECRET, '12345', null, time)).toBeNull();
    expect(verifyCode(RFC_SECRET, 'abcdef', null, time)).toBeNull();
  });

  it('never accepts a code twice (nor an older one)', () => {
    const time = 1_800_000_000_000;
    const now = stepAt(time);
    expect(verifyCode(RFC_SECRET, codeAt(RFC_SECRET, now), now, time)).toBeNull();
    expect(verifyCode(RFC_SECRET, codeAt(RFC_SECRET, now - 1), now, time)).toBeNull();
    expect(verifyCode(RFC_SECRET, codeAt(RFC_SECRET, now + 1), now, time)).toBe(now + 1);
  });

  it('makes 160-bit secrets and the link of the QR code', () => {
    const secret = generateSecret();
    expect(base32Decode(secret)).toHaveLength(20);
    expect(generateSecret()).not.toBe(secret);
    const url = otpauthUrl('ABC', 'valerie@gmail.com');
    expect(url.startsWith('otpauth://totp/VP%20Dietetic%20Center%3Avalerie%40gmail.com?')).toBe(true);
    expect(new URL(url).searchParams.get('secret')).toBe('ABC');
    expect(new URL(url).searchParams.get('issuer')).toBe('VP Dietetic Center');
  });

  it('makes ten distinct recovery codes, compared whatever the case and dash', () => {
    const codes = generateRecoveryCodes();
    expect(codes).toHaveLength(10);
    expect(new Set(codes).size).toBe(10);
    for (const code of codes) expect(code).toMatch(/^[A-Z2-9]{4}-[A-Z2-9]{4}$/);
    expect(hashRecoveryCode('k7q4 9mzd')).toBe(hashRecoveryCode('K7Q4-9MZD'));
    expect(hashRecoveryCode('K7Q4-9MZD')).not.toBe(hashRecoveryCode('K7Q4-9MZE'));
  });
});
