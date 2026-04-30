# Guia Completo: AtenderBem, Endpoints, Estruturas e Regras de Operacao

## Objetivo

Este documento descreve, de forma consolidada, o que foi aprendido sobre o ecossistema `atenderbem.com` dentro deste projeto.

O foco aqui e:

- autenticar em instancias AtenderBem;
- entender a diferenca entre IAs e fluxos;
- saber quais endpoints HTTP foram descobertos e utilizados;
- entender quais payloads sao necessarios;
- entender o que esses endpoints retornam;
- conhecer as regras de negocio importantes para operar com seguranca;
- orientar outros agentes sobre como navegar, auditar e atualizar o ecossistema.

Este guia e voltado para agentes tecnicos, Tech Leads, CTOs, operadores de integracao e desenvolvedores.

## Conceitos fundamentais da plataforma

### 1. Assistant

Na pratica, o `assistant` e a entidade principal da IA na plataforma.

Ele representa:

- o nome da IA;
- o prompt principal;
- variaveis e configuracoes do assistente;
- referencias a automacoes auxiliares, como `preautomation`.

No projeto, o `assistant` e tratado como o componente central da instalacao.

### 2. IVR / automacao / fluxo / URA

Na plataforma, os fluxos sao tratados como `IVR`.

No contexto do projeto, esses nomes aparecem como sinonimos:

- IVR
- fluxo
- automacao
- URA

Esses objetos representam:

- pre-processamento;
- busca de produtos;
- download de imagem;
- URA IA;
- URA AB;
- outras automacoes auxiliares.

Cada fluxo costuma ser armazenado como um JSON grande com:

- metadados do fluxo;
- `initialtext`
- `finishtext`
- `options`
- configuracoes de timeout;
- propriedades de execucao;
- e, dentro de `options`, os blocos do fluxo.

### 3. `options`

O coracao do fluxo fica no campo `options`.

Esse campo normalmente vem como:

- string JSON serializada, ou
- array de objetos, dependendo do endpoint ou do tratamento local.

Cada item de `options` representa um bloco do fluxo.

Campos comuns por bloco:

- `id`
- `type`
- `x`
- `y`
- `info`
- `config`
- `configured`

### 4. Bloco JavaScript

Os blocos `type: 21` sao os JavaScripts do fluxo.

Eles costumam ser usados para:

- inicializar variaveis em `vars[...]`
- processar resultados de APIs
- montar listas intermediarias
- setar flags de controle do fluxo

No caso da `URA IA`, o primeiro `type: 21` e especialmente importante porque costuma carregar as variaveis de configuracao do cliente.

## Autenticacao na instancia

### Endpoint de login

Metodo:

- `POST {instance}/login`

Exemplo:

```http
POST https://ambientesdetesteunicocontato.atenderbem.com/login
Content-Type: application/json
Accept: application/json
```

Payload:

```json
{
  "username": "rl--instalador",
  "password": "senha",
  "code": "123456",
  "trusted": false
}
```

### O que precisa

- URL da instancia
- usuario valido da instancia
- senha valida
- codigo 2FA/TOTP atual

### O que retorna

Quando funciona, a resposta contem um `token`.

Estrutura esperada, na pratica:

```json
{
  "token": "jwt-ou-token-da-plataforma"
}
```

### Exemplo realista de resposta

```json
{
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.redacted.signature",
  "user": {
    "username": "rl--instalador",
    "name": "Instalador"
  }
}
```

### Como o projeto usa

Arquivos:

- [c:\dev\unicointegracompleto\back\src\services\loginInstance.js](c:\dev\unicointegracompleto\back\src\services\loginInstance.js)
- [c:\dev\unicointegracompleto\back\src\services\instanceApi.services.js](c:\dev\unicointegracompleto\back\src\services\instanceApi.services.js)

Fluxo:

1. o backend resolve as credenciais operacionais;
2. chama `POST /login`;
3. guarda o `token`;
4. usa o `token` nas demais operacoes.

### Erros conhecidos

#### `AUTH_004`

Sinaliza falha de autenticacao.

