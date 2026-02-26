# API UnicoIntegra Backend

## Visão geral

Esta API é um backend em `Express` que centraliza automações para:

- criar e configurar assistentes de IA em instâncias externas (`/api/ia/*`);
- instalar integrações/IVRs em instâncias externas (`/install/integration`);
- criar e listar bancos PostgreSQL do ambiente administrativo (`/api/databases`);
- registrar e consultar logs operacionais (`/api/logs`);
- publicar novidades para o frontend (`/api/news/*`);
- gerar um pacote ZIP customizado do app `Alpha7` (`/api/generate`).

## Base URL e execução

- Base local padrão: `http://127.0.0.1:4000`
- Host pode ser alterado por `HOST` (porta fixa no código: `4000`)

### Como iniciar

1. Instale dependências:

```bash
npm install
```

2. Configure variáveis de ambiente (ver seção abaixo).

3. (Recomendado) aplique as migrations do Prisma para garantir `sistema.system_logs`:

```bash
npx prisma migrate deploy
```

4. Inicie o servidor:

```bash
node src/server.js
```

Observação: o script `npm run dev` atual aponta para `server.js` (raiz), mas o arquivo real está em `src/server.js`.

## Variáveis de ambiente

### Banco administrativo (`pg`)

Usadas em `src/database/adminPool.js`:

- `DBHOST`
- `DBUSER`
- `DBPASSWORD`
- `DB_DATABASE` (opcional; default: `unico_integra`)

### Prisma (logs)

Usada em `prisma/PrismaClient.js`:

- `DATABASE_URL` (PostgreSQL)

### Outras

- `HOST` (opcional; default `127.0.0.1`)
- `ADMIN_API_KEY` (somente se você aplicar o middleware de API key manualmente nas rotas)

## Autenticação e segurança

### No backend

- Não existe autenticação global ativa nas rotas atuais.
- O middleware `x-api-key` existe (`src/middlewares/apiKey.middleware.js`), mas **não está aplicado**.

### Para rotas de IA/integração

Essas rotas exigem credenciais da **instância externa** no body:

- `instance` (URL base da instância)
- `username`
- `password`
- `code` (código/2FA)

O backend faz login na instância (`POST {instance}/login`) e usa o token para criar assistentes/IVRs.

## CORS

Origens liberadas no código:

- `http://localhost:5173`
- `http://localhost:3000`
- `https://unico-integra.vercel.app`

Requisições sem `Origin` (ex.: Postman) também são aceitas.

## Formato geral de respostas

- A maioria das rotas retorna JSON.
- `POST /api/generate` retorna download de arquivo ZIP.
- Erros de validação retornam `400`.
- Erros internos normalmente retornam `500`.

Exemplo comum de erro:

```json
{
  "message": "Ocorreu um erro ao criar a IA.",
  "error": "detalhe interno"
}
```

## Endpoints (de ponta a ponta)

## 1) Geração de app cliente

### `POST /api/generate`

### Para que serve

Gera uma cópia customizada do app `app-Alpha7`, injeta configurações do cliente, compila executáveis com `pkg` (Windows/Linux/macOS), compacta tudo em ZIP e devolve para download.

### Fluxo interno

1. Copia `app-Alpha7` para uma pasta temporária.
2. Atualiza `data/db-config.json` com dados de banco.
3. Atualiza `data/access_key.json`.
4. Executa `npm install` + `npx pkg`.
5. Gera ZIP.
6. Faz download do ZIP e remove a pasta temporária.

### Body (JSON)

Campos usados no código:

- `db_user`
- `db_host`
- `db_database`
- `db_password`
- `access_key`
- `nome_cliente` (opcional; usado no nome do ZIP)

### Exemplo

```bash
curl -X POST http://127.0.0.1:4000/api/generate \
  -H "Content-Type: application/json" \
  -d '{
    "db_user": "cliente_user",
    "db_host": "127.0.0.1",
    "db_database": "cliente_db",
    "db_password": "senha123",
    "access_key": "MINHA-CHAVE",
    "nome_cliente": "Loja ABC"
  }' --output app-cliente.zip
```

