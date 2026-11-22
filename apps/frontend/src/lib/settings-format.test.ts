import { describe, expect, it } from 'vitest';

import {
  adeliRppsError,
  centsToInput,
  formatEuros,
  formatTime,
  parseEuros,
  siretError,
} from './settings-format';

describe('settings-format', () => {
  it('reads a price typed in euros', () => {
    expect(parseEuros('60')).toBe(6000);
    expect(parseEuros('52,50 €')).toBe(5250);
    expect(parseEuros('52.5')).toBe(5250);
    expect(parseEuros('')).toBeNull();
    expect(parseEuros('soixante')).toBeUndefined();
    expect(parseEuros('-5')).toBeUndefined();
    expect(parseEuros('20000')).toBeUndefined();
  });

  it('writes a price back for the field and for reading', () => {
    expect(centsToInput(6000)).toBe('60');
    expect(centsToInput(5250)).toBe('52,50');
    expect(centsToInput(null)).toBe('');
    expect(formatEuros(6000).replace(/\s/g, ' ')).toBe('60 €');
    expect(formatEuros(5250).replace(/\s/g, ' ')).toBe('52,50 €');
  });

  it('checks the SIRET (Luhn) and the ADELI or RPPS number like the API', () => {
    expect(siretError('912 345 678 00011')).toBeNull();
    expect(siretError('91234567800012')).toMatch(/n’est pas valide/);
    expect(siretError('1234')).toBe('Le SIRET compte 14 chiffres.');
    expect(adeliRppsError('139512345')).toBeNull();
    expect(adeliRppsError('101 0123 4567')).toBeNull();
    expect(adeliRppsError('1234567890')).not.toBeNull();
  });

  it('writes the time the French way', () => {
    expect(formatTime(new Date(2026, 10, 22, 14, 5))).toBe('14 h 05');
  });
});
