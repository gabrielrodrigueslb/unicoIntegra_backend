import pg from "pg";
import { pickFirstString } from "../utils/text.js";
import { normalizeEan } from "../utils/ean.js";

const { Pool } = pg;
const DEFAULT_PAGE_SIZE = Math.max(1, Number(process.env.ALPHA7_PAGE_SIZE || process.env.TRIER_PRODUTOS_PAGE_SIZE || 100));
const DEFAULT_SCHEMA = process.env.ALPHA7_DB_SCHEMA || "public";
const poolCache = new Map();

function normalizeString(value) {
  return typeof value === "string" ? value.trim() : "";
}

function sanitizeSchema(schema) {
  const normalized = normalizeString(schema) || DEFAULT_SCHEMA;
  if (!/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(normalized)) {
    throw new Error("Schema do Alpha 7 invalido.");
  }

  return normalized;
}

function buildPoolKey(config) {
  return JSON.stringify({
    host: config.host,
    port: config.port,
    database: config.database,
    user: config.user,
    schema: config.schema,
  });
}

function mapAlpha7Product(row, index) {
  const ean = normalizeEan(row?.ean);
  const nome = pickFirstString(row?.nome);

  return {
    id_produto: index,
    nome,
    nomeOriginal: nome,
    codigoBarras: ean,
    nomeLaboratorio: null,
    nomePrincipioAtivo: null,
    produtoOrigem: row,
  };
}

export class Alpha7ProductsClient {
  constructor({
    host = process.env.ALPHA7_DB_HOST || "",
    port = Number(process.env.ALPHA7_DB_PORT || 5432),
    database = process.env.ALPHA7_DB_DATABASE || "",
    user = process.env.ALPHA7_DB_USER || "",
    password = process.env.ALPHA7_DB_PASSWORD || "",
    schema = process.env.ALPHA7_DB_SCHEMA || DEFAULT_SCHEMA,
    pageSize = DEFAULT_PAGE_SIZE,
  } = {}) {
    this.host = normalizeString(host);
    this.port = Number.parseInt(port, 10) || 5432;
    this.database = normalizeString(database);
    this.user = normalizeString(user);
    this.password = normalizeString(password);
    this.schema = sanitizeSchema(schema);
    this.pageSize = Math.max(1, Number(pageSize || DEFAULT_PAGE_SIZE));
  }

  validateConfiguration() {
    if (!this.host || !this.database || !this.user || !this.password) {
      throw new Error("Configuracao do Alpha 7 incompleta. Informe host, database, user e password.");
    }
  }

  describeSource() {
    return `alpha7-postgres://${this.host}:${this.port}/${this.database}/${this.schema}.embalagem`;
  }

  getPool() {
    this.validateConfiguration();
    const key = buildPoolKey(this);

    if (!poolCache.has(key)) {
      poolCache.set(key, new Pool({
        host: this.host,
        port: this.port,
        database: this.database,
        user: this.user,
        password: this.password,
      }));
    }

    return poolCache.get(key);
  }

  async fetchPage(skip = 0) {
    const pool = this.getPool();
    const limit = this.pageSize;
    const offset = Math.max(0, Number.parseInt(skip, 10) || 0);
    const rowsQuery = `
      select distinct on (codigobarras)
        codigobarras as ean,
        descricao as nome
      from ${this.schema}.embalagem
      where codigobarras is not null
        and btrim(codigobarras) <> ''
        and descricao is not null
        and btrim(descricao) <> ''
      order by codigobarras, descricao, id
      limit $1
      offset $2
    `;
    const countQuery = `
      select count(distinct codigobarras) as total
      from ${this.schema}.embalagem
      where codigobarras is not null
        and btrim(codigobarras) <> ''
        and descricao is not null
        and btrim(descricao) <> ''
    `;

    const [rowsResult, countResult] = await Promise.all([
      pool.query(rowsQuery, [limit, offset]),
      pool.query(countQuery),
    ]);

    return {
      total: Number.parseInt(countResult.rows?.[0]?.total, 10) || 0,
      products: rowsResult.rows.map((row, index) => mapAlpha7Product(row, offset + index)),
    };
  }

  async fetchAllProducts() {
    const products = [];
    let skip = 0;
    let page = 0;

    while (true) {
      page += 1;
      const { products: pageProducts, total } = await this.fetchPage(skip);
      console.log(`Alpha 7 pagina ${page}: ${pageProducts.length} produto(s) recebidos de ${total}.`);

      if (!pageProducts.length) {
        break;
      }

      products.push(...pageProducts);

      if (pageProducts.length < this.pageSize) {
        break;
      }

      skip += this.pageSize;
    }

    return products;
  }
}
