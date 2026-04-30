# Guia da API do AtenderBem

## Objetivo

Este documento descreve somente a API da plataforma `atenderbem.com`.

Ele nao cobre:

- rotas do backend do Unico Integra
- regras internas de controllers do projeto
- endpoints `/api/...` locais

O foco aqui e exclusivamente:

- autenticacao na instancia
- endpoints HTTP descobertos
- headers necessarios
- bodies minimos
- bodies padrao
- respostas esperadas
- estruturas de `assistant` e `IVR`

## Visao geral da plataforma

A API do AtenderBem, no contexto observado, gira principalmente em torno de dois grupos de recurso:

1. `assistants`
   - representam as IAs da plataforma

2. `ivrs`
   - representam automacoes, fluxos e URAs

## Autenticacao

## Login

Metodo:

- `POST {instance}/login`

Exemplo:

```http
POST https://ambientesdetesteunicocontato.atenderbem.com/login
Content-Type: application/json
Accept: application/json
```

### Headers

```http
Content-Type: application/json
Accept: application/json
```

### Body minimo

```json
{
  "username": "usuario_da_instancia",
  "password": "senha_da_instancia",
  "code": "123456",
  "trusted": false
}
```

### Body padrao recomendado

```json
{
  "username": "rl--instalador",
  "password": "senha_da_conta",
  "code": "123456",
  "trusted": false
}
```

### O que retorna

Quando o login funciona, a resposta contem um `token`.

Exemplo realista:

```json
{
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.redacted.signature",
  "user": {
    "username": "rl--instalador",
    "name": "Instalador"
  }
}
```

### Erros conhecidos

#### `AUTH_004`

Indica falha de autenticacao.

Causas provaveis:

- usuario incorreto
- senha incorreta
- TOTP incorreto
- `secret` TOTP de outra conta
- 2FA nao concluido

## Headers padrao das rotas autenticadas

Depois do login:

```http
Authorization: Bearer <token>
Content-Type: application/json
Accept: application/json
```

## Endpoints descobertos

## 1. Listar IAs

Metodo:

- `POST {instance}/assistants/getItems`

Exemplo:

```http
POST https://ambientesdetesteunicocontato.atenderbem.com/assistants/getItems
Authorization: Bearer <token>
Content-Type: application/json
Accept: application/json
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

### O que faz

- lista todas as IAs existentes na instancia
- permite reconciliar `assistantId`
- permite detectar duplicidade e stale

### O que retorna

Retorna lista de assistants.

Exemplo realista de item:

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

## 2. Criar IA

Metodo:

- `POST {instance}/assistants/createItem`

Exemplo:

```http
POST https://ambientesdetesteunicocontato.atenderbem.com/assistants/createItem
Authorization: Bearer <token>
Content-Type: application/json
Accept: application/json
```

### Body minimo

```json
{
  "name": "Novo assistente"
}
```

### Body padrao recomendado

Na criacao inicial observada, o corpo e minimo e a configuracao completa vem depois no `updateItem`.

```json
{
  "name": "Novo assistente"
}
```

### O que faz

- cria o registro inicial da IA

### O que retorna

Exemplo realista:

```json
{
  "id": 115,
  "name": "Novo assistente",
  "createdAt": "2026-04-27T11:52:08.000Z",
  "updatedAt": "2026-04-27T11:52:08.000Z"
}
```

## 3. Atualizar IA

Metodo:

- `POST {instance}/assistants/updateItem`

Exemplo:

```http
POST https://ambientesdetesteunicocontato.atenderbem.com/assistants/updateItem
Authorization: Bearer <token>
Content-Type: application/json
Accept: application/json
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

### O que faz

- atualiza o prompt e configuracao principal da IA
- associa `preautomation` e outras configuracoes

### O que retorna

Retorna o assistant atualizado.

## 4. Criar fluxo / IVR

Metodo:

- `POST {instance}/ivrs/`

Exemplo:

```http
POST https://ambientesdetesteunicocontato.atenderbem.com/ivrs/
Authorization: Bearer <token>
Content-Type: application/json
Accept: application/json
```

### Body minimo

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

### O que faz

- cria um fluxo, automacao ou URA

### O que retorna

Exemplo realista:

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

## 5. Ler fluxo / IVR

Metodo:

- `GET {instance}/ivrs/{ivrId}`

Exemplo:

```http
GET https://ambientesdetesteunicocontato.atenderbem.com/ivrs/1416
Authorization: Bearer <token>
Accept: application/json
```

### Body

Nao possui body.

### O que faz

- retorna o JSON completo do fluxo
- permite auditar a URA
- permite extrair variaveis do primeiro JavaScript
- permite localizar `automationId` encadeado