As causas mais provaveis sao:

- usuario errado;
- senha errada;
- `secret` TOTP errado;
- QR Code/secret de outro usuario;
- 2FA ainda nao concluido/ativado;
- codigo TOTP fora da janela de tempo.

## Conta tecnica e TOTP

O projeto foi evoluido para operar preferencialmente com uma conta tecnica fixa no backend.

### Variaveis de ambiente

- `INSTANCE_SERVICE_USERNAME`
- `INSTANCE_SERVICE_PASSWORD`
- `INSTANCE_SERVICE_TOTP_SECRET`
- `INSTANCE_SERVICE_TOTP_DIGITS`
- `INSTANCE_SERVICE_TOTP_PERIOD_SECONDS`

### Regra operacional

Quando essas variaveis existem:

- instalacoes usam a conta tecnica;
- atualizacoes usam a conta tecnica;
- auditorias usam a conta tecnica;
- o codigo do operador vira apenas fallback manual.

### Formatos aceitos para o TOTP

O sistema aceita:

- `secret` Base32 puro
- ou a URL inteira `otpauth://...`

Exemplo:

```txt
otpauth://totp/AtenderBem:Instalador?issuer=AtenderBem&secret=ABCDEF123456...
```

## Header de autenticacao nas demais rotas

Depois do login:

```http
Authorization: Bearer <token>
Content-Type: application/json
```

## Padrao de headers

### Headers de login

```http
Content-Type: application/json
Accept: application/json
```

### Headers padrao para endpoints autenticados

```http
Authorization: Bearer <token>
Content-Type: application/json
Accept: application/json
```

## Corpos padrao

### Body padrao de login

```json
{
  "username": "usuario_da_instancia",
  "password": "senha_da_instancia",
  "code": "123456",
  "trusted": false
}
```

### Body padrao de uma IA / assistant

Exemplo estrutural de body de assistant usado no sistema:

```json
{
  "id": 115,
  "name": "Alpha7 - IA - Alpha 7",
  "signaturename": "IA - Alpha 7",
  "type": 2,
  "description": "Voce e o assistente de vendas...",
  "internaldescription": "",
  "preautomation": 1403,
  "variables": []
}
```

### Body padrao de um IVR / fluxo

Exemplo estrutural de body de fluxo:

```json
{
  "name": "IA alpha 7 - URA",
  "type": 1,
  "version": 1,
  "initialtext": "ab75ad470",
  "description": null,
  "listitems": "[]",
  "options": "[{\"id\":\"...\",\"type\":21,\"config\":{\"code\":\"...\"}}]",
  "finishtext": "ab2f57690",
  "timeout": 300,
  "buttons": "[]"
}
```

## Endpoints HTTP descobertos e usados

## 1. Listar assistants

Metodo:

- `POST {instance}/assistants/getItems`

Exemplo:

```http
POST https://ambientesdetesteunicocontato.atenderbem.com/assistants/getItems
Authorization: Bearer <token>
Content-Type: application/json
```

Payload usado:

```json
{
  "full": true
}
```

### Para que serve

- listar todas as IAs realmente existentes na instancia;
- reconciliar banco local vs estado real da instancia;
- descobrir `assistantId` valido;
- validar se um registro local esta stale;
- descobrir duplicidades.

### O que retorna

Retorna a lista de assistants da instancia.

O formato exato pode variar, mas na pratica ha objetos com informacoes como:

- `id`
- `name`
- demais propriedades do assistant

### Exemplo realista de item retornado

```json
{
  "id": 115,
  "name": "Alpha7 - IA - Alpha 7",
  "signaturename": "IA - Alpha 7",
  "type": 2,
  "description": "Voce e o assistente de vendas...",
  "preautomation": 1403,
  "createdAt": "2026-04-27T11:52:08.000Z",
  "updatedAt": "2026-04-29T12:24:31.000Z"
}
```

### Regras operacionais

- e a melhor rota para descobrir quais IAs existem de verdade;
- deve ser usada antes de concluir que um `assistantId` local ainda e valido.

### Header minimo

