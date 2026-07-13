export class BancoUnicoClient {
  constructor({
    baseUrl = process.env.BANCO_UNICO_BASE_URL || "https://unicocontato.tech/banco-unico",
    authorization = process.env.BANCO_UNICO_AUTHORIZATION || "",
    timeoutMs = Number(process.env.BANCO_UNICO_TIMEOUT_MS || 30000),
  } = {}) {
    this.baseUrl = String(baseUrl || "").replace(/\/$/, "");
    this.authorization = authorization;
    this.timeoutMs = timeoutMs;
  }

  async requestJson(url, options = {}) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.timeoutMs);

    try {
      const response = await fetch(url, {
        ...options,
        headers: {
          "content-type": "application/json",
          ...(this.authorization ? { authorization: this.authorization } : {}),
          ...(options.headers || {}),
        },
        signal: controller.signal,
      });

      const bodyText = await response.text();
      const body = bodyText ? JSON.parse(bodyText) : null;

      if (!response.ok) {
        const error = new Error(`Falha na API do Banco Unico: HTTP ${response.status}`);
        error.status = response.status;
        error.details = body;
        throw error;
      }

      return body;
    } finally {
      clearTimeout(timer);
    }
  }

  async publishProducts(products = []) {
    return this.requestJson(`${this.baseUrl}/api/products`, {
      method: "POST",
      body: JSON.stringify({ products }),
    });
  }

  async searchProductsByEans(eans = []) {
    const normalizedEans = [...new Set(
      eans
        .map((ean) => String(ean || "").trim())
        .filter(Boolean),
    )];

    if (!normalizedEans.length) {
      return [];
    }

    try {
      const body = await this.requestJson(`${this.baseUrl}/api/products/search/eans`, {
        method: "POST",
        body: JSON.stringify({ eans: normalizedEans }),
      });

      return Array.isArray(body?.products)
        ? body.products
        : Array.isArray(body)
          ? body
          : [];
    } catch (error) {
      if (error.status !== 404) {
        throw error;
      }
    }

    const results = await Promise.all(
      normalizedEans.map(async (ean) => {
        const body = await this.requestJson(`${this.baseUrl}/api/products/search`, {
          method: "POST",
          body: JSON.stringify({
            query: ean,
            limit: 1,
            offset: 0,
            includeRelevanceScore: false,
          }),
        });

        const found = Array.isArray(body?.results)
          ? body.results.find((item) => String(item?.ean || "").trim() === ean)
          : null;

        return found || null;
      }),
    );

    return results.filter(Boolean);
  }
}
