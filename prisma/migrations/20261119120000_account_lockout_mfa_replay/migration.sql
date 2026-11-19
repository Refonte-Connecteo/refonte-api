-- Verrouillage du compte après plusieurs échecs, et protection contre le rejeu d'un code TOTP
ALTER TABLE "user" ADD COLUMN "failed_login_count" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "user" ADD COLUMN "locked_until" TIMESTAMP(3);
ALTER TABLE "user" ADD COLUMN "mfa_last_used_step" INTEGER;
