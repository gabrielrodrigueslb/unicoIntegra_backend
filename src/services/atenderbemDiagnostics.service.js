import axios from 'axios';

import { resolveInstanceExecutionCredentials } from './instanceExecutionAuth.services.js';
import loginInstance from './loginInstance.js';
import { createLogService } from './logs.services.js';

function normalizeUrl(url) {
  return String(url || '').trim().replace(/\/+$/, '');
}

function getHeaders(token) {
  return {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${token}`,
  };
}

function normalizeText(value) {
  return String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();
}

function normalizeId(value) {
  if (value === undefined || value === null || value === '') {
    return null;
  }

  const numericValue = Number(value);
  if (Number.isFinite(numericValue)) {
    return numericValue;
  }

  return String(value).trim();
}

function truncate(value, maxLength = 220) {
  const text = String(value || '').trim();
  if (text.length <= maxLength) {
    return text;
  }

  return `${text.slice(0, maxLength - 3).trimEnd()}...`;
}

function safeParseJsonString(value, fallbackValue = null) {
  if (typeof value !== 'string' || !value.trim()) {
    return fallbackValue;
  }

  try {
    return JSON.parse(value);
  } catch {
    return fallbackValue;
  }
}

function uniqueBy(items, buildKey) {
  const seen = new Set();
  const result = [];

  for (const item of items) {
    const key = buildKey(item);
    if (seen.has(key)) {
      continue;
    }

    seen.add(key);
    result.push(item);
  }

  return result;
}

function pickArray(value) {
  if (Array.isArray(value)) {
    return value;
  }

  if (!value || typeof value !== 'object') {
    return [];
  }

  for (const key of [
    'data',
    'items',
    'rows',
    'list',
    'result',
    'assistants',
    'queues',
    'ivrs',
    'messages',
    'chat',
  ]) {
    if (Array.isArray(value[key])) {
      return value[key];
    }
  }

  for (const nestedValue of Object.values(value)) {
    if (Array.isArray(nestedValue)) {
      return nestedValue;
    }
  }

  return [];
}

function isHtmlDocument(value) {
  return (
    typeof value === 'string' &&
    /<!doctype html>|<html[\s>]/i.test(value)
  );
}

async function authenticate(instance) {
  const resolved = resolveInstanceExecutionCredentials();
  const loginData = await loginInstance(
    instance,
    resolved.username,
    resolved.password,
    resolved.code2fa,
  );

  if (!loginData?.token) {
    throw new Error('Nao foi possivel autenticar na instancia do AtenderBem.');
  }

  return {
    token: loginData.token,
    authMode: resolved.mode,
  };
}

async function getFromInstance(instance, endpoint, token) {
  const response = await axios.get(`${instance}${endpoint}`, {
    headers: getHeaders(token),
  });

  return response.data;
}

async function postToInstance(instance, endpoint, payload, token) {
  const response = await axios.post(`${instance}${endpoint}`, payload, {
    headers: getHeaders(token),
  });

  return response.data;
}

async function getIvrDetail(instance, ivrId, token) {
  const response = await axios.get(`${instance}/ivrs/${ivrId}`, {
    headers: getHeaders(token),
    validateStatus: () => true,
  });

  return {
    status: response.status,
    contentType: response.headers['content-type'] || '',
    data: response.data,
  };
}

function findAssistant(assistants, { assistantId, assistantName }) {
  const targetId = normalizeId(assistantId);
  const targetName = normalizeText(assistantName);

  return (
    assistants.find((assistant) => {
      if (targetId !== null && normalizeId(assistant?.id) === targetId) {
        return true;
      }

      if (!targetName) {
        return false;
      }

      return (
        normalizeText(assistant?.name) === targetName ||
        normalizeText(assistant?.signaturename) === targetName
      );
    }) || null
  );
}

function parseQueueControlData(queue) {
  const parsed = safeParseJsonString(queue?.controldata, {});
  return parsed && typeof parsed === 'object' ? parsed : {};
}

function parseQueueTransferFilters(queue) {
  const parsed = safeParseJsonString(queue?.transferfilters, []);
  return Array.isArray(parsed) ? parsed : [];
}

function findQueue(queues, { queueId, queueName }) {
  const targetId = normalizeId(queueId);
  const targetName = normalizeText(queueName);

  return (
    queues.find((queue) => {
      if (targetId !== null && normalizeId(queue?.id) === targetId) {
        return true;
      }

      if (!targetName) {
        return false;
      }

      return normalizeText(queue?.name) === targetName;
    }) || null
  );
}

function summarizeAssistant(assistant) {
  if (!assistant || typeof assistant !== 'object') {
    return null;
  }

  const functions = Array.isArray(assistant.functions) ? assistant.functions : [];
  const procedures = Array.isArray(assistant.procedures) ? assistant.procedures : [];
  const presets = Array.isArray(assistant.presets) ? assistant.presets : [];

  return {
    id: assistant.id ?? null,
    name: assistant.name || null,
    signaturename: assistant.signaturename || null,
    type: assistant.type ?? null,
    preautomation: assistant.preautomation ?? null,
    postautomation: assistant.postautomation ?? null,
    waitfornewmsgs: assistant.waitfornewmsgs ?? null,
    msgslimit: assistant.msgslimit ?? null,
    description: truncate(assistant.description, 420),
    kbdescription: truncate(assistant.kbdescription, 320),
    functionsCount: functions.length,
    functions: functions.slice(0, 12).map((item) => ({
      id: item?.id || null,
      name: item?.name || null,
      automation: item?.automation ?? null,
      attrsCount: Array.isArray(item?.attrs) ? item.attrs.length : 0,
      description: truncate(item?.description, 180),
    })),
    proceduresCount: procedures.length,
    presetsCount: presets.length,
    variablesCount: Array.isArray(assistant.variables)
      ? assistant.variables.length
      : 0,
    fileCount: Array.isArray(assistant.files) ? assistant.files.length : 0,
  };
}

function summarizeQueue(queue) {
  if (!queue || typeof queue !== 'object') {
    return null;
  }

  const controlData = parseQueueControlData(queue);
  const webConfig =
    queue.webconfig && typeof queue.webconfig === 'object' ? queue.webconfig : {};

  return {
    id: queue.id ?? null,
    name: queue.name || null,
    type: queue.type ?? null,
    enabled: queue.enabled ?? null,
    status: queue.status ?? null,
    ivrid: queue.ivrid ?? null,
    apikey: queue.apikey ? `${String(queue.apikey).slice(0, 4)}***` : null,
    keywordtriggersCount: Array.isArray(queue.keywordtriggers)
      ? queue.keywordtriggers.length
      : 0,
    transferfilters: parseQueueTransferFilters(queue),
    webConfig: {
      queueId: webConfig.queueId ?? null,
      domain: webConfig.domain ?? null,
      showChat: webConfig.showChat ?? null,
      showHelp: webConfig.showHelp ?? null,
    },
    controlData: {
      queueId: controlData.queueId ?? null,
      loginUsername: controlData?.loginData?.username || null,
      firstLogin: controlData.firstLogin ?? null,
    },
  };
}

function summarizeIvrSummary(ivr) {
  if (!ivr || typeof ivr !== 'object') {
    return null;
  }

  return {
    id: ivr.id ?? null,
    name: ivr.name || null,
    type: ivr.type ?? null,
    allowmsgexecution: ivr.allowmsgexecution ?? null,
    allmsgs: ivr.allmsgs ?? null,
  };
}

function parseIvrOptions(detail) {
  const rawOptions = detail?.options;
  if (Array.isArray(rawOptions)) {
    return rawOptions;
  }

  return safeParseJsonString(rawOptions, []);
}

function inspectIvrDetail(detail, { assistant, queue } = {}) {
  if (!detail || typeof detail !== 'object') {
    return {
      inspectable: false,
      reason: 'IVR indisponivel.',
      evidence: [],
      optionCount: 0,
      directAssistantLink: false,
      directQueueLink: false,
    };
  }

  const options = parseIvrOptions(detail);
  const serialized = JSON.stringify(detail);
  const normalizedSerialized = normalizeText(serialized);
  const assistantId = normalizeId(assistant?.id);
  const assistantNames = [
    assistant?.name,
    assistant?.signaturename,
  ]
    .map((item) => normalizeText(item))
    .filter(Boolean);
  const queueId = normalizeId(queue?.id);
  const evidence = [];

  let directAssistantLink = false;
  let directQueueLink = false;

  for (const option of Array.isArray(options) ? options : []) {
    const optionType = Number(option?.type);
    const config = option?.config || {};

    if (
      assistantId !== null &&
      optionType === 77 &&
      normalizeId(config.assistantId) === assistantId
    ) {
      directAssistantLink = true;
      evidence.push(
        `Opcao do tipo 77 referencia assistantId ${assistantId} diretamente.`,
      );
    }

    if (
      queueId !== null &&
      optionType === 5 &&
      normalizeId(config.destinationId) === queueId
    ) {
      directQueueLink = true;
      evidence.push(
        `Opcao de transferencia referencia destinationId ${queueId}.`,
      );
    }
  }

  if (!directAssistantLink && assistantId !== null) {
    if (
      normalizedSerialized.includes(`\"assistantid\":${String(assistantId)}`) ||
      normalizedSerialized.includes(`assistantid ${String(assistantId)}`)
    ) {
      directAssistantLink = true;
      evidence.push(
        `O JSON completo da IVR contem referencia textual ao assistantId ${assistantId}.`,
      );
    }
  }

  if (!directAssistantLink && assistantNames.length) {
    const matchedName = assistantNames.find((item) =>
      normalizedSerialized.includes(item),
    );
    if (matchedName) {
      evidence.push(
        `O JSON completo da IVR contem referencia textual ao nome do assistant (${matchedName}).`,
      );
    }
  }

  return {
    inspectable: true,
    reason: null,
    evidence: uniqueBy(evidence, (item) => item),
    optionCount: Array.isArray(options) ? options.length : 0,
    directAssistantLink,
    directQueueLink,
  };
}

