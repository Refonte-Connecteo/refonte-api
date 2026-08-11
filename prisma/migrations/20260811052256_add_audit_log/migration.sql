-- CreateTable
CREATE TABLE "audit_log" (
    "id" SERIAL NOT NULL,
    "event_type" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "actor_user_id" INTEGER,
    "actor_email" TEXT,
    "resource_type" TEXT,
    "resource_id" TEXT,
    "success" BOOLEAN NOT NULL,
    "status_code" INTEGER,
    "error_code" TEXT,
    "ip" TEXT,
    "user_agent" TEXT,
    "request_id" TEXT,
    "method" TEXT,
    "route" TEXT,
    "details" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "audit_log_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "audit_log_created_at_idx" ON "audit_log"("created_at");

-- CreateIndex
CREATE INDEX "audit_log_event_type_idx" ON "audit_log"("event_type");

-- CreateIndex
CREATE INDEX "audit_log_actor_user_id_idx" ON "audit_log"("actor_user_id");

-- CreateIndex
CREATE INDEX "audit_log_success_idx" ON "audit_log"("success");

-- CreateIndex
CREATE INDEX "audit_log_request_id_idx" ON "audit_log"("request_id");
