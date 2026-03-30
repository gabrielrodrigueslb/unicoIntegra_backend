# Deploy Linux do Link AI

## Visao geral

O backend ja sai pronto para Linux com o template da extensao Trier dentro do proprio projeto:

- `back/templates/trier-inovafarma`

Isso evita dependencia de `.tmp` na VPS.

## Requisitos

- Node.js 20+
- npm
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
CORS_ALLOWED_ORIGINS=https://seu-front.com
```

Observacao:

- `TRIER_EXTENSION_TEMPLATE_DIR` e `TRIER_EXTENSION_TEMPLATE_ZIP` sao opcionais em producao, porque o backend usa `back/templates/trier-inovafarma` por padrao.

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

- o build da extensao instala dependencias e executa `npm run build` em uma copia temporaria do template
- o ZIP final contem apenas a pasta `dist`
- a URL da instancia e normalizada automaticamente com `/` no final

## Estrutura importante em producao

```text
back/
  downloads/
  builds-temporarios/
  templates/
    trier-inovafarma/
```
