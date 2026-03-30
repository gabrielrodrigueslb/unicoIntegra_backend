import { installIntegrationFromCatalog } from '../services/chatAutomation.service.js';

export async function executarInstalacaoIntegracaoCatalogo(
  args = {},
  executionContext = {},
) {
  return installIntegrationFromCatalog(args, executionContext);
}
