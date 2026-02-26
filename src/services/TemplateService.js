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

    if (value !== undefined && value !== null) {
      // Escape seguro para strings em JSON.
      if (typeof value === 'string') {
        return JSON.stringify(value).slice(1, -1);
      }
      return value;
    }

    return `{{${k}}}`;
  });
}

export function parseTemplateContent(content, variables = {}, fileExt = '.json') {
  let fileContent = content;

  if (fileExt === '.txt') {
    fileContent = Buffer.from(fileContent, 'base64').toString('utf-8');
  }

  const parsedContent = applyTemplate(fileContent, variables);
  return JSON.parse(parsedContent);
}

export async function loadAndParseTemplate(templateName, variables) {
  try {
    const filePath = path.join(__dirname, '..', 'templates', templateName);
    const fileExt = path.extname(templateName);
    const fileContent = await fs.readFile(filePath, 'utf-8');

    return parseTemplateContent(fileContent, variables, fileExt);
  } catch (error) {
    console.error(`Erro ao carregar template ${templateName}:`, error);
    throw new Error(`Falha ao processar template ${templateName}`);
  }
}
