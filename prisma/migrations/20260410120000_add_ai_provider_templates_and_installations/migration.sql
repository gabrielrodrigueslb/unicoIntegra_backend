CREATE TABLE IF NOT EXISTS "sistema"."ai_provider_templates" (
  "id" SERIAL PRIMARY KEY,
  "provider" VARCHAR(50) NOT NULL,
  "templateName" VARCHAR(255) NOT NULL,
  "version" INTEGER NOT NULL,
  "assistantTemplate" TEXT NOT NULL,
  "preProcessTemplate" TEXT NOT NULL,
  "buscaProdutosTemplate" TEXT NOT NULL,
  "downloadImagemTemplate" TEXT NOT NULL,
  "uraTemplate" TEXT NOT NULL,
  "uraAbTemplate" TEXT NOT NULL,
  "isCurrent" BOOLEAN NOT NULL DEFAULT true,
  "isActive" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE UNIQUE INDEX IF NOT EXISTS "ai_provider_templates_provider_version_key"
ON "sistema"."ai_provider_templates" ("provider", "version");

CREATE INDEX IF NOT EXISTS "ai_provider_templates_provider_current_idx"
ON "sistema"."ai_provider_templates" ("provider", "isCurrent");

CREATE TABLE IF NOT EXISTS "sistema"."ai_client_installations" (
  "id" SERIAL PRIMARY KEY,
  "instance" VARCHAR(255) NOT NULL,
  "provider" VARCHAR(50) NOT NULL,
  "assistantId" VARCHAR(100),
  "assistantName" VARCHAR(255),
  "installedVersion" INTEGER,
  "source" VARCHAR(50) NOT NULL DEFAULT 'managed',
  "configSnapshot" JSONB,
  "preProcessId" VARCHAR(100),
  "buscaProdutosId" VARCHAR(100),
  "downloadImagemId" VARCHAR(100),
  "uraIaId" VARCHAR(100),
  "uraAbId" VARCHAR(100),
  "lastSyncStatus" VARCHAR(50) NOT NULL DEFAULT 'installed',
  "lastSyncError" TEXT,
  "createdAt" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS "ai_client_installations_instance_idx"
ON "sistema"."ai_client_installations" ("instance");

CREATE INDEX IF NOT EXISTS "ai_client_installations_provider_idx"
ON "sistema"."ai_client_installations" ("provider");

CREATE UNIQUE INDEX IF NOT EXISTS "ai_client_installations_instance_assistant_key"
ON "sistema"."ai_client_installations" ("instance", "assistantId");
