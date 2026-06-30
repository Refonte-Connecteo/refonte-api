import dotenv from 'dotenv';

dotenv.config();

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

function validateEnv() {
  const requiredVars: string[] = [
    'DATABASE_URL',
    'JWT_SECRET',
    'JWT_ACCESS_SECRET',
    'JWT_REFRESH_SECRET',
    'AWS_REGION',
    'AWS_ACCESS_KEY_ID',
    'AWS_SECRET_ACCESS_KEY',
    'AWS_S3_BUCKET_NAME',
  ];

  const missing = requiredVars.filter(name => !process.env[name]);

  if (missing.length > 0) {
    console.error(`Missing required environment variables: ${missing.join(', ')}`);
    process.exit(1);
  }
}

validateEnv();

const getNumber = (key: string, fallback: number): number => {
  const value = process.env[key];
  return value ? Number(value) : fallback;
};

const getBoolean = (key: string, fallback: boolean = false): boolean => {
  return process.env[key] === 'true' || fallback;
};

export const envConfig = {
  serverConfig: {
    port: getNumber('PORT', 3000),
    nodeEnv: process.env.NODE_ENV || 'development',
    jwtSecret: requireEnv('JWT_SECRET'),
    jwtAccessSecret: requireEnv('JWT_ACCESS_SECRET'),
    jwtRefreshSecret: requireEnv('JWT_REFRESH_SECRET'),
    jwtAccessExpiration: process.env.JWT_ACCESS_EXPIRATION || '15m',
    jwtRefreshExpiration: process.env.JWT_REFRESH_EXPIRATION || '7d',
  },

  s3Config: {
    region: requireEnv('AWS_REGION'),
    accessKeyId: requireEnv('AWS_ACCESS_KEY_ID'),
    secretAccessKey: requireEnv('AWS_SECRET_ACCESS_KEY'),
    bucketName: requireEnv('AWS_S3_BUCKET_NAME'),
  },

  dbConfig: {
    databaseUrl: requireEnv('DATABASE_URL'),
    host: process.env.DB_HOST || 'localhost',
    port: getNumber('DB_PORT', 5432),
    user: process.env.DB_USER || 'postgres',
    password: process.env.DB_PASSWORD || 'password',
    database: process.env.DB_NAME || 'refonte_connecteo',
  },

  gemini: {
    apiKey: process.env.GEMINI_API_KEY || '',
  },

  email: {
    smtpHost: process.env.SMTP_HOST || '',
    smtpPort: getNumber('SMTP_PORT', 587),
    smtpSecure: getBoolean('SMTP_SECURE', false),
    smtpUser: process.env.SMTP_USER || '',
    smtpPass: process.env.SMTP_PASS || '',
    contactRecipient: process.env.CONTACT_RECIPIENT || '',
  },
};
