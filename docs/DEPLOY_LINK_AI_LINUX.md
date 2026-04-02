# Deploy Linux do Link AI

## Visao geral

O backend agora gera a extensao Trier a partir de um clone do repositorio:

- `https://github.com/UnicoContato/trier_extensao.git`

O clone e feito em um diretorio temporario de build, sem depender do template fixo dentro do projeto.

## Requisitos

- Node.js 20+
- npm
- git
- acesso de escrita em:
  - `back/downloads`
  - `back/builds-temporarios`

## Backend

No servidor:

```bash
cd /caminho/do/projeto/back
npm install
cp .env.example .env
```

Ajuste o `.env`:

```env
HOST=0.0.0.0
PORT=4000
OPENAI_API_KEY=sk-...
OPENAI_MODEL=gpt-4.1-nano
OPENAI_REASONING_EFFORT=low
OPENAI_VERBOSITY=medium
TRIER_EXTENSION_REPO_URL=https://github.com/UnicoContato/trier_extensao.git
TRIER_EXTENSION_REPO_BRANCH=main
CORS_ALLOWED_ORIGINS=https://seu-front.com
```

Observacao:

- `TRIER_EXTENSION_REPO_URL` e `TRIER_EXTENSION_REPO_BRANCH` controlam qual checkout da extensao sera usado no build.
- `TRIER_EXTENSION_TEMPLATE_DIR` e `TRIER_EXTENSION_TEMPLATE_ZIP` ficam como fallback opcional, caso voce precise apontar para um checkout local ou um zip externo.

Suba com:

```bash
npm start
```

## Frontend

```bash
cd /caminho/do/projeto/front
npm install
npm run build
```

Defina o `.env` do front:

```env
VITE_URLBASE=https://sua-api.com
```

Sirva `front/dist` com Nginx, Vercel ou outro host estatico.

## PM2

Exemplo:

```bash
cd /caminho/do/projeto/back
pm2 start src/server.js --name link-ai-back
pm2 save
```

## Observacoes sobre a extensao Trier

- o backend clona o repositorio configurado da extensao antes de iniciar o build
- o build da extensao instala dependencias e executa `npm run build` em uma copia temporaria do template
- o ZIP final contem apenas a pasta `dist`
- a URL da instancia e normalizada automaticamente com `/` no final

## Estrutura importante em producao

```text
back/
  downloads/
  builds-temporarios/
```
