import { pickFirstString } from "../utils/text.js";
import { normalizeEan } from "../utils/ean.js";

const DEFAULT_PAGE_SIZE = Math.max(1, Number(process.env.TRIER_PRODUTOS_PAGE_SIZE || 999));
const DEFAULT_BASE_URL = "https://api-sgf-gateway.triersistemas.com.br/sgfpod1/rest/integracao/produto/obter-todos-v1";
const DEFAULT_RETRY_COUNT = Math.max(0, Number(process.env.TRIER_PRODUTOS_RETRY_COUNT || 3));
const DEFAULT_RETRY_BASE_DELAY_MS = Math.max(0, Number(process.env.TRIER_PRODUTOS_RETRY_BASE_DELAY_MS || 1500));
const DEFAULT_RETRY_MAX_DELAY_MS = Math.max(DEFAULT_RETRY_BASE_DELAY_MS, Number(process.env.TRIER_PRODUTOS_RETRY_MAX_DELAY_MS || 10000));

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function isRetryableStatus(status) {
  return [408, 425, 429, 500, 502, 503, 504, 545].includes(Number(status));
}

function isRetryableError(error) {
  if (!error) {
    return false;
  }

  if (typeof error.status === "number" && isRetryableStatus(error.status)) {
    return true;
  }

  if (error.name === "AbortError") {
    return true;
  }

  return /fetch failed|network|timeout|socket|econnreset|econnrefused|etimedout/i.test(
    String(error.message || ""),
  );
}

function computeRetryDelay(attempt, baseDelayMs, maxDelayMs) {
  const delay = baseDelayMs * (2 ** Math.max(0, attempt - 1));
  return Math.min(delay, maxDelayMs);
}

function buildHttpErrorMessage(status, body) {
  const detailsMessage = String(body?.message || '').trim();

  if (Number(status) === 545) {
    const hint =
      'Verifique se a URL da API Trier usa o sgfpod correto para este cliente e se o SGF esta aceitando conexoes.';
    return detailsMessage
      ? `Falha na API de origem Trier: HTTP 545 - ${detailsMessage}. ${hint}`
      : `Falha na API de origem Trier: HTTP 545. ${hint}`;
  }

  return `Falha na API de origem Trier: HTTP ${status}`;
}

function parseBoolean(value, fallback) {
  if (typeof value === "boolean") {
    return value;
  }

  if (typeof value === "string") {
    const normalized = value.trim().toLowerCase();
    if (normalized === "true") return true;
    if (normalized === "false") return false;
  }

  return fallback;
}

function buildBearerAuthorization(tokenOrAuthorization = "") {
  const trimmed = String(tokenOrAuthorization || "").trim();
  if (!trimmed) {
    return "";
  }

  return /^bearer\s+/i.test(trimmed) ? trimmed : `Bearer ${trimmed}`;
}

function extractArrayFromPayload(payload) {
  if (Array.isArray(payload)) {
    return payload;
  }

  if (!payload || typeof payload !== "object") {
    return [];
  }

  const preferredKeys = [
    "produtos",
    "products",
    "itens",
    "items",
    "dados",
    "data",
    "resultado",
    "result",
    "retorno",
    "content",
    "records",
  ];

  for (const key of preferredKeys) {
    if (Array.isArray(payload[key])) {
      return payload[key];
    }
  }

  for (const value of Object.values(payload)) {
    if (Array.isArray(value)) {
      return value;
    }

    if (value && typeof value === "object") {
      for (const nestedValue of Object.values(value)) {
        if (Array.isArray(nestedValue)) {
          return nestedValue;
        }
      }
    }
  }

  return [];
}

function pickEan(product) {
  const candidates = [
    product?.codigoBarras,
    product?.codigoBarra,
    product?.codigoDeBarras,
    product?.ean,
    product?.gtin,
  ];

  for (const candidate of candidates) {
    const normalized = normalizeEan(candidate);
    if (normalized) {
      return normalized;
    }
  }

  return null;
}

function mapSourceProduct(product, index) {
  const idValue = product?.id_produto ?? product?.idProduto ?? product?.produtoId ?? product?.id ?? index;
  const numericId = Number(idValue);

  return {
    id_produto: Number.isFinite(numericId) ? numericId : index,
    nome: pickFirstString(
      product?.nome,
      product?.nomeProduto,
      product?.descricao,
      product?.descricaoProduto,
      product?.descricaoResumida,
    ),
    nomeOriginal: pickFirstString(
      product?.nome,
      product?.nomeProduto,
      product?.descricao,
      product?.descricaoProduto,
      product?.descricaoResumida,
    ),
    codigoBarras: pickEan(product),
    nomeLaboratorio: pickFirstString(
      product?.nomeLaboratorio,
      product?.laboratorio,
      product?.fabricante,
      product?.nomeFabricante,
    ),
    nomePrincipioAtivo: pickFirstString(
      product?.nomePrincipioAtivo,
      product?.principioAtivo,
      product?.descricaoPrincipioAtivo,
      product?.ativo,
    ),
    produtoOrigem: product,
  };
}

