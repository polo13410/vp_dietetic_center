import { plainToInstance } from 'class-transformer';
import { validateSync } from 'class-validator';
import { describe, expect, it } from 'vitest';

import { ChangePasswordDto } from '../../auth/dto/change-password.dto';

import { CreateFormulaDto, ReorderFormulasDto, UpdateFormulaDto } from './formula.dto';
import { UpdateMeDto, UpdatePracticeDto } from './me.dto';

/** Transforms and validates like the app's ValidationPipe; returns the value and the messages. */
function check<T extends object>(cls: new () => T, body: object) {
  const value = plainToInstance(cls, body);
  const errors = validateSync(value, { whitelist: true, forbidNonWhitelisted: true });
  return { value, messages: errors.flatMap((e) => Object.values(e.constraints ?? {})) };
}

describe('UpdatePracticeDto', () => {
  it('accepts a SIRET typed with spaces and stores the digits only', () => {
    const { value, messages } = check(UpdatePracticeDto, { siret: '912 345 678 00011' });
    expect(messages).toEqual([]);
    expect(value.siret).toBe('91234567800011');
  });

  it('refuses a SIRET whose checksum is wrong', () => {
    const { messages } = check(UpdatePracticeDto, { siret: '91234567800012' });
    expect(messages).toEqual([expect.stringContaining('SIRET n’est pas valide')]);
  });

  it('accepts an ADELI or an RPPS number, refuses other lengths', () => {
    expect(check(UpdatePracticeDto, { adeliRpps: '13 95 12345' }).messages).toEqual([]);
    expect(check(UpdatePracticeDto, { adeliRpps: '10101234567' }).messages).toEqual([]);
    expect(check(UpdatePracticeDto, { adeliRpps: '1234567890' }).messages).toEqual([
      'Le numéro ADELI compte 9 chiffres, le numéro RPPS 11 chiffres.',
    ]);
  });

  it('clears a field sent empty', () => {
    const { value, messages } = check(UpdatePracticeDto, { siret: '  ', city: '', vatMention: ' ' });
    expect(messages).toEqual([]);
    expect(value).toMatchObject({ siret: null, city: null, vatMention: null });
  });

  it('checks the zip code and refuses unknown fields', () => {
    expect(check(UpdatePracticeDto, { zipCode: '1310' }).messages).toEqual([
      'Le code postal compte 5 chiffres.',
    ]);
    expect(check(UpdatePracticeDto, { userId: 'someone-else' }).messages).toHaveLength(1);
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

describe('ChangePasswordDto', () => {
  it('asks for at least 8 characters with a capital letter and a digit', () => {
    expect(check(ChangePasswordDto, { currentPassword: 'x', newPassword: 'Nouveau1' }).messages).toEqual([]);
    expect(check(ChangePasswordDto, { currentPassword: 'x', newPassword: 'court1A' }).messages).toEqual([
      'Le nouveau mot de passe doit compter au moins 8 caractères.',
    ]);
    expect(check(ChangePasswordDto, { currentPassword: '', newPassword: 'nouveau12' }).messages).toEqual([
      'Indiquez votre mot de passe actuel.',
      'Le nouveau mot de passe doit contenir au moins une majuscule et un chiffre.',
    ]);
  });
});
