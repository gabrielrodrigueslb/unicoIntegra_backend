import OpenAI from 'openai';
import { env } from '../config/env.js';
import { logger } from '../utils/logger.js';

const DEFAULT_MODEL = env.OPENAI_MODEL;

let cachedClient = null;

function getOpenAIClient() {
  if (cachedClient) {
    return cachedClient;
  }

  if (!env.OPENAI_API_KEY) {
    throw new Error('OPENAI_API_KEY nao configurada no back/.env.');
  }

  cachedClient = new OpenAI({
    apiKey: env.OPENAI_API_KEY,
  });

  return cachedClient;
}

function buildSystemInstruction(knowledgeBaseContext) {
  return [
    'Voce e o Link AI, um assistente tecnico integrado ao sistema Unico.',
    'Fale de forma natural, humana e profissional.',
    'Seja objetivo, claro e confiavel.',
    'Mantenha saudacoes curtas e nao liste capacidades sem necessidade.',
    'Use a base de conhecimento sempre que ela for relevante.',
    'Voce pode gerar build, instalar integracoes/automacoes do catalogo atual e criar IAs do catalogo atual.',
    'Quando o pedido corresponder a uma dessas operacoes e os dados necessarios estiverem completos, use a tool correta.',
    'Nao invente integracoes, IAs, campos ou endpoints fora do catalogo e da documentacao fornecida.',
    'Se faltarem parametros para a tool, pergunte somente o que falta e em uma unica resposta curta.',
    'Considere que username e password da sessao do operador ja sao enviados pelo backend; nunca peca essas credenciais ao usuario.',
    'O codigo 2FA e a URL da instancia ainda precisam ser informados pelo usuario quando a operacao exigir.',
    'Nao descreva etapas internas se nenhuma tool foi usada.',
    'Apos executar uma tool, explique o resultado em portugues de forma objetiva.',
    'Quando houver erro retornado pela tool, explique o problema e oriente exatamente qual dado ou acao falta.',
    'Quando existir download, mencione o download disponivel.',
    'Quando orientar o usuario para uma tela especifica da plataforma, inclua um link markdown curto para a rota interna correta, por exemplo [Bancos de Dados](/main/databases).',
    'Quando falar sobre a extensao Trier, trate o guia dessa extensao como fonte de verdade e normalize VITE_INSTANCE_URL com barra final / automaticamente, sem exigir que o usuario digite a barra.',
    'Extensao Trier e IA Trier sao coisas diferentes: para extensao Trier use a tool configurar_extensao_trier; para IA Trier use criar_ia_catalogo apenas quando o pedido for explicitamente sobre a IA.',
    '',
    'Base de conhecimento:',
    knowledgeBaseContext,
  ].join('\n');
}

function supportsReasoningEffort(model) {
  return /^(gpt-5|o1|o3|o4)/i.test(model);
}

function supportsVerbosity(model) {
  return /^gpt-5/i.test(model);
}

function isUnsupportedParameterError(error) {
  const errorMessage =
    error?.error?.message ||
    error?.message ||
    '';

  return (
    typeof errorMessage === 'string' &&
    errorMessage.includes('Unsupported parameter')
  );
}

export function normalizeHistory(history = []) {
  if (!Array.isArray(history)) {
    return [];
  }

  return history
    .filter((item) => item && typeof item === 'object')
    .map((item) => ({
      role: item.role === 'assistant' ? 'assistant' : 'user',
      content: typeof item.content === 'string' ? item.content.trim() : '',
    }))
    .filter((item) => item.content);
}

export function buildChatInput({ knowledgeBaseContext, history, message }) {
  return [
    {
      role: 'system',
      content: buildSystemInstruction(knowledgeBaseContext),
    },
    ...history,
    {
      role: 'user',
      content: message.trim(),
    },
  ];
}

export async function createChatResponse({ input, tools = [] }) {
  const client = getOpenAIClient();

  logger.info('Enviando requisicao para a OpenAI.', {
    model: DEFAULT_MODEL,
    toolCount: tools.length,
  });

  const request = {
    model: DEFAULT_MODEL,
    input,
    tools,
    parallel_tool_calls: false,
  };

  if (supportsReasoningEffort(DEFAULT_MODEL)) {
    request.reasoning = {
      effort: env.OPENAI_REASONING_EFFORT,
    };
  }

  if (supportsVerbosity(DEFAULT_MODEL)) {
    request.text = {
      verbosity: env.OPENAI_VERBOSITY,
    };
  }

  try {
    return await client.responses.create(request);
  } catch (error) {
    if (
      !isUnsupportedParameterError(error) ||
      (!request.reasoning && !request.text)
    ) {
      throw error;
    }

    logger.warn(
      'Modelo nao aceitou parametros opcionais. Reenviando sem reasoning/text.',
      {
        model: DEFAULT_MODEL,
      },
    );

    delete request.reasoning;
    delete request.text;

    return client.responses.create(request);
  }
}

export function extractFunctionCalls(response) {
  return (response?.output || []).filter(
    (item) => item?.type === 'function_call',
  );
}

export function extractResponseText(response) {
  if (typeof response?.output_text === 'string' && response.output_text.trim()) {
    return response.output_text.trim();
  }

  for (const item of response?.output || []) {
    if (!Array.isArray(item?.content)) {
      continue;
    }

    for (const contentItem of item.content) {
      const maybeText =
        contentItem?.text ||
        contentItem?.output_text ||
        contentItem?.value ||
        '';

      if (typeof maybeText === 'string' && maybeText.trim()) {
        return maybeText.trim();
      }
    }
  }

  return '';
}
