/**
 * Checks and formats of the settings page. The checks mirror the API's
 * (apps/api/src/common/validation/identifiers.ts) so mistakes show before saving.
 */

/** Removes the spaces, dots and dashes used to group digits. */
export function digitsOnly(value: string): string {
  return value.replace(/[\s.-]/g, '');
}

function passesLuhn(digits: string): boolean {
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

export function siretError(value: string): string | null {
  const digits = digitsOnly(value);
  if (!/^\d{14}$/.test(digits)) return 'Le SIRET compte 14 chiffres.';
  if (!passesLuhn(digits)) {
    return 'Ce SIRET n’est pas valide : vérifiez ses 14 chiffres sur votre avis de situation Insee.';
  }
  return null;
}

export function adeliRppsError(value: string): string | null {
  return /^(\d{9}|\d{11})$/.test(digitsOnly(value))
    ? null
    : 'Le numéro ADELI compte 9 chiffres, le numéro RPPS 11 chiffres.';
}

export function zipCodeError(value: string): string | null {
  return /^\d{5}$/.test(value) ? null : 'Le code postal compte 5 chiffres.';
}

export function phoneError(value: string): string | null {
  return /^\+?[\d\s.()-]{6,20}$/.test(value) ? null : 'Le numéro de téléphone n’est pas valide.';
}

/** "60", "60,5" or "60,50 €" → 6050 cents; null when empty; undefined when not a price. */
export function parseEuros(value: string): number | null | undefined {
  const text = value.replace(/€/g, '').replace(/\s/g, '').replace(',', '.');
  if (text === '') return null;
  if (!/^\d{1,5}(\.\d{1,2})?$/.test(text)) return undefined;
  const cents = Math.round(Number(text) * 100);
  return cents <= 1_000_000 ? cents : undefined;
}

export function priceError(value: string): string | null {
  return parseEuros(value) === undefined
    ? 'Indiquez un prix en euros, par exemple 60 ou 52,50 (10 000 € au plus).'
    : null;
}

/** 6000 → "60", 5250 → "52,50": how the price is typed back in the field. */
export function centsToInput(cents: number | null): string {
  if (cents === null) return '';
  return cents % 100 === 0 ? String(cents / 100) : (cents / 100).toFixed(2).replace('.', ',');
}

/** 6000 → "60 €", 5250 → "52,50 €". */
export function formatEuros(cents: number): string {
  return new Intl.NumberFormat('fr-FR', {
    style: 'currency',
    currency: 'EUR',
    minimumFractionDigits: cents % 100 === 0 ? 0 : 2,
  }).format(cents / 100);
}

/** "14 h 32" (docs/DESIGN.md § 7). */
export function formatTime(date: Date): string {
  return `${date.getHours()} h ${String(date.getMinutes()).padStart(2, '0')}`;
}

/** A duration typed in minutes: a whole number from 15 minutes to 8 hours (same as the API). */
export function durationError(value: string): string | null {
  if (!/^\d+$/.test(value.trim())) return 'Indiquez la durée en minutes, par exemple 45.';
  const minutes = Number(value);
  if (minutes < 15) return 'Comptez au moins 15 minutes.';
  if (minutes > 480) return 'La durée ne peut pas dépasser 8 heures.';
  return null;
}

/** 45 → "45 min", 60 → "1 h", 90 → "1 h 30". */
export function formatDuration(minutes: number): string {
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  if (hours === 0) return `${rest} min`;
  return rest === 0 ? `${hours} h` : `${hours} h ${String(rest).padStart(2, '0')}`;
}

/** "12 rue des Oliviers, 13100 Aix-en-Provence", or null when nothing is filled in. */
export function addressLine(place: { address: string | null; zipCode: string | null; city: string | null }) {
  const town = [place.zipCode, place.city].filter(Boolean).join(' ');
  return [place.address, town].filter(Boolean).join(', ') || null;
}
