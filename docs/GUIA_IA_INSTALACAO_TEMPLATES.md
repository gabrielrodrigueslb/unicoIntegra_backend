# Guia para IA: Instalação de IAs e Integrações por Template

## Objetivo

Este guia é para uma IA (agente/orquestrador) que precisa instalar:

- integrações/automações/URAs baseadas em templates (`.txt` base64 -> JSON IVR);
- IAs (assistentes) baseadas nos templates do catálogo do frontend.

O foco aqui é descrever:

- quais funções a IA deve executar;
- quais parâmetros coletar;
- para quais endpoints enviar;
- como montar os payloads corretamente;
- o que muda em cada template.

## Fonte de verdade (usado neste guia)

Frontend (fluxo e campos):

- `UnicoIntegra/src/pages/Integrations/Integrations.tsx`
- `UnicoIntegra/src/components/IVRGenerator.tsx`
- `UnicoIntegra/src/components/TemplateForm.tsx`
- `UnicoIntegra/src/pages/AiPage/AiPage.tsx`
- `UnicoIntegra/src/data/templates.ts`
- `UnicoIntegra/src/data/templates_ia.ts`

Backend (rotas e execução):

- `unicoIntegra_backend/src/routes/installing.routes.js`
- `unicoIntegra_backend/src/controllers/installing.controller.js`
- `unicoIntegra_backend/src/services/installing.services.js`
- `unicoIntegra_backend/src/routes/ai.routes.js`
- `unicoIntegra_backend/src/controllers/ia.controller.js`
- `unicoIntegra_backend/src/services/ai.services.js`
- `unicoIntegra_backend/src/services/aiFunctions.js`

## Conceitos importantes (para a IA não errar)

### 1) Existem 2 tipos de instalação

1. Instalação de template IVR/integração
: Envia `integrationData` para `POST /install/integration`, que faz login na instância e posta em `{instance}/ivrs/`.

2. Criação de IA (assistente)
: Envia body para `POST /api/ia/create-ai*`, e o backend cria assistente + automações auxiliares.

### 2) Campos comuns no frontend (integrações)

No formulário de integração (`TemplateForm` modo legado), o frontend coleta:

- `instanceURL` (URL da instância do cliente)
- `code` (2FA)
- campos específicos do template (`template.fields`)

O frontend converte isso para o backend em:

```json
{
  "instance": "https://instancia",
  "integrationData": { "...template json..." },
  "integration": "Nome do template",
  "username": "authUsername (localStorage)",
  "password": "authPassword (localStorage)",
  "code": "123456"
}
```

### 3) Campos comuns no frontend (IAs)

No formulário de IA (`TemplateForm` modo IA), o frontend coleta:

- `name`
- `instance`
- `context`
- `code`
- campos específicos da IA (depende do template)

E envia:

```json
{
  "...campos especificos": "...",
  "instance": "https://instancia",
  "name": "Nome da IA",
  "username": "authUsername (localStorage)",
  "password": "authPassword (localStorage)",
  "context": "prompt",
  "code": "123456"
}
```

### 4) Placeholders de template

Nem todo placeholder `{{...}}` deve ser preenchido no momento da instalação.

Existem 2 grupos:

- placeholders de configuração (dados fornecidos pelo operador/cliente no momento da instalação);
- placeholders de runtime (ex.: `chat_id`, `ai_result`, `message_file.file_id`) que são resolvidos pela plataforma durante a execução do fluxo.

Regra para a IA:

- preencha apenas placeholders para os quais você tem dados de configuração;
- mantenha placeholders de runtime intactos.

## Funções que a IA deve implementar (modelo)

## 1) `instalar_template_integracao`

### Finalidade

Instalar uma integração/automação/URA baseada em template `.txt` (base64) no endpoint `/install/integration`.

### Assinatura sugerida

```ts
type InstalarTemplateIntegracaoInput = {
  templateKey: string;              // chave do catálogo frontend (ex: "Cielo_webhook")
  backendBaseUrl: string;           // ex: https://unicocontato.tech
  instance: string;                 // URL da instância do cliente (login/ivrs)
  username: string;                 // credencial da instância
  password: string;                 // credencial da instância
  code: string;                     // 2FA
  params: Record<string, string>;   // campos específicos do template
};
```

### Fluxo (frontend-like)

