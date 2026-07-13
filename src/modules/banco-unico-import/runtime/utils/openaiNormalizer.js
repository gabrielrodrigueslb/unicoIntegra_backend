import { preNormalizarProduto } from "./normalizador-v25.js";

let client = null;

function readOptionalTemperature(envKey) {
  const raw = String(process.env[envKey] || "").trim();
  if (!raw) {
    return false;
  }

  if (raw.toLowerCase() === "false") {
    return false;
  }

  const parsed = Number(raw);
  return Number.isFinite(parsed) ? parsed : false;
}

async function getOpenAIClient() {
  if (!client) {
    const { default: OpenAI } = await import("openai");
    client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  }
  return client;
}

function extrairJsonSeguro(texto) {
  try {
    return JSON.parse(texto);
  } catch {
    const match = String(texto).match(/\{[\s\S]*\}/);
    if (!match) throw new Error("A IA não retornou JSON válido.");
    return JSON.parse(match[0]);
  }
}

export async function normalizarNomeComIA(produto) {
  const nomeOriginal = typeof produto === "string" ? produto : produto.nome || produto.nomeOriginal;
  const produtoPreNormalizado = preNormalizarProduto(nomeOriginal);

  const openai = await getOpenAIClient();
  const temperature = readOptionalTemperature("BANCO_UNICO_NORMALIZER_TEMPERATURE");
  const response = await openai.responses.create({
    model: "gpt-5.4-nano",
    ...(temperature !== false ? { temperature } : {}),
    input: `
Você é um especialista em normalização de catálogo farmacêutico, higiene, beleza, medicamentos e suplementos.

Retorne APENAS JSON válido.

Formato obrigatório:
{
  "nome_normalizado": "",
  "confianca": "alta|media|baixa",
  "precisa_revisao": true|false
}

Regras:
- Não invente informações.
- Preserve marcas quando houver dúvida.
- Use unidades técnicas curtas: mg, mL, mg/mL, mg/g, mcg, g, kg.
- Nunca escreva Miligrama, Grama ou Mililitro por extenso.
- Preserve vírgula decimal: 0,250 mg, 0,2 mL, 12,5 mg.
- Preserve dosagem composta com +: 1 mg + 0,250 mg.
- Use plural quando quantidade for maior que 1.
- Não transforme marca em descrição.
- Respeite contexto: SH pode ser Shampoo em cabelo/higiene e Shake em suplemento.
- Em cosmético capilar, CAP pode significar Capilar.
- Em medicamento, CAP pode significar Cápsula.
- Em barra alimentar, CER pode significar Cereal.

Dados adicionais:
Laboratório: ${produto.nomeLaboratorio || ""}
Princípio ativo: ${produto.nomePrincipioAtivo || ""}
Código de barras: ${produto.codigoBarras || ""}

Produto original:
${nomeOriginal}

Produto pré-normalizado:
${produtoPreNormalizado}
`
  });

  const json = extrairJsonSeguro(response.output_text);

  return {
    nomeOriginal,
    nomePreNormalizado: produtoPreNormalizado,
    nomeNormalizadoFinal: json.nome_normalizado || produtoPreNormalizado,
    confianca: json.confianca || "media",
    precisaRevisao: Boolean(json.precisa_revisao),
    codigoBarras: produto.codigoBarras ?? null,
    nomeLaboratorio: produto.nomeLaboratorio ?? null,
    nomePrincipioAtivo: produto.nomePrincipioAtivo ?? null
  };
}

export function normalizarNomeLocal(produto) {
  const nomeOriginal = typeof produto === "string" ? produto : produto.nome || produto.nomeOriginal;

  return {
    nomeOriginal,
    nomeNormalizadoFinal: preNormalizarProduto(nomeOriginal),
    confianca: "alta",
    precisaRevisao: false,
    codigoBarras: produto.codigoBarras ?? null,
    nomeLaboratorio: produto.nomeLaboratorio ?? null,
    nomePrincipioAtivo: produto.nomePrincipioAtivo ?? null
  };
}