function buildQueueKeywords(queue) {
  const keywords = [];

  if (queue?.name) {
    keywords.push(queue.name);
  }

  const transferFilters = parseQueueTransferFilters(queue);
  for (const item of transferFilters) {
    if (typeof item === 'string' && item.trim()) {
      keywords.push(item);
    }
  }

  return uniqueBy(
    keywords
      .map((item) => normalizeText(item))
      .filter(Boolean),
    (item) => item,
  );
}

function summarizeIvrDetail(detailResult, inspectionResult, source = 'explicit') {
  if (!detailResult) {
    return null;
  }

  if (isHtmlDocument(detailResult.data)) {
    return {
      id: null,
      name: null,
      source,
      inspectable: false,
      reason:
        'O endpoint retornou HTML em vez de JSON estruturado; a IVR pode ser de outro tipo ou exigir rota diferente.',
    };
  }

  const detail = detailResult.data;

  return {
    id: detail?.id ?? null,
    name: detail?.name || null,
    type: detail?.type ?? null,
    timeout: detail?.timeout ?? null,
    waitmsgaiprocess: detail?.waitmsgaiprocess ?? null,
    locked: detail?.locked ?? null,
    source,
    inspectable: inspectionResult?.inspectable ?? false,
    optionCount: inspectionResult?.optionCount ?? 0,
    directAssistantLink: inspectionResult?.directAssistantLink ?? false,
    directQueueLink: inspectionResult?.directQueueLink ?? false,
    evidence: inspectionResult?.evidence ?? [],
  };
}

