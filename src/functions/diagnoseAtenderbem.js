import { diagnosticarAtenderBem } from '../services/atenderbemDiagnostics.service.js';

export async function executarDiagnosticoAtenderBem(
  args = {},
  executionContext = {},
) {
  return diagnosticarAtenderBem(args, executionContext);
}
