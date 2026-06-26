const getEnv = (key: string, defaultValue?: string): string => {
  const value = process.env[key] ?? defaultValue;
  if (!value) {
    throw new Error(`Missing environment variable: ${key}`);
  }
  return value;
};

export const env = {
  PORT: parseInt(process.env.PORT || "3000", 10),
  DATABASE_URL: getEnv("DATABASE_URL"),
  JWT_SECRET: getEnv("JWT_SECRET"),
  JWT_EXPIRES_IN: process.env.JWT_EXPIRES_IN || "7d",
  RESEND_API_KEY: process.env.RESEND_API_KEY || "",
  FRONTEND_URL: process.env.FRONTEND_URL || "http://localhost:5173",
  INVITATION_TOKEN_EXPIRES_HOURS: parseInt(process.env.INVITATION_TOKEN_EXPIRES_HOURS || "24", 10),
};
