import { createRequire } from 'node:module';

import { expect, test } from '@playwright/test';

import { expectPatientFile, signIn, uniqueName } from './helpers';

/*
 * Import of an existing patient from her Numbers file (one per patient). The file is made here,
 * with her template's tables and made-up data: real files are never committed. SheetJS is the
 * API's dependency (it reads the files), so it is loaded from there.
 */
const apiRequire = createRequire(new URL('../../api/package.json', import.meta.url));
const XLSX = apiRequire('xlsx');

const utc = (y: number, m: number, d: number) => new Date(Date.UTC(y, m - 1, d));

function numbersFile(name: string): Buffer {
  const wb = XLSX.utils.book_new();
  const sheet = (rows: unknown[][], title: string): void =>
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(rows, { cellDates: true }), title);
  sheet([['Valérie Pera'], ['Diététicienne nutritionniste']], 'Facture');
  sheet(
    [
      [null, 'Patient', 'Tel', 'Email', 'Situation familiale', 'Profession', 'Médecin traitant', 'Compte rendu '],
      ['Administratif ', name, '06', null, 'Marié, 2 enf', 'Maçon', 'Dr Martin', 'Envoyé'],
    ],
    'Récapitulatif',
  );
  sheet(
    [
      [null, 'Age', 'Sexe', 'Poids', 'Taille', 'Constante', 'IMC', 'Santé maladie', 'Psy'],
      ['Dossier médical ', 57, 'M', 115, 1.77, 1.083, 36.7, 'HTA traitée depuis 10 ans', 'Stress : mange sucré'],
    ],
    'Dossier',
  );
  sheet(
    [
      [null, 'Date', 'Formule', 'Moyen de paiement', 'Poids', 'IMC', 'Habitudes et évolution ', 'Conseils diététiques'],
      // The Bilan's year is a typo of hers: after Suivi 1
      ['Bilan ', utc(2026, 8, 18), 60, null, 115, 36.7, 'Beaucoup de pain', 'Légumes à chaque repas'],
      ['Suivi 1', utc(2025, 9, 10), 50, 'Chèque ', 107, 34.2, 'Moins de charcuterie'],
      ['Suivi 2', utc(2025, 10, 15), 50, 'Chèque ', 103, 32.9],
      ['Suivi 3', null, 'Non', null, 0, 0],
    ],
    'Suivi',
  );
  const numbers = apiRequire('xlsx/dist/xlsx.zahl.js');
  return XLSX.write(wb, { type: 'buffer', bookType: 'numbers', numbers }) as Buffer;
}

test('imports a patient from her Numbers file, after checking it', async ({ page }) => {
  const lastName = uniqueName('Importe');
  await signIn(page);
  await page.goto('/patients');
  await page.getByRole('link', { name: 'Importer' }).click();
  await expect(page.getByRole('heading', { name: 'Importer un patient' })).toBeVisible();

  await page.getByLabel('Fichier du patient').setInputFiles({
    name: `${lastName}.numbers`,
    mimeType: 'application/x-iwork-numbers-sffnumbers',
    buffer: numbersFile(lastName),
  });

  // What to check, read from the file; nothing is saved yet
  await expect(page.getByText('Bilan (18/08/2026) est après Suivi 1 (10/09/2025) : vérifiez les dates.')).toBeVisible();
  await expect(page.getByText('Téléphone incomplet : « 06 ».')).toBeVisible();
  await expect(page.getByText('HTA traitée depuis 10 ans')).toBeVisible();
  await expect(page.getByText(/Non repris : Feuille « Facture » · Compte rendu au médecin : « Envoyé »/)).toBeVisible();
  await expect(page.getByText('3 séances, 2 rubriques du dossier médical')).toBeVisible();

  // Her file has one word for the name: the first name is asked for, the Bilan's date corrected
  await page.getByRole('button', { name: 'Importer le dossier' }).click();
  await expect(page.getByText('Indiquez le prénom.')).toBeVisible();
  await page.getByLabel(/^Prénom/).fill('Paul');
  await page.getByLabel('Date de Bilan').fill('2025-08-18');
  await page.getByRole('button', { name: 'Importer le dossier' }).click();

  await expect(page.getByText(/le patient est créé avec 3 séances/)).toBeVisible();
  await page.getByRole('link', { name: 'Ouvrir son dossier' }).click();
  await expectPatientFile(page, 'Paul', lastName);

  // Importing the same file again is held: she already has this patient
  await page.goto('/patients/import');
  await page.getByLabel('Fichier du patient').setInputFiles({
    name: `${lastName}.numbers`,
    mimeType: 'application/octet-stream',
    buffer: numbersFile(`Paul ${lastName}`),
  });
  await expect(page.getByText(/Ce fichier est peut-être déjà importé/)).toBeVisible();
  await expect(page.getByRole('button', { name: 'Importer le dossier' })).toBeDisabled();
});
