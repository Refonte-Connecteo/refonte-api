import pino from "pino";

export const logger = pino({
  level: process.env.LOG_LEVEL || "info",
  redact: {
    paths: ["password", "password_hash", "token", "jwt", "JWT_SECRET", "authorization", "invitation_token"],
    censor: "[REDACTED]",
  },
  transport:
    process.env.NODE_ENV !== "production"
      ? {
          target: "pino/file",
          options: { destination: 1 },
        }
      : undefined,
});