async function buildIvrDetailsMap(instance, token, ivrIds = []) {
  const results = await Promise.allSettled(
    uniqueBy(
      ivrIds
        .map((item) => normalizeId(item))
        .filter((item) => Number.isFinite(item) && item > 0),
      (item) => String(item),
    ).map(async (ivrId) => ({
      ivrId,
      detail: await getIvrDetail(instance, ivrId, token),
    })),
  );

  const map = new Map();

  for (const result of results) {
    if (result.status === 'fulfilled') {
      map.set(result.value.ivrId, result.value.detail);
    }
  }

  return map;
}

function collectMessageEntries(value, depth = 0) {
  if (depth > 5 || value === null || value === undefined) {
    return [];
  }

  if (Array.isArray(value)) {
    const directMatches = value.filter((entry) => {
      return (
        entry &&
        typeof entry === 'object' &&
        entry.id !== undefined &&
        (
          entry.text !== undefined ||
          entry.message !== undefined ||
          entry.body !== undefined ||
          entry.content !== undefined ||
          entry.msg !== undefined ||
          entry.type !== undefined
        )
      );
    });

    if (directMatches.length) {
      return directMatches;
    }

    return value.flatMap((item) => collectMessageEntries(item, depth + 1));
  }

  if (typeof value !== 'object') {
    return [];
  }

  return Object.values(value).flatMap((item) =>
    collectMessageEntries(item, depth + 1),
  );
}

