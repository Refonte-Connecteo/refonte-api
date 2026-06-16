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
  },

  dbConfig: {
    databaseUrl: requireEnv('DATABASE_URL'),
    host: process.env.DB_HOST || 'localhost',
    port: getNumber('DB_PORT', 5432),
    user: process.env.DB_USER || 'postgres',
    password: process.env.DB_PASSWORD || 'password',
    database: process.env.DB_NAME || 'refonte_connecteo',
  },
};
