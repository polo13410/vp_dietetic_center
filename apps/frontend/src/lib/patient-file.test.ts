import { describe, expect, it } from 'vitest';

import { bmrConstant, formatPrice, missingMessage, todaysAppointment } from './patient-file';

describe('missingMessage', () => {
  it('says what to add, in her words', () => {
    expect(missingMessage(['height'], 'bmi')).toBe('Ajoutez la taille pour calculer l’IMC');
    expect(missingMessage(['sex', 'age'], 'bmr')).toBe('Ajoutez le sexe et l’âge pour calculer le MB');
    expect(missingMessage(['weight', 'sex', 'age'], 'bmr')).toBe('Ajoutez le poids, le sexe et l’âge pour calculer le MB');
  });

  it('is silent when the figure can be computed', () => {
    expect(missingMessage([], 'bmr')).toBeNull();
    expect(missingMessage(['sex'], 'bmi')).toBeNull();
  });
});

describe('bmrConstant', () => {
  it('follows her sheet: 0,963 for a woman, 1,083 for a man', () => {
    expect(bmrConstant('F')).toBe(0.963);
    expect(bmrConstant('M')).toBe(1.083);
    expect(bmrConstant(null)).toBeNull();
  });
});

describe('todaysAppointment', () => {
  const now = new Date(2026, 10, 22, 8, 0);
  const at = (day: number, status = 'SCHEDULED') => ({
    id: `${day}-${status}`,
    startAt: new Date(2026, 10, day, 14, 0).toISOString(),
    duration: 45,
    type: 'IN_PERSON',
    status,
  });

  it('finds the appointment of the day a session can start from', () => {
    expect(todaysAppointment([at(21), at(22), at(23)], now)?.id).toBe('22-SCHEDULED');
  });

  it('ignores cancelled or past days', () => {
    expect(todaysAppointment([at(22, 'CANCELLED'), at(21)], now)).toBeUndefined();
  });
});

describe('formatPrice', () => {
  it('shows euros', () => {
    expect(formatPrice(6000)).toBe('60 €');
    expect(formatPrice(4550)).toBe('45,5 €');
  });
});
