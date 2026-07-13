-- Instância administrativa, independente da configuração técnica do provedor.
ALTER TABLE "sistema"."clients"
ADD COLUMN "clientInstance" VARCHAR(255);
