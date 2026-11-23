import { expect, test } from '@playwright/test';

import { expectPatientFile, signIn, uniqueName } from './helpers';

test.beforeEach(async ({ page }) => {
  await signIn(page);
});

test('creates a patient with the wizard from the name alone, skipping the other steps', async ({ page }) => {
  const lastName = uniqueName('Assistant');

  await page.goto('/patients');
  await page.getByRole('link', { name: 'Nouveau patient' }).click();
  await expect(page).toHaveURL(/\/patients\/new/);

  // « Qui est-ce ? »: the file exists as soon as this step is done
  await page.getByLabel(/^Prénom/).fill('Camille');
  await page.getByLabel(/^Nom/).fill(lastName);
  await page.getByRole('button', { name: 'Créer le dossier' }).click();

  // « Le joindre », « Sa situation », « Dossier médical »: all skipped
  for (const step of ['Le joindre', 'Sa situation', 'Dossier médical']) {
    await expect(page.getByRole('heading', { name: step })).toBeVisible();
    await page.getByRole('button', { name: 'Passer cette étape' }).click();
  }

  // « C'est prêt », with what is missing for the BMR
  await expect(page.getByText(`Le dossier de Camille ${lastName} est prêt.`)).toBeVisible();
  await expect(page.getByText(/Il manque le sexe, l’âge et la taille pour calculer le MB/)).toBeVisible();
  await page.getByRole('link', { name: 'Ouvrir le dossier' }).click();
  await expectPatientFile(page, 'Camille', lastName);

  // The new patient is in the list
  await page.goto('/patients');
  await expect(page.getByRole('link', { name: `${lastName} Camille`, exact: true })).toBeVisible();
});
