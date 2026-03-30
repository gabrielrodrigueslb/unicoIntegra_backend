import axios from 'axios';
import {
  deleteCacheMetadata,
  getCacheMetadata,
  getProductsByCodesFromCache,
  getProductsFromCache,
  isCacheEmpty,
  removeProductsFromCache,
  saveProductsToCache,
  setCacheMetadata,
  upsertProductsToCache,
} from '@/cache/productCache';
import { eventBus } from '@/lib/event-bus';

export type PriceSource =
  | 'venda'
  | 'venda_desconto'
  | 'promocao'
  | 'melhor'
  | 'encarte';

export interface ProductInfo {
  codigo: number;
  nome: string;
  valorVenda: number;
  percentualDesconto: number;
  valorCusto: number;
  codigoBarras: number | string | null;
  quantidadeEstoque: number;
  ativo?: boolean;
  valorPromocao: number | null;
  valorMelhor: number | null;
  valorEncarte: number | null;
  valorFinal: number;
  origemPreco: PriceSource;
}

export interface Budget {
  productName: string;
  productCode: number;
  quantity: number;
  price: number;
  discount: number;
  total: number;
  hasDelivery: boolean;
  cep?: string;
  street?: string;
  number?: string;
  city?: string;
  state?: string;
  clientName: string;
  chatId: number;
  paymentMethod: string;
  taxEntrega?: string;
  cpfClient: string;
  neighborhood?: string;
}

interface ProductApiItem {
  codigo: number | string;
  nome: string;
  valorVenda: number | string;
  valorPromocao?: number | string | null;
  percentualDesconto?: number | string | null;
  valorCusto?: number | string | null;
  codigoBarras?: number | string | null;
  quantidadeEstoque?: number | string | null;
  ativo?: boolean;
}

interface DiscountFlatApiItem {
  codigoProduto: number | string;
  quantidadeProduto?: number | string | null;
  valorPromocao?: number | string | null;
  valorVenda?: number | string | null;
  percentualDesconto?: number | string | null;
}

interface DiscountCampaignApiItem {
  codigoEncarte?: number | string;
  nomeCampanha?: string;
  dataInicio?: string;
  dataFim?: string;
  produtosEncarte?: DiscountFlatApiItem[] | null;
}

type DiscountApiItem = DiscountFlatApiItem | DiscountCampaignApiItem;

function isExtensionRuntimeAvailable(): boolean {
  return typeof chrome !== 'undefined' && Boolean(chrome.runtime?.id);
}

const API_BASE_URL = isExtensionRuntimeAvailable()
  ? 'https://api-sgf-gateway.triersistemas.com.br'
  : '/api';

const INTEGRATION_BASE_PATH = '/sgfpod1/rest/integracao';
const PRODUCT_PAGE_SIZE = 900;
const DISCOUNT_PAGE_SIZE = 500;
const DEFAULT_REQUEST_TIMEOUT_MS = 30000;
const MAX_REQUEST_RETRIES = 2;
const LAST_SYNC_AT_KEY = 'products:lastSyncAt';
const PRODUCT_SYNC_AT_KEY = 'products:lastProductsSyncAt';
const MELHOR_SYNC_AT_KEY = 'products:lastMelhorSyncAt';
const ENCARTE_SYNC_AT_KEY = 'products:lastEncarteSyncAt';
const ENCARTE_BLOCKED_UNTIL_KEY = 'products:encarteBlockedUntil';
const ENCARTE_BACKOFF_MS = 1000 * 60 * 30;

const REVALIDATION_INTERVAL = 1000 * 60 * 10;
let syncPromise: Promise<ProductInfo[]> | null = null;

interface PaginatedFetchResult<T> {
  items: T[];
  isComplete: boolean;
}

interface SyncFeedResult<T> {
  data: T;
  isComplete: boolean;
}

function getAuthHeaders() {
  return {
    Authorization: `Bearer ${import.meta.env.VITE_CLIENT_TOKEN}`,
  };
}

function parseLooseNumber(value: unknown): number {
  if (typeof value === 'number') return value;
  if (typeof value !== 'string') return Number.NaN;

  const trimmed = value.trim();
  if (!trimmed) return Number.NaN;

  const normalized = trimmed
    .replace(/\s/g, '')
    .replace(/\.(?=\d{3}(\D|$))/g, '')
    .replace(',', '.');

  return Number(normalized);
}

