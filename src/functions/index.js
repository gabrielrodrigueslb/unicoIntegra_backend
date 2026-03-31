import { gerarBuildProjeto } from './gerarBuild.js';
import { executarInstalacaoIntegracaoCatalogo } from './installIntegrationFromCatalog.js';
import { executarCriacaoIaCatalogo } from './createAiFromCatalog.js';
import {
  configurarExtensaoTrier,
  configurarExtensaoTrierLote,
} from './configureTrierExtension.js';

export async function executeFunction(name, args = {}, executionContext = {}) {
  switch (name) {
    case 'gerar_build_projeto':
      return gerarBuildProjeto(args);
    case 'configurar_extensao_trier':
      return configurarExtensaoTrier(args);
    case 'configurar_extensao_trier_lote':
      return configurarExtensaoTrierLote(args);
    case 'instalar_integracao_catalogo':
      return executarInstalacaoIntegracaoCatalogo(args, executionContext);
    case 'criar_ia_catalogo':
      return executarCriacaoIaCatalogo(args, executionContext);
    default:
      throw new Error(`Funcao nao suportada: ${name}`);
  }
}
