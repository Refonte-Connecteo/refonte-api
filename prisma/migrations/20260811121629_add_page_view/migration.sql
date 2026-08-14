-- CreateTable
CREATE TABLE "page_view" (
    "id" SERIAL NOT NULL,
    "visitor_id" TEXT NOT NULL,
    "path" TEXT NOT NULL,
    "referrer" TEXT,
    "user_agent" TEXT,
    "device" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "page_view_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "page_view_created_at_idx" ON "page_view"("created_at");

-- CreateIndex
CREATE INDEX "page_view_visitor_id_idx" ON "page_view"("visitor_id");