1. Resolver `templateKey` no catálogo (`src/data/templates.ts`).
2. Carregar o arquivo `public/templates/{template.file}` (ou `src/templates/{template.file}` no backend).
3. Decodificar Base64 -> UTF-8.
4. `JSON.parse` no conteúdo.
5. Substituir placeholders `{{campo}}` usando `params`.
6. Montar `integrationData` (objeto JSON).
7. Chamar `POST {backendBaseUrl}/install/integration`.

### Endpoint

- `POST /install/integration`

### Body

```json
{
  "instance": "https://cliente.exemplo.com",
  "username": "admin",
  "password": "senha",
  "code": "123456",
  "integration": "Link de pagamento - Cielo",
  "integrationData": {}
}
```

### Resposta esperada

- `200` com o retorno de `{instance}/ivrs/`

### Erros

- `400` campos obrigatórios ausentes
- `500` erro de login ou erro da instância no `/ivrs/`

## 2) `criar_ia_por_template`

### Finalidade

Criar uma IA (assistente) usando um dos templates do catálogo de IA (`src/data/templates_ia.ts`).

### Assinatura sugerida

```ts
type CriarIaInput = {
  templateKey: "alpha7" | "vannon" | "atendimento";
  backendBaseUrl: string;   // ex: https://unicocontato.tech
  instance: string;
  username: string;
  password: string;
  code: string;
  name: string;
  context?: string;         // obrigatório para "atendimento"; opcional para alpha7/vannon (backend usa fallback)
  params?: Record<string, string | number>;
};
```

### Fluxo (frontend-like)

1. Resolver template no catálogo (`templates_ia.ts`).
2. Definir endpoint:
   - `''` => `/api/ia/create-ai`
   - `/alpha` => `/api/ia/create-ai/alpha`
   - `/vannon` => `/api/ia/create-ai/vannon`
3. Montar body com campos comuns + específicos.
4. `POST` para o backend.

### Endpoint base

- `POST /api/ia/create-ai{suffix}`

## Regras operacionais para a IA (antes de chamar endpoints)

### Sempre normalizar URL da instância

- remover barra final (`/`) da URL (`https://cliente.com/` -> `https://cliente.com`)

### Distinguir campos que parecem iguais

Exemplo crítico em Cielo/Getnet webhook:

- `instance` (body wrapper): URL da instância para login + `/ivrs/`
- `instancia` (placeholder do template): dado interno do fluxo (armazenamento/referência)
- `url` (placeholder do template getnet webhook): endpoint usado pelo próprio fluxo

### Não depender de `authToken`

No frontend, `authToken` só controla acesso à tela.
Para backend, o que importa nas rotas de instalação/criação é:

- `username`
- `password`
- `code`

### Recomendação de implementação (mais robusta que o frontend)

- Ao decodificar templates base64, prefira `trim()` somente.
- O frontend atual faz `replace(/\//g, '')` antes do decode; isso pode remover caracteres válidos de Base64.

## Catálogo de IAs (templates_ia.ts)

## 1) `atendimento` (IA - Atendimento)

### Rota

- `POST /api/ia/create-ai`

### Para que serve

Cria uma IA genérica de atendimento com pré-processamento padrão e prompt de atendimento humano.

### Campos que a IA deve enviar

Comuns (obrigatórios):

- `instance`
- `username`
- `password`
- `code`
- `name`
- `context` (obrigatório no controller)

Específicos:

- nenhum (`fields: []`)

### Fluxo interno no backend

1. login na instância (`/login`)
2. cria automação `default_pre_automation.json` em `/ivrs/`
3. cria assistente base em `/assistants/createItem`
4. atualiza assistente em `/assistants/updateItem`

## 2) `alpha7` (IA - Alpha 7)

### Rota

- `POST /api/ia/create-ai/alpha`

### Campos que a IA deve enviar

Comuns:

- `instance`
- `username`
- `password`
- `code`
- `name`
- `context` (recomendado; backend aceita vazio e aplica fallback)

Específicos (frontend):

- `apiKey`
- `clientIp`
- `clientPort`
- `unidade_negocio`
- `queueId`

### Fluxo interno no backend (ponta a ponta)

1. `loginInstance(instance, username, password, code)`
2. `createAi()` -> cria assistente vazio e obtém `iaId`
3. `alpha7Functions()` cria IVRs auxiliares:
   - `alpha7Download.json`
   - `alpha7_filtra_produto.json`
   - `alpha7_busca_itens.json`
   - `ura_ia.json`
   - `ura_ia_ab.json`
   - `ai_pre_processamento.json`
4. Backend carrega `ia/alpha7_ia_config.json`
5. Injeta IDs (`preProcessId`, `FiltraProdutoItemId`, `BuscaItensId`)
6. `POST {instance}/assistants/updateItem`

