import { createAiFromCatalog } from '../services/chatAutomation.service.js';

export async function executarCriacaoIaCatalogo(
  args = {},
  executionContext = {},
) {
  return createAiFromCatalog(args, executionContext);
}
