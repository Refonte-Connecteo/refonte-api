-- AlterTable
ALTER TABLE "user" ALTER COLUMN "password_hash" DROP NOT NULL;

-- AlterTable
ALTER TABLE "user" ADD COLUMN "is_active" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "user" ADD COLUMN "invitation_token" TEXT;

-- AlterTable
ALTER TABLE "user" ADD COLUMN "invitation_token_expires" TIMESTAMP(3);

-- CreateIndex
CREATE UNIQUE INDEX "user_invitation_token_key" ON "user"("invitation_token");