### Resposta de sucesso

- Download de arquivo `.zip`

### Possíveis erros

- `500` se falhar cópia/edição/build/zip/download

## 2) Bancos de dados (PostgreSQL administrativo)

Prefixo: `/api/databases`

### `GET /api/databases`

### Para que serve

Lista bancos PostgreSQL (exceto templates e `postgres`) com paginação e busca.

### Query params

- `page` (opcional, default `1`)
- `limit` (opcional, default `9`)
- `search` (opcional; busca por nome com `ILIKE`)

### Exemplo

```bash
curl "http://127.0.0.1:4000/api/databases?page=1&limit=10&search=loja"
```

### Resposta (exemplo)

```json
{
  "data": [
    { "name": "loja_abc", "size": "25 MB" }
  ],
  "meta": {
    "page": 1,
    "limit": 10,
    "totalItems": 1,
    "totalPages": 1
  }
}
```

### `POST /api/databases/createDatabase`

### Para que serve

Cria um novo banco PostgreSQL no servidor administrativo e registra log da ação.

### Body (JSON)

- `name` (obrigatório)
- `username` (opcional; usado só para log)

### Regras importantes

- O nome é sanitizado:
  - minúsculas
  - remove caracteres fora de `[a-z0-9_-]`
  - limite de 50 caracteres
- Nome final precisa ter pelo menos 3 caracteres.

### Exemplo

```bash
curl -X POST http://127.0.0.1:4000/api/databases/createDatabase \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Loja ABC 01",
    "username": "gabriel"
  }'
```

### Respostas

Sucesso (`201`):

```json
{
  "database": "lojaabc01",
  "message": "Criado com sucesso"
}
```

Banco já existe (`409`):

```json
{
  "error": "Banco de dados já existe"
}
```

## 3) Instalação de integrações/IVRs

Prefixo: `/install`

### `POST /install/integration`

### Para que serve

Faz login em uma instância externa e envia um payload de integração diretamente para `POST {instance}/ivrs/`.

### Body (JSON)

Obrigatórios:

- `instance`
- `username`
- `password`
- `code`
- `integrationData` (objeto JSON aceito pela API da instância)

Opcionais:

- `integration` (nome usado só no log)

### Exemplo

```bash
curl -X POST http://127.0.0.1:4000/install/integration \
  -H "Content-Type: application/json" \
  -d '{
    "instance": "https://cliente.exemplo.com",
    "username": "admin",
    "password": "senha",
    "code": "123456",
    "integration": "Webhook Cielo",
    "integrationData": {
      "name": "Minha Integracao",
      "type": 1
    }
  }'
```

### Resposta

- `200` com o payload retornado pela instância externa (`/ivrs/`)

### Erros comuns

- `400` por falta de campos
- `500` com mensagem encapsulando erro da instância externa

## 4) Criação de IA (genérica)

Prefixo: `/api/ia`

### `POST /api/ia/create-ai`

### Para que serve

Cria uma IA de atendimento genérica com pré-processamento padrão (`default_pre_automation.json`) e depois atualiza o assistente com nome/contexto.

### Fluxo interno

1. Login na instância externa.
2. Cria um IVR de pré-processamento via template.
3. Cria um assistente base (`/assistants/createItem`).
4. Atualiza o assistente (`/assistants/updateItem`) vinculando `preautomation`.

### Body (JSON)

Obrigatórios (validados no controller):

- `instance`
- `username`
- `password`
- `code`
- `name`
- `context`

### Exemplo

```bash
curl -X POST http://127.0.0.1:4000/api/ia/create-ai \
  -H "Content-Type: application/json" \
  -d '{
    "instance": "https://cliente.exemplo.com",
    "username": "admin",
    "password": "senha",
    "code": "123456",
    "name": "Assistente Loja",
    "context": "Você é um assistente de atendimento da loja."
  }'
```