function dedupeEntries(entries) {
  return uniqueBy(
    entries.filter((entry) => entry?.id !== undefined && entry?.id !== null),
    (entry) => String(entry.id),
  );
}

function inferDirection(entry) {
  if (entry?.out === true || entry?.fromMe === true || entry?.from_me === true) {
    return 'out';
  }

  if (entry?.out === false || entry?.fromMe === false || entry?.from_me === false) {
    return 'in';
  }

  if (typeof entry?.role === 'string') {
    return normalizeText(entry.role).includes('assistant') ? 'out' : 'in';
  }

  return 'unknown';
}

function getMessageText(entry) {
  return (
    entry?.text ??
    entry?.message ??
    entry?.body ??
    entry?.content ??
    entry?.msg ??
    entry?.info ??
    ''
  );
}

function summarizeChatEntries(entries) {
  const normalizedEntries = entries
    .map((entry) => ({
      id: entry?.id ?? null,
      type: entry?.type ?? null,
      direction: inferDirection(entry),
      text: truncate(getMessageText(entry), 220),
      createdAt:
        entry?.createdAt ??
        entry?.created_at ??
        entry?.date ??
        entry?.timestamp ??
        null,
    }))
    .filter((entry) => entry.id !== null);

  const outboundTexts = normalizedEntries
    .filter((entry) => entry.direction === 'out' && entry.text)
    .map((entry) => normalizeText(entry.text));

  const repeatedOutboundSnippets = [];
  const counts = new Map();
  for (const text of outboundTexts) {
    const nextCount = (counts.get(text) || 0) + 1;
    counts.set(text, nextCount);
    if (text && nextCount === 3) {
      repeatedOutboundSnippets.push(truncate(text, 120));
    }
  }

  let currentOutStreak = 0;
  let maxOutStreak = 0;
  for (const entry of normalizedEntries) {
    if (entry.direction === 'out') {
      currentOutStreak += 1;
      maxOutStreak = Math.max(maxOutStreak, currentOutStreak);
    } else {
      currentOutStreak = 0;
    }
  }

  return {
    totalMessages: normalizedEntries.length,
    inboundMessages: normalizedEntries.filter((entry) => entry.direction === 'in').length,
    outboundMessages: normalizedEntries.filter((entry) => entry.direction === 'out').length,
    maxOutboundStreak: maxOutStreak,
    repeatedOutboundSnippets,
    possibleLoop: repeatedOutboundSnippets.length > 0 || maxOutStreak >= 4,
    firstMessages: normalizedEntries.slice(0, 5),
    lastMessages: normalizedEntries.slice(-5),
  };
}

async function fetchCompleteChatHistory(instance, token, { chatId, queueId }) {
  if (!chatId || !queueId) {
    return null;
  }

  const initialResponse = await postToInstance(
    instance,
    '/api/getChat',
    {
      id: Number(chatId),
      all: true,
      queueId: Number(queueId),
      lastId: 0,
    },
    token,
  );

  let uniqueEntries = dedupeEntries(collectMessageEntries(initialResponse));
  let oldestId = uniqueEntries.reduce((lowest, entry) => {
    const numericId = Number(entry?.id);
    if (!Number.isFinite(numericId)) {
      return lowest;
    }

    return lowest === null || numericId < lowest ? numericId : lowest;
  }, null);
  let pageCount = 0;

  while (oldestId !== null && pageCount < 20) {
    const page = await postToInstance(
      instance,
      '/api/getPastMessages',
      {
        oldestId,
        chatId: Number(chatId),
      },
      token,
    );

    const pageEntries = dedupeEntries(collectMessageEntries(page));
    if (!pageEntries.length) {
      break;
    }

    const previousCount = uniqueEntries.length;
    uniqueEntries = dedupeEntries([...pageEntries, ...uniqueEntries]);
    if (uniqueEntries.length === previousCount) {
      break;
    }

    oldestId = pageEntries.reduce((lowest, entry) => {
      const numericId = Number(entry?.id);
      if (!Number.isFinite(numericId)) {
        return lowest;
      }

      return lowest === null || numericId < lowest ? numericId : lowest;
    }, oldestId);

    pageCount += 1;
  }

  return {
    totalPagesFetched: pageCount + 1,
    summary: summarizeChatEntries(uniqueEntries),
  };
}