```http
Authorization: Bearer <token>
Content-Type: application/json
```

### Body minimo

```json
{
  "full": true
}
```

### Body padrao recomendado

```json
{
  "full": true
}
```

## 2. Criar assistant

Metodo:

- `POST {instance}/assistants/createItem`

Payload minimo usado pelo projeto:

```json
{
  "name": "Novo assistente"
}
```

### Header minimo

```http
Authorization: Bearer <token>
Content-Type: application/json
```

### Body minimo

```json
{
  "name": "Novo assistente"
}
```

### Body padrao recomendado

Na criacao inicial, o projeto usa body minimo e depois chama `updateItem`.

```json
{
  "name": "Novo assistente"
}
```

### Para que serve

- cria o assistant base;
- depois o backend atualiza esse assistant com o template correto do provider.

### O que retorna

Na pratica, retorna o assistant criado, incluindo `id`.

Campo crucial:

- `id`

### Exemplo realista de resposta

```json
{
  "id": 115,
  "name": "Novo assistente",
  "createdAt": "2026-04-27T11:52:08.000Z",
  "updatedAt": "2026-04-27T11:52:08.000Z"
}
```

### Regra de negocio no projeto

Para providers gerenciados, o fluxo atual e:

1. criar o assistant vazio;
2. criar os IVRs auxiliares;
3. renderizar o template final do assistant com os IDs corretos;
4. atualizar o assistant.

## 3. Atualizar assistant

Metodo:

- `POST {instance}/assistants/updateItem`

### Para que serve

- aplicar o template final do assistant;
- atualizar o prompt/config principal de uma IA existente.

### O que precisa

- `token`
- payload do assistant completo ou suficientemente estruturado

### Header minimo

```http
Authorization: Bearer <token>
Content-Type: application/json
```

### Body minimo

```json
{
  "id": 115,
  "name": "Alpha7 - IA - Alpha 7"
}
```

### Body padrao recomendado

```json
{
  "id": 115,
  "name": "Alpha7 - IA - Alpha 7",
  "signaturename": "IA - Alpha 7",
  "type": 2,
  "preautomation": 1403,
  "description": "Voce e o assistente de vendas da farmacia...",
  "internaldescription": "",
  "variables": []
}
```

### O que retorna

Retorna o resultado da atualizacao do assistant.

### Exemplo realista de payload enviado

```json
{
  "id": 115,
  "name": "Alpha7 - IA - Alpha 7",
  "signaturename": "IA - Alpha 7",
  "type": 2,
  "preautomation": 1403,
  "description": "Voce e o assistente de vendas da farmacia...",
  "internaldescription": "",
  "variables": []
}
```

### Regra de negocio no projeto

Hoje a base da atualizacao deve vir do template publicado no backend, nao do arquivo `.json` local.

## 4. Criar IVR

Metodo:

- `POST {instance}/ivrs/`

### Para que serve

- instalar automacoes auxiliares;
- criar `preProcess`;
- criar `buscaProdutos`;
- criar `downloadImagem`;
- criar `ura`;
- criar `uraAb`;
- instalar integracoes genericas baseadas em template.

### O que precisa

- `token`
- payload completo do fluxo/IVR

### Header minimo

```http
Authorization: Bearer <token>
Content-Type: application/json
```

### Body minimo

Na pratica, mesmo o corpo minimo precisa ter estrutura suficiente para a plataforma aceitar o fluxo:

```json
{
  "name": "Fluxo exemplo",
  "type": 1,
  "initialtext": "node_1",
  "options": "[]",
  "timeout": 300,
  "buttons": "[]"
}
```

### Body padrao recomendado