### O que retorna

Campos tipicos:

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

Exemplo realista resumido:

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

`options` pode vir como:

- string JSON
- array ja parseado

O agente deve suportar os dois casos.

## 6. Atualizar fluxo / IVR

Metodo:

- `PUT {instance}/ivrs/{ivrId}`

Exemplo:

```http
PUT https://ambientesdetesteunicocontato.atenderbem.com/ivrs/1416
Authorization: Bearer <token>
Content-Type: application/json
Accept: application/json
```

### Body minimo

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

Use o fluxo completo.

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

### O que faz

- atualiza o fluxo salvo na instancia

### O que retorna

Retorna o IVR atualizado.

## Estruturas importantes

## Estrutura de assistant

Campos frequentemente observados:

- `id`
- `name`
- `signaturename`
- `type`
- `description`
- `internaldescription`
- `preautomation`

## Estrutura de IVR

Campos frequentemente observados:

- `id`
- `name`
- `type`
- `version`
- `initialtext`
- `description`
- `listitems`
- `options`
- `finishtext`
- `timeout`
- `buttons`

## Estrutura de `options`

Cada item de `options` costuma seguir esta linha:

```json
{
  "id": "ab75ad470",
  "type": 21,
  "x": 125,
  "y": 40,
  "info": "",
  "config": {
    "code": "vars['url_cliente_var'] = 'https://instancia.atenderbem.com'",
    "nextElementId": "a12abfbf0"
  },
  "configured": true
}
```

## Tipos de bloco observados

- `21`: JavaScript
- `12`: chamada HTTP
- `27`: chamada de outra automacao
- `77`: referencia ao assistant
- `11`: decisao/condicao
- `3`: mensagem
- `0`: mensagem/texto

## Exemplo de URA com placeholders

```json
{
  "name": "IA alpha 7 - URA",
  "type": 1,
  "initialtext": "ab75ad470",
  "options": "[{\"id\":\"a12abfbf0\",\"type\":77,\"config\":{\"assistantId\":{{ia_id}},\"nextElementId\":\"aa21b0a60\",\"transferNextElementId\":\"aa21b0a60\"}},{\"id\":\"ab75ad470\",\"type\":21,\"config\":{\"code\":\"vars['url_cliente_var'] = '{{url_cliente}}'\\nvars['api_key_var'] = '{{api_key}}'\\nvars['nome_cliente_var'] = '{{nome_cliente}}'\\nvars['ip_cliente'] = '145.223.27.100'\\nvars['porta_cliente_var'] = {{porta_cliente}},\\nvars['unidade_negocio_var'] = {{unidade_negocio}}\\nvars['qtd_produtos'] = {{quantidade_de_produtos}}\",\"nextElementId\":\"a12abfbf0\"}}]"
}
```

## Exemplo de `buscaProdutos`

```json
{
  "name": "busca_produtos",
  "type": 2,
  "initialtext": "a64a15680",
  "options": "[{\"id\":\"a64a15680\",\"type\":21,\"config\":{\"code\":\"vars['buscando'] = true\",\"nextElementId\":\"a77685070\"}},{\"id\":\"a9258fb50\",\"type\":12,\"config\":{\"varPrefix\":\"itens\",\"dataType\":\"jsonraw\",\"method\":\"post\",\"url\":\"http://{{ip_cliente}}:{{porta_cliente_var}}/api/buscar-medicamentos\",\"dataRaw\":\"{\\\"query\\\":\\\"{{assistant_produto}}\\\",\\\"unidade_negocio_id\\\":{{unidade_negocio_var}}}\",\"nextElementId\":\"ab2746f00\"}},{\"id\":\"a604404f0\",\"type\":27,\"config\":{\"automationId\":\"{{download_img_id}}\",\"nextElementId\":\"a7820b910\"}}]"
}
```

## Script standalone para gerar TOTP

Arquivo:

- [c:\dev\unicointegracompleto\back\scripts\generate-atenderbem-totp.mjs](c:\dev\unicointegracompleto\back\scripts\generate-atenderbem-totp.mjs)

Exemplos:

```powershell
node .\scripts\generate-atenderbem-totp.mjs --secret JBSWY3DPEHPK3PXP
```

```powershell
node .\scripts\generate-atenderbem-totp.mjs --otpauth "otpauth://totp/AtenderBem:Instalador?secret=ABCDEF123456&issuer=AtenderBem"
```

## Escopo deste documento

Este guia termina aqui de proposito.

Ele descreve somente a API da plataforma AtenderBem.

Se for necessario documentar:

- rotas internas do Unico Integra
- regras de rollout do backend
- reconciliacao com banco local

isso deve ficar em um documento separado.