function toCode(value: unknown): number | null {
  const code = parseLooseNumber(value);
  if (!Number.isFinite(code)) return null;
  return Math.trunc(code);
}

function toPositiveOrNull(value: unknown): number | null {
  const numeric = parseLooseNumber(value);
  if (!Number.isFinite(numeric) || numeric <= 0) return null;
  return Number(numeric.toFixed(2));
}

function toSafeNumber(value: unknown, fallback = 0): number {
  const numeric = parseLooseNumber(value);
  if (!Number.isFinite(numeric)) return fallback;
  return numeric;
}

function applyBaseDiscount(valorVenda: number, percentualDesconto: number): number {
  const normalizedDiscount = Math.min(Math.max(percentualDesconto || 0, 0), 100);
  return Number((valorVenda * (1 - normalizedDiscount / 100)).toFixed(2));
}

function resolveFinalPrice(args: {
  valorVenda: number;
  valorVendaComDesconto: number;
  valorPromocao: number | null;
  valorMelhor: number | null;
  valorEncarte: number | null;
}): { valorFinal: number; origemPreco: PriceSource } {
  const { valorVenda, valorVendaComDesconto, valorPromocao, valorMelhor, valorEncarte } = args;

  // Ordem explicitamente definida:
  // encarte > melhor > promocao > venda com desconto > venda
  if (valorEncarte && valorEncarte > 0) {
    return { valorFinal: Number(valorEncarte.toFixed(2)), origemPreco: 'encarte' };
  }

  if (valorMelhor && valorMelhor > 0) {
    return { valorFinal: Number(valorMelhor.toFixed(2)), origemPreco: 'melhor' };
  }

  if (valorPromocao && valorPromocao > 0) {
    return { valorFinal: Number(valorPromocao.toFixed(2)), origemPreco: 'promocao' };
  }

  if (
    valorVendaComDesconto > 0 &&
    valorVenda > 0 &&
    valorVendaComDesconto < valorVenda
  ) {
    return {
      valorFinal: Number(valorVendaComDesconto.toFixed(2)),
      origemPreco: 'venda_desconto',
    };
  }

  if (valorVenda > 0) {
    return { valorFinal: Number(valorVenda.toFixed(2)), origemPreco: 'venda' };
  }

  if (valorVendaComDesconto > 0) {
    return {
      valorFinal: Number(valorVendaComDesconto.toFixed(2)),
      origemPreco: 'venda_desconto',
    };
  }

  return { valorFinal: 0, origemPreco: 'venda' };
}

export function getEffectiveProductPrice(
  product: Pick<ProductInfo, 'valorFinal' | 'valorVenda' | 'percentualDesconto'>,
): number {
  const valorFinal = toPositiveOrNull(product.valorFinal);
  if (valorFinal) return valorFinal;

  const valorVenda = toSafeNumber(product.valorVenda);
  const percentualDesconto = toSafeNumber(product.percentualDesconto);
  return applyBaseDiscount(valorVenda, percentualDesconto);
}

function normalizeProduct(
  base: ProductApiItem,
  valorMelhor: number | null,
  valorEncarte: number | null,
): ProductInfo {
  const valorVenda = Number(toSafeNumber(base.valorVenda).toFixed(2));
  const valorPromocao = toPositiveOrNull(base.valorPromocao);
  const percentualDesconto = Number(toSafeNumber(base.percentualDesconto).toFixed(2));
  const valorCusto = Number(toSafeNumber(base.valorCusto).toFixed(2));
  const quantidadeEstoque = Number(toSafeNumber(base.quantidadeEstoque));

  const valorVendaComDesconto = applyBaseDiscount(valorVenda, percentualDesconto);
  const resolvedPrice = resolveFinalPrice({
    valorVenda,
    valorVendaComDesconto,
    valorPromocao,
    valorMelhor,
    valorEncarte,
  });

  const code = toCode(base.codigo);
  if (code === null) {
    throw new Error('Codigo de produto invalido recebido da API.');
  }

  return {
    codigo: code,
    nome: base.nome,
    valorVenda,
    percentualDesconto,
    valorCusto,
    codigoBarras: base.codigoBarras ?? null,
    quantidadeEstoque,
    ativo: base.ativo,
    valorPromocao,
    valorMelhor,
    valorEncarte,
    valorFinal: resolvedPrice.valorFinal,
    origemPreco: resolvedPrice.origemPreco,
  };
}