```json
{
  "name": "IA alpha 7 - URA",
  "type": 1,
  "version": 1,
  "initialtext": "ab75ad470",
  "description": null,
  "listitems": "[]",
  "options": "[{\"id\":\"a12abfbf0\",\"type\":77,\"config\":{\"assistantId\":115,\"nextElementId\":\"aa21b0a60\",\"transferNextElementId\":\"aa21b0a60\"}},{\"id\":\"ab75ad470\",\"type\":21,\"config\":{\"code\":\"vars['url_cliente_var'] = 'https://instancia.atenderbem.com'\\nvars['api_key_var'] = '***'\\nvars['nome_cliente_var'] = 'Cliente Exemplo'\\nvars['ip_cliente'] = '145.223.27.100'\\nvars['porta_cliente_var'] = 5801,\\nvars['unidade_negocio_var'] = 50003840493\\nvars['qtd_produtos'] = 3\",\"nextElementId\":\"a12abfbf0\"}}]",
  "finishtext": "ab2f57690",
  "timeout": 300,
  "buttons": "[]"
}
```

### O que retorna

Retorna a automacao criada.

Campo crucial:

- `id`

### Exemplo realista de resposta

```json
{
  "id": 1416,
  "name": "IA alpha 7 - URA",
  "type": 1,
  "initialtext": "ab75ad470",
  "createdAt": "2026-04-27T11:52:08.000Z",
  "updatedAt": "2026-04-27T11:52:08.000Z"
}
```

### Regra de negocio no projeto

Na instalacao de IAs gerenciadas, os IDs retornados aqui sao salvos no banco local em:

- `preProcessId`
- `buscaProdutosId`
- `downloadImagemId`
- `uraIaId`
- `uraAbId`

## 5. Ler IVR

Metodo:

- `GET {instance}/ivrs/{ivrId}`

Exemplo:

```http
GET https://ambientesdetesteunicocontato.atenderbem.com/ivrs/1420
Authorization: Bearer <token>
```

### Para que serve

- ler o fluxo atual da instancia;
- validar se o banco esta apontando para o IVR correto;
- localizar o primeiro JavaScript da URA;
- comparar conteudo atual com template esperado;
- extrair variaveis salvas na URA;
- descobrir se uma automacao esta com estrutura diferente do padrao.

### O que retorna

Retorna o JSON do fluxo.

Campos tipicos observados:

- `id`
- `name`
- `type`
- `version`
- `initialtext`
- `description`
- `options`
- `finishtext`
- `timeout`
- `buttons`
- `createdAt`
- `updatedAt`

### Exemplo realista de resposta resumida da URA

```json
{
  "id": 1416,
  "name": "IA alpha 7 - URA",
  "type": 1,
  "version": 1,
  "initialtext": "ab75ad470",
  "description": null,
  "options": "[{\"id\":\"a12abfbf0\",\"type\":77,\"config\":{\"assistantId\":115,\"nextElementId\":\"aa21b0a60\",\"transferNextElementId\":\"aa21b0a60\"}},{\"id\":\"ab75ad470\",\"type\":21,\"config\":{\"code\":\"vars['url_cliente_var'] = 'https://instancia.atenderbem.com'\\nvars['api_key_var'] = '***'\\nvars['nome_cliente_var'] = 'Cliente Exemplo'\\nvars['ip_cliente'] = '145.223.27.100'\\nvars['porta_cliente_var'] = 5801,\\nvars['unidade_negocio_var'] = 50003840493\\nvars['qtd_produtos'] = 3\",\"nextElementId\":\"a12abfbf0\"}}]",
  "finishtext": "ab2f57690",
  "timeout": 300,
  "buttons": "[]",
  "createdAt": "2026-04-27T11:52:08.000Z",
  "updatedAt": "2026-04-29T12:24:31.000Z"
}
```

### Observacao importante

`options` pode vir:

- como string JSON;
- ou como array ja parseado.

O agente que consumir essa rota deve suportar os dois formatos.

### Header minimo

```http
Authorization: Bearer <token>
Accept: application/json
```

### Body

Esse endpoint nao usa body.

## 6. Atualizar IVR

Metodo:

- `PUT {instance}/ivrs/{ivrId}`

### Para que serve

- atualizar um fluxo existente;
- aplicar novo template de `buscaProdutos`, `preProcess` ou `downloadImagem`;
- aplicar patch seguro na URA;
- corrigir uma automacao sem recria-la.

### O que precisa

