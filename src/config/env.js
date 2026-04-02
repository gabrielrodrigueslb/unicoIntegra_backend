function readEnv(name, fallback = '') {
  const value = process.env[name];

  if (typeof value !== 'string') {
    return fallback;
  }

  return value.trim();
}

const defaultTrierExtensionRepoUrl =
  'https://github.com/UnicoContato/trier_extensao.git';
const defaultTrierExtensionRepoBranch = 'main';

export const env = {
  PORT: Number(readEnv('PORT', '4000')),
  HOST: readEnv('HOST', '127.0.0.1'),
  OPENAI_API_KEY: readEnv('OPENAI_API_KEY'),
  OPENAI_MODEL: readEnv('OPENAI_MODEL', 'gpt-5.4'),
  OPENAI_REASONING_EFFORT: readEnv('OPENAI_REASONING_EFFORT', 'medium'),
  OPENAI_VERBOSITY: readEnv('OPENAI_VERBOSITY', 'medium'),
  TRIER_EXTENSION_REPO_URL:
    readEnv('TRIER_EXTENSION_REPO_URL', defaultTrierExtensionRepoUrl),
  TRIER_EXTENSION_REPO_BRANCH:
    readEnv('TRIER_EXTENSION_REPO_BRANCH', defaultTrierExtensionRepoBranch),
  TRIER_EXTENSION_TEMPLATE_DIR: readEnv('TRIER_EXTENSION_TEMPLATE_DIR'),
  TRIER_EXTENSION_TEMPLATE_ZIP: readEnv('TRIER_EXTENSION_TEMPLATE_ZIP'),
  CORS_ALLOWED_ORIGINS: readEnv(
    'CORS_ALLOWED_ORIGINS',
    'http://localhost:5173,http://localhost:3000,https://unico-integra.vercel.app',
  )
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean),
};