### Resposta

- `200` com a resposta de `POST {instance}/assistants/updateItem` (repasse do backend)

## 5) Criação de IA Alpha7 (template completo)

### `POST /api/ia/create-ai/alpha`

### Para que serve

Cria uma IA Alpha7 completa, instalando múltiplos IVRs/automações auxiliares e depois configurando o assistente via template `ia/alpha7_ia_config.json`.

### Fluxo interno resumido

1. Login na instância.
2. Cria assistente vazio (`/assistants/createItem`).
3. Instala IVRs/templates:
   - `alpha7Download.json`
   - `alpha7_filtra_produto.json`
   - `alpha7_busca_itens.json`
   - `ura_ia.json`
   - `ura_ia_ab.json`
   - `ai_pre_processamento.json`
4. Atualiza o assistente com referências aos IDs criados.

### Body (JSON)

Obrigatórios (validados):

- `instance`
- `username`
- `password`
- `name`
- `queueId`
- `apiKey`
- `code`

Campos usados no fluxo (recomendado enviar):

- `context`
- `clientIp`
- `clientPort`
- `unidade_negocio`

Se `context` não for enviado, o serviço usa um texto padrão (`"Você é um assistente..."`).

### Exemplo

```bash
curl -X POST http://127.0.0.1:4000/api/ia/create-ai/alpha \
  -H "Content-Type: application/json" \
  -d '{
    "instance": "https://cliente.exemplo.com",
    "username": "admin",
    "password": "senha",
    "code": "123456",
    "name": "Alpha7 IA",
    "context": "Atenda clientes e ajude no orçamento.",
    "clientIp": "192.168.0.10",
    "clientPort": "8080",
    "unidade_negocio": "loja-centro",
    "apiKey": "API-KEY-CLIENTE",
    "queueId": 123
  }'
```

### Resposta

- `200` com a resposta da instância em `POST {instance}/assistants/updateItem`

Observação: os IDs dos IVRs criados são usados internamente para compor a IA, mas não são retornados explicitamente pelo controller.

## 6) Criação de IA Vannon (template completo)

### `POST /api/ia/create-ai/vannon`

### Para que serve

Cria uma IA Vannon completa, instalando automações/templates específicos da Vannon e atualizando o assistente final.

### Fluxo interno resumido

1. Login na instância.
2. Cria assistente vazio.
3. Instala templates Vannon:
   - `ia/vannon/download_de_imagens_IA_Vannon.json`
   - `ia/vannon/pre_processamento.json`
   - `ia/vannon/envio_itens_vannon.json`
   - `ia/vannon/transfere_para_atendente_encerrar.json`
   - `ia/vannon/ura_vannon.json`
   - `ia/vannon/ura_ab.json`
4. Atualiza assistente com template `ia/vannon/Vannon_ai_config.json`.

### Body (JSON)

Obrigatórios (validados):

- `instance`
- `username`
- `password`
- `name`
- `queueId`
- `apiKey`
- `code`

Campos usados no fluxo (recomendado enviar):

- `context`
- `clientEndpoint`
- `clientName`
- `cepLoja`

Se `context` não for enviado, o serviço usa um texto padrão (`"Você é um assistente..."`).

### Exemplo

```bash
curl -X POST http://127.0.0.1:4000/api/ia/create-ai/vannon \
  -H "Content-Type: application/json" \
  -d '{
    "instance": "https://cliente.exemplo.com",
    "username": "admin",
    "password": "senha",
    "code": "123456",
    "name": "Vannon IA",
    "context": "Atenda clientes Vannon com foco em catálogo.",
    "clientEndpoint": "https://api.cliente.com/webhook",
    "clientName": "Cliente Vannon",
    "cepLoja": "01001000",
    "apiKey": "API-KEY-CLIENTE",
    "queueId": 456
  }'
```

### Resposta

- `200` com a resposta da instância em `POST {instance}/assistants/updateItem`

