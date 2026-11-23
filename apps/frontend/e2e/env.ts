/** Ports and database of the end-to-end run, apart from the ones used for development. */
export const API_PORT = Number(process.env.E2E_API_PORT ?? 3900);
export const APP_PORT = Number(process.env.E2E_APP_PORT ?? 5900);
export const E2E_DATABASE_URL =
  process.env.E2E_DATABASE_URL ?? 'postgresql://vp_user:vp_password@localhost:5432/vp_e2e';