- `token`
- `ivrId`
- payload completo do fluxo a ser salvo

### Header minimo

```http
Authorization: Bearer <token>
Content-Type: application/json
```

### Body minimo

Atualizacao parcial e arriscada. O minimo operacional costuma ser um fluxo completo ou quase completo:

```json
{
  "name": "Fluxo exemplo",
  "type": 1,
  "initialtext": "node_1",
  "options": "[]",
  "timeout": 300,
  "buttons": "[]"
}
```

### Body padrao recomendado

Use o fluxo completo, preservando a estrutura do IVR atual e alterando apenas o necessario.

### O que retorna

Retorna o resultado da atualizacao.

### Exemplo realista de payload de update da URA

```json
{
  "name": "IA alpha 7 - URA",
  "type": 1,
  "version": 1,
  "initialtext": "ab75ad470",
  "description": null,
  "listitems": "[]",
  "options": "[{\"id\":\"a12abfbf0\",\"type\":77,\"config\":{\"assistantId\":115,\"nextElementId\":\"aa21b0a60\",\"transferNextElementId\":\"aa21b0a60\"}},{\"id\":\"ab75ad470\",\"type\":21,\"config\":{\"code\":\"vars['url_cliente_var'] = 'https://instancia.atenderbem.com'\\nvars['api_key_var'] = '***'\\nvars['nome_cliente_var'] = 'Cliente Exemplo'\\nvars['ip_cliente'] = '145.223.27.100'\\nvars['porta_cliente_var'] = 5801,\\nvars['unidade_negocio_var'] = 50003840493\\nvars['qtd_produtos'] = 3\",\"nextElementId\":\"a12abfbf0\"}}]",
  "finishtext": "ab2f57690",
  "timeout": 300,
  "buttons": "[]"
}
```

### Regra de negocio critica

Atualizar um IVR com payload completo e poderoso, mas arriscado.

Se o IVR for personalizado por cliente, um `PUT` com template inteiro pode sobrescrever customizacoes locais.

Por isso:

- `URA IA` e `URA AB` nao entram no update automatico;
- para URA, o ideal e usar patch cirurgico quando possivel.

## Endpoints internos do backend ligados ao AtenderBem

Esses endpoints nao sao da plataforma `atenderbem.com`, mas sao o ponto de entrada do projeto para operar nela.

## Criacao de IAs

Rotas principais do backend:

- `POST /api/ia/create-ai`
- `POST /api/ia/create-ai-alpha`
- `POST /api/ia/create-ai-trier`
- `POST /api/ia/create-ai-vannon`
- `POST /api/ia/create-ai-vetor`

### O que fazem

- autenticam na instancia;
- criam assistant;
- criam IVRs auxiliares;
- aplicam template final do backend;
- registram a instalacao localmente.

## Atualizacao de instalacoes gerenciadas

- `POST /api/ia/installations/:id/update`
- `POST /api/ia/installations/update-all`

### O que fazem

- carregam a instalacao do banco;
- verificam se pode atualizar;
- buscam o pacote publicado do provider;
- renderizam os componentes;
- atualizam a instancia;
- atualizam o status local.

## Patch seguro de URA

- `POST /api/ia/installations/:id/patch-ura-qtd`

### O que faz

- le a URA atual;
- encontra o primeiro JS;
- injeta ou atualiza `qtd_produtos`;
- preserva o restante do fluxo.

## Auditoria de snapshots de URA

- `POST /api/ia/installations/audit-ura-snapshots`

### O que faz

- le a `URA IA` das instalacoes integradas;
- compara variaveis com `configSnapshot`;
- atualiza o banco local quando a instancia mudou fora do sistema.

## Estruturas relevantes dentro dos fluxos

## Exemplo real de URA `alpha7` com placeholders

Trecho representativo do template base da URA:

