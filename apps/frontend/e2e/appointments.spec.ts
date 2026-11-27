import { expect, test } from '@playwright/test';

import { signIn } from './helpers';

test.beforeEach(async ({ page }) => {
  await signIn(page);
});

test('books an appointment by type: the type gives the duration', async ({ page }) => {
  // Next week, 7 days from today at 15:30: a slot the seed leaves free
  // (the day in the practice's time zone, which the browser uses, whatever the machine's)
  const dayLabel = new Intl.DateTimeFormat('fr-FR', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    timeZone: 'Europe/Paris',
  }).format(Date.now() + 7 * 24 * 3600 * 1000);

  await page.goto('/appointments');
  await page.getByRole('button', { name: 'Semaine suivante' }).click();
  await page.getByRole('button', { name: `Nouveau rendez-vous le ${dayLabel} à 15 h 30` }).click();

  const dialog = page.getByRole('dialog', { name: 'Nouveau rendez-vous' });
  await dialog.getByText('Choisir un patient').click();
  await page.getByPlaceholder('Rechercher un patient…').fill('Bernard');
  await page.getByRole('option', { name: 'Claire Bernard' }).click();

  // Suivi: 50 €, 45 min (seed)
  await expect(dialog.getByLabel(/^Type de rendez-vous/).locator('option:checked')).toHaveText(/^Suivi/);
  const day = dialog.getByLabel(/^Date du rendez-vous/);
  const slotDay = await day.inputValue();
  await dialog.getByRole('button', { name: 'Ouvrir le calendrier' }).click();
  await page.getByRole('button', { name: 'Demain', exact: true }).click();
  await expect(day).not.toHaveValue(slotDay);
  await day.fill(slotDay);
  await expect(dialog.getByLabel('Durée en minutes')).toHaveValue('45');
  await expect(dialog.getByLabel(/^Heure/)).toHaveValue('15:30');
  await dialog.getByRole('button', { name: 'Prendre le rendez-vous' }).click();
  await expect(dialog).toBeHidden();

  // On the agenda, with its type
  await expect(page.getByRole('link', { name: /^15 h 30, Claire Bernard, Suivi/ })).toBeVisible();
});
