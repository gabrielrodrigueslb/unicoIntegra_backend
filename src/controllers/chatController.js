import { executeFunction } from '../functions/index.js';
import { chatTools } from '../tools/chatTools.js';
import { buildKnowledgeBaseContext } from '../utils/knowledgeBase.js';
import { logger } from '../utils/logger.js';
import {
  buildChatInput,
  createChatResponse,
  extractFunctionCalls,
  extractResponseText,
  normalizeHistory,
} from '../services/openaiService.js';

const MAX_TOOL_ROUNDS = 4;

function createTrace(message, status = 'info') {
  return {
    id: `trace-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    message,
    status,
  };
}

function safeParseArguments(rawArguments) {
  if (!rawArguments) {
    return {};
  }

  if (typeof rawArguments === 'object') {
    return rawArguments;
  }

  try {
    return JSON.parse(rawArguments);
  } catch {
    return {};
  }
}

function normalizeText(value = '') {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();
}

function cleanExtractedValue(value = '') {
  return String(value || '').trim().replace(/[)\],;"']+$/g, '');
}

function isTrierExtensionIntent(message) {
  const normalizedMessage = normalizeText(message);
  const mentionsTrier = normalizedMessage.includes('trier');
  const mentionsExtensionContext =
    normalizedMessage.includes('extensao') ||
    normalizedMessage.includes('.env') ||
    normalizedMessage.includes('vite_instance_url') ||
    normalizedMessage.includes('vite_client_token') ||
    normalizedMessage.includes('client_token');
  const mentionsIaContext =
    normalizedMessage.includes('ia trier') ||
    normalizedMessage.includes('assistente trier') ||
    normalizedMessage.includes('criar ia');

  return mentionsTrier && mentionsExtensionContext && !mentionsIaContext;
}

function extractTrierExtensionArgs(message) {
  const urlMatch =
    message.match(/\burl\s*:\s*(https?:\/\/\S+)/i) ||
    message.match(/\binstance(?:_url)?\s*:\s*(https?:\/\/\S+)/i) ||
    message.match(/(https?:\/\/\S+)/i);

  const tokenMatch = message.match(
    /\b(?:client[_\s-]*token|token)\s*:\s*([A-Za-z0-9._-]+)/i,
  );

  return {
    instance_url: urlMatch ? cleanExtractedValue(urlMatch[1]) : '',
    client_token: tokenMatch ? cleanExtractedValue(tokenMatch[1]) : '',
  };
}

function maskToken(token = '') {
  const trimmed = String(token || '').trim();

  if (trimmed.length <= 14) {
    return trimmed;
  }

  return `${trimmed.slice(0, 8)}...${trimmed.slice(-6)}`;
}

function isAffirmativeMessage(message) {
  const normalizedMessage = normalizeText(message).trim();

  return /^(sim|s|ok|okay|confirmo|confirmado|isso|isso mesmo|pode|pode sim|pode prosseguir|prossegue|prosseguir|gere|gerar|seguir)\b/.test(
    normalizedMessage,
  );
}

function isPendingTrierConfirmation(history = []) {
  if (!Array.isArray(history) || !history.length) {
    return false;
  }

  const lastMessage = history[history.length - 1];
  return (
    lastMessage?.role === 'assistant' &&
    typeof lastMessage.content === 'string' &&
    lastMessage.content.includes('Confirmacao pendente da extensao Trier')
  );
}

function findLatestTrierExtensionArgsFromHistory(history = []) {
  for (let index = history.length - 1; index >= 0; index -= 1) {
    const item = history[index];

    if (item?.role !== 'user' || typeof item.content !== 'string') {
      continue;
    }

    if (!isTrierExtensionIntent(item.content)) {
      continue;
    }

    const args = extractTrierExtensionArgs(item.content);

    if (args.instance_url && args.client_token) {
      return args;
    }
  }

  return null;
}

function buildTrierExtensionConfirmationReply(args) {
  return [
    'Entendi assim para a extensao Trier:',
    '',
    `URL da instancia: ${args.instance_url}`,
    `Token: ${maskToken(args.client_token)}`,
    '',
    'Se estiver correto, responda apenas "sim" que eu gero o build da extensao, empacoto o dist em ZIP e libero o download.',
    'Confirmacao pendente da extensao Trier.',
  ].join('\n');
}

function buildTrierExtensionReadyReply(functionResult) {
  return [
    'Perfeito. Gerei o ZIP instalavel da extensao Trier a partir do build final.',
    'O download ja esta disponivel.',
    'Se a URL vier sem / no final, eu normalizo automaticamente antes de gerar o build.',
    'Depois de baixar, extraia o ZIP e carregue a pasta no Chrome como extensao descompactada.',
  ].join('\n');
}

function buildTrierExtensionMissingReply(args) {
  const missingFields = [];

  if (!args.instance_url) {
    missingFields.push('a URL da instancia do cliente');
  }

  if (!args.client_token) {
    missingFields.push('o token da Trier');
  }

  const missingLabel =
    missingFields.length > 1
      ? `${missingFields.slice(0, -1).join(' e ')} e ${missingFields[missingFields.length - 1]}`
      : missingFields[0];

  return `Para a extensao Trier, preciso apenas de ${missingLabel}. Se a URL vier sem / no final, eu ajusto automaticamente.`;
}

export async function postChatController(req, res) {
  const { message, history = [], sessionContext = {} } = req.body ?? {};

  if (typeof message !== 'string' || !message.trim()) {
    return res.status(400).json({
      message: 'O campo "message" e obrigatorio.',
    });
  }

  const trace = [createTrace('Recebendo a mensagem do usuario.')];

  try {
    if (isAffirmativeMessage(message) && isPendingTrierConfirmation(history)) {
      const pendingArgs = findLatestTrierExtensionArgsFromHistory(history);

      if (!pendingArgs) {
        return res.status(200).json({
          reply:
            'Nao encontrei os dados anteriores da extensao Trier no historico. Pode me reenviar a URL e o token?',
          action: null,
          trace: [],
        });
      }

      trace.push(createTrace('Confirmacao da extensao Trier recebida.'));
      trace.push(createTrace('Executando configuracao da extensao Trier.'));
      const functionResult = await executeFunction(
        'configurar_extensao_trier',
        pendingArgs,
        sessionContext,
      );

      if (Array.isArray(functionResult?.traceSteps)) {
        functionResult.traceSteps.forEach((step) => {
          trace.push(createTrace(step, 'success'));
        });
      }

      trace.push(
        createTrace(
          functionResult.traceMessage ||
            'Configuracao da extensao Trier preparada.',
          'success',
        ),
      );

      return res.status(200).json({
        reply: buildTrierExtensionReadyReply(functionResult),
        action: functionResult.action || null,
        trace,
      });
    }

    if (isTrierExtensionIntent(message)) {
      const trierArgs = extractTrierExtensionArgs(message);

      if (!trierArgs.instance_url || !trierArgs.client_token) {
        return res.status(200).json({
          reply: buildTrierExtensionMissingReply(trierArgs),
          action: null,
          trace: [],
        });
      }

      return res.status(200).json({
        reply: buildTrierExtensionConfirmationReply(trierArgs),
        action: null,
        trace: [],
      });
    }

    const knowledgeBaseContext = buildKnowledgeBaseContext(message);
    const normalizedHistory = normalizeHistory(history);
    const input = buildChatInput({
      knowledgeBaseContext,
      history: normalizedHistory,
      message,
    });

    trace.push(createTrace('Base de conhecimento anexada ao contexto.'));

    let response = await createChatResponse({
      input,
      tools: chatTools,
    });

    trace.push(createTrace('Mensagem enviada ao modelo.'));

    let action = null;
    let toolRound = 0;
    let usedTools = false;

    while (toolRound < MAX_TOOL_ROUNDS) {
      const functionCalls = extractFunctionCalls(response);

      if (!functionCalls.length) {
        break;
      }

      usedTools = true;

      input.push(...response.output);

      for (const functionCall of functionCalls) {
        const args = safeParseArguments(functionCall.arguments);
        trace.push(
          createTrace(`Executando tool ${functionCall.name}.`, 'info'),
        );

        let functionResult;

        try {
          functionResult = await executeFunction(
            functionCall.name,
            args,
            sessionContext,
          );
        } catch (toolError) {
          logger.warn('Falha ao executar tool do chat.', {
            toolName: functionCall.name,
            message: toolError.message,
          });

          trace.push(
            createTrace(
              toolError.message ||
                `Falha ao executar a tool ${functionCall.name}.`,
              'error',
            ),
          );

          input.push({
            type: 'function_call_output',
            call_id: functionCall.call_id,
            output: JSON.stringify({
              sucesso: false,
              tool: functionCall.name,
              error:
                toolError.message ||
                `Falha ao executar a tool ${functionCall.name}.`,
            }),
          });

          continue;
        }

        if (functionResult?.action) {
          action = functionResult.action;
        }

        if (Array.isArray(functionResult?.traceSteps)) {
          functionResult.traceSteps.forEach((step) => {
            trace.push(createTrace(step, 'success'));
          });
        }

        if (functionResult?.traceMessage) {
          trace.push(createTrace(functionResult.traceMessage, 'success'));
        } else {
          trace.push(
            createTrace(`Tool ${functionCall.name} concluida.`, 'success'),
          );
        }

        input.push({
          type: 'function_call_output',
          call_id: functionCall.call_id,
          output: JSON.stringify(functionResult),
        });
      }

      toolRound += 1;
      response = await createChatResponse({
        input,
        tools: chatTools,
      });

      trace.push(createTrace('Solicitando resposta final ao modelo.'));
    }

    const reply =
      extractResponseText(response) ||
      (action?.type === 'download'
        ? 'Build gerado com sucesso. O download ja esta disponivel.'
        : 'Nao consegui gerar uma resposta final.');

    return res.status(200).json({
      reply,
      action,
      trace: usedTools ? trace : [],
    });
  } catch (error) {
    logger.error('Falha ao processar /chat', {
      message: error.message,
      stack: error.stack,
    });

    trace.push(
      createTrace(
        'Ocorreu um erro interno ao processar a solicitacao.',
        'error',
      ),
    );

    return res.status(500).json({
      reply:
        'Ocorreu um erro ao falar com a IA. Verifique a configuracao da API e tente novamente.',
      action: null,
      trace: [],
      error: error.message,
    });
  }
}