function productToApiLike(product: ProductInfo): ProductApiItem {
  return {
    codigo: product.codigo,
    nome: product.nome,
    valorVenda: product.valorVenda,
    valorPromocao: product.valorPromocao,
    percentualDesconto: product.percentualDesconto,
    valorCusto: product.valorCusto,
    codigoBarras: product.codigoBarras,
    quantidadeEstoque: product.quantidadeEstoque,
    ativo: product.ativo,
  };
}

function isDiscountFlatItem(item: DiscountApiItem): item is DiscountFlatApiItem {
  return Object.prototype.hasOwnProperty.call(item, 'codigoProduto');
}

function flattenDiscountItems(items: DiscountApiItem[]): DiscountFlatApiItem[] {
  const flattened: DiscountFlatApiItem[] = [];

  items.forEach((item) => {
    if (isDiscountFlatItem(item)) {
      flattened.push(item);
      return;
    }

    if (Array.isArray(item.produtosEncarte)) {
      item.produtosEncarte.forEach((productItem) => {
        if (productItem) {
          flattened.push(productItem);
        }
      });
    }
  });

  return flattened;
}

function extractDiscountValue(item: DiscountFlatApiItem): number | null {
  const promocao = toPositiveOrNull(item.valorPromocao);
  if (promocao) return promocao;

  const valorVenda = toPositiveOrNull(item.valorVenda);
  const percentualDesconto = toSafeNumber(item.percentualDesconto);
  if (!valorVenda || percentualDesconto <= 0) return null;

  return applyBaseDiscount(valorVenda, percentualDesconto);
}

function buildDiscountMap(items: DiscountApiItem[]): Map<number, number | null> {
  type DiscountCandidate = {
    value: number | null;
    quantity: number;
  };

  const discountsByCode = new Map<number, DiscountCandidate>();
  const normalizedItems = flattenDiscountItems(items);

  normalizedItems.forEach((item) => {
    const code = toCode(item.codigoProduto);
    if (code === null) return;

    const value = extractDiscountValue(item);
    const quantityRaw = toSafeNumber(item.quantidadeProduto, 1);
    const quantity = quantityRaw > 0 ? Math.trunc(quantityRaw) : 1;
    const previous = discountsByCode.get(code);

    if (previous === undefined) {
      discountsByCode.set(code, { value, quantity });
      return;
    }

    if (value === null) {
      return;
    }

    if (previous.value === null) {
      discountsByCode.set(code, { value, quantity });
      return;
    }

    const currentIsUnit = quantity === 1;
    const previousIsUnit = previous.quantity === 1;

    if (currentIsUnit && !previousIsUnit) {
      discountsByCode.set(code, { value, quantity });
      return;
    }

    if (currentIsUnit === previousIsUnit && value < previous.value) {
      discountsByCode.set(code, { value, quantity });
    }
  });

  const result = new Map<number, number | null>();
  discountsByCode.forEach((candidate, code) => {
    result.set(code, candidate.value);
  });

  return result;
}

function getAxiosStatusCode(error: unknown): number | null {
  if (!axios.isAxiosError(error)) return null;
  return error.response?.status ?? null;
}

function parseSyncTimestamp(value: string | null): number | null {
  if (!value) return null;

  // API format: yyyy-MM-ddTHH:mm:ss+0300
  const normalized = value.replace(
    /([+-]\d{2})(\d{2})$/,
    '$1:$2',
  );

  const parsed = Date.parse(normalized);
  if (Number.isNaN(parsed)) return null;

  return parsed;
}

async function shouldRunRevalidationNow(): Promise<boolean> {
  const lastSyncAt = await getCacheMetadata<string>(LAST_SYNC_AT_KEY);
  const lastSyncTimestamp = parseSyncTimestamp(lastSyncAt);

  if (lastSyncTimestamp === null) {
    return true;
  }

  return Date.now() - lastSyncTimestamp >= REVALIDATION_INTERVAL;
}

