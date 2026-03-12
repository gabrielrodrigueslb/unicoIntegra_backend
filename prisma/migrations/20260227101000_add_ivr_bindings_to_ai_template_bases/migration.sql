-- AlterTable
ALTER TABLE "sistema"."ai_template_bases"
ADD COLUMN IF NOT EXISTS "immutablePaths" JSONB,
ADD COLUMN IF NOT EXISTS "ivrBindings" JSONB;
