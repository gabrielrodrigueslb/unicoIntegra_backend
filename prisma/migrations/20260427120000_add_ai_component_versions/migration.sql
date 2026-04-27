ALTER TABLE IF EXISTS "sistema"."ai_provider_templates"
ADD COLUMN IF NOT EXISTS "componentVersions" JSONB NOT NULL DEFAULT '{}'::jsonb;

ALTER TABLE IF EXISTS "sistema"."ai_client_installations"
ADD COLUMN IF NOT EXISTS "installedComponentVersions" JSONB;
