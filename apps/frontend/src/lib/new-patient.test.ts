import { describe, expect, it } from 'vitest';

import { patient } from '../test/patient-fixtures';

import {
  changedFields,
  contactErrors,
  EMPTY_IDENTITY,
  identityErrors,
  identityFromPatient,
  identityFromSearch,
  identityPayload,
  joinFrench,
  parseHeight,
} from './new-patient';

describe('new patient wizard helpers', () => {
  it('requires the names and checks the age and birth date', () => {
    expect(identityErrors(EMPTY_IDENTITY)).toEqual({ firstName: 'Indiquez le prénom.', lastName: 'Indiquez le nom.' });
    const named = { ...EMPTY_IDENTITY, firstName: 'Claire', lastName: 'Martin' };
    expect(identityErrors(named)).toEqual({});
    expect(identityErrors({ ...named, ageOnly: true, age: '130' }).age).toBeDefined();
    expect(identityErrors({ ...named, dateOfBirth: '0019-05-02' }).dateOfBirth).toBeDefined();
    expect(identityErrors({ ...named, dateOfBirth: '1970-08-24' })).toEqual({});
  });

  it('sends either the birth date or the declared age', () => {
    const named = { ...EMPTY_IDENTITY, firstName: ' Claire ', lastName: 'Martin', sex: 'F' as const };
    expect(identityPayload({ ...named, dateOfBirth: '1970-08-24', age: '56' })).toEqual({
      firstName: 'Claire',
      lastName: 'Martin',
      sex: 'F',
      dateOfBirth: '1970-08-24',
    });
    expect(identityPayload({ ...named, ageOnly: true, age: '56', dateOfBirth: '1970-08-24' })).toMatchObject({ age: 56 });
    expect(identityPayload({ ...named, ageOnly: true })).toMatchObject({ dateOfBirth: null });
  });

  it('reads a patient back, with the declared age when the birth date is estimated', () => {
    expect(identityFromPatient(patient)).toMatchObject({ sex: 'F', ageOnly: false, dateOfBirth: '1970-08-24', age: '' });
    const estimated = identityFromPatient({ ...patient, birthDateEstimated: true, dateOfBirth: '1970-01-01T00:00:00.000Z' });
    expect(estimated).toMatchObject({ ageOnly: true, dateOfBirth: '' });
    expect(Number(estimated.age)).toBeGreaterThanOrEqual(56);
  });

  it('splits a searched name', () => {
    expect(identityFromSearch('Dupont')).toMatchObject({ firstName: '', lastName: 'Dupont' });
    expect(identityFromSearch(' Marie  de la Tour ')).toMatchObject({ firstName: 'Marie', lastName: 'de la Tour' });
  });

  it('sends only what changed, an emptied field as null', () => {
    const saved = { phone: '06', email: 'a@b.fr', city: '' };
    expect(changedFields({ phone: '06 ', email: '', city: 'Nîmes' }, saved)).toEqual({ email: null, city: 'Nîmes' });
    expect(contactErrors({ phone: '', email: 'a@', address: '', zipCode: '', city: '' }).email).toBeDefined();
  });

  it('reads a height in cm, with a comma or a dot', () => {
    expect(parseHeight('')).toBeUndefined();
    expect(parseHeight('158,5')).toBe(158.5);
    expect(parseHeight('1.59')).toBeNull();
    expect(joinFrench(['le sexe', 'l’âge', 'la taille'])).toBe('le sexe, l’âge et la taille');
  });
});