```json
{
  "name": "IA alpha 7 - URA",
  "type": 1,
  "initialtext": "ab75ad470",
  "options": "[{\"id\":\"a12abfbf0\",\"type\":77,\"config\":{\"assistantId\":{{ia_id}},\"nextElementId\":\"aa21b0a60\",\"transferNextElementId\":\"aa21b0a60\"}},{\"id\":\"ab75ad470\",\"type\":21,\"config\":{\"code\":\"vars['url_cliente_var'] = '{{url_cliente}}'\\nvars['api_key_var'] = '{{api_key}}'\\nvars['nome_cliente_var'] = '{{nome_cliente}}'\\nvars['ip_cliente'] = '145.223.27.100'\\nvars['porta_cliente_var'] = {{porta_cliente}},\\nvars['unidade_negocio_var'] = {{unidade_negocio}}\\nvars['qtd_produtos'] = {{quantidade_de_produtos}}\",\"nextElementId\":\"a12abfbf0\"}}]"
}
```

### O que esse trecho mostra

- o `assistantId` e injetado via `{{ia_id}}`
- a URA inicializa variaveis do cliente no primeiro JS
- `qtd_produtos` tambem e injetado na renderizacao do template

## Exemplo real de `buscaProdutos`

Trecho representativo do fluxo:

```json
{
  "name": "busca_produtos",
  "type": 2,
  "initialtext": "a64a15680",
  "options": "[{\"id\":\"a64a15680\",\"type\":21,\"config\":{\"code\":\"vars['buscando'] = true\",\"nextElementId\":\"a77685070\"}},{\"id\":\"a9258fb50\",\"type\":12,\"config\":{\"varPrefix\":\"itens\",\"dataType\":\"jsonraw\",\"method\":\"post\",\"url\":\"http://{{ip_cliente}}:{{porta_cliente_var}}/api/buscar-medicamentos\",\"dataRaw\":\"{\\\"query\\\":\\\"{{assistant_produto}}\\\",\\\"unidade_negocio_id\\\":{{unidade_negocio_var}}}\",\"nextElementId\":\"ab2746f00\"}},{\"id\":\"a604404f0\",\"type\":27,\"config\":{\"automationId\":\"{{download_img_id}}\",\"nextElementId\":\"a7820b910\"}}]"
}
```

### O que esse trecho mostra

- `type: 12` chama a API do ERP
- `varPrefix: itens` guarda o retorno para processamento posterior
- `type: 27` chama o fluxo de `downloadImagem`
- `downloadImagem` pode ser descoberto via `automationId`

## Tipos de bloco relevantes observados

### `type: 21`

JavaScript.

Usado para:

- setar `vars[...]`
- processar payloads de API
- montar listas
- controlar flags

### `type: 12`

Requisicao HTTP / integracao de dados.

Campos comuns em `config`:

- `varPrefix`
- `dataType`
- `method`
- `url`
- `dataRaw`
- `headers`
- `timeout`
- `nextElementId`

### `type: 27`

Chamada para outra automacao.

Campo importante:

- `automationId`

Esse bloco foi importante em `buscaProdutos`, onde o fluxo usa `downloadImagem` como sub-automacao encadeada.

### `type: 77`

Bloco que referencia `assistantId`.

No caso da URA, costuma ser o bloco que liga o fluxo ao assistant correspondente.

Campo importante:

- `config.assistantId`

### `type: 11`

Bloco de decisao/condicao.

### `type: 3` e `type: 0`

Blocos de mensagem/texto intermediarios no fluxo.

## Estrutura da URA IA

### Papel da URA

A `URA IA` funciona como fluxo de orquestracao ao redor do assistant.

Ela costuma:

- carregar variaveis do cliente;
- chamar o assistant;
- lidar com busca;
- acionar `downloadImagem`;
- tratar transferencia e fallback.

### Primeiro JavaScript da URA

O primeiro `type: 21` da URA e critico.

Ali ficam variaveis como:

- `url_cliente_var`
- `api_key_var`
- `nome_cliente_var`
- `ip_cliente`
- `porta_cliente_var`
- `unidade_negocio_var`
- `qtd_produtos`

### Exemplo realista desse primeiro JavaScript

