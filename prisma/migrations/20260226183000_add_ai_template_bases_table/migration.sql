-- CreateTable
CREATE TABLE "sistema"."ai_template_bases" (
    "id" SERIAL NOT NULL,
    "templateKey" VARCHAR(100) NOT NULL,
    "templateName" VARCHAR(255) NOT NULL,
    "version" INTEGER NOT NULL,
    "templateContent" TEXT NOT NULL,
    "contentType" VARCHAR(50) NOT NULL DEFAULT 'json-template',
    "sourcePath" VARCHAR(255),
    "isCurrent" BOOLEAN NOT NULL DEFAULT true,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ai_template_bases_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ai_template_bases_templateKey_version_key" ON "sistema"."ai_template_bases"("templateKey", "version");

-- CreateIndex
CREATE INDEX "ai_template_bases_templateKey_isCurrent_idx" ON "sistema"."ai_template_bases"("templateKey", "isCurrent");

-- CreateIndex
CREATE INDEX "ai_template_bases_isCurrent_idx" ON "sistema"."ai_template_bases"("isCurrent");