function extractAtenderBemDiagnosticArgsFromMessage(message = '') {
  const normalizedMessage = normalizeText(message);
  const instanceMatch = message.match(/https?:\/\/[^\s)]+/i);
  const assistantIdMatch =
    message.match(/\b(?:ia|assistant|assistente)\D{0,20}\bid\D{0,10}(\d+)/i) ||
    message.match(/\b(?:estrutura|configuracao|diagnostico|verifique|inspecione)\D{0,30}\bia\D{0,20}(\d+)/i);
  const queueIdMatch = message.match(/\bfila\D{0,20}\bid\D{0,10}(\d+)/i);
  const ivrIdMatch = message.match(/\b(?:ura|ivr)\D{0,20}\bid\D{0,10}(\d+)/i);
  const chatIdMatch = message.match(/\b(?:chat|ticket|atendimento)\D{0,20}\bid\D{0,10}(\d+)/i);

  return {
    instance: instanceMatch ? normalizeUrl(instanceMatch[0]) : '',
    assistantId: assistantIdMatch?.[1] || '',
    queueId: queueIdMatch?.[1] || '',
    ivrId: ivrIdMatch?.[1] || '',
    chatId: chatIdMatch?.[1] || '',
    normalizedMessage,
  };
}

function isAtenderBemDiagnosticIntent(message = '') {
  const normalizedMessage = normalizeText(message);
  const mentionsAtenderBem =
    normalizedMessage.includes('atenderbem') ||
    normalizedMessage.includes('atender bem') ||
    normalizedMessage.includes('.atenderbem.com');
  const mentionsDiagnosticAction =
    normalizedMessage.includes('verifique') ||
    normalizedMessage.includes('verificar') ||
    normalizedMessage.includes('estrutura') ||
    normalizedMessage.includes('diagnost') ||
    normalizedMessage.includes('inspec') ||
    normalizedMessage.includes('auditar') ||
    normalizedMessage.includes('analisar');
  const mentionsTarget =
    normalizedMessage.includes('ia') ||
    normalizedMessage.includes('assistant') ||
    normalizedMessage.includes('assistente') ||
    normalizedMessage.includes('fila') ||
    normalizedMessage.includes('ura') ||
    normalizedMessage.includes('ivr') ||
    normalizedMessage.includes('chat') ||
    normalizedMessage.includes('ticket') ||
    normalizedMessage.includes('atendimento');

  return (mentionsAtenderBem || /https?:\/\/[^\s]+atenderbem\.com/i.test(message)) &&
    mentionsDiagnosticAction &&
    mentionsTarget;
}

