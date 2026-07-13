-- CreateTable
CREATE TABLE "sistema"."clients" (
    "id" SERIAL NOT NULL,
    "name" VARCHAR(255) NOT NULL,
    "businessUnit" VARCHAR(255),
    "cnpj" VARCHAR(20),
    "provider" VARCHAR(30) NOT NULL,
    "instance" TEXT NOT NULL,
    "credential" TEXT,
    "alpha7Port" INTEGER,
    "alpha7Database" VARCHAR(255),
    "alpha7User" VARCHAR(255),
    "alpha7Schema" VARCHAR(100) DEFAULT 'public',
    "createdAt" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(6) NOT NULL,

    CONSTRAINT "clients_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "clients_name_key" ON "sistema"."clients"("name");

-- CreateIndex
CREATE INDEX "clients_provider_idx" ON "sistema"."clients"("provider");

-- AlterTable
ALTER TABLE "sistema"."banco_unico_import_jobs" ADD COLUMN "clientId" INTEGER;

-- CreateIndex
CREATE INDEX "banco_unico_import_jobs_clientId_idx" ON "sistema"."banco_unico_import_jobs"("clientId");

-- AddForeignKey
ALTER TABLE "sistema"."banco_unico_import_jobs" ADD CONSTRAINT "banco_unico_import_jobs_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "sistema"."clients"("id") ON DELETE SET NULL ON UPDATE CASCADE;
