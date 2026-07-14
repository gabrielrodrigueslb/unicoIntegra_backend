ALTER TABLE "sistema"."clients"
  ADD COLUMN IF NOT EXISTS "multiProviderTenantId" INTEGER,
  ADD COLUMN IF NOT EXISTS "multiProviderApiKey" TEXT;
