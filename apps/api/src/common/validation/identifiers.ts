import { registerDecorator, type ValidationOptions } from 'class-validator';

/** Luhn checksum (used by SIREN and SIRET numbers). */
export function passesLuhn(digits: string): boolean {
  let sum = 0;
  for (let i = 0; i < digits.length; i++) {
    let n = Number(digits[digits.length - 1 - i]);
    if (i % 2 === 1) {
      n *= 2;
      if (n > 9) n -= 9;
    }
    sum += n;
  }
  return sum % 10 === 0;
}

/** A SIRET: 14 digits whose Luhn checksum is right. */
export function isValidSiret(value: string): boolean {
  return /^\d{14}$/.test(value) && passesLuhn(value);
}

/** An ADELI number (9 digits) or an RPPS number (11 digits). */
export function isValidAdeliRpps(value: string): boolean {
  return /^(\d{9}|\d{11})$/.test(value);
}

/** Removes spaces, dots and dashes people type to group digits ("123 456 789 00012"). */
export function digitsOnly(value: unknown): unknown {
  return typeof value === 'string' ? value.replace(/[\s.-]/g, '') : value;
}

function validator(name: string, check: (value: string) => boolean, message: string) {
  return (options?: ValidationOptions) => (object: object, propertyName: string) =>
    registerDecorator({
      name,
      target: object.constructor,
      propertyName,
      options: { message, ...options },
      validator: { validate: (value: unknown) => typeof value === 'string' && check(value) },
    });
}

export const IsSiret = validator(
  'isSiret',
  isValidSiret,
  'Ce SIRET n’est pas valide : vérifiez ses 14 chiffres sur votre avis de situation Insee.',
);

export const IsAdeliRpps = validator(
  'isAdeliRpps',
  isValidAdeliRpps,
  'Le numéro ADELI compte 9 chiffres, le numéro RPPS 11 chiffres.',
);
