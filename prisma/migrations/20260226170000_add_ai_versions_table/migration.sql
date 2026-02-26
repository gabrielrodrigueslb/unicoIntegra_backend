-- CreateTable
CREATE TABLE "sistema"."ai_versions" (
    "id" SERIAL NOT NULL,
    "instance" VARCHAR(255) NOT NULL,
    "version" INTEGER NOT NULL,
    "payload" JSONB NOT NULL,
    "createdAt" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ai_versions_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ai_versions_instance_version_key" ON "sistema"."ai_versions"("instance", "version");

-- CreateIndex
CREATE INDEX "ai_versions_instance_idx" ON "sistema"."ai_versions"("instance");

-- CreateIndex
CREATE INDEX "ai_versions_createdAt_idx" ON "sistema"."ai_versions"("createdAt");