export class TrierProductsClient {
  constructor({
    baseUrl = process.env.TRIER_PRODUTOS_API_URL || DEFAULT_BASE_URL,
    token = process.env.TRIER_PRODUTOS_API_TOKEN || "",
    pageSize = DEFAULT_PAGE_SIZE,
    ativo = parseBoolean(process.env.TRIER_PRODUTOS_ATIVO, true),
    integracaoEcommerce = parseBoolean(process.env.TRIER_PRODUTOS_INTEGRACAO_ECOMMERCE, true),
    processaCustoMedio = parseBoolean(process.env.TRIER_PRODUTOS_PROCESSA_CUSTO_MEDIO, false),
    timeoutMs = Number(process.env.TRIER_PRODUTOS_TIMEOUT_MS || 30000),
    retryCount = DEFAULT_RETRY_COUNT,
    retryBaseDelayMs = DEFAULT_RETRY_BASE_DELAY_MS,
    retryMaxDelayMs = DEFAULT_RETRY_MAX_DELAY_MS,
  } = {}) {
    this.baseUrl = String(baseUrl || "").trim();
    this.authorization = buildBearerAuthorization(token);
    this.pageSize = Math.max(1, Number(pageSize || DEFAULT_PAGE_SIZE));
    this.ativo = Boolean(ativo);
    this.integracaoEcommerce = Boolean(integracaoEcommerce);
    this.processaCustoMedio = Boolean(processaCustoMedio);
    this.timeoutMs = Number(timeoutMs || 30000);
    this.retryCount = Math.max(0, Number(retryCount || 0));
    this.retryBaseDelayMs = Math.max(0, Number(retryBaseDelayMs || 0));
    this.retryMaxDelayMs = Math.max(this.retryBaseDelayMs, Number(retryMaxDelayMs || this.retryBaseDelayMs));
  }

  validateConfiguration() {
    if (!this.baseUrl) {
      throw new Error("TRIER_PRODUTOS_API_URL nao configurada.");
    }

    if (!this.authorization) {
      throw new Error("TRIER_PRODUTOS_API_TOKEN nao configurado.");
    }
  }

  buildUrl(primeiroRegistro) {
    const url = new URL(this.baseUrl);
    url.searchParams.set("primeiroRegistro", String(primeiroRegistro));
    url.searchParams.set("quantidadeRegistros", String(this.pageSize));
    url.searchParams.set("ativo", String(this.ativo));
    url.searchParams.set("integracaoEcommerce", String(this.integracaoEcommerce));
    url.searchParams.set("processaCustoMedio", String(this.processaCustoMedio));
    return url;
  }

  async requestJson(url, options = {}) {
    let attempt = 0;

    while (true) {
      attempt += 1;
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), this.timeoutMs);

      try {
        const response = await fetch(url, {
          method: "GET",
          headers: {
            accept: "application/json",
            authorization: this.authorization,
          },
          signal: controller.signal,
        });

        const bodyText = await response.text();
        const body = bodyText ? JSON.parse(bodyText) : null;

        if (!response.ok) {
          const error = new Error(buildHttpErrorMessage(response.status, body));
          error.status = response.status;
          error.details = body;
          throw error;
        }

        return body;
      } catch (error) {
        const canRetry =
          attempt <= this.retryCount &&
          isRetryableError(error);

        if (!canRetry) {
          throw error;
        }

        const delayMs = computeRetryDelay(
          attempt,
          this.retryBaseDelayMs,
          this.retryMaxDelayMs,
        );

        if (typeof options.onRetry === "function") {
          await options.onRetry({
            attempt,
            delayMs,
            error,
          });
        }

        await sleep(delayMs);
      } finally {
        clearTimeout(timer);
      }
    }
  }

  async fetchPage(primeiroRegistro = 0, options = {}) {
    this.validateConfiguration();
    const payload = await this.requestJson(this.buildUrl(primeiroRegistro), options);
    const products = extractArrayFromPayload(payload);

    return {
      payload,
      products,
    };
  }

  async fetchAllProducts(options = {}) {
    this.validateConfiguration();

    const products = [];
    let primeiroRegistro = 0;
    let page = 0;

    while (true) {
      if (typeof options.shouldContinue === "function") {
        options.shouldContinue();
      }

      page += 1;
      const { products: pageProducts } = await this.fetchPage(primeiroRegistro, {
        onRetry: options.onRetry
          ? (retry) => options.onRetry({ ...retry, page, primeiroRegistro })
          : undefined,
      });
      console.log(`API Trier pagina ${page}: ${pageProducts.length} produto(s) recebidos.`);

      if (typeof options.onPage === "function") {
        await options.onPage({
          page,
          count: pageProducts.length,
          loaded: products.length + pageProducts.length,
          primeiroRegistro,
          products: pageProducts.map((product, index) =>
            mapSourceProduct(product, primeiroRegistro + index),
          ),
        });
      }

      if (!pageProducts.length) {
        break;
      }

      products.push(
        ...pageProducts.map((product, index) => mapSourceProduct(product, primeiroRegistro + index)),
      );

      if (pageProducts.length < this.pageSize) {
        break;
      }

      primeiroRegistro += this.pageSize;
    }

    return products;
  }
}