function isTemporaryGatewayFailure(status: number | null): boolean {
  if (status === null) return true;
  return [408, 429, 500, 502, 503, 504, 545, 554].includes(status);
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function getSyncCursor(key: string): Promise<string | null> {
  const explicitCursor = await getCacheMetadata<string>(key);
  if (explicitCursor) return explicitCursor;

  return getCacheMetadata<string>(LAST_SYNC_AT_KEY);
}

async function persistSyncProgress(args: {
  syncPoint: string;
  productsComplete?: boolean;
  melhorComplete?: boolean;
  encarteComplete?: boolean;
}): Promise<void> {
  const writes: Promise<void>[] = [];
  let hadSuccessfulFeed = false;

  if (args.productsComplete) {
    writes.push(setCacheMetadata(PRODUCT_SYNC_AT_KEY, args.syncPoint));
    hadSuccessfulFeed = true;
  }

  if (args.melhorComplete) {
    writes.push(setCacheMetadata(MELHOR_SYNC_AT_KEY, args.syncPoint));
    hadSuccessfulFeed = true;
  }

  if (args.encarteComplete) {
    writes.push(setCacheMetadata(ENCARTE_SYNC_AT_KEY, args.syncPoint));
    hadSuccessfulFeed = true;
  }

  if (hadSuccessfulFeed) {
    writes.push(setCacheMetadata(LAST_SYNC_AT_KEY, args.syncPoint));
  }

  await Promise.all(writes);
}

function describePendingFeeds(args: {
  productsComplete: boolean;
  melhorComplete: boolean;
  encarteComplete: boolean;
}): string[] {
  const pending: string[] = [];

  if (!args.productsComplete) pending.push('produtos');
  if (!args.melhorComplete) pending.push('melhor preco');
  if (!args.encarteComplete) pending.push('encarte');

  return pending;
}

interface FetchPaginatedOptions {
  pageSize?: number;
  progressLabel?: string;
  allowPartialOnPageError?: boolean;
  timeoutMs?: number;
}

async function requestPageWithRetry<T>(
  path: string,
  params: Record<string, unknown>,
  timeoutMs: number,
): Promise<T[]> {
  let lastError: unknown;

  for (let attempt = 1; attempt <= MAX_REQUEST_RETRIES; attempt += 1) {
    try {
      const response = await axios.get<T[]>(
        `${API_BASE_URL}${INTEGRATION_BASE_PATH}${path}`,
        {
          params,
          headers: getAuthHeaders(),
          timeout: timeoutMs,
        },
      );

      return response.data ?? [];
    } catch (error) {
      lastError = error;
      const status = getAxiosStatusCode(error);
      const shouldRetry = isTemporaryGatewayFailure(status);

      if (!shouldRetry || attempt === MAX_REQUEST_RETRIES) {
        break;
      }

      await sleep(350 * attempt);
    }
  }

  throw lastError;
}

async function fetchPaginated<T>(
  path: string,
  params: Record<string, unknown>,
  options: FetchPaginatedOptions = {},
): Promise<PaginatedFetchResult<T>> {
  const pageSize = options.pageSize ?? PRODUCT_PAGE_SIZE;
  const progressLabel = options.progressLabel;
  const allowPartialOnPageError = options.allowPartialOnPageError ?? false;
  const timeoutMs = options.timeoutMs ?? DEFAULT_REQUEST_TIMEOUT_MS;

  const allItems: T[] = [];
  let primeiroRegistro = 1;
  let isComplete = true;

  while (true) {
    let page: T[];

    try {
      page = await requestPageWithRetry<T>(
        path,
        {
          primeiroRegistro,
          quantidadeRegistros: pageSize,
          ...params,
        },
        timeoutMs,
      );
    } catch (error) {
      const status = getAxiosStatusCode(error);
      const hasPartialData = allItems.length > 0;

      if (allowPartialOnPageError && hasPartialData) {
        console.warn(
          `Falha na paginacao (${path}) na faixa ${primeiroRegistro}. ` +
          `Usando dados parciais ja baixados. Status: ${status ?? 'N/A'}.`,
        );
        isComplete = false;
        break;
      }

      throw error;
    }

    if (!page.length) break;

    allItems.push(...page);
    primeiroRegistro += pageSize;

    if (progressLabel) {
      eventBus.emit(
        'loading:status',
        `${allItems.length.toLocaleString('pt-BR')} ${progressLabel} carregados...`,
      );
    }

    if (page.length < pageSize) break;
  }

  return { items: allItems, isComplete };
}

async function fetchAllProducts(): Promise<ProductApiItem[]> {
  const result = await fetchPaginated<ProductApiItem>(
    '/produto/obter-v1',
    {
      ativo: true,
      integracaoEcommerce: true,
      processaCustoMedio: false,
    },
    {
      pageSize: PRODUCT_PAGE_SIZE,
      progressLabel: 'produtos',
      timeoutMs: 45000,
    },
  );

  return result.items;
}

async function fetchChangedProducts(
  dataInicial: string,
  dataFinal: string,
): Promise<PaginatedFetchResult<ProductApiItem>> {
  return fetchPaginated<ProductApiItem>(
    '/produto/obter-alterados-v1',
    {
      dataInicial,
      dataFinal,
    },
    {
      pageSize: PRODUCT_PAGE_SIZE,
      allowPartialOnPageError: true,
      timeoutMs: 35000,
    },
  );
}

async function fetchChangedProductsSafely(
  dataInicial: string,
  dataFinal: string,
): Promise<SyncFeedResult<ProductApiItem[]>> {
  try {
    const result = await fetchChangedProducts(dataInicial, dataFinal);
    return { data: result.items, isComplete: result.isComplete };
  } catch (error) {
    const status = getAxiosStatusCode(error);
    if (isTemporaryGatewayFailure(status)) {
      eventBus.emit(
        'loading:status',
        'Nao foi possivel consultar alteracoes de produtos agora. Mantendo cache atual.',
      );
      console.warn('Falha temporaria no endpoint de produtos alterados.', error);
      return { data: [], isComplete: false };
    }

    throw error;
  }
}

async function fetchAllMelhorDiscounts(): Promise<PaginatedFetchResult<DiscountApiItem>> {
  return fetchPaginated<DiscountApiItem>(
    '/produto/desconto/melhor/obter-v1',
    {},
    {
      pageSize: DISCOUNT_PAGE_SIZE,
      allowPartialOnPageError: true,
      timeoutMs: 30000,
    },
  );
}

async function fetchChangedMelhorDiscounts(
  dataInicial: string,
  dataFinal: string,
): Promise<PaginatedFetchResult<DiscountApiItem>> {
  return fetchPaginated<DiscountApiItem>(
    '/produto/desconto/melhor/obter-alterados-v1',
    {
      dataInicial,
      dataFinal,
    },
    {
      pageSize: DISCOUNT_PAGE_SIZE,
      allowPartialOnPageError: true,
      timeoutMs: 30000,
    },
  );
}

async function fetchAllEncarteDiscounts(): Promise<PaginatedFetchResult<DiscountApiItem>> {
  return fetchPaginated<DiscountApiItem>(
    '/produto/desconto/encarte/obter-v1',
    {},
    {
      pageSize: DISCOUNT_PAGE_SIZE,
      allowPartialOnPageError: true,
      timeoutMs: 30000,
    },
  );
}

async function fetchChangedEncarteDiscounts(
  dataInicial: string,
  dataFinal: string,
): Promise<PaginatedFetchResult<DiscountApiItem>> {
  return fetchPaginated<DiscountApiItem>(
    '/produto/desconto/encarte/obter-alterados-v1',
    {
      dataInicial,
      dataFinal,
    },
    {
      pageSize: DISCOUNT_PAGE_SIZE,
      allowPartialOnPageError: true,
      timeoutMs: 30000,
    },
  );
}

async function isEncarteTemporarilyBlocked(): Promise<boolean> {
  const blockedUntil = await getCacheMetadata<number>(ENCARTE_BLOCKED_UNTIL_KEY);
  if (!blockedUntil) return false;

  if (Date.now() >= blockedUntil) {
    await deleteCacheMetadata(ENCARTE_BLOCKED_UNTIL_KEY);
    return false;
  }

  return true;
}

async function blockEncarteTemporarily(): Promise<void> {
  await setCacheMetadata(ENCARTE_BLOCKED_UNTIL_KEY, Date.now() + ENCARTE_BACKOFF_MS);
}

async function fetchMelhorMapSafely(args: {
  dataInicial?: string;
  dataFinal?: string;
}): Promise<SyncFeedResult<Map<number, number | null>>> {
  const isIncremental = Boolean(args.dataInicial && args.dataFinal);

  try {
    const result = args.dataInicial && args.dataFinal
      ? await fetchChangedMelhorDiscounts(args.dataInicial, args.dataFinal)
      : await fetchAllMelhorDiscounts();

    return {
      data: buildDiscountMap(result.items),
      isComplete: result.isComplete,
    };
  } catch (error) {
    const status = getAxiosStatusCode(error);
    if (isIncremental && isTemporaryGatewayFailure(status)) {
      eventBus.emit(
        'loading:status',
        'Melhor preco indisponivel no momento (SGF offline/lento). Usando valor de venda.',
      );
      console.warn('Melhor preco indisponivel temporariamente.', error);
      return { data: new Map(), isComplete: false };
    }

    throw error;
  }
}

async function fetchEncarteMapSafely(args: {
  dataInicial?: string;
  dataFinal?: string;
}): Promise<SyncFeedResult<Map<number, number | null>>> {
  const isIncremental = Boolean(args.dataInicial && args.dataFinal);
  const blocked = await isEncarteTemporarilyBlocked();
  if (blocked) {
    if (!isIncremental) {
      throw new Error('Encarte bloqueado temporariamente para sincronizacao completa.');
    }

    eventBus.emit(
      'loading:status',
      'Encarte temporariamente indisponivel. Sincronizando com melhor preco e valor de venda.',
    );
    return { data: new Map(), isComplete: false };
  }

  try {
    const result = args.dataInicial && args.dataFinal
      ? await fetchChangedEncarteDiscounts(args.dataInicial, args.dataFinal)
      : await fetchAllEncarteDiscounts();

    await deleteCacheMetadata(ENCARTE_BLOCKED_UNTIL_KEY);
    return {
      data: buildDiscountMap(result.items),
      isComplete: result.isComplete,
    };
  } catch (error) {
    const status = getAxiosStatusCode(error);
    if (isIncremental && (status === 404 || isTemporaryGatewayFailure(status))) {
      await blockEncarteTemporarily();
      eventBus.emit(
        'loading:status',
        'Encarte indisponivel no momento. Usando melhor preco e valor de venda.',
      );
      console.warn('Endpoint de encarte indisponivel. Backoff aplicado.', error);
      return { data: new Map(), isComplete: false };
    }

    throw error;
  }
}

function mergeFullProducts(
  products: ProductApiItem[],
  melhorMap: Map<number, number | null>,
  encarteMap: Map<number, number | null>,
): ProductInfo[] {
  return products
    .filter((product) => product.ativo !== false)
    .map((product) => {
      const code = toCode(product.codigo);
      if (code === null) return null;

      return normalizeProduct(
        product,
        melhorMap.get(code) ?? null,
        encarteMap.get(code) ?? null,
      );
    })
    .filter((product): product is ProductInfo => Boolean(product));
}

async function runFullSync(): Promise<ProductInfo[]> {
  const syncPoint = formatDateForTrier();
  eventBus.emit('loading:status', 'Buscando dados completos na API...');

  try {
    // Base de produtos primeiro para reduzir concorrencia no SGF/gateway.
    const products = await fetchAllProducts();
    const melhorResult = await fetchMelhorMapSafely({});
    const encarteResult = await fetchEncarteMapSafely({});

    if (!melhorResult.isComplete || !encarteResult.isComplete) {
      throw new Error('Sincronizacao completa parcial detectada. Mantendo cache anterior.');
    }

    const mergedProducts = mergeFullProducts(
      products,
      melhorResult.data,
      encarteResult.data,
    );

    eventBus.emit('loading:status', 'Atualizando cache local...');
    await saveProductsToCache(mergedProducts);
    await persistSyncProgress({
      syncPoint,
      productsComplete: true,
      melhorComplete: true,
      encarteComplete: true,
    });

    eventBus.emit('products:updated', mergedProducts.length);
    eventBus.emit('loading:status', 'Sincronizacao completa concluida!');
    return mergedProducts;
  } catch (error) {
    const status = getAxiosStatusCode(error);
    const cachedProducts = await getProductsFromCache();

    if (cachedProducts.length > 0) {
      eventBus.emit(
        'loading:status',
        'API instavel no momento. Usando dados do cache local.',
      );
      console.warn(
        `Full sync falhou (status: ${status ?? 'N/A'}). Mantendo cache existente.`,
        error,
      );
      return cachedProducts;
    }

    throw error;
  }
}

async function runIncrementalSync(): Promise<ProductInfo[]> {
  const [productsCursor, melhorCursor, encarteCursor] = await Promise.all([
    getSyncCursor(PRODUCT_SYNC_AT_KEY),
    getSyncCursor(MELHOR_SYNC_AT_KEY),
    getSyncCursor(ENCARTE_SYNC_AT_KEY),
  ]);

  if (!productsCursor || !melhorCursor || !encarteCursor) {
    return runFullSync();
  }

  const dataFinal = formatDateForTrier();
  eventBus.emit('loading:status', 'Buscando alteracoes desde a ultima sincronizacao...');

  const [changedProductsResult, melhorResult, encarteResult] = await Promise.all([
    fetchChangedProductsSafely(productsCursor, dataFinal),
    fetchMelhorMapSafely({ dataInicial: melhorCursor, dataFinal }),
    fetchEncarteMapSafely({ dataInicial: encarteCursor, dataFinal }),
  ]);

  const changedProductMap = new Map<number, ProductApiItem>();
  changedProductsResult.data.forEach((product) => {
    const code = toCode(product.codigo);
    if (code !== null) {
      changedProductMap.set(code, product);
    }
  });

  const affectedCodes = new Set<number>([
    ...changedProductMap.keys(),
    ...melhorResult.data.keys(),
    ...encarteResult.data.keys(),
  ]);

  const pendingFeeds = describePendingFeeds({
    productsComplete: changedProductsResult.isComplete,
    melhorComplete: melhorResult.isComplete,
    encarteComplete: encarteResult.isComplete,
  });

  if (!affectedCodes.size) {
    await persistSyncProgress({
      syncPoint: dataFinal,
      productsComplete: changedProductsResult.isComplete,
      melhorComplete: melhorResult.isComplete,
      encarteComplete: encarteResult.isComplete,
    });
    eventBus.emit(
      'loading:status',
      pendingFeeds.length
        ? `Nenhuma alteracao aplicavel agora. Pendente: ${pendingFeeds.join(', ')}.`
        : 'Nenhuma alteracao encontrada.',
    );
    return getProductsFromCache();
  }

  const existingProducts = await getProductsByCodesFromCache([...affectedCodes]);
  const existingProductsMap = new Map<number, ProductInfo>(
    existingProducts.map((product) => [product.codigo, product]),
  );

  const productsToRemove: number[] = [];
  const productsToUpsert: ProductInfo[] = [];

  affectedCodes.forEach((code) => {
    const changedBase = changedProductMap.get(code);
    const currentProduct = existingProductsMap.get(code);

    if (changedBase?.ativo === false) {
      productsToRemove.push(code);
      return;
    }

    const baseProduct = changedBase ?? (currentProduct ? productToApiLike(currentProduct) : null);
    if (!baseProduct) {
      return;
    }

    const nextMelhor = melhorResult.data.has(code)
      ? melhorResult.data.get(code) ?? null
      : currentProduct?.valorMelhor ?? null;

    const nextEncarte = encarteResult.data.has(code)
      ? encarteResult.data.get(code) ?? null
      : currentProduct?.valorEncarte ?? null;

    productsToUpsert.push(normalizeProduct(baseProduct, nextMelhor, nextEncarte));
  });

  await Promise.all([
    upsertProductsToCache(productsToUpsert),
    removeProductsFromCache(productsToRemove),
  ]);

  await persistSyncProgress({
    syncPoint: dataFinal,
    productsComplete: changedProductsResult.isComplete,
    melhorComplete: melhorResult.isComplete,
    encarteComplete: encarteResult.isComplete,
  });

  const allProducts = await getProductsFromCache();
  eventBus.emit('products:updated', allProducts.length);
  eventBus.emit(
    'loading:status',
    pendingFeeds.length
      ? `Atualizacao parcial concluida (${productsToUpsert.length} atualizados). Pendente: ${pendingFeeds.join(', ')}.`
      : `Atualizacao incremental concluida (${productsToUpsert.length} atualizados).`,
  );

  return allProducts;
}

async function executeSync(mode: 'full' | 'incremental'): Promise<ProductInfo[]> {
  if (syncPromise) {
    return syncPromise;
  }

  syncPromise = (async () => {
    try {
      return mode === 'full' ? await runFullSync() : await runIncrementalSync();
    } finally {
      syncPromise = null;
    }
  })();

  return syncPromise;
}

export async function forceSync(): Promise<ProductInfo[]> {
  return executeSync('full');
}

export async function getProducts(): Promise<ProductInfo[]> {
  if (syncPromise) {
    return syncPromise;
  }

  const cacheIsEmpty = await isCacheEmpty();
  if (cacheIsEmpty) {
    return executeSync('full');
  }

  const shouldRevalidate = await shouldRunRevalidationNow();

  if (shouldRevalidate && navigator.onLine) {
    executeSync('incremental').catch((error) => {
      console.error('Revalidacao silenciosa falhou.', error);
    });
  }

  return getProductsFromCache();
}

function formatDateForTrier(date = new Date()) {
  const pad = (n: number) => String(n).padStart(2, '0');

  const yyyy = date.getFullYear();
  const MM = pad(date.getMonth() + 1);
  const dd = pad(date.getDate());
  const HH = pad(date.getHours());
  const mm = pad(date.getMinutes());
  const ss = pad(date.getSeconds());

  const offsetMin = date.getTimezoneOffset() * -1;
  const sign = offsetMin >= 0 ? '+' : '-';
  const oh = pad(Math.floor(Math.abs(offsetMin) / 60));
  const om = pad(Math.abs(offsetMin) % 60);

  return `${yyyy}-${MM}-${dd}T${HH}:${mm}:${ss}${sign}${oh}${om}`;
}

export async function sendToGoogleSheets(budgetItems: Budget[]) {
  if (!budgetItems.length) {
    console.error('sendToGoogleSheets chamada com array vazio.');
    return;
  }

  const primeiroItem = budgetItems[0];
  const numeroPedido = Math.floor(Date.now() / 1000);

  const produtos = budgetItems.map((item) => {
    const descontoValor = item.price * item.quantity * (item.discount / 100);

    return {
      codigoProduto: Number(item.productCode),
      nomeProduto: item.productName,
      quantidade: Number(item.quantity),
      valorUnitario: Number(item.price),
      valorDesconto: Number(descontoValor.toFixed(2)),
    };
  });

  const valorTotal = produtos.reduce((total, p) => {
    const subtotal = p.valorUnitario * p.quantidade;
    return total + (subtotal - p.valorDesconto);
  }, 0);

  const body = {
    numeroPedido,
    dataPedido: formatDateForTrier(),
    valorTotalVenda: Number(valorTotal.toFixed(2)),
    valorFrete: primeiroItem.hasDelivery
      ? Number(primeiroItem.taxEntrega ?? 0)
      : 0,
    entrega: Boolean(primeiroItem.hasDelivery),

    cliente: {
      codigo: '',
      nome: primeiroItem.clientName,
      numeroCpfCnpj: primeiroItem.cpfClient,
      numeroRGIE: null,
      dataNascimento: null,
      sexo: null,
      celular: null,
      fone: '',
      email: '',
    },

    enderecoEntrega: {
      logradouro: primeiroItem.street || 'Retirada em loja',
      numero: primeiroItem.number || 'S/N',
      complemento: '',
      referencia: null,
      bairro: primeiroItem.neighborhood || 'Loja',
      cidade: primeiroItem.city || 'N/A',
      estado: primeiroItem.state
        ? primeiroItem.state.slice(0, 2).toUpperCase()
        : '',
      cep: primeiroItem.cep || '13960000',
    },

    produtos,

    pagamento: {
      pagamentoRealizado: true,
      valorParcela: Number(valorTotal.toFixed(2)),
      dataVencimento: formatDateForTrier(),
      valorDinheiro: Number(valorTotal.toFixed(2)),
      valorTroco: 0,
      numeroAutorizacao: String(numeroPedido),
    },
  };

  const response = await axios.post(
    `${API_BASE_URL}/sgfpod1/rest/integracao/venda/ecommerce/efetuar-venda-v1`,
    body,
    {
      headers: getAuthHeaders(),
    },
  );

  if (![200, 204].includes(response.status)) {
    throw new Error('Failed to send data to API');
  }

  return response.data;
}
