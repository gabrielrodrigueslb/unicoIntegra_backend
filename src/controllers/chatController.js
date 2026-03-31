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
const TRIER_SINGLE_CONFIRMATION_MARKER =
  'Confirmação pendente da extensão Trier';
const TRIER_BATCH_CONFIRMATION_MARKER =
  'Confirmação pendente do lote da extensão Trier';
const TRIER_BATCH_MISSING_MARKER =
  'Pendência de dados do lote da extensão Trier';
const TRIER_SINGLE_CONFIRMATION_MARKER_LEGACY =
  'Confirmacao pendente da extensao Trier';
const TRIER_BATCH_CONFIRMATION_MARKER_LEGACY =
  'Confirmacao pendente do lote da extensao Trier';
const TRIER_BATCH_MISSING_MARKER_LEGACY =
  'Pendencia de dados do lote da extensao Trier';

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

function includesAnyMarker(content = '', markers = []) {
  return markers.some((marker) => content.includes(marker));
}

function isTrierExtensionIntent(message) {
  const normalizedMessage = normalizeText(message);
  const mentionsTrier = normalizedMessage.includes('trier');
  const mentionsExtensionContext =
    normalizedMessage.includes('extensao') ||
    normalizedMessage.includes('extensoes') ||
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

function extractTrierExtensionUrls(message = '') {
  return Array.from(
    message.matchAll(/\bhttps?:\/\/[^\s,;]+/gi),
    (match) => cleanExtractedValue(match[0]),
  );
}

function extractTrierExtensionTokens(message = '') {
  return Array.from(
    message.matchAll(
      /\b(?:client[_\s-]*token|token)\s*[:=]\s*([A-Za-z0-9._-]+)/gi,
    ),
    (match) => cleanExtractedValue(match[1]),
  );
}

function extractTrierExtensionArgs(message) {
  const urlMatch =
    message.match(/\burl\s*[:=]\s*(https?:\/\/\S+)/i) ||
    message.match(/\binstance(?:_url)?\s*[:=]\s*(https?:\/\/\S+)/i) ||
    message.match(/(https?:\/\/\S+)/i);

  const tokenMatch = message.match(
    /\b(?:client[_\s-]*token|token)\s*[:=]\s*([A-Za-z0-9._-]+)/i,
  );

  return {
    instance_url: urlMatch ? cleanExtractedValue(urlMatch[1]) : '',
    client_token: tokenMatch ? cleanExtractedValue(tokenMatch[1]) : '',
  };
}

function buildTrierBatchItems(urls = [], tokens = []) {
  const normalizedUrls = urls.filter(Boolean);
  const normalizedTokens = tokens.filter(Boolean);

  if (!normalizedUrls.length || !normalizedTokens.length) {
    return [];
  }

  const distinctUrls = Array.from(new Set(normalizedUrls));
  const distinctTokens = Array.from(new Set(normalizedTokens));

  if (distinctUrls.length === 1 && normalizedTokens.length > 1) {
    return normalizedTokens.map((token) => ({
      instance_url: distinctUrls[0],
      client_token: token,
    }));
  }

  if (distinctTokens.length === 1 && distinctUrls.length > 1) {
    return normalizedUrls.map((url) => ({
      instance_url: url,
      client_token: distinctTokens[0],
    }));
  }

  const totalPairs = Math.min(normalizedUrls.length, normalizedTokens.length);
  const items = [];

  for (let index = 0; index < totalPairs; index += 1) {
    if (!normalizedUrls[index] || !normalizedTokens[index]) {
      continue;
    }

    items.push({
      instance_url: normalizedUrls[index],
      client_token: normalizedTokens[index],
    });
  }

  return items;
}

function extractTrierExtensionBatchArgs(message = '') {
  const urls = extractTrierExtensionUrls(message);
  const tokens = extractTrierExtensionTokens(message);

  return {
    items: buildTrierBatchItems(urls, tokens),
    urlCount: urls.length,
    tokenCount: tokens.length,
  };
}

function buildTrierExtensionBatchArgsFromMessages(messages = []) {
  const urls = [];
  const tokens = [];

  for (const message of messages) {
    if (typeof message !== 'string' || !message.trim()) {
      continue;
    }

    urls.push(...extractTrierExtensionUrls(message));
    tokens.push(...extractTrierExtensionTokens(message));
  }

  return {
    items: buildTrierBatchItems(urls, tokens),
    urlCount: urls.length,
    tokenCount: tokens.length,
  };
}

function hasTrierExtensionData(message = '') {
  return (
    extractTrierExtensionUrls(message).length > 0 ||
    extractTrierExtensionTokens(message).length > 0
  );
}

function isTrierExtensionBatchIntent(message = '') {
  if (!isTrierExtensionIntent(message)) {
    return false;
  }

  const normalizedMessage = normalizeText(message);
  const { urlCount, tokenCount } = extractTrierExtensionBatchArgs(message);

  return (
    urlCount > 1 ||
    tokenCount > 1 ||
    normalizedMessage.includes('lote') ||
    normalizedMessage.includes('varias') ||
    normalizedMessage.includes('multiplas') ||
    normalizedMessage.includes('3 extensoes') ||
    normalizedMessage.includes('duas extensoes')
  );
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

  for (let index = history.length - 1; index >= 0; index -= 1) {
    const item = history[index];

    if (item?.role !== 'assistant' || typeof item.content !== 'string') {
      continue;
    }

    return (
      includesAnyMarker(item.content, [
        TRIER_SINGLE_CONFIRMATION_MARKER,
        TRIER_SINGLE_CONFIRMATION_MARKER_LEGACY,
      ]) ||
      includesAnyMarker(item.content, [
        TRIER_BATCH_CONFIRMATION_MARKER,
        TRIER_BATCH_CONFIRMATION_MARKER_LEGACY,
      ])
    );
  }

  return false;
}

function isPendingTrierBatchCompletion(history = []) {
  if (!Array.isArray(history) || !history.length) {
    return false;
  }

  for (let index = history.length - 1; index >= 0; index -= 1) {
    const item = history[index];

    if (item?.role !== 'assistant' || typeof item.content !== 'string') {
      continue;
    }

    return includesAnyMarker(item.content, [
      TRIER_BATCH_MISSING_MARKER,
      TRIER_BATCH_MISSING_MARKER_LEGACY,
    ]);
  }

  return false;
}

function findLatestTrierBatchAssistantIndex(history = []) {
  for (let index = history.length - 1; index >= 0; index -= 1) {
    const item = history[index];

    if (item?.role !== 'assistant' || typeof item.content !== 'string') {
      continue;
    }

    if (
      includesAnyMarker(item.content, [
        TRIER_BATCH_CONFIRMATION_MARKER,
        TRIER_BATCH_CONFIRMATION_MARKER_LEGACY,
      ]) ||
      includesAnyMarker(item.content, [
        TRIER_BATCH_MISSING_MARKER,
        TRIER_BATCH_MISSING_MARKER_LEGACY,
      ])
    ) {
      return index;
    }
  }

  return -1;
}

function buildTrierBatchRequestFromHistory(history = [], currentMessage = '') {
  const messages = [];
  const latestBatchAssistantIndex = findLatestTrierBatchAssistantIndex(history);

  if (latestBatchAssistantIndex !== -1) {
    for (let index = latestBatchAssistantIndex - 1; index >= 0; index -= 1) {
      const item = history[index];

      if (item?.role !== 'user' || typeof item.content !== 'string') {
        continue;
      }

      if (!isTrierExtensionIntent(item.content) && !hasTrierExtensionData(item.content)) {
        continue;
      }

      messages.unshift(item.content);

      if (isTrierExtensionIntent(item.content)) {
        break;
      }
    }
  }

  if (typeof currentMessage === 'string' && currentMessage.trim()) {
    messages.push(currentMessage);
  }

  return buildTrierExtensionBatchArgsFromMessages(messages);
}

function findLatestTrierExtensionRequestFromHistory(history = []) {
  const mergedBatchRequest = buildTrierBatchRequestFromHistory(history);

  if (mergedBatchRequest.items.length > 1) {
    return {
      type: 'batch',
      items: mergedBatchRequest.items,
    };
  }

  for (let index = history.length - 1; index >= 0; index -= 1) {
    const item = history[index];

    if (item?.role !== 'user' || typeof item.content !== 'string') {
      continue;
    }

    if (!isTrierExtensionIntent(item.content)) {
      continue;
    }

    const batchRequest = extractTrierExtensionBatchArgs(item.content);

    if (batchRequest.items.length > 1) {
      return {
        type: 'batch',
        items: batchRequest.items,
      };
    }

    const args = extractTrierExtensionArgs(item.content);

    if (args.instance_url && args.client_token) {
      return {
        type: 'single',
        args,
      };
    }
  }

  return null;
}

function buildTrierExtensionConfirmationReply(args) {
  return [
    'Entendi assim para a extensão Trier:',
    '',
    `URL da instância: ${args.instance_url}`,
    `Token: ${maskToken(args.client_token)}`,
    '',
    'Se estiver correto, responda apenas "sim" que eu gero o build da extensão, empacoto o dist em ZIP e libero o download.',
    `${TRIER_SINGLE_CONFIRMATION_MARKER}.`,
  ].join('\n');
}

function buildTrierExtensionBatchConfirmationReply(items = []) {
  const lines = items.flatMap((item, index) => [
    `${index + 1}. URL da instância: ${item.instance_url}`,
    `Token: ${maskToken(item.client_token)}`,
    '',
  ]);

  return [
    `Entendi assim para o lote da extensão Trier (${items.length} item(ns)):`,
    '',
    ...lines,
    'Se estiver correto, responda apenas "sim" que eu gero os ZIPs das extensões e libero os downloads.',
    `${TRIER_BATCH_CONFIRMATION_MARKER}.`,
  ].join('\n');
}

function buildTrierExtensionReadyReply(functionResult) {
  return [
    'Perfeito. Gerei o ZIP instalável da extensão Trier a partir do build final.',
    'O download já está disponível.',
    'Se a URL vier sem / no final, eu normalizo automaticamente antes de gerar o build.',
    'Depois de baixar, extraia o ZIP e carregue a pasta no Chrome como extensão descompactada.',
  ].join('\n');
}

function buildTrierExtensionBatchReadyReply(functionResult) {
  const successLines = Array.isArray(functionResult?.results)
    ? functionResult.results.map(
        (result) =>
          `- ${
            result.details?.extensionDisplayName ||
            result.extensionDisplayName ||
            result.details?.instanceDisplayName ||
            result.instanceDisplayName
          }`,
      )
    : [];
  const failureLines = Array.isArray(functionResult?.failures)
    ? functionResult.failures.map(
        (failure) =>
          `- ${
            failure.extensionDisplayName ||
            failure.instanceDisplayName ||
            failure.instance_url
          }: ${failure.error}`,
      )
    : [];

  return [
    'Concluí o lote da extensão Trier.',
    successLines.length
      ? ['Extensões geradas com sucesso:', ...successLines].join('\n')
      : 'Nenhuma extensão foi gerada com sucesso.',
    failureLines.length
      ? ['', 'Falhas encontradas:', ...failureLines].join('\n')
      : '',
    '',
    'Os downloads disponíveis estão listados abaixo.',
    'Depois de baixar, extraia cada ZIP e carregue a pasta no Chrome como extensão descompactada.',
  ]
    .filter(Boolean)
    .join('\n');
}

function buildTrierExtensionMissingReply(args) {
  const missingFields = [];

  if (!args.instance_url) {
    missingFields.push('a URL da instância do cliente');
  }

  if (!args.client_token) {
    missingFields.push('o token da Trier');
  }

  const missingLabel =
    missingFields.length > 1
      ? `${missingFields.slice(0, -1).join(' e ')} e ${missingFields[missingFields.length - 1]}`
      : missingFields[0];

  return `Para a extensão Trier, preciso apenas de ${missingLabel}. Se a URL vier sem / no final, eu ajusto automaticamente.`;
}

function buildTrierExtensionBatchMissingReply(batchRequest) {
  const { urlCount = 0, tokenCount = 0, items = [] } = batchRequest || {};

  if (items.length > 1) {
    return '';
  }

  const mismatchMessage =
    urlCount || tokenCount
      ? `Recebi ${urlCount} URL(s) e ${tokenCount} token(s).`
      : 'Ainda não recebi nenhuma combinação completa de URL e token.';

  return [
    'Para gerar várias extensões Trier em um único pedido, preciso fechar todos os pares de URL e token.',
    mismatchMessage,
    '',
    'Se todas usarem a mesma URL, pode enviar uma única URL e vários tokens.',
    '',
    'Envie neste formato:',
    '1. url: https://cliente-a.atenderbem.com/ token: TOKEN_A',
    '2. url: https://cliente-b.atenderbem.com/ token: TOKEN_B',
    '3. url: https://cliente-c.atenderbem.com/ token: TOKEN_C',
    '',
    `${TRIER_BATCH_MISSING_MARKER}.`,
  ].join('\n');
}

function collectActionsFromFunctionResult(functionResult) {
  const actions = [];
  const seenActionKeys = new Set();

  function appendAction(action) {
    if (!action?.url) {
      return;
    }

    const actionKey = `${action.type || 'download'}:${action.url}:${action.label || ''}`;

    if (seenActionKeys.has(actionKey)) {
      return;
    }

    seenActionKeys.add(actionKey);
    actions.push(action);
  }

  appendAction(functionResult?.action);

  if (Array.isArray(functionResult?.actions)) {
    for (const action of functionResult.actions) {
      appendAction(action);
    }
  }

  return actions;
}

export async function postChatController(req, res) {
  const { message, history = [], sessionContext = {} } = req.body ?? {};

  if (typeof message !== 'string' || !message.trim()) {
    return res.status(400).json({
      message: 'O campo "message" é obrigatório.',
    });
  }

  const trace = [createTrace('Recebendo a mensagem do usuário.')];

  try {
    if (isAffirmativeMessage(message) && isPendingTrierConfirmation(history)) {
      const pendingRequest = findLatestTrierExtensionRequestFromHistory(history);

      if (!pendingRequest) {
        return res.status(200).json({
          reply:
            'Não encontrei os dados anteriores da extensão Trier no histórico. Pode me reenviar a URL e o token?',
          action: null,
          actions: [],
          trace: [],
        });
      }

      trace.push(createTrace('Confirmação da extensão Trier recebida.'));
      const functionName =
        pendingRequest.type === 'batch'
          ? 'configurar_extensao_trier_lote'
          : 'configurar_extensao_trier';
      const functionArgs =
        pendingRequest.type === 'batch'
          ? { items: pendingRequest.items }
          : pendingRequest.args;
      trace.push(createTrace('Executando configuração da extensão Trier.'));
      const functionResult = await executeFunction(
        functionName,
        functionArgs,
        sessionContext,
      );
      const actions = collectActionsFromFunctionResult(functionResult);

      if (Array.isArray(functionResult?.traceSteps)) {
        functionResult.traceSteps.forEach((step) => {
          trace.push(createTrace(step, 'success'));
        });
      }

      trace.push(
        createTrace(
          functionResult.traceMessage ||
            'Configuração da extensão Trier preparada.',
          'success',
        ),
      );

      return res.status(200).json({
        reply:
          pendingRequest.type === 'batch'
            ? buildTrierExtensionBatchReadyReply(functionResult)
            : buildTrierExtensionReadyReply(functionResult),
        action: actions[0] || functionResult.action || null,
        actions,
        trace,
      });
    }

    if (isPendingTrierBatchCompletion(history)) {
      const batchRequest = buildTrierBatchRequestFromHistory(history, message);

      if (batchRequest.items.length <= 1) {
        return res.status(200).json({
          reply: buildTrierExtensionBatchMissingReply(batchRequest),
          action: null,
          actions: [],
          trace: [],
        });
      }

      return res.status(200).json({
        reply: buildTrierExtensionBatchConfirmationReply(batchRequest.items),
        action: null,
        actions: [],
        trace: [],
      });
    }

    if (isTrierExtensionBatchIntent(message)) {
      const batchRequest = extractTrierExtensionBatchArgs(message);

      if (batchRequest.items.length <= 1) {
        return res.status(200).json({
          reply: buildTrierExtensionBatchMissingReply(batchRequest),
          action: null,
          actions: [],
          trace: [],
        });
      }

      return res.status(200).json({
        reply: buildTrierExtensionBatchConfirmationReply(batchRequest.items),
        action: null,
        actions: [],
        trace: [],
      });
    }

    if (isTrierExtensionIntent(message)) {
      const trierArgs = extractTrierExtensionArgs(message);

      if (!trierArgs.instance_url || !trierArgs.client_token) {
        return res.status(200).json({
          reply: buildTrierExtensionMissingReply(trierArgs),
          action: null,
          actions: [],
          trace: [],
        });
      }

      return res.status(200).json({
        reply: buildTrierExtensionConfirmationReply(trierArgs),
        action: null,
        actions: [],
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
    const actions = [];
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

        const functionActions = collectActionsFromFunctionResult(functionResult);

        if (functionActions.length) {
          actions.push(...functionActions);
          action = functionActions[0];
        } else if (functionResult?.action) {
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
            createTrace(`Tool ${functionCall.name} concluída.`, 'success'),
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
        ? 'Build gerado com sucesso. O download já está disponível.'
        : 'Não consegui gerar uma resposta final.');

    return res.status(200).json({
      reply,
      action: actions[0] || action,
      actions,
      trace: usedTools ? trace : [],
    });
  } catch (error) {
    logger.error('Falha ao processar /chat', {
      message: error.message,
      stack: error.stack,
    });

    trace.push(
      createTrace(
        'Ocorreu um erro interno ao processar a solicitação.',
        'error',
      ),
    );

    return res.status(500).json({
      reply:
        'Ocorreu um erro ao falar com a IA. Verifique a configuração da API e tente novamente.',
      action: null,
      actions: [],
      trace: [],
      error: error.message,
    });
  }
}
