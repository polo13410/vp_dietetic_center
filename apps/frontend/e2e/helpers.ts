import { type Download, expect, type Locator, type Page } from '@playwright/test';

/**
 * Signs in without Google, with the dev sign-in: the API runs with DEV_LOGIN=true (local
 * development and tests only) on the seed's accounts.
 */
export async function signIn(page: Page, email = 'praticienne@vp-dietetic.fr') {
  await page.goto('/login');
  await page.getByLabel('Adresse e-mail d’un compte enregistré').fill(email);
  await page.getByRole('button', { name: 'Connexion de développement' }).click();
  await page.waitForURL((url) => !url.pathname.startsWith('/login'));
}

/** A name no other run or seed patient has, so a flow finds its own patient. */
export const uniqueName = (prefix: string) => `${prefix}${Date.now().toString(36)}`;

/** Chooses the option of a native select whose text starts with `text` (labels carry prices). */
export async function chooseOption(select: Locator, text: string) {
  const value = await select
    .locator('option')
    .filter({ hasText: new RegExp(`^${text}`) })
    .first()
    .getAttribute('value');
  expect(value, `option « ${text} »`).toBeTruthy();
  await select.selectOption(value!);
}

/** Opens a seed patient's file from the patients list. */
export async function openPatient(page: Page, firstName: string, lastName: string) {
  await page.goto('/patients');
  await page.getByRole('link', { name: `${lastName} ${firstName}`, exact: true }).click();
  await expectPatientFile(page, firstName, lastName);
}

/** The patient's file is open: its title is the name (followed by the age). */
export async function expectPatientFile(page: Page, firstName: string, lastName: string) {
  await expect(page.getByRole('heading', { level: 1, name: new RegExp(`^${firstName} ${lastName}`) })).toBeVisible();
}

/** The PDF a click produces: saved by the browser, a real PDF, named as expected. */
export async function expectPdfDownload(page: Page, click: () => Promise<void>, name: RegExp) {
  const [download] = await Promise.all([page.waitForEvent('download'), click()]);
  expect(download.suggestedFilename()).toMatch(name);
  await expectPdf(download);
}

async function expectPdf(download: Download) {
  const stream = await download.createReadStream();
  const chunks: Buffer[] = [];
  for await (const chunk of stream) chunks.push(chunk as Buffer);
  const pdf = Buffer.concat(chunks);
  expect(pdf.subarray(0, 5).toString()).toBe('%PDF-');
  expect(pdf.length).toBeGreaterThan(1000);
}