```js
vars['url_cliente_var'] = 'https://ambientesdetesteunicocontato.atenderbem.com'
vars['api_key_var'] = '***'
vars['nome_cliente_var'] = 'Ambiente de testes'
vars['ip_cliente'] = '145.223.27.100'
vars['porta_cliente_var'] = 5801,
vars['unidade_negocio_var'] = 50003840493
vars['qtd_produtos'] = 3
```

### Regra de auditoria

Essas variaveis sao a base da reconciliacao noturna do snapshot.

Se alguem alterar esse trecho diretamente na instancia, o backend pode refletir a mudanca no banco local.

## Estrutura da `buscaProdutos`

### Papel

Fluxo responsavel por:

- consultar a API do ERP / farmacia;
- processar produtos retornados;
- montar lista final;
- disparar mensagens para o chat;
- acionar automacoes de imagem.

### Relacao com `downloadImagem`

O `downloadImagem` costuma ficar vinculado a `buscaProdutos` via blocos `type: 27`.

Por isso, para descobrir o ID correto de `downloadImagem`, e comum:

1. descobrir o ID de `buscaProdutos`;
2. ler o IVR de `buscaProdutos`;
3. localizar blocos `type: 27`;
4. extrair o `automationId` apontado.

Isso foi uma estrategia real usada para saneamento de registros.

## Regras de negocio importantes

## 1. Backend publicado e a fonte de verdade

Instalacoes e atualizacoes devem usar:

- `sistema.ai_provider_templates`
- `sistema.ai_template_bases`

Nao devem depender de arquivo local `.json` durante a execucao operacional.

## 2. `URA IA` e `URA AB` nao entram no update automatico

Motivo:

- sao altamente customizaveis por cliente;
- sobrescrever integralmente e arriscado.

Regra atual:

- nao aparecem no update manual;
- nao aparecem no update em lote;
- o backend bloqueia tentativa de atualizar por esse caminho.

## 3. Patch de URA deve ser cirurgico

Se for preciso alterar algo pequeno na URA:

- ler fluxo atual;
- localizar primeiro JS;
- editar so esse trecho;
- manter o resto intacto.

## 4. Nem toda IA listada e gerenciavel

Existem registros que devem ficar apenas catalogados:

- `legacy`
- `IA - Atendimento`
- `SDR`

Essas IAs:

- podem existir na instancia;
- devem ser listadas no banco;
- mas nao devem entrar no fluxo automatico de rollout gerenciado.

## 5. O banco local precisa refletir a realidade da instancia

Os registros em `sistema.ai_client_installations` podem ficar errados ao longo do tempo.

Problemas reais ja encontrados:

- `assistantId` stale
- `uraIaId` errado
- duplicidade de registros
- instalacoes reais sem registro local

A reconciliacao com `assistants/getItems` e `GET /ivrs/{id}` faz parte da operacao.

## O que um agente precisa validar antes de mexer

Antes de instalar ou atualizar uma IA:

1. a autenticacao automatica esta ativa?
2. o template atual publicado existe no banco?
3. a instalacao esta registrada em `ai_client_installations`?
4. os IDs (`assistantId`, `buscaProdutosId`, `uraIaId` etc.) estao corretos?
5. a alteracao envolve `URA`? se sim, o fluxo normal nao e o caminho certo.

## O que um agente precisa validar antes de remover registro

1. o assistant ainda existe na instancia?
2. existe outro registro local valido para a mesma IA?
3. o registro e realmente stale ou esta apenas incompleto?

## O que um agente precisa validar antes de criar registro faltante

1. a IA existe na instancia?
2. o `assistantId` nao esta registrado ainda?
3. e uma IA gerenciada ou apenas catalogavel?
4. os IVRs ligados a ela podem ser identificados com seguranca?

## Respostas e estados importantes no backend local

Na listagem de instalacoes gerenciadas, campos importantes:

- `updateAvailable`
- `canUpdate`
- `source`
- `installedVersion`
- `currentVersion`
- `installedComponentVersions`
- `currentComponentVersions`
- `componentsNeedingUpdate`
- `lastSyncStatus`
- `lastSyncError`

### `source`

Valores encontrados:

