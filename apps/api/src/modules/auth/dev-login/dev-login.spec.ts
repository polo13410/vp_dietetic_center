/*
 * The sign-in without Google must be impossible on staging and prod: asked for there, the API
 * refuses to start; not asked for, the route does not exist.
 */
import { ConfigModule } from '@nestjs/config';
import { afterEach, beforeAll, describe, expect, it } from 'vitest';

import { configuration } from '../../../config/configuration';

import { devLoginEnabled } from './dev-login-enabled';
import { DevLoginController } from './dev-login.controller';
import { DevLoginModule, devLoginImport } from './dev-login.module';

const env = { ...process.env };
const setEnv = (values: Record<string, string | undefined>) => {
  process.env = { ...env, JWT_SECRET: 'x'.repeat(64), ...values };
  for (const [key, value] of Object.entries(values)) if (value === undefined) delete process.env[key];
};

describe('dev sign-in', () => {
  beforeAll(async () => {
    // What AppModule does first: the conditional import waits for the environment to be read
    await ConfigModule.forRoot({ ignoreEnvFile: true });
  });

  afterEach(() => {
    process.env = { ...env };
  });

  it('is off unless DEV_LOGIN=true, wherever it runs', () => {
    expect(devLoginEnabled({ NODE_ENV: 'development' })).toBe(false);
    expect(devLoginEnabled({ NODE_ENV: 'production', DEV_LOGIN: 'false' })).toBe(false);
    expect(devLoginEnabled({ NODE_ENV: 'production', K_SERVICE: 'staging-api' })).toBe(false);
  });

  it('can be turned on locally and in tests', () => {
    expect(devLoginEnabled({ DEV_LOGIN: 'true' })).toBe(true);
    expect(devLoginEnabled({ NODE_ENV: 'development', DEV_LOGIN: 'true' })).toBe(true);
    expect(devLoginEnabled({ NODE_ENV: 'test', DEV_LOGIN: 'true' })).toBe(true);
  });

  it.each([
    ['staging and prod (NODE_ENV=production)', { NODE_ENV: 'production' }],
    ['any other NODE_ENV', { NODE_ENV: 'staging' }],
    ['Cloud Run, even with NODE_ENV=development', { NODE_ENV: 'development', K_SERVICE: 'prod-api' }],
  ])('makes the API refuse to start on %s', (_, values) => {
    setEnv({ ...values, DEV_LOGIN: 'true' });
    expect(() => configuration()).toThrow(/DEV_LOGIN=true is only allowed/);
    expect(() => devLoginEnabled()).toThrow(/DEV_LOGIN=true is only allowed/);
  });

  it('starts normally in production when not asked for', () => {
    setEnv({ NODE_ENV: 'production', K_SERVICE: 'prod-api', DEV_LOGIN: undefined });
    expect(configuration().devLogin).toBe(false);
  });

  it('has no route in production: the module is not loaded', async () => {
    setEnv({ NODE_ENV: 'production', DEV_LOGIN: undefined });
    expect((await devLoginImport()).imports).toEqual([]);
  });

  it('refuses to load the module in production when asked for', async () => {
    setEnv({ NODE_ENV: 'production', DEV_LOGIN: 'true' });
    await expect(devLoginImport()).rejects.toThrow(/DEV_LOGIN=true is only allowed/);
  });

  it('loads the route locally when asked for', async () => {
    setEnv({ NODE_ENV: 'development', DEV_LOGIN: 'true' });
    expect((await devLoginImport()).imports).toEqual([DevLoginModule]);
  });

  it('cannot be created by mistake when it is off', () => {
    setEnv({ NODE_ENV: 'production', DEV_LOGIN: undefined });
    expect(() => new DevLoginController({} as any)).toThrow(/must not be loaded/);
  });
});
