/** Environments where the dev sign-in may be turned on: a developer's machine and the tests. */
const LOCAL_ENVIRONMENTS = ['development', 'test'];

/**
 * Whether the sign-in without Google (POST /auth/dev-login, local development and end-to-end
 * tests) is on: only with DEV_LOGIN=true, and only on a local machine. Asked for anywhere else it
 * throws, so the API refuses to start: staging and prod run with NODE_ENV=production, and on
 * Cloud Run (which always sets K_SERVICE) it is refused whatever NODE_ENV says.
 */
export function devLoginEnabled(env: NodeJS.ProcessEnv = process.env): boolean {
  if (env.DEV_LOGIN !== 'true') return false;

  const nodeEnv = env.NODE_ENV ?? 'development';
  if (!LOCAL_ENVIRONMENTS.includes(nodeEnv) || env.K_SERVICE) {
    throw new Error(
      `DEV_LOGIN=true is only allowed in local development and tests (NODE_ENV=${nodeEnv}${
        env.K_SERVICE ? ', on Cloud Run' : ''
      }): remove it`,
    );
  }
  return true;
}
