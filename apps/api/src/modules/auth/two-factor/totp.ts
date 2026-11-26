import { createHash, createHmac, randomBytes, randomInt, timingSafeEqual } from 'crypto';

/**
 * Time-based one-time passwords (RFC 6238, the codes of Google Authenticator, Microsoft
 * Authenticator, 1Password…): HMAC-SHA1, 6 digits, a new code every 30 seconds.
 */

const STEP_SECONDS = 30;
const DIGITS = 6;
/** A code from the step before or after is still accepted (clock drift, slow typing). */
const WINDOW = 1;
const BASE32 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';

export function base32Encode(bytes: Buffer): string {
  let bits = 0;
  let value = 0;
  let out = '';
  for (const byte of bytes) {
    value = (value << 8) | byte;
    bits += 8;
    while (bits >= 5) {
      out += BASE32[(value >>> (bits - 5)) & 31];
      bits -= 5;
    }
  }
  if (bits > 0) out += BASE32[(value << (5 - bits)) & 31];
  return out;
}

export function base32Decode(text: string): Buffer {
  const clean = text.replace(/[\s=]/g, '').toUpperCase();
  let bits = 0;
  let value = 0;
  const out: number[] = [];
  for (const char of clean) {
    const index = BASE32.indexOf(char);
    if (index === -1) throw new Error('Invalid base32');
    value = (value << 5) | index;
    bits += 5;
    if (bits >= 8) {
      out.push((value >>> (bits - 8)) & 255);
      bits -= 8;
    }
  }
  return Buffer.from(out);
}

/** A new 160-bit secret, in base32 as authenticator apps expect it. */
export function generateSecret(): string {
  return base32Encode(randomBytes(20));
}

/** The 30-second step a moment falls in. */
export function stepAt(time = Date.now()): number {
  return Math.floor(time / 1000 / STEP_SECONDS);
}

/** The code of a step (RFC 4226 dynamic truncation). */
export function codeAt(secret: string, step: number, digits = DIGITS): string {
  const counter = Buffer.alloc(8);
  counter.writeBigUInt64BE(BigInt(step));
  const hmac = createHmac('sha1', base32Decode(secret)).update(counter).digest();
  const offset = hmac[hmac.length - 1] & 15;
  const binary = hmac.readUInt32BE(offset) & 0x7fffffff;
  return String(binary % 10 ** digits).padStart(digits, '0');
}

/**
 * The step the code belongs to, if it is valid now and newer than `lastStep` (a code already
 * used is refused: someone who saw it cannot replay it). Null otherwise.
 */
export function verifyCode(secret: string, code: string, lastStep: number | null, time = Date.now()): number | null {
  const typed = code.replace(/\s/g, '');
  if (!/^\d{6}$/.test(typed)) return null;
  const now = stepAt(time);
  for (let step = now - WINDOW; step <= now + WINDOW; step++) {
    if (lastStep !== null && step <= lastStep) continue;
    if (safeEqual(codeAt(secret, step), typed)) return step;
  }
  return null;
}

/** The link authenticator apps read from the QR code. */
export function otpauthUrl(secret: string, account: string, issuer = 'VP Dietetic Center'): string {
  const label = encodeURIComponent(`${issuer}:${account}`);
  const params = new URLSearchParams({ secret, issuer, algorithm: 'SHA1', digits: String(DIGITS), period: String(STEP_SECONDS) });
  return `otpauth://totp/${label}?${params.toString()}`;
}

/** Ten single-use recovery codes such as `K7Q4-9MZD`, for a lost phone. */
export function generateRecoveryCodes(count = 10): string[] {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // no 0/O, 1/I
  const part = () => Array.from({ length: 4 }, () => alphabet[randomInt(alphabet.length)]).join('');
  return Array.from({ length: count }, () => `${part()}-${part()}`);
}

/** How a recovery code is stored and compared (case, spaces and dash do not matter). */
export function hashRecoveryCode(code: string): string {
  const normalized = code.toUpperCase().replace(/[^A-Z0-9]/g, '');
  return createHash('sha256').update(normalized).digest('hex');
}

function safeEqual(a: string, b: string): boolean {
  const left = Buffer.from(a);
  const right = Buffer.from(b);
  return left.length === right.length && timingSafeEqual(left, right);
}
