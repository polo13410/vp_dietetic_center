import { expect, test } from '@playwright/test';

import { chooseOption, expectPdfDownload, openPatient, signIn, uniqueName } from './helpers';

test.beforeEach(async ({ page }) => {
  await signIn(page);
});

test('runs a bilan with the test case figures, then issues and downloads its invoice', async ({ page }) => {
  const lastName = uniqueName('Bilan');

  await test.step('creates the patient: woman, 56 (age only), 1.59 m', async () => {
    await page.goto('/patients/new');
    await page.getByLabel(/^Prénom/).fill('Martine');
    await page.getByLabel(/^Nom/).fill(lastName);
    await page.getByRole('button', { name: 'Femme' }).click();
    await page.getByRole('button', { name: 'Je ne connais que son âge' }).click();
    await page.getByLabel(/^Âge/).fill('56');
    await page.getByRole('button', { name: 'Créer le dossier' }).click();
    await page.getByRole('button', { name: 'Passer cette étape' }).click();
    await page.getByRole('button', { name: 'Passer cette étape' }).click();
    await page.getByLabel(/^Taille \(cm\)/).fill('159');
    await page.getByRole('button', { name: 'Enregistrer et continuer' }).click();
    await expect(page.getByText('Tout est là pour calculer l’IMC et le MB.', { exact: false })).toBeVisible();
  });

  await test.step('time 1, « Avant de commencer », then the séance', async () => {
    await page.getByRole('button', { name: 'Démarrer le bilan' }).click();
    await expect(page.getByRole('heading', { name: 'Avant de commencer' })).toBeVisible();
    await page.getByRole('button', { name: 'Commencer la séance' }).click();
    await expect(page.getByRole('button', { name: 'Terminer la séance' })).toBeVisible();
  });

  await test.step('the weight gives the BMI and BMR of § 3.1 (79 kg → 31,25 · 5,86 MJ · 1 400,3 kcal)', async () => {
    // A first séance is a « Bilan » at the Bilan price
    await expect(page.getByLabel('Formule')).toHaveValue(/.+/);
    await expect(page.getByLabel('Formule').locator('option:checked')).toHaveText(/^Bilan/);
    await page.getByLabel(/^Poids \(kg\)/).fill('79');
    await expect(page.getByText('31,25', { exact: true })).toBeVisible();
    await expect(page.getByText('5,86', { exact: true })).toBeVisible();
    await expect(page.getByText(/^1\s400,3$/)).toBeVisible();
  });

  await test.step('« Terminer la séance » → « Faire la facture » → download', async () => {
    await page.getByLabel(/^Poids \(kg\)/).blur();
    await page.getByRole('button', { name: 'Terminer la séance' }).click();
    const dialog = page.getByRole('dialog', { name: 'Séance terminée' });
    await expect(dialog).toBeVisible();
    await dialog.getByRole('button', { name: /Faire la facture/ }).click();
    await expect(dialog.getByText(/Facture n° \d{4}-\d{4} faite \(60,00\s€\)/)).toBeVisible();
    await dialog.getByRole('button', { name: /^Voir facture-/ }).click();
    const preview = page.getByRole('dialog', { name: /^Facture n°/ });
    const frame = preview.locator('iframe');
    await expect(frame).toHaveAttribute('src', /^blob:/);
    const url = (await frame.getAttribute('src'))!;
    expect(await page.evaluate(async (src) => (await (await fetch(src)).blob()).slice(0, 5).text(), url)).toBe('%PDF-');
    await preview.getByRole('button', { name: 'Fermer' }).click();
    expect(await page.evaluate((src) => fetch(src).then(() => false, () => true), url)).toBe(true);
    await expectPdfDownload(
      page,
      () => dialog.getByRole('button', { name: 'Télécharger la facture' }).click(),
      /^facture-\d{4}-\d{4}\.pdf$/,
    );
  });
});

test('corrects the price of an old, invoiced séance with a credit note and a new invoice', async ({ page }) => {
  // Lucas Moreau's bilan, three weeks ago, was invoiced at the Bilan price (seed)
  await openPatient(page, 'Lucas', 'Moreau');
  await page.getByRole('tab', { name: 'Suivi' }).click();
  await page.getByRole('link', { name: 'Bilan', exact: true }).click();

  // A past séance opens straight on its fields
  await expect(page.getByRole('button', { name: 'Terminer la séance' })).toBeVisible();
  const issued = page.getByText(/^Facture n° \d{4}-\d{4}$/);
  await expect(issued).toBeVisible();
  const oldNumber = (await issued.textContent())!.replace('Facture n° ', '');

  // Wrong price: she changes the formula, the app says the invoice no longer matches
  await chooseOption(page.getByLabel('Formule'), 'Suivi');
  const banner = page.getByRole('status').filter({ hasText: `La facture n° ${oldNumber} ne correspond plus à la séance` });
  await expect(banner).toBeVisible();
  await banner.getByRole('button', { name: 'Corriger la facture' }).click();
  await page
    .getByRole('dialog', { name: `Corriger la facture n° ${oldNumber} ?` })
    .getByRole('button', { name: 'Corriger la facture' })
    .click();

  // A new invoice at the Suivi price replaces the old one, which a credit note cancels
  await expect(page.getByText(`Remplace la facture n° ${oldNumber}.`)).toBeVisible();
  await expect(page.getByText(/^50,00\s€ · faite le/)).toBeVisible();
  await expect(page.getByRole('status').filter({ hasText: 'ne correspond plus' })).toHaveCount(0);
  await expect(page.getByText(/^Avoir n° A-\d{4}-\d{4}/)).toBeVisible();
});

test('edits one session’s payer amount and keeps the patient’s agreement', async ({ page }) => {
  await openPatient(page, 'Martine', 'Roux');
  await page.getByRole('tab', { name: 'Suivi' }).click();
  await page.getByRole('link', { name: 'Bilan', exact: true }).click();
  const amount = page.getByLabel(/^Pris en charge par/);
  const original = await amount.inputValue();
  await amount.fill('0');
  await amount.press('Enter');
  await expect(amount).toHaveValue('0,00');
  await page.reload();
  await expect(amount).toHaveValue('0,00');
  await amount.fill('');
  await amount.press('Enter');
  await expect(amount).toHaveValue(original);

  await openPatient(page, 'Martine', 'Roux');
  await page.getByRole('tab', { name: 'Factures' }).click();
  await page.getByRole('button', { name: 'Ajouter une prise en charge' }).click();
  const field = page.getByLabel(/^Part prise en charge/);
  for (const width of [390, 1024]) {
    await page.setViewportSize({ width, height: 844 });
    for (const [button, unit] of [['En euros', '€'], ['En %', '%']]) {
      await page.getByRole('button', { name: button, exact: true }).click();
      const inputBox = await field.boundingBox();
      const unitBox = await field.locator('..').getByText(unit, { exact: true }).boundingBox();
      expect(inputBox!.width).toBeLessThan(145);
      expect(unitBox!.x).toBeGreaterThanOrEqual(inputBox!.x + inputBox!.width);
      expect(unitBox!.y).toBeLessThan(inputBox!.y + inputBox!.height);
    }
  }
});