## 7) Novidades (news)

Prefixo: `/api/news`

### `POST /api/news/create`

### Para que serve

Cria uma novidade para ser consumida pelo frontend.

### Body (JSON)

Obrigatórios:

- `title`
- `description`
- `type`

Tipos esperados no código/comentários (livre no banco):

- `feature`
- `update`
- `maintenance`
- `alert`

### Exemplo

```bash
curl -X POST http://127.0.0.1:4000/api/news/create \
  -H "Content-Type: application/json" \
  -d '{
    "title": "Nova integração disponível",
    "description": "Integração com X liberada para clientes.",
    "type": "feature"
  }'
```

### Resposta (`201`)

Retorna o registro criado (incluindo `id` e `created_at`).

### `GET /api/news/latest`

### Para que serve

Retorna as 3 novidades mais recentes (`ORDER BY created_at DESC LIMIT 3`).

### Exemplo

```bash
curl http://127.0.0.1:4000/api/news/latest
```

## 8) Logs do sistema

Prefixo real montado: `/api`

### `GET /api/logs`

### Para que serve

Lista logs operacionais com paginação e filtros por texto e período.

### Query params

- `page` (opcional, default `1`)
- `limit` (opcional, default `10`)
- `search` (opcional; busca em `userName`, `action`, `target`)
- `startDate` (opcional; ex. `2026-02-01`)
- `endDate` (opcional; ex. `2026-02-25`, incluído até `23:59:59.999`)

### Exemplo

```bash
curl "http://127.0.0.1:4000/api/logs?page=1&limit=20&search=IA&startDate=2026-02-01&endDate=2026-02-25"
```

### Resposta (exemplo)

```json
{
  "data": [
    {
      "id": 10,
      "userName": "gabriel",
      "action": "Criou a IA do alpha 7 - Alpha7 IA",
      "target": "https://cliente.exemplo.com",
      "createdAt": "2026-02-25T13:00:00.000Z"
    }
  ],
  "pagination": {
    "total": 1,
    "page": 1,
    "totalPages": 1,
    "limit": 20
  }
}
```

## Banco de dados usado pela API

### Tabela de novidades

No startup, a API garante a criação de:

- schema `sistema`
- tabela `sistema.news`

Isso acontece automaticamente ao subir o servidor.

### Tabela de logs

Os logs são gravados via Prisma em:

- `sistema.system_logs`

Importante: essa tabela depende das migrations do Prisma (não é criada pelo `ensureNewsTableExists()`).

Ações que hoje geram log:

- criação de banco
- instalação de integração
- criação de IA (genérica, Alpha7, Vannon)

## Integração com instâncias externas (importante)

As rotas de IA e integração assumem que a `instance` informada expõe estes endpoints:

- `POST /login`
- `POST /ivrs/`
- `POST /assistants/createItem`
- `POST /assistants/updateItem`

### Recomendação de formato para `instance`

Use URL completa com protocolo:

- `https://cliente.exemplo.com`

## Troubleshooting rápido

### Erro de login sem token

Se o backend retornar falha de login e mencionar resposta sem token, normalmente é:

- URL da `instance` incorreta
- endpoint retornando HTML ao invés de JSON
- credenciais/2FA inválidos

### Falha em templates de IA

As IAs Alpha7/Vannon dependem de templates em `src/templates`. Campos não enviados (mesmo quando não validados no controller) podem gerar configuração inválida.

### CORS no frontend

Se estiver acessando de outro domínio/porta, a origem precisa ser adicionada em `src/server.js`.

## Observações de implementação

- `OPTIONS` (preflight) já existem para algumas rotas `POST` (`/install/integration`, `/api/ia/create-ai*`, `/api/databases/createDatabase`).
- O header `x-api-key` está liberado no CORS, mas a verificação não está ativa nas rotas atuais.
- `POST /api/generate` pode ser pesado/lento, pois executa `npm install` e `pkg` por requisição.
