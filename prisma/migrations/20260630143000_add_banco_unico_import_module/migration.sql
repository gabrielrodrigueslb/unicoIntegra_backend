CREATE TABLE "sistema"."banco_unico_import_jobs" (
    "id" SERIAL NOT NULL,
    "clientName" VARCHAR(255) NOT NULL,
    "sourceType" VARCHAR(30) NOT NULL,
    "sourceLabel" TEXT,
    "status" VARCHAR(30) NOT NULL DEFAULT 'pending',
    "mode" VARCHAR(30) NOT NULL DEFAULT 'publish',
    "requestedBy" VARCHAR(255) NOT NULL,
    "currentStage" VARCHAR(100),
    "currentMessage" TEXT,
    "progressCurrent" INTEGER NOT NULL DEFAULT 0,
    "progressTotal" INTEGER NOT NULL DEFAULT 0,
    "progressPercent" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "totalCatalogValid" INTEGER NOT NULL DEFAULT 0,
    "totalInvalidEans" INTEGER NOT NULL DEFAULT 0,
    "totalSampled" INTEGER NOT NULL DEFAULT 0,
    "totalSelected" INTEGER NOT NULL DEFAULT 0,
    "totalExisting" INTEGER NOT NULL DEFAULT 0,
    "totalPrepared" INTEGER NOT NULL DEFAULT 0,
    "totalSkipped" INTEGER NOT NULL DEFAULT 0,
    "totalErrors" INTEGER NOT NULL DEFAULT 0,
    "totalPublished" INTEGER NOT NULL DEFAULT 0,
    "options" JSONB,
    "summary" JSONB,
    "startedAt" TIMESTAMP(6),
    "finishedAt" TIMESTAMP(6),
    "createdAt" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(6) NOT NULL,

    CONSTRAINT "banco_unico_import_jobs_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "sistema"."banco_unico_import_items" (
    "id" SERIAL NOT NULL,
    "jobId" INTEGER NOT NULL,
    "externalKey" VARCHAR(255) NOT NULL,
    "sourceProductId" INTEGER,
    "ean" VARCHAR(20),
    "nameOriginal" TEXT,
    "nameNormalized" TEXT,
    "manufacturer" TEXT,
    "activeIngredient" TEXT,
    "status" VARCHAR(40) NOT NULL,
    "skippedReason" VARCHAR(100),
    "errorStage" VARCHAR(100),
    "errorMessage" TEXT,
    "confidence" VARCHAR(20),
    "needsReview" BOOLEAN NOT NULL DEFAULT false,
    "taxonomy" JSONB,
    "metadata" JSONB,
    "payload" JSONB,
    "sourcePayload" JSONB,
    "publishedAt" TIMESTAMP(6),
    "createdAt" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(6) NOT NULL,

    CONSTRAINT "banco_unico_import_items_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "sistema"."banco_unico_import_events" (
    "id" SERIAL NOT NULL,
    "jobId" INTEGER NOT NULL,
    "level" VARCHAR(20) NOT NULL DEFAULT 'info',
    "message" TEXT NOT NULL,
    "data" JSONB,
    "createdAt" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "banco_unico_import_events_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "banco_unico_import_items_externalKey_key"
ON "sistema"."banco_unico_import_items"("externalKey");

CREATE INDEX "banco_unico_import_jobs_clientName_idx"
ON "sistema"."banco_unico_import_jobs"("clientName");

CREATE INDEX "banco_unico_import_jobs_status_idx"
ON "sistema"."banco_unico_import_jobs"("status");

CREATE INDEX "banco_unico_import_jobs_createdAt_idx"
ON "sistema"."banco_unico_import_jobs"("createdAt");

CREATE INDEX "banco_unico_import_items_jobId_idx"
ON "sistema"."banco_unico_import_items"("jobId");

CREATE INDEX "banco_unico_import_items_jobId_status_idx"
ON "sistema"."banco_unico_import_items"("jobId", "status");

CREATE INDEX "banco_unico_import_items_ean_idx"
ON "sistema"."banco_unico_import_items"("ean");

CREATE INDEX "banco_unico_import_items_createdAt_idx"
ON "sistema"."banco_unico_import_items"("createdAt");

CREATE INDEX "banco_unico_import_events_jobId_id_idx"
ON "sistema"."banco_unico_import_events"("jobId", "id");

CREATE INDEX "banco_unico_import_events_createdAt_idx"
ON "sistema"."banco_unico_import_events"("createdAt");

ALTER TABLE "sistema"."banco_unico_import_items"
ADD CONSTRAINT "banco_unico_import_items_jobId_fkey"
FOREIGN KEY ("jobId") REFERENCES "sistema"."banco_unico_import_jobs"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "sistema"."banco_unico_import_events"
ADD CONSTRAINT "banco_unico_import_events_jobId_fkey"
FOREIGN KEY ("jobId") REFERENCES "sistema"."banco_unico_import_jobs"("id")
ON DELETE CASCADE ON UPDATE CASCADE;