function buildDirectDiagnosticReply(result) {
  const lines = [];
  const assistant = result.assistant;
  const queue = result.queue;
  const ivr = result.ivrDetail;
  const candidateQueues = Array.isArray(result.candidateQueues)
    ? result.candidateQueues
    : [];
  const findings = Array.isArray(result.findings) ? result.findings : [];

  lines.push(`Verifiquei a instancia \`${result.details.instance}\` em modo somente leitura.`);

  if (assistant) {
    lines.push('');
    lines.push('**Assistant**');
    lines.push(`- ID: **${assistant.id}**`);
    lines.push(`- Nome: **${assistant.name || assistant.signaturename || '-'}**`);
    lines.push(`- Signature: **${assistant.signaturename || '-'}**`);
    lines.push(`- Tipo: **${assistant.type ?? '-'}**`);
    lines.push(`- Preautomation: **${assistant.preautomation ?? '-'}**`);
    lines.push(`- Funcoes: **${assistant.functionsCount}**`);
  }

  if (queue) {
    lines.push('');
    lines.push('**Fila**');
    lines.push(`- ID: **${queue.id}**`);
    lines.push(`- Nome: **${queue.name || '-'}**`);
    lines.push(`- Tipo: **${queue.type ?? '-'}**`);
    lines.push(`- IVR principal: **${queue.ivrid ?? '-'}**`);
    lines.push(`- Keyword triggers: **${queue.keywordtriggersCount}**`);
  }

  if (ivr) {
    lines.push('');
    lines.push('**URA / IVR**');
    if (!ivr.inspectable) {
      lines.push(`- Inspecao inconclusiva: ${ivr.reason}`);
    } else {
      lines.push(`- ID: **${ivr.id}**`);
      lines.push(`- Nome: **${ivr.name || '-'}**`);
      lines.push(`- Tipo: **${ivr.type ?? '-'}**`);
      lines.push(`- Opcoes: **${ivr.optionCount}**`);
      lines.push(`- Vinculo direto com assistant: **${ivr.directAssistantLink ? 'sim' : 'nao'}**`);
      lines.push(`- Vinculo direto com fila: **${ivr.directQueueLink ? 'sim' : 'nao'}**`);
      if (ivr.evidence?.length) {
        lines.push('- Evidencias:');
        for (const evidence of ivr.evidence.slice(0, 4)) {
          lines.push(`  - ${evidence}`);
        }
      }
    }
  }

  if (candidateQueues.length) {
    lines.push('');
    lines.push('**Filas candidatas relacionadas**');
    for (const candidate of candidateQueues.slice(0, 5)) {
      lines.push(
        `- Fila **${candidate.name || candidate.id}** (id ${candidate.id}) com IVR ${candidate.ivrid ?? '-'} e confianca **${candidate.linkConfidence}**`,
      );
    }
  }

  if (result.chatHistory?.summary) {
    const chat = result.chatHistory.summary;
    lines.push('');
    lines.push('**Chat auditado**');
    lines.push(`- Total de mensagens: **${chat.totalMessages}**`);
    lines.push(`- Entrada: **${chat.inboundMessages}** | Saida: **${chat.outboundMessages}**`);
    lines.push(`- Maior sequencia de saidas: **${chat.maxOutboundStreak}**`);
    lines.push(`- Possivel loop: **${chat.possibleLoop ? 'sim' : 'nao'}**`);
  }

  lines.push('');
  lines.push('**Laudo**');
  if (findings.length) {
    for (const finding of findings) {
      lines.push(`- ${finding}`);
    }
  } else {
    lines.push('- Nao encontrei inconsistencias operacionais evidentes com os identificadores informados.');
  }

  return lines.join('\n');
}

