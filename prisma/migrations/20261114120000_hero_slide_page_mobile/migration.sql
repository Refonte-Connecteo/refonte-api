-- AlterTable
ALTER TABLE "hero_slide" ADD COLUMN     "page" VARCHAR(20) NOT NULL DEFAULT 'home',
ADD COLUMN     "mobile_image_url" TEXT;

-- CreateIndex
CREATE INDEX "hero_slide_page_position_idx" ON "hero_slide"("page", "position");
