-- AlterTable
ALTER TABLE "catalogue" ADD COLUMN     "year" INTEGER,
ADD COLUMN     "is_impact_report" BOOLEAN NOT NULL DEFAULT false;

-- CreateIndex
CREATE INDEX "catalogue_is_impact_report_idx" ON "catalogue"("is_impact_report");
