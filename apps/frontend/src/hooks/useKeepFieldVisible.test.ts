import { describe, expect, it } from 'vitest';

import { revealOffset } from './useKeepFieldVisible';

describe('revealOffset', () => {
  // iPad landscape with the keyboard open: about 400 px left at the top of the screen
  const top = 0;
  const bottom = 400;

  it('leaves a visible field alone', () => {
    expect(revealOffset({ top: 100, bottom: 144 }, top, bottom)).toBe(0);
  });

  it('brings a field hidden by the keyboard to the middle of what is left', () => {
    expect(revealOffset({ top: 600, bottom: 644 }, top, bottom)).toBe(422);
  });

  it('brings a field above the screen back down', () => {
    expect(revealOffset({ top: -100, bottom: -56 }, top, bottom)).toBe(-278);
  });

  it('shows the top of a field taller than the free area', () => {
    expect(revealOffset({ top: 300, bottom: 900 }, top, bottom)).toBe(276);
  });
});
