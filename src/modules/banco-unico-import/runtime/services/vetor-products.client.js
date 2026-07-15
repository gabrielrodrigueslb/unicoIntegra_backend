import { pickFirstString } from "../utils/text.js";
import { normalizeEan } from "../utils/ean.js";

const DEFAULT_BASE_URL = "https://integracao.zetti.dev/api/ecommerce/produtos/consulta";
const DEFAULT_PAGE_SIZE = Math.max(1, Math.min(500, Number(process.env.VETOR_PRODUTOS_PAGE_SIZE || 500)));
const DEFAULT_TIMEOUT_MS = Number(process.env.VETOR_PRODUTOS_TIMEOUT_MS || 30000);

function buildApiKeyAuthorization(tokenOrAuthorization = "") {
  const trimmed = String(tokenOrAuthorization || "").trim();
  if (!trimmed) {
    return "";
  }

  return /^apikey\s+/i.test(trimmed) ? trimmed : `ApiKey ${trimmed}`;
}

function mapSourceProduct(product, index) {
  const idValue = product?.cdProduto ?? index;
  const numericId = Number(idValue);
  const nome = pickFirstString(product?.descricao, product?.descricaoUsual);

  return {
    id_produto: Number.isFinite(numericId) ? numericId : index,
    nome,
    nomeOriginal: nome,
    codigoBarras: normalizeEan(product?.codigoBarras),
    nomeLaboratorio: pickFirstString(product?.nomeFabricante, product?.nomeMarca),
    nomePrincipioAtivo: null,
    produtoOrigem: product,
  };
}

export class VetorProductsClient {
  constructor({
    baseUrl = process.env.VETOR_PRODUTOS_API_URL || DEFAULT_BASE_URL,
    token = "",
    unidade = "",
    pageSize = DEFAULT_PAGE_SIZE,
    timeoutMs = DEFAULT_TIMEOUT_MS,
  } = {}) {
    this.baseUrl = String(baseUrl || "").trim();
    this.authorization = buildApiKeyAuthorization(token);
    this.unidade = String(unidade ?? "").trim();
    // API caps $top at 500 records per page.
    this.pageSize = Math.max(1, Math.min(500, Number(pageSize || DEFAULT_PAGE_SIZE)));
    this.timeoutMs = Number(timeoutMs || DEFAULT_TIMEOUT_MS);
  }

  validateConfiguration() {
    if (!this.baseUrl) {
      throw new Error("VETOR_PRODUTOS_API_URL nao configurada.");
    }

    if (!this.authorization) {
      throw new Error("Token da API Vetor nao configurado.");
    }
  }

  describeSource() {
    return this.unidade ? `vetor://unidade-${this.unidade}` : "vetor://consulta-produtos";
  }

  buildUrl(skip) {
    const url = new URL(this.baseUrl);
    url.searchParams.set("$top", String(this.pageSize));
    url.searchParams.set("$skip", String(skip));
    url.searchParams.set("$count", "true");

    const filters = ["inativo eq false"];
    if (this.unidade) {
      filters.push(`cdFilial eq ${this.unidade}`);
    }
    url.searchParams.set("$filter", filters.join(" and "));

    return url;
  }

  async fetchPage(skip = 0) {
    this.validateConfiguration();

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.timeoutMs);

    try {
      const response = await fetch(this.buildUrl(skip), {
        method: "GET",
        headers: {
          accept: "application/json",
          authorization: this.authorization,
        },
        signal: controller.signal,
      });

      const bodyText = await response.text();
      const body = bodyText ? JSON.parse(bodyText) : null;

      if (!response.ok || Number(body?.status) >= 400) {
        const message = String(body?.msg || "").trim();
        const error = new Error(
          message ? `Falha na API de origem Vetor: ${message}` : `Falha na API de origem Vetor: HTTP ${response.status}`,
        );
        error.status = response.status;
        error.details = body;
        throw error;
      }

      const products = Array.isArray(body?.data) ? body.data : [];

      return {
        products,
        total: Number.isFinite(Number(body?.total)) ? Number(body.total) : null,
      };
    } finally {
      clearTimeout(timer);
    }
  }

  async fetchAllProducts() {
    this.validateConfiguration();

    const products = [];
    let skip = 0;
    let page = 0;

    while (true) {
      page += 1;
      const { products: pageProducts } = await this.fetchPage(skip);
      console.log(`API Vetor pagina ${page}: ${pageProducts.length} produto(s) recebidos.`);

      if (!pageProducts.length) {
        break;
      }

      products.push(
        ...pageProducts.map((product, index) => mapSourceProduct(product, skip + index)),
      );

      if (pageProducts.length < this.pageSize) {
        break;
      }

      skip += this.pageSize;
    }

    return products;
  }
}
