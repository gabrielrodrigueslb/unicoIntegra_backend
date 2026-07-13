import fs from "fs";
import { normalizeText, tokenize } from "../utils/text.js";

function parseCsvLine(line) {
  const parts = [];
  let current = "";
  let inQuotes = false;

  for (let index = 0; index < line.length; index += 1) {
    const char = line[index];

    if (char === "\"") {
      const next = line[index + 1];
      if (inQuotes && next === "\"") {
        current += "\"";
        index += 1;
        continue;
      }

      inQuotes = !inQuotes;
      continue;
    }

    if (char === ";" && !inQuotes) {
      parts.push(current.trim());
      current = "";
      continue;
    }

    current += char;
  }

  parts.push(current.trim());
  return parts;
}

function buildTokenSet(entry) {
  return new Set(
    tokenize([
      entry.departamento,
      entry.categoria,
      entry.subcategoria,
      entry.segmento,
      entry.subsegmento,
    ].filter(Boolean).join(" ")),
  );
}

function joinPath(entry) {
  return [
    entry.departamento,
    entry.categoria,
    entry.subcategoria,
    entry.segmento,
    entry.subsegmento,
  ].filter(Boolean).join(" > ");
}

export class MercadologicalTreeService {
  constructor({ csvPath } = {}) {
    this.csvPath = csvPath || process.env.MERCADOLOGICAL_TREE_CSV_PATH || "C:\\Users\\Comercial\\Downloads\\levantamento_arvore_mercadologica.csv";
    this.entries = null;
  }

  isConfigured() {
    return Boolean(this.csvPath && fs.existsSync(this.csvPath));
  }

  loadEntries() {
    if (this.entries) {
      return this.entries;
    }

    if (!this.isConfigured()) {
      throw new Error(`Arquivo da arvore mercadologica nao encontrado: ${this.csvPath}`);
    }

    const csv = fs.readFileSync(this.csvPath, "utf8").replace(/^\uFEFF/, "");
    const lines = csv.split(/\r?\n/).filter(Boolean);
    const [, ...rows] = lines;

    this.entries = rows.map((line, index) => {
      const [
        departamento,
        categoria,
        subcategoria,
        segmento,
        subsegmento,
        qtdCodigosBarras,
      ] = parseCsvLine(line);

      const entry = {
        id: `taxonomy_${index + 1}`,
        departamento: departamento || null,
        categoria: categoria || null,
        subcategoria: subcategoria || null,
        segmento: segmento || null,
        subsegmento: subsegmento || null,
        qtdCodigosBarras: Number(qtdCodigosBarras || 0) || 0,
      };

      return {
        ...entry,
        path: joinPath(entry),
        normalizedPath: normalizeText(joinPath(entry)),
        tokenSet: buildTokenSet(entry),
      };
    });

    return this.entries;
  }

  scoreEntry(entry, signals = {}) {
    let score = 0;
    const signalTokens = signals._signalTokens || new Set(tokenize(signals.searchText));
    const ingredientTokens = signals._ingredientTokens || new Set(tokenize(signals.principioAtivo));

    for (const token of signalTokens) {
      if (entry.tokenSet.has(token)) {
        score += 4;
      }
    }

    for (const token of ingredientTokens) {
      if (entry.tokenSet.has(token)) {
        score += 14;
      }
    }

    const normalizedIngredient = normalizeText(signals.principioAtivo);
    const normalizedName = normalizeText(signals.nome);
    const normalizedSubsegment = normalizeText(entry.subsegmento);
    const normalizedSegment = normalizeText(entry.segmento);

    if (normalizedIngredient && normalizedSubsegment) {
      if (normalizedSubsegment.includes(normalizedIngredient) || normalizedIngredient.includes(normalizedSubsegment)) {
        score += 160;
      }
    }

    if (normalizedIngredient && normalizedSegment) {
      if (normalizedSegment.includes(normalizedIngredient) || normalizedIngredient.includes(normalizedSegment)) {
        score += 80;
      }
    }

    if (normalizedName && normalizedSubsegment && normalizedName.includes(normalizedSubsegment)) {
      score += 90;
    }

    if (normalizedName && normalizedSegment && normalizedName.includes(normalizedSegment)) {
      score += 90;
    }

    const normalizedSubcategory = normalizeText(entry.subcategoria);
    if (normalizedName && normalizedSubcategory && normalizedName.includes(normalizedSubcategory)) {
      score += 70;
    }

    const normalizedEntryPath = normalizeText(entry.path);
    const phraseBoosts = [
      "creme dental",
      "gel dental",
      "escova dental",
      "enxaguante bucal",
      "fio dental",
      "shampoo",
      "condicionador",
      "sabonete",
      "desodorante",
      "fralda",
      "mamadeira",
      "chupeta",
      "colirio",
      "pomada",
      "capsulas",
      "comprimidos",
    ];

    for (const phrase of phraseBoosts) {
      if (normalizedName.includes(phrase) && normalizedEntryPath.includes(phrase)) {
        score += 140;
      }
    }

    if (signals.departamento && normalizeText(signals.departamento) === normalizeText(entry.departamento)) {
      score += 120;
    }

    if (signals.categoria && normalizeText(signals.categoria) === normalizeText(entry.categoria)) {
      score += 140;
    }

    if (signals.subcategoria && normalizeText(signals.subcategoria) === normalizeText(entry.subcategoria)) {
      score += 160;
    }

    if (signals.segmento && normalizeText(signals.segmento) === normalizeText(entry.segmento)) {
      score += 180;
    }

    if (signals.subsegmento && normalizeText(signals.subsegmento) === normalizeText(entry.subsegmento)) {
      score += 220;
    }

    score += Math.min(entry.qtdCodigosBarras, 25) / 25;
    return score;
  }

  findCandidates(signals = {}, limit = 25) {
    return this.loadEntries()
      .map((entry) => ({
        ...entry,
        score: this.scoreEntry(entry, signals),
      }))
      .filter((entry) => entry.score > 0)
      .sort((left, right) => right.score - left.score || right.qtdCodigosBarras - left.qtdCodigosBarras)
      .slice(0, limit)
      .map(({ tokenSet, normalizedPath, ...entry }) => entry);
  }
}
