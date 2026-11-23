import { plainToInstance } from 'class-transformer';
import { validateSync } from 'class-validator';
import { describe, expect, it } from 'vitest';

import { CreateFormulaDto, ReorderFormulasDto, UpdateFormulaDto } from './formula.dto';
import { UpdateActivityDto, UpdateMeDto } from './me.dto';
import { CreatePracticeDto, UpdatePracticeDto } from './practice.dto';

/** Transforms and validates like the app's ValidationPipe; returns the value and the messages. */
function check<T extends object>(cls: new () => T, body: object) {
  const value = plainToInstance(cls, body);
  const errors = validateSync(value, { whitelist: true, forbidNonWhitelisted: true });
  return { value, messages: errors.flatMap((e) => Object.values(e.constraints ?? {})) };
}

describe('UpdateActivityDto', () => {
  it('accepts a SIRET typed with spaces and stores the digits only', () => {
    const { value, messages } = check(UpdateActivityDto, { siret: '912 345 678 00011' });
    expect(messages).toEqual([]);
    expect(value.siret).toBe('91234567800011');
  });

  it('refuses a SIRET whose checksum is wrong', () => {
    const { messages } = check(UpdateActivityDto, { siret: '91234567800012' });
    expect(messages).toEqual([expect.stringContaining('SIRET n’est pas valide')]);
  });

  it('accepts an ADELI or an RPPS number, refuses other lengths', () => {
    expect(check(UpdateActivityDto, { adeliRpps: '13 95 12345' }).messages).toEqual([]);
    expect(check(UpdateActivityDto, { adeliRpps: '10101234567' }).messages).toEqual([]);
    expect(check(UpdateActivityDto, { adeliRpps: '1234567890' }).messages).toEqual([
      'Le numéro ADELI compte 9 chiffres, le numéro RPPS 11 chiffres.',
    ]);
  });

  it('clears a field sent empty', () => {
    const { value, messages } = check(UpdateActivityDto, { siret: '  ', vatMention: ' ' });
    expect(messages).toEqual([]);
    expect(value).toMatchObject({ siret: null, vatMention: null });
  });

  it('no longer takes an address (it belongs to the practices), nor unknown fields', () => {
    expect(check(UpdateActivityDto, { city: 'Aix' }).messages).toHaveLength(1);
    expect(check(UpdateActivityDto, { userId: 'someone-else' }).messages).toHaveLength(1);
  });
});

describe('practice DTOs', () => {
  it('requires a name, and checks the zip code, phone and SIRET', () => {
    expect(check(CreatePracticeDto, { name: 'Cabinet d’Aix', zipCode: '13100', phone: '04 42 00 00 00' }).messages).toEqual([]);
    expect(check(CreatePracticeDto, { name: ' ' }).messages).toEqual(['Donnez un nom au cabinet.']);
    expect(check(CreatePracticeDto, { name: 'Aix', zipCode: '1310' }).messages).toEqual([
      'Le code postal compte 5 chiffres.',
    ]);
    expect(check(UpdatePracticeDto, { phone: 'abc' }).messages).toEqual([
      'Le numéro de téléphone n’est pas valide.',
    ]);
    expect(check(UpdatePracticeDto, { siret: '912 345 678 00011' }).value.siret).toBe('91234567800011');
    expect(check(UpdatePracticeDto, { siret: '91234567800012' }).messages).toHaveLength(1);
  });

  it('only makes a practice the default one, never « not the default »', () => {
    expect(check(UpdatePracticeDto, { isDefault: true }).messages).toEqual([]);
    expect(check(UpdatePracticeDto, { isDefault: false }).messages).toEqual([
      'Choisissez plutôt un autre cabinet par défaut.',
    ]);
    expect(check(UpdatePracticeDto, { archived: true }).messages).toEqual([]);
    expect(check(UpdatePracticeDto, { practitionerId: 'someone-else' }).messages).toHaveLength(1);
  });
});

describe('UpdateMeDto', () => {
  it('trims names and refuses an empty one', () => {
    expect(check(UpdateMeDto, { firstName: '  Valérie ' }).value.firstName).toBe('Valérie');
    expect(check(UpdateMeDto, { lastName: '   ' }).messages).toContain('Le nom ne peut pas être vide.');
  });

  it('accepts a phone number or none, and only the known themes', () => {
    expect(check(UpdateMeDto, { phone: '+33 6 12 34 56 78' }).messages).toEqual([]);
    expect(check(UpdateMeDto, { phone: '' }).value.phone).toBeNull();
    expect(check(UpdateMeDto, { phone: 'abc' }).messages).toEqual([
      'Le numéro de téléphone n’est pas valide.',
    ]);
    expect(check(UpdateMeDto, { theme: 'DARK' }).messages).toEqual([]);
    expect(check(UpdateMeDto, { theme: 'PINK' }).messages).toHaveLength(1);
  });

  it('does not let the email or the role be changed here', () => {
    expect(check(UpdateMeDto, { email: 'x@y.fr' }).messages).toHaveLength(1);
    expect(check(UpdateMeDto, { role: 'ADMIN' }).messages).toHaveLength(1);
  });
});

describe('formula DTOs', () => {
  it('takes a duration between 15 minutes and 8 hours', () => {
    expect(check(CreateFormulaDto, { label: 'Bilan', durationMinutes: 60 }).messages).toEqual([]);
    expect(check(UpdateFormulaDto, { durationMinutes: 10 }).messages).toEqual(['Comptez au moins 15 minutes.']);
    expect(check(UpdateFormulaDto, { durationMinutes: 600 }).messages).toEqual([
      'La durée ne peut pas dépasser 8 heures.',
    ]);
    expect(check(UpdateFormulaDto, { durationMinutes: 45.5 }).messages).toEqual(['La durée n’est pas valide.']);
  });

  it('requires a label, and a price that is a whole number of cents or empty', () => {
    expect(check(CreateFormulaDto, { label: 'Bilan', priceCents: 6000 }).messages).toEqual([]);
    expect(check(CreateFormulaDto, { label: 'Bilan', priceCents: null }).messages).toEqual([]);
    expect(check(CreateFormulaDto, { label: ' ' }).messages).toEqual(['Donnez un nom à la formule.']);
    expect(check(CreateFormulaDto, { label: 'Bilan', priceCents: -1 }).messages).toEqual([
      'Le prix ne peut pas être négatif.',
    ]);
    expect(check(UpdateFormulaDto, { priceCents: 60.5 }).messages).toEqual([
      'Le prix n’est pas valide.',
    ]);
    expect(check(UpdateFormulaDto, { priceCents: 2_000_000 }).messages).toEqual([
      'Le prix ne peut pas dépasser 10 000 €.',
    ]);
  });

  it('orders by a list of distinct ids', () => {
    const a = '11111111-1111-4111-8111-111111111111';
    expect(check(ReorderFormulasDto, { ids: [a] }).messages).toEqual([]);
    expect(check(ReorderFormulasDto, { ids: [a, a] }).messages).toHaveLength(1);
  });
});
