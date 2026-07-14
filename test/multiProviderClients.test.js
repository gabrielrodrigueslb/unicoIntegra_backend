import assert from 'node:assert/strict';
import test from 'node:test';

process.env.MULTIPROVIDER_BASE_URL = 'http://multi-provider.test';
process.env.MULTIPROVIDER_ADMIN_API_KEY = 'admin-key';
process.env.MULTIPROVIDER_TENANT_DB_HOST = 'postgres';
process.env.MULTIPROVIDER_TENANT_DB_USER = 'postgres';
process.env.MULTIPROVIDER_TENANT_DB_PASSWORD = 'secret';

const { buildMultiProviderClientRequest } = await import(
  '../src/services/multiProviderClients.service.js'
);

test('builds the provider-specific client registrations without exposing the admin key', () => {
  const alpha = buildMultiProviderClientRequest({
    provider: 'alpha7', name: 'Alpha', instance: 'db.alpha', credential: 'db-password',
    alpha7Port: 5432, alpha7Database: 'alpha_db', alpha7User: 'reader',
  });
  const trier = buildMultiProviderClientRequest({
    provider: 'api', name: 'Drogaria Sao Jose', credential: 'trier-token',
  });

  assert.equal(alpha.path, '/api/admin/clientes/alpha7');
  assert.equal(alpha.body.password, 'db-password');
  assert.equal(trier.path, '/api/admin/clientes/trier');
  assert.equal(trier.body.database, 'cliente_drogaria_sao_jose_cache');
  assert.equal('x-api-key' in trier.body, false);
});
