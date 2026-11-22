import { describe, expect, it } from 'vitest';

import { digitsOnly, isValidAdeliRpps, isValidSiret, passesLuhn } from './identifiers';

describe('identifiers', () => {
  it('computes the Luhn checksum', () => {
    expect(passesLuhn('79927398713')).toBe(true);
    expect(passesLuhn('79927398710')).toBe(false);
  });

  it('accepts a SIRET of 14 digits with the right checksum', () => {
    expect(isValidSiret('91234567800011')).toBe(true);
  });

  it('refuses a SIRET with a wrong checksum, a wrong length or letters', () => {
    expect(isValidSiret('91234567800012')).toBe(false);
    expect(isValidSiret('9123456780001')).toBe(false);
    expect(isValidSiret('912345678000110')).toBe(false);
    expect(isValidSiret('9123456780001A')).toBe(false);
  });

  it('accepts an ADELI (9 digits) or an RPPS (11 digits), nothing else', () => {
    expect(isValidAdeliRpps('139512345')).toBe(true);
    expect(isValidAdeliRpps('10101234567')).toBe(true);
    expect(isValidAdeliRpps('1395123456')).toBe(false);
    expect(isValidAdeliRpps('13951234')).toBe(false);
    expect(isValidAdeliRpps('13951234A')).toBe(false);
  });

  it('removes the spaces, dots and dashes used to group digits', () => {
    expect(digitsOnly('912 345 678 00011')).toBe('91234567800011');
    expect(digitsOnly('13-95.12 345')).toBe('139512345');
    expect(digitsOnly(null)).toBe(null);
  });
});