### Variáveis de template preenchidas pelo backend (não pedir ao usuário final)

Principais:

- `preProcessId`
- `FiltraProdutoItemId`
- `BuscaItensId`
- `signaturename` (vem de `name`)
- `context`

## 3) `vannon` (IA - Vannon)

### Rota

- `POST /api/ia/create-ai/vannon`

### Campos que a IA deve enviar

Comuns:

- `instance`
- `username`
- `password`
- `code`
- `name`
- `context` (recomendado; backend aceita fallback)

Específicos (frontend):

- `clientName`
- `apiKey`
- `clientEndpoint`
- `cepLoja`
- `queueId`

### Fluxo interno no backend (ponta a ponta)

1. login na instância
2. cria assistente vazio
3. `vannonFunctions()` cria IVRs:
   - `ia/vannon/download_de_imagens_IA_Vannon.json`
   - `ia/vannon/pre_processamento.json`
   - `ia/vannon/envio_itens_vannon.json`
   - `ia/vannon/transfere_para_atendente_encerrar.json`
   - `ia/vannon/ura_vannon.json`
   - `ia/vannon/ura_ab.json`
4. carrega `ia/vannon/Vannon_ai_config.json`
5. injeta IDs (`preProcessId`, `envioItensId`, `transfereId`)
6. atualiza assistente em `/assistants/updateItem`

### Variáveis de template preenchidas pelo backend (não pedir ao usuário final)

Principais:

- `preProcessId`
- `envioItensId`
- `transfereId`
- `signaturename` (vem de `name`)
- `context`

## Catálogo de integrações (templates.ts)

Observação importante:

- O catálogo principal usado pela tela moderna de integrações é `UnicoIntegra/src/data/templates.ts`.
- `templates_automations.ts` e `templates_uras.ts` estão desatualizados/minimais e não devem ser usados como fonte principal.

## Fluxo técnico padrão para integrações (vale para todos os templates ativos)

1. Coletar:
   - `instance` (URL da instância)
   - `username`
   - `password`
   - `code` (2FA)
   - campos específicos do template
2. Carregar template `.txt` correspondente.
3. Decodificar base64 e parsear JSON.
4. Substituir placeholders de configuração com os campos coletados.
5. Montar payload de wrapper:

```json
{
  "instance": "https://cliente.exemplo.com",
  "username": "admin",
  "password": "senha",
  "code": "123456",
  "integration": "NOME EXIBIDO NO CATÁLOGO",
  "integrationData": { "...JSON do template..." }
}
```

6. Chamar `POST /install/integration`.

## Templates por integração (um a um)

## 1) `alpha7extensao` (Alpha7 - Extensão)

### Status no frontend

- `active: false`
- `type: "Extensão"`

### Observação crítica

Esse item é usado como guia operacional/comercial e de configuração de extensão.
Não é um fluxo ativo de instalação automática via botão na tela (botão fica indisponível).

### Implicação para a IA

- Não tentar instalar automaticamente via `/install/integration` como fluxo padrão.
- Tratar como fluxo assistido/manual (banco + gestão de extensões + licença).

### Campos exibidos no frontend

- `Banco`
- `Licensa`

## 2) `alpha7` (Alpha7 - Orçamento)

### Tipo

- `Integração`

### Arquivo de template

- `Alpha7_orcamento.txt`

### Rota backend

- `POST /install/integration`

### Campos específicos (frontend)

- `ip_do_cliente` (IP/DNS + porta local do app intermediário, normalmente o host exposto pelo cliente)
- `Authorization` (header de autorização usado no fluxo)
- `nome_da_empresa`

### Placeholders de configuração relevantes (template)

- `ip_do_cliente`
- `Authorization`
- `nome_da_empresa`

### Placeholders de runtime (manter)

Exemplos:

- `clientNumber`
- `orcamentoId`
- `filial`
- `status`
- `respostaBD.*`
- `valorTotalAlpha`

### Observação

O template depende de variáveis que serão preenchidas em execução (ex.: número do orçamento, filial, status). A IA instaladora não deve tentar resolvê-las.

## 3) `cashback` (Alpha7 - Cashback ativo)

### Tipo

- `Integração`

### Arquivo de template

- `alpha7_cashback_ativo.txt`

### Rota backend

- `POST /install/integration`

### Campos específicos (frontend)

- `client_ip`

### Placeholders de configuração relevantes

- `client_ip`

