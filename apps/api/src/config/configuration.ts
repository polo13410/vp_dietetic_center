export const configuration = () => ({
  nodeEnv: process.env.NODE_ENV ?? 'development',
  port: parseInt(process.env.PORT ?? '3000', 10),
  appName: process.env.APP_NAME ?? 'VP Dietetic Center API',

  database: {
    url: process.env.DATABASE_URL,
  },

  jwt: {
    secret: process.env.JWT_SECRET ?? 'dev-secret-change-in-prod',
    refreshSecret: process.env.JWT_REFRESH_SECRET ?? 'dev-refresh-secret',
    expiresIn: process.env.JWT_EXPIRES_IN ?? '15m',
    refreshExpiresIn: process.env.JWT_REFRESH_EXPIRES_IN ?? '7d',
  },

  cors: {
    origins: (process.env.CORS_ORIGINS ?? 'http://localhost:5173').split(','),
  },

  smtp: {
    host: process.env.SMTP_HOST ?? 'localhost',
    port: parseInt(process.env.SMTP_PORT ?? '1025', 10),
    secure: process.env.SMTP_SECURE === 'true',
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
    from: process.env.SMTP_FROM ?? 'noreply@vp-dietetic.fr',
  },

  gcs: {
    bucketName: process.env.GCS_BUCKET_NAME ?? '',
    projectId: process.env.GOOGLE_CLOUD_PROJECT ?? '',
  },

  throttle: {
    ttl: parseInt(process.env.THROTTLE_TTL ?? '60000', 10),
    limit: parseInt(process.env.THROTTLE_LIMIT ?? '100', 10),
  },
});

export type AppConfig = ReturnType<typeof configuration>;
