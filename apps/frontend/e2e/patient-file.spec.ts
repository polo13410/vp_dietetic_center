import { expect, test } from '@playwright/test';

import { openPatient, signIn } from './helpers';

test.beforeEach(async ({ page }) => {
  await signIn(page);
});

test('adds a past weight, with a note, in the Mesures tab', async ({ page }) => {
  await openPatient(page, 'Lucas', 'Moreau');
  await page.getByRole('tab', { name: 'Mesures' }).click();
  await page.getByRole('button', { name: 'Ajouter une mesure' }).first().click();

  // Years before the follow-up: « à cette époque je faisais 85 kg »
  const form = page.getByRole('form', { name: 'Ajouter une mesure' });
  await form.getByLabel(/^Date/).fill('2020-03-15');
  await form.getByLabel(/^Mesure/).selectOption('WEIGHT');
  await form.getByLabel(/^Valeur/).fill('85,5');
  await form.getByLabel(/^Note/).fill('avant le diagnostic');
  await form.getByRole('button', { name: 'Enregistrer la mesure' }).click();
  await expect(page.getByText(/Mesure ajoutée : poids du/).first()).toBeVisible();
  await form.getByRole('button', { name: 'Terminer' }).click();

  // In the timeline, the oldest row, with its value and note
  const row = page.getByRole('list', { name: 'Frise des mesures' }).getByRole('listitem').last();
  await expect(row).toContainText('2020');
  await expect(row).toContainText(/85,5\s?kg/);
  await expect(row).toContainText('avant le diagnostic');
});

test('generates a GP report draft pre-filled with the test case figures', async ({ page }) => {
  // Martine Roux is the test case of § 3.1: 79 kg at the bilan (BMI 31,25), 76,5 kg now
  await openPatient(page, 'Martine', 'Roux');
  await page.getByRole('button', { name: 'Rédiger un compte rendu' }).click();

  await expect(page.getByRole('heading', { name: 'Compte rendu au médecin' })).toBeVisible();
  const text = page.getByLabel('Texte du compte rendu');
  await expect(text).toHaveValue(/Martine Roux/);
  await expect(text).toHaveValue(/Lors du bilan, son poids était de 79 kg \(IMC 31,25\)/);
  await expect(text).toHaveValue(/il est de 76,5 kg \(IMC 30,26\), soit une perte de 2,5 kg/);
  await expect(text).toHaveValue(/5,77 MJ \(1\s378,9 kcal\)/);
});