### Placeholders de runtime (manter)

Exemplos:

- `clientNumber`
- `cpf_client`
- `nome`
- `telefone_formatado`
- `response_httpStatus`

## 4) `ifood_notificacao` (Ifood - Notificação de pedidos)

### Tipo

- `Integração`

### Arquivo de template

- `ifood.txt`

### Rota backend

- `POST /install/integration`

### Campos específicos (frontend)

- `ClientId`
- `ClientSecret`

### Placeholders de configuração relevantes

- `ClientId`
- `ClientSecret`

### Placeholders de runtime (manter)

Exemplos:

- `capture_orderId`
- `capture_code`
- `produtos`
- `valorPedido`
- `tipoPagamento`
- `nomeCliente`

### Observação

O template também contém placeholders `clientId`/`clientSecret` (minúsculos). Não sobrescreva manualmente sem validar o comportamento do template; parte deles pode ser derivada no fluxo.

## 5) `Napp` (Integração NAPP carrinho de compras)

### Tipo

- `URA` (mas tecnicamente instalado pelo mesmo endpoint de integração)

### Arquivo de template

- `integracao_napp.txt`

### Rota backend

- `POST /install/integration`

### Campos específicos (frontend)

- `cnpjCliente`
- `nomeDaLoja`

### Placeholders de configuração relevantes

- `cnpjCliente`
- `nomeDaLoja`

### Placeholders de runtime (manter)

Exemplos:

- `produto`
- `estoque`
- `opcoes`
- `total_car`
- `adicionado`

## 6) `Cielo` (Link de pagamento - Cielo)

### Tipo

- `Integração`

### Arquivo de template

- `link_cielo.txt`

### Rota backend

- `POST /install/integration`

### Campos específicos (frontend)

- `Cliente`
- `autenticacao` (basic / credenciais Cielo conforme operação)

### Placeholders de configuração relevantes

- `Cliente`
- `autenticacao`

### Placeholders de runtime (manter)

Exemplos:

- `preco`
- `descricao`
- `parcela`
- `createLink_shortUrl`
- `createLink_orderNumber`

## 7) `Cielo_webhook` (Cielo Webhook / Notificação)

### Tipo

- `Automação`

### Arquivo de template

- `CieloWebhook.txt`

### Rota backend

- `POST /install/integration`

### Campos específicos (frontend)

- `nomecliente`
- `clientcode` (`ClientId:ClientSecret`)
- `instancia` (instância de armazenamento/referência do fluxo)
- `fila` (QueueId)
- `apikey`

### Placeholders de configuração relevantes

- `nomecliente`
- `clientcode`
- `instancia`
- `fila`
- `apikey`

### Placeholders de runtime (manter)

Exemplos:

- `capture_payment_status`
- `capture_checkout_cielo_order_number`
- `ref_chat_id`
- `ref_queue_id`
- `message`

### Observação crítica

Não confundir:

- `instance` do wrapper (URL da instância para login e instalação)
- `instancia` do template (valor interno do fluxo/webhook)

## 8) `Getnet` (Link de pagamento - Getnet)

### Tipo

- `Integração`

### Arquivo de template

- `Integracao_getnet.txt`

### Rota backend

- `POST /install/integration`

### Campos específicos (frontend)

- `credencial`

### Placeholders de configuração relevantes

- `credencial`

### Placeholders de runtime (manter)

Exemplos:

- `titVenda`
- `descVenda`
- `centavos`
- `b_url`
- `b_id`

## 9) `Getnet_webhook` (Webhook - Getnet)

### Tipo

- `Automação`

### Arquivo de template

- `getnet_Webhook.txt`

### Rota backend

- `POST /install/integration`

### Campos específicos (frontend)

- `queueId`
- `apikey`
- `url`

### Placeholders de configuração relevantes

- `queueId`
- `apikey`
- `url`

### Placeholders de runtime (manter)

Exemplos:

- `capture_status`
- `capture_order_id`
- `formatted_payment`
- `order_id`
- `link_id`

### Observação

O template também referencia `queue_id` (snake_case). Preserve se não tiver valor direto; o fluxo pode derivar internamente.

## 10) `transcricao_de_receitas` (IA - Transcrição de receita)

### Tipo

- `Ferramenta de IA` (mas instalada via template de IVR)

### Arquivo de template

- `transcricao_de_receita.txt`

### Rota backend

- `POST /install/integration`

### Campos específicos (frontend)

- nenhum (`fields: []`)

### Placeholders de runtime (manter)

