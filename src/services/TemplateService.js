// src/services/TemplateService.js
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

function applyTemplate(content, vars = {}) {
  return content.replace(/{{(.*?)}}/g, (_, key) => {
    const k = key.trim();
    const value = vars?.[k];

    // Se o valor existe (não é undefined/null)
    if (value !== undefined && value !== null) {
      // FIX CRÍTICO: Se for string, usamos JSON.stringify para escapar caracteres
      // como quebras de linha (\n), aspas ("), etc.
      if (typeof value === 'string') {
        // .slice(1, -1) remove as aspas duplas extras que o JSON.stringify adiciona,
        // pois no seu template as variáveis já estão entre aspas: "{{variavel}}"
        return JSON.stringify(value).slice(1, -1);
      }
      // Se for número ou booleano, retorna direto
      return value;
    }
    
    // Se não encontrar a variável, mantém o {{placeholder}} original
    return `{{${k}}}`;
  });
}

export async function loadAndParseTemplate(templateName, variables) {
  try {
    const filePath = path.join(__dirname, '..', 'templates', templateName);
    const fileExt = path.extname(templateName); 
    
    let fileContent = await fs.readFile(filePath, 'utf-8');

    // Suporte a Base64 (.txt)
    if (fileExt === '.txt') {
      fileContent = Buffer.from(fileContent, 'base64').toString('utf-8');
    }

    // Aplica variáveis COM tratamento de escape
    const parsedContent = applyTemplate(fileContent, variables);

    // Agora o JSON.parse não vai quebrar com quebras de linha
    return JSON.parse(parsedContent);
  } catch (error) {
    console.error(`Erro ao carregar template ${templateName}:`, error);
    // Dica de debug: Se der erro, mostre um pedaço do conteúdo parseado para achar o caractere inválido
    // console.log('Conteúdo inválido:', parsedContent); 
    throw new Error(`Falha ao processar template ${templateName}`);
  }
}
