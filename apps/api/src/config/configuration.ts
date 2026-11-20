/**
 * The JWT signing secret. A known default is only acceptable in development: in production a
 * missing or short secret would let anyone forge sessions, so the API refuses to start.
 */
function jwtSecret(): string {
  const secret = process.env.JWT_SECRET;
  if (process.env.NODE_ENV === 'production' && (!secret || secret.length < 32)) {
    throw new Error('JWT_SECRET must be set (at least 32 characters) in production');
  }
  return secret ?? 'dev-secret-change-in-prod';
}

export const configuration = () => ({
  nodeEnv: process.env.NODE_ENV ?? 'development',
  port: parseInt(process.env.PORT ?? '3000', 10),
  appName: process.env.APP_NAME ?? 'VP Dietetic Center API',

  database: {
    url: process.env.DATABASE_URL,
  },

  jwt: {
    secret: jwtSecret(),
    expiresIn: process.env.JWT_EXPIRES_IN ?? '15m',
    // Length of a session (a working day). Counted from sign-in: refreshing does not extend it.
    refreshExpiresIn: process.env.JWT_REFRESH_EXPIRES_IN ?? '10h',
  },

  google: {
    clientId: process.env.GOOGLE_CLIENT_ID ?? '',
  },

  // Public address of the app (the API is served under it at /api), used in emails
  appUrl: process.env.APP_URL ?? 'http://localhost:5173',

  smtp: {
    host: process.env.SMTP_HOST ?? 'localhost',
    port: parseInt(process.env.SMTP_PORT ?? '1025', 10),
    secure: process.env.SMTP_SECURE === 'true',
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
    from: process.env.SMTP_FROM ?? 'VP Diététique <noreply@vp-dietetic.local>',
  },

  // Documents bucket; empty in development (files then go to a local folder)
  gcs: {
    bucketName: process.env.GCS_BUCKET_NAME ?? '',
  },

  throttle: {
    ttl: parseInt(process.env.THROTTLE_TTL ?? '60000', 10),
    limit: parseInt(process.env.THROTTLE_LIMIT ?? '300', 10),
  },
});

export type AppConfig = ReturnType<typeof configuration>;