- `ai_result`
- `message_file.file_id`

### Implicação para a IA

Esse template pode ser instalado só com:

- `instance`
- `username`
- `password`
- `code`

sem parâmetros adicionais de configuração.

## Catálogo resumido (rápido para roteamento da IA)

## IAs (frontend `templates_ia.ts`)

| templateKey | Nome | Endpoint |
|---|---|---|
| `atendimento` | IA - Atendimento | `/api/ia/create-ai` |
| `alpha7` | IA - Alpha 7 | `/api/ia/create-ai/alpha` |
| `vannon` | IA - Vannon | `/api/ia/create-ai/vannon` |

## Integrações (frontend `templates.ts`)

| templateKey | Nome | Tipo | Arquivo | Instala via `/install/integration` |
|---|---|---|---|---|
| `alpha7extensao` | Alpha7 - Extensão | Extensão | `Alpha7_orcamento.txt` | Não (fluxo manual) |
| `alpha7` | Alpha7 - Orçamento | Integração | `Alpha7_orcamento.txt` | Sim |
| `cashback` | Alpha7 - Cashback ativo | Integração | `alpha7_cashback_ativo.txt` | Sim |
| `ifood_notificacao` | Ifood - Notificação de pedidos | Integração | `ifood.txt` | Sim |
| `Napp` | Integração NAPP carrinho de compras | URA | `integracao_napp.txt` | Sim |
| `Cielo` | Link de pagamento - Cielo | Integração | `link_cielo.txt` | Sim |
| `Cielo_webhook` | Cielo Webhook (Notificação) | Automação | `CieloWebhook.txt` | Sim |
| `Getnet` | Link de pagamento - Getnet | Integração | `Integracao_getnet.txt` | Sim |
| `Getnet_webhook` | Webhook - Getnet | Automação | `getnet_Webhook.txt` | Sim |
| `transcricao_de_receitas` | IA - Transcrição de receita | Ferramenta de IA | `transcricao_de_receita.txt` | Sim |

## Exemplos de funções (prontas para implementar)

## Exemplo A: instalar integração por template

```ts
async function instalarIntegracaoPorTemplate(input: InstalarTemplateIntegracaoInput) {
  const catalog = INTEGRATION_TEMPLATES[input.templateKey];
  if (!catalog) throw new Error("templateKey inválido");
  if (catalog.active === false) throw new Error("Template indisponível para instalação automática");

  const templateJson = await carregarTemplateTxtBase64(catalog.file); // decode + parse JSON
  const integrationData = substituirPlaceholders(templateJson, input.params); // mantém placeholders não informados

  const body = {
    instance: normalizarUrl(input.instance),
    username: input.username,
    password: input.password,
    code: input.code,
    integration: catalog.name,
    integrationData,
  };

  return http.post(`${input.backendBaseUrl}/install/integration`, body);
}
```

## Exemplo B: criar IA por template

```ts
async function criarIaPorTemplate(input: CriarIaInput) {
  const catalog = IA_TEMPLATES[input.templateKey];
  if (!catalog) throw new Error("templateKey inválido");

  const suffix = catalog.endpoint ?? "";
  const body = {
    instance: normalizarUrl(input.instance),
    username: input.username,
    password: input.password,
    code: input.code,
    name: input.name,
    context: input.context ?? catalog.context ?? "",
    ...(input.params ?? {}),
  };

  return http.post(`${input.backendBaseUrl}/api/ia/create-ai${suffix}`, body);
}
```

## Checklist que a IA deve seguir (antes de instalar)

1. Confirmar `templateKey` e se está ativo para instalação automática.
2. Confirmar `instance` com `https://` e sem barra final.
3. Confirmar credenciais da instância (`username`, `password`, `code`).
4. Coletar todos os campos específicos do template.
5. Diferenciar placeholders de configuração vs runtime.
6. Enviar para o endpoint correto (`/install/integration` ou `/api/ia/create-ai*`).
7. Em caso de erro, retornar:
   - endpoint chamado
   - status HTTP
   - mensagem do backend
   - campos faltantes (se houver)

## Observações finais (práticas)

- A tela de IA usa `VITE_URLBASE` (fallback `https://unicocontato.tech`).
- A tela de integração usa URL hardcoded `https://unicocontato.tech/install/integration`.
- Se você for implementar um agente do zero, use `backendBaseUrl` configurável para ambos.
- Para strings com caracteres especiais, prefira substituição com escape seguro (similar ao `TemplateService` do backend), para evitar JSON inválido após substituição.