- `managed`
- `manual_import`
- `legacy-ai_versions`
- `instance_scan`

### Exemplo realista de registro de instalacao gerenciada

```json
{
  "id": 70,
  "instance": "https://ambientesdetesteunicocontato.atenderbem.com",
  "provider": "alpha7",
  "assistantId": "115",
  "assistantName": "Alpha7 - IA - Alpha 7",
  "installedVersion": 16,
  "currentVersion": 16,
  "updateAvailable": false,
  "canUpdate": true,
  "source": "managed",
  "configSnapshot": {
    "apiKey": "***",
    "nome_cliente": "Ambiente de testes",
    "porta_cliente": "5801",
    "unidade_negocio": "50003840493",
    "assistantDisplayName": "IA - Alpha 7",
    "quantidade_de_produtos": 3
  },
  "installedComponentVersions": {
    "assistant": 3,
    "preProcess": 3,
    "buscaProdutos": 7,
    "downloadImagem": 6
  },
  "preProcessId": "1418",
  "buscaProdutosId": "1415",
  "downloadImagemId": "1414",
  "uraIaId": "1416",
  "uraAbId": "1417",
  "lastSyncStatus": "updated",
  "lastSyncError": null
}
```

### `canUpdate`

So deve ser `true` quando:

- provider e gerenciado;
- nao esta bloqueado;
- os IDs e configuracoes minimas existem.

## Troubleshooting

## `AUTH_004`

Indica falha de autenticacao na instancia.

Checar:

- usuario
- senha
- secret TOTP
- conclusao da ativacao do 2FA

## `O campo "username" e obrigatorio`

Se a conta tecnica estiver configurada, isso indica:

- backend nao reiniciado apos mudanca;
- controller antigo ainda exigindo username antes do fluxo de service account;
- ou ambiente sem as variaveis da conta tecnica.

## `Nao foi possivel ler os blocos atuais da URA`

Indica normalmente:

- `uraIaId` errado;
- ou resposta inesperada de `GET /ivrs/{id}`;
- ou `options` malformado/inesperado.

## A atualizacao executou, mas nao refletiu a mudanca esperada

Checar:

1. o pacote atual publicado no banco contem a mudanca?
2. o update foi feito para o componente certo?
3. a instalacao esta com IDs corretos?
4. o componente esta fora do fluxo automatico por regra de negocio?

## Script independente para gerar o codigo 2FA

Foi criado um script standalone em:

- [c:\dev\unicointegracompleto\back\scripts\generate-atenderbem-totp.mjs](c:\dev\unicointegracompleto\back\scripts\generate-atenderbem-totp.mjs)

Ele:

- aceita `secret` Base32 ou `otpauth://...`
- usa apenas `node:crypto`
- nao depende dos services internos do projeto
- pode ser entregue para outro agente como ferramenta isolada

### Exemplos de uso

Com `secret` direto:

```powershell
node .\scripts\generate-atenderbem-totp.mjs --secret ABCDEF123456
```

Com `otpauth://...`:

```powershell
node .\scripts\generate-atenderbem-totp.mjs --otpauth "otpauth://totp/AtenderBem:Instalador?secret=ABCDEF123456&issuer=AtenderBem"
```

Com variavel de ambiente:

```powershell
$env:INSTANCE_SERVICE_TOTP_SECRET="otpauth://totp/AtenderBem:Instalador?secret=ABCDEF123456&issuer=AtenderBem"
node .\scripts\generate-atenderbem-totp.mjs
```

### O que ele retorna

Saida JSON simples:

```json
{
  "token": "123456",
  "digits": 6,
  "period": 30,
  "counter": 12345678
}
```

## Recomendacao final para agentes

Se um agente for operar em cima do AtenderBem, ele deve seguir esta ordem mental:

1. autenticar corretamente;
2. descobrir o estado real da instancia;
3. reconciliar com o banco local;
4. carregar apenas template publicado do backend;
5. evitar overwrite de URA;
6. usar patch seguro quando a alteracao for localizada;
7. registrar ou atualizar o snapshot local depois da operacao.