export async function diagnosticarAtenderBem(args = {}, executionContext = {}) {
  if (!args.instance || !String(args.instance).trim()) {
    throw new Error('Informe a URL da instancia do AtenderBem.');
  }

  const assistantRequested = Boolean(args.assistantId || args.assistantName);
  const queueRequested = Boolean(args.queueId || args.queueName);
  const ivrRequested = Boolean(args.ivrId);
  const chatRequested = Boolean(args.chatId);

  if (!assistantRequested && !queueRequested && !ivrRequested && !chatRequested) {
    throw new Error(
      'Informe ao menos um identificador para diagnostico: assistantId, assistantName, queueId, queueName, ivrId ou chatId.',
    );
  }

  const instance = normalizeUrl(args.instance);
  const traceSteps = [
    `Validando a instancia ${instance}.`,
    'Iniciando autenticacao com a conta de servico do backend.',
  ];

  const { token, authMode } = await authenticate(instance);
  traceSteps.push(
    authMode === 'service-account'
      ? 'Autenticacao concluida com a conta de servico e TOTP automatico.'
      : 'Autenticacao concluida com credenciais manuais.',
  );
  traceSteps.push('Lendo assistants, filas e IVRs da instancia em modo somente leitura.');

  const [assistantsResponse, queuesResponse, ivrsResponse] = await Promise.all([
    postToInstance(instance, '/assistants/getItems', { full: true }, token),
    getFromInstance(instance, '/queues', token),
    getFromInstance(instance, '/ivrs/getResumedList', token),
  ]);

  const assistants = pickArray(assistantsResponse);
  const queues = pickArray(queuesResponse);
  const ivrs = pickArray(ivrsResponse);
  traceSteps.push(
    `Leitura base concluida: ${assistants.length} assistants, ${queues.length} filas e ${ivrs.length} IVRs localizados.`,
  );

  const assistantRaw = findAssistant(assistants, args);
  const queueRaw = findQueue(queues, args);
  const explicitIvrSummary = ivrRequested
    ? ivrs.find((item) => normalizeId(item?.id) === normalizeId(args.ivrId)) || null
    : null;

  if (assistantRequested) {
    traceSteps.push(
      assistantRaw
        ? `Assistant localizado: ${assistantRaw.name || assistantRaw.signaturename || assistantRaw.id}.`
        : 'Nenhum assistant correspondente foi localizado pelos filtros informados.',
    );
  }

  if (queueRequested) {
    traceSteps.push(
      queueRaw
        ? `Fila localizada: ${queueRaw.name || queueRaw.id}.`
        : 'Nenhuma fila correspondente foi localizada pelos filtros informados.',
    );
  }

  if (ivrRequested) {
    traceSteps.push(
      explicitIvrSummary
        ? `IVR localizada na lista resumida: ${explicitIvrSummary.name || explicitIvrSummary.id}.`
        : 'Nenhuma IVR correspondente foi localizada na lista resumida.',
    );
  }

  const candidateQueueIvrs = [];
  if (queueRaw?.ivrid) {
    candidateQueueIvrs.push(queueRaw.ivrid);
  }
  if (args.ivrId) {
    candidateQueueIvrs.push(args.ivrId);
  }

  let candidateQueues = [];
  if (assistantRaw && !queueRaw) {
    const queueIvrIds = queues
      .map((queue) => normalizeId(queue?.ivrid))
      .filter((value) => Number.isFinite(value) && value > 0);
    const ivrDetailsMap = await buildIvrDetailsMap(instance, token, queueIvrIds);

    candidateQueues = queues
      .map((queue) => {
        const ivrId = normalizeId(queue?.ivrid);
        if (!Number.isFinite(ivrId) || ivrId <= 0) {
          return null;
        }

        const detailResult = ivrDetailsMap.get(ivrId);
        if (!detailResult || isHtmlDocument(detailResult.data)) {
          return null;
        }

        const inspection = inspectIvrDetail(detailResult.data, {
          assistant: assistantRaw,
          queue,
        });

        const queueKeywords = buildQueueKeywords(queue);
        const nameHit = queueKeywords.some((keyword) => {
          return [
            assistantRaw?.name,
            assistantRaw?.signaturename,
          ]
            .map((item) => normalizeText(item))
            .filter(Boolean)
            .some((assistantName) => keyword.includes(assistantName));
        });

        if (!inspection.directAssistantLink && !nameHit && !inspection.evidence.length) {
          return null;
        }

        return {
          id: queue.id ?? null,
          name: queue.name || null,
          ivrid: queue.ivrid ?? null,
          linkConfidence: inspection.directAssistantLink
            ? 'alta'
            : nameHit
              ? 'media'
              : 'baixa',
          evidence: inspection.evidence,
        };
      })
      .filter(Boolean);

    if (candidateQueues.length) {
      traceSteps.push(
        `${candidateQueues.length} fila(s) candidata(s) com indicio de vinculacao ao assistant foram encontradas.`,
      );
    } else {
      traceSteps.push(
        'Nao apareceu fila com vinculo evidente ao assistant na varredura deterministica das IVRs principais.',
      );
    }
  }

  const ivrIdsToInspect = uniqueBy(
    [
      normalizeId(args.ivrId),
      normalizeId(queueRaw?.ivrid),
      ...candidateQueues.map((item) => normalizeId(item?.ivrid)),
    ].filter((item) => Number.isFinite(item) && item > 0),
    (item) => String(item),
  );

  const ivrDetailsMap = await buildIvrDetailsMap(instance, token, ivrIdsToInspect);
  let ivrDetail = null;

  if (normalizeId(args.ivrId) !== null) {
    const detailResult = ivrDetailsMap.get(normalizeId(args.ivrId));
    if (detailResult) {
      const inspected = isHtmlDocument(detailResult.data)
        ? null
        : inspectIvrDetail(detailResult.data, {
            assistant: assistantRaw,
            queue: queueRaw,
          });
      ivrDetail = summarizeIvrDetail(detailResult, inspected, 'explicit');
    }
  } else if (queueRaw?.ivrid) {
    const detailResult = ivrDetailsMap.get(normalizeId(queueRaw.ivrid));
    if (detailResult) {
      const inspected = isHtmlDocument(detailResult.data)
        ? null
        : inspectIvrDetail(detailResult.data, {
            assistant: assistantRaw,
            queue: queueRaw,
          });
      ivrDetail = summarizeIvrDetail(detailResult, inspected, 'queue-primary');
    }
  }

  if (ivrDetail?.inspectable) {
    traceSteps.push(
      `IVR detalhada inspecionada: ${ivrDetail.name || ivrDetail.id}.`,
    );
  } else if (ivrDetail?.reason) {
    traceSteps.push(ivrDetail.reason);
  }

  const effectiveQueueId =
    args.queueId ??
    queueRaw?.id ??
    (candidateQueues.length === 1 ? candidateQueues[0].id : null);

  if (chatRequested && effectiveQueueId) {
    traceSteps.push(
      `Carregando o historico completo do chat ${args.chatId} usando a fila ${effectiveQueueId}.`,
    );
  } else if (chatRequested) {
    traceSteps.push(
      'O chat foi solicitado, mas faltou uma fila resolvida de forma confiavel para auditar o historico completo.',
    );
  }

  const chatHistory = await fetchCompleteChatHistory(instance, token, {
    chatId: args.chatId,
    queueId: effectiveQueueId,
  });

  if (chatHistory?.summary) {
    traceSteps.push(
      `Historico consolidado com ${chatHistory.summary.totalMessages} mensagens em ${chatHistory.totalPagesFetched} chamada(s).`,
    );
    if (chatHistory.summary.possibleLoop) {
      traceSteps.push('O historico apresentou sinal de loop ou repeticao automatica de mensagens.');
    }
  }

  const findings = [];

  if (assistantRequested && !assistantRaw) {
    findings.push('Nao encontrei o assistant solicitado na instancia.');
  }

  if (queueRequested && !queueRaw) {
    findings.push('Nao encontrei a fila solicitada na instancia.');
  }

  if (ivrRequested && !explicitIvrSummary) {
    findings.push('Nao encontrei a IVR solicitada na lista resumida da instancia.');
  }

  if (queueRaw && ivrDetail && !ivrDetail.inspectable) {
    findings.push(
      'A fila possui IVR principal definida, mas a inspecao detalhada dela foi inconclusiva porque o endpoint retornou HTML em vez de JSON estruturado.',
    );
  }

  if (assistantRaw && queueRaw && ivrDetail?.inspectable && !ivrDetail.directAssistantLink) {
    findings.push(
      'Nao apareceu, na IVR principal da fila, uma referencia direta ao assistant informado. O vinculo pode estar em outra URA, em automacao intermediaria ou nao existir.',
    );
  }

  if (assistantRaw && !queueRaw && candidateQueues.length > 1) {
    findings.push(
      'Ha mais de uma fila candidata relacionada ao assistant, entao o vinculo operacional ainda precisa de desambiguacao.',
    );
  }

  if (chatRequested && !effectiveQueueId) {
    findings.push(
      'Nao foi possivel auditar o chat porque faltou uma fila confiavel para usar no getChat/getPastMessages.',
    );
  }

  if (chatHistory?.summary?.possibleLoop) {
    findings.push(
      'O historico do chat sugere loop ou repeticao automatica de mensagens.',
    );
  }

  traceSteps.push(
    findings.length
      ? `Diagnostico consolidado com ${findings.length} apontamento(s).`
      : 'Diagnostico consolidado sem inconsistencias operacionais evidentes.',
  );

  const operatorName =
    executionContext?.operatorName ||
    executionContext?.authUsername ||
    'Link AI';

  await createLogService(operatorName, 'Executou diagnostico AtenderBem', instance, {
    generatedByAi: true,
    source: 'Link AI',
  });

  const result = {
    sucesso: true,
    traceMessage: 'Diagnostico AtenderBem concluido em modo somente leitura.',
    resultSummary: 'Leitura operacional do tenant concluida sem alterar dados.',
    details: {
      instance,
      authMode,
      requested: {
        assistantId: args.assistantId ?? null,
        assistantName: args.assistantName ?? null,
        queueId: args.queueId ?? null,
        queueName: args.queueName ?? null,
        ivrId: args.ivrId ?? null,
        chatId: args.chatId ?? null,
      },
      counts: {
        assistants: assistants.length,
        queues: queues.length,
        ivrs: ivrs.length,
      },
    },
    traceSteps,
    findings,
    assistant: summarizeAssistant(assistantRaw),
    queue: summarizeQueue(queueRaw),
    candidateQueues,
    ivrSummary: summarizeIvrSummary(explicitIvrSummary),
    ivrDetail,
    chatHistory,
  };

  return {
    ...result,
    reply: buildDirectDiagnosticReply(result),
  };
}

export {
  buildDirectDiagnosticReply,
  extractAtenderBemDiagnosticArgsFromMessage,
  isAtenderBemDiagnosticIntent,
};
