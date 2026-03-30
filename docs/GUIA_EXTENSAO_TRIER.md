# Guia da Extensao Trier

## Visao geral

Esta extensao e um projeto `React + TypeScript + Vite` empacotado como extensao Chrome com `manifest_version: 3`.

Objetivo principal:

- autenticar um operador em uma instancia AtenderBem/Trier;
- sincronizar produtos via gateway da Trier;
- montar um orcamento no popup da extensao;
- opcionalmente coletar endereco de entrega;
- enviar a mensagem final para um chat aberto da instancia.

## Diferenca entre Extensao Trier e IA Trier

Extensao Trier:

- usa apenas configuracao de `.env`
- exige `VITE_INSTANCE_URL` e `VITE_CLIENT_TOKEN`
- nao exige `nomeCliente`, `porta_cliente` ou `apiKey` global da IA

IA Trier:

- e um fluxo separado da plataforma Unico
- usa a criacao de IA do catalogo
- pede `nomeCliente`, `porta_cliente` e `apiKey`

Regra para o Link AI:

- se o pedido for sobre extensao Trier, nunca usar o fluxo de IA Trier

## Nome e estrutura do projeto

- Nome tecnico do pacote: `inovafarma`
- Popup principal: `index.html`
- Background service worker: `background.js`
- Manifesto: `public/manifest.json`

Arquivos principais:

- `src/pages/login.tsx`
- `src/pages/budget-form.tsx`
- `src/pages/address-form.tsx`
- `src/pages/chats.tsx`
- `src/services/googleSheetsService.ts`
- `src/background.ts`

## Variaveis de ambiente obrigatorias

Usar `.env` com pelo menos:

```env
VITE_INSTANCE_URL="https://cliente.atenderbem.com/"
VITE_CLIENT_TOKEN="TOKEN_DA_TRIER"
```

## Regra critica de normalizacao da URL

`VITE_INSTANCE_URL` deve sempre terminar com `/`.

Exemplo correto:

- `https://acfarmamartins.atenderbem.com/`

Exemplo incorreto:

- `https://acfarmamartins.atenderbem.com`

Motivo:

O codigo concatena endpoints diretamente, por exemplo:

- `${VITE_INSTANCE_URL}login`
- `${VITE_INSTANCE_URL}users/{userId}/queues`
- `${VITE_INSTANCE_URL}int/getAllOpenChats`
- `${VITE_INSTANCE_URL}int/sendMessageToChat`

Se a URL base nao terminar com `/`, os endpoints ficam invalidos.

Regra para o Link AI:

- nao pedir ao usuario que corrija manualmente a barra final
- aceitar a URL com ou sem `/`
- adicionar a barra automaticamente antes de montar o `.env`

## Fluxo funcional da extensao

### 1. Login

Tela: `src/pages/login.tsx`

- faz `POST` para `{VITE_INSTANCE_URL}login`
- envia `username` e `password`
- bloqueia usuarios administradores (`response.data.user.type === 0`)
- salva `token` e `userId` em `chrome.storage.sync`

### 2. Sincronizacao de produtos

Arquivos:

- `src/background.ts`
- `src/services/googleSheetsService.ts`

Comportamento:

- sincronizacao inicial apos login
- sincronizacao periodica a cada 10 minutos
- uso do gateway Trier: `https://api-sgf-gateway.triersistemas.com.br`
- autenticacao no gateway via `Bearer ${VITE_CLIENT_TOKEN}`
- cache local com `idb`

## 3. Montagem do orcamento

Tela: `src/pages/budget-form.tsx`

- seleciona produtos
- calcula valor final considerando desconto e quantidade
- permite marcar delivery

## 4. Endereco de entrega

Tela: `src/pages/address-form.tsx`

- coleta CEP, logradouro, numero, complemento, bairro, cidade, estado
- consulta CEP pela BrasilAPI
- coleta taxa de entrega

## 5. Escolha do chat e envio

Tela: `src/pages/chats.tsx`

Fluxo:

1. busca filas do usuario em `{VITE_INSTANCE_URL}users/{userId}/queues`
2. busca chats abertos em `{VITE_INSTANCE_URL}int/getAllOpenChats`
3. permite selecionar forma de pagamento e CPF
4. envia a mensagem final para `{VITE_INSTANCE_URL}int/sendMessageToChat`

## Rotas internas do popup

A extensao usa `HashRouter` com estas rotas:

- `/login`
- `/`
- `/address`
- `/chats`

## Permissoes e manifest

Permissoes declaradas no manifesto:

- `storage`
- `tabs`
- `activeTab`
- `webRequest`
- `alarms`

Host permissions:

- `https://api-sgf-gateway.triersistemas.com.br/*`

## Build

Comandos:

```bash
npm install
npm run build
```

Saida:

- pasta `dist/`

Uso no Chrome:

- abrir `chrome://extensions`
- ativar modo desenvolvedor
- carregar a pasta `dist` como extensao descompactada

## Template padrao no backend

Para producao Linux, o backend pode manter o template da extensao dentro do proprio projeto, no mesmo estilo do `app-Alpha7`.

Caminho recomendado:

- `back/templates/trier-inovafarma`

Regra operacional:

- em producao, preferir esse template interno
- usar `TRIER_EXTENSION_TEMPLATE_DIR` apenas se quiser sobrescrever o template padrao
- nao depender de `.tmp` na VPS

## Fluxo esperado no Link AI

Quando o operador enviar a URL da instancia e o token da Trier:

1. o Link AI deve confirmar os dados entendidos;
2. somente apos a confirmacao do operador ele deve gerar o build;
3. o backend deve empacotar apenas os arquivos finais da pasta `dist` em um ZIP;
4. o chat deve disponibilizar esse ZIP para download.

## Regras para o Link AI

Quando orientar sobre esta extensao:

- normalizar `VITE_INSTANCE_URL` automaticamente para terminar com `/`
- nunca inventar endpoints fora dos existentes no codigo
- nunca expor um token real; usar apenas placeholders ou pedir o token ao operador
- se o usuario pedir o passo a passo de criacao/configuracao, usar este fluxo como fonte de verdade
