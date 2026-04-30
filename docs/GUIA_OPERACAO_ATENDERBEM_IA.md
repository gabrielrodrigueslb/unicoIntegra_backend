# Guia Operacional: AtenderBem, IAs, Fluxos e URAs

## Objetivo

Este documento consolida o funcionamento atual do projeto em relacao ao ecossistema `atenderbem.com`, com foco em:

- autenticacao na instancia;
- instalacao de integracoes e IAs;
- leitura e atualizacao de fluxos/URAs;
- templates publicados no backend;
- controle de instalacoes no banco;
- regras operacionais que nao devem ser quebradas.

Este guia e interno do projeto.

## Visao geral

O sistema trabalha com dois tipos principais de artefato na plataforma AtenderBem:

1. `Assistant`
   - representa a IA em si.
   - e criada e atualizada pelos endpoints de `assistants`.

2. `IVR` / automacao / fluxo / URA
   - representa os fluxos auxiliares ligados a uma IA.
   - e criado, lido e atualizado pelos endpoints de `ivrs`.

Para providers gerenciados, uma instalacao normalmente contem:

- `assistant`
- `preProcess`
- `buscaProdutos`
- `downloadImagem`
- `ura`
- `uraAb`

## Fonte de verdade

### Regra atual

Instalacoes e atualizacoes operacionais devem usar apenas o backend publicado no banco como fonte de verdade.

Isso significa:

- criacao de IA gerenciada: usa pacote publicado em `sistema.ai_provider_templates`
- atualizacao de IA gerenciada: usa pacote publicado em `sistema.ai_provider_templates`
- criacao da IA base `atendimento`: usa template publicado em `sistema.ai_template_bases`

O fluxo operacional nao deve mais cair silenciosamente para arquivo local `.json`.

Se o template atual publicado no banco nao existir, a operacao deve falhar com erro explicito.

### Arquivos relevantes

- [c:\dev\unicointegracompleto\back\src\services\aiProviderTemplate.services.js](c:\dev\unicointegracompleto\back\src\services\aiProviderTemplate.services.js)
- [c:\dev\unicointegracompleto\back\src\services\aiTemplateBase.services.js](c:\dev\unicointegracompleto\back\src\services\aiTemplateBase.services.js)
- [c:\dev\unicointegracompleto\back\src\services\ai.services.js](c:\dev\unicointegracompleto\back\src\services\ai.services.js)
- [c:\dev\unicointegracompleto\back\src\services\aiFunctions.js](c:\dev\unicointegracompleto\back\src\services\aiFunctions.js)

## Autenticacao na instancia AtenderBem

### Endpoint de login

- `POST {instance}/login`

Payload esperado:

```json
{
  "username": "usuario",
  "password": "senha",
  "code": "123456",
  "trusted": false
}
```

Se o login funcionar, a resposta contem `token`.

### Token bearer

Os endpoints da instancia usam:

```http
Authorization: Bearer <token>
Content-Type: application/json
```

### Conta tecnica

Hoje o backend suporta autenticacao automatica por service account.

Variaveis de ambiente:

- `INSTANCE_SERVICE_USERNAME`
- `INSTANCE_SERVICE_PASSWORD`
- `INSTANCE_SERVICE_TOTP_SECRET`
- `INSTANCE_SERVICE_TOTP_DIGITS`
- `INSTANCE_SERVICE_TOTP_PERIOD_SECONDS`

Servico responsavel:

- [c:\dev\unicointegracompleto\back\src\services\instanceExecutionAuth.services.js](c:\dev\unicointegracompleto\back\src\services\instanceExecutionAuth.services.js)

Geracao de TOTP:

- [c:\dev\unicointegracompleto\back\src\services\totp.services.js](c:\dev\unicointegracompleto\back\src\services\totp.services.js)

Entrada principal de autenticacao:

- [c:\dev\unicointegracompleto\back\src\services\instanceApi.services.js](c:\dev\unicointegracompleto\back\src\services\instanceApi.services.js)

Regra:

- se a conta tecnica estiver configurada, o backend usa somente ela;
- `username/password/code` do operador passam a ser fallback manual, nao fluxo principal.

## Endpoints uteis da instancia AtenderBem

### Listar IAs da instancia

- `POST {instance}/assistants/getItems`

Payload tipico:

```json
{
  "full": true
}
```

Uso:

- levantar todas as IAs realmente existentes na instancia;
- comparar com o banco local;
- descobrir `assistantId` valido;
- identificar registros stale ou duplicados.

### Criar assistant

- `POST {instance}/assistants/createItem`

Uso no projeto:

- criar o assistant "Novo assistente" primeiro;
- depois atualizar o assistant com o template publicado.

### Atualizar assistant

- `POST {instance}/assistants/updateItem`

Uso no projeto:

- aplicar o payload final do template do provider;
- tambem usado durante atualizacao de instalacoes gerenciadas.

### Criar IVR

- `POST {instance}/ivrs/`

Uso no projeto:

- instalar `preProcess`, `buscaProdutos`, `downloadImagem`, `ura`, `uraAb`.

### Ler IVR

- `GET {instance}/ivrs/{ivrId}`

Uso no projeto:

- auditar o fluxo atual na instancia;
- localizar primeiro JavaScript da URA;
- descobrir IDs corretos;
- comparar fluxo atual com template renderizado.

### Atualizar IVR

- `PUT {instance}/ivrs/{ivrId}`

Uso no projeto:

- atualizar componentes gerenciados;
- aplicar patch seguro em URA;
- corrigir automacoes especificas sem recriar o fluxo.

## Conceitos do banco local

### Templates base

Tabela:

- `sistema.ai_template_bases`

Uso:

- armazenar templates base versionados, como `atendimento`.

### Templates por provider

Tabela:

- `sistema.ai_provider_templates`

Uso:

- armazenar pacote atual e historico por provider;
- cada linha contem:
  - `assistantTemplate`
  - `preProcessTemplate`
  - `buscaProdutosTemplate`
  - `downloadImagemTemplate`
  - `uraTemplate`
  - `uraAbTemplate`
  - `componentVersions`

### Instalacoes por cliente

Tabela:

- `sistema.ai_client_installations`

Uso:

- controlar o que esta instalado em cada instancia;
- mapear IDs reais da plataforma para cada componente;
- armazenar `configSnapshot`;
- calcular o que pode ou nao pode ser atualizado.

Campos importantes:

- `instance`
- `provider`
- `assistantId`
- `assistantName`
- `installedVersion`
- `installedComponentVersions`
- `preProcessId`
- `buscaProdutosId`
- `downloadImagemId`
- `uraIaId`
- `uraAbId`
- `configSnapshot`
- `source`
- `lastSyncStatus`
- `lastSyncError`

## Providers gerenciados

Providers hoje tratados como gerenciados:

- `alpha7`
- `trier`
- `vannon`
- `vetor`

Arquivos relevantes:

- [c:\dev\unicointegracompleto\back\src\services\aiProviderCatalog.js](c:\dev\unicointegracompleto\back\src\services\aiProviderCatalog.js)
- [c:\dev\unicointegracompleto\back\src\services\aiFunctions.js](c:\dev\unicointegracompleto\back\src\services\aiFunctions.js)

## Regras operacionais importantes

### 1. URA IA e URA AB nao entram no fluxo normal de atualizacao

Regra atual:

- `ura` e `uraAb` nao aparecem mais no update manual;
- `ura` e `uraAb` nao aparecem mais no update em lote;
- o backend bloqueia tentativa de atualizar esses componentes pelo endpoint normal.

Motivo:

- sao fluxos com alta chance de customizacao por cliente;
- sobrescrever esses fluxos por template completo e arriscado.

### 2. URA pode receber patch seguro

Para casos controlados, existe patch manual e cirurgico na URA.

Exemplo implementado:

- inclusao de `vars['qtd_produtos']` no primeiro JavaScript da URA do `alpha7`.

Regra do patch seguro:

- ler a URA atual;
- localizar o primeiro bloco `type: 21`;
- alterar somente `config.code`;
- preservar o restante do fluxo.

Endpoint interno criado para isso:

- `POST /api/ia/installations/:id/patch-ura-qtd`

### 3. `URA AB` e `URA IA` ficam fora do update automatico

Mesmo quando existirem no registro:

- devem ser apenas catalogadas;
- nao devem entrar em rollout automatico;
- so podem ser tratadas por acao especifica e controlada.

### 4. IAs `legacy`, `atendimento` e `SDR`

Nem toda IA listada na instancia e gerenciada por pacote.

Casos de `legacy`, `IA - Atendimento` e `SDR`:

- devem permanecer listados para controle;
- nao entram no fluxo automatico de update;
- tipicamente ficam com `provider: legacy` e `canUpdate: false`.

## Fluxo de criacao de IA gerenciada

Resumo do processo:

1. autenticar na instancia;
2. criar assistant vazio;
3. montar `configSnapshot` do provider;
4. instalar componentes IVR na ordem definida;
5. renderizar `assistantTemplate` com os IDs instalados;
6. atualizar o assistant;
7. salvar/atualizar o registro em `sistema.ai_client_installations`.

Arquivo principal:

- [c:\dev\unicointegracompleto\back\src\services\ai.services.js](c:\dev\unicointegracompleto\back\src\services\ai.services.js)

## Fluxo de atualizacao de IA gerenciada

Resumo:

1. carregar instalacao do banco;
2. validar que a instalacao e gerenciada e atualizavel;
3. carregar o pacote atual publicado do provider;
4. descobrir componentes realmente pendentes;
5. renderizar payloads com IDs atuais da instalacao;
6. atualizar IVRs permitidos;
7. atualizar assistant;
8. atualizar `installedComponentVersions` e status de sync.

Observacao:

- a atualizacao nao usa mais arquivo local como base;
- ela depende do pacote atual publicado no banco.

## Como descobrir IDs corretos na instancia

Metodologia que funcionou bem neste projeto:

1. listar assistants reais:
   - `POST /assistants/getItems` com `{ "full": true }`

2. identificar o `assistantId` correto pelo nome real da IA.

3. usar IDs conhecidos de `preProcess` e `buscaProdutos` como ancora.

4. ler IVRs proximos com:
   - `GET /ivrs/{id}`

5. validar os componentes por estrutura e por nomes:
   - `downloadImagem`
   - `buscaProdutos`
   - `ura`
   - `uraAb`
   - `preProcess`

6. corrigir no banco:
   - completar IDs faltantes;
   - remover registros stale;
   - criar registros faltantes que existam na instancia e ainda nao estejam no banco.

## Casos que apareceram neste trabalho

### Registros stale / duplicados

Foram encontrados registros que:

- apontavam para `assistantId` que nao existia mais;
- estavam duplicados em relacao a outro registro valido;
- precisavam ser removidos do banco;
- ou precisavam de ajuste de `assistantId` / `uraIaId`.

Licao:

- o banco local precisa refletir a realidade da instancia;
- antes de atualizar em lote, vale validar `assistantId` e IDs de IVR.

### `uraIaId` incorreto

Caso real:

- `farmaconect` estava com `uraIaId` errado no banco;
- por isso o patch seguro nao conseguia ler a URA;
- apos corrigir o `uraIaId`, o patch funcionou normalmente.

Licao:

- problemas de patch/update podem ser apenas ID errado no banco, nao erro do fluxo em si.

## Auditoria noturna de variaveis da URA

Foi implementada uma auditoria automatica que roda de madrugada.

Objetivo:

- verificar se as variaveis salvas no `configSnapshot` continuam batendo com o primeiro JavaScript da `URA IA`;
- detectar alteracoes feitas direto na plataforma;
- atualizar o snapshot local para manter o controle sincronizado.

Configuracao:

- `AI_URA_AUDIT_ENABLED=true`
- `AI_URA_AUDIT_HOUR=3`
- `AI_URA_AUDIT_MINUTE=0`
- `AI_URA_AUDIT_TIMEZONE=America/Sao_Paulo`

Servico:

- [c:\dev\unicointegracompleto\back\src\services\aiUraSnapshotAudit.services.js](c:\dev\unicointegracompleto\back\src\services\aiUraSnapshotAudit.services.js)

Integracao no server:

- [c:\dev\unicointegracompleto\back\src\server.js](c:\dev\unicointegracompleto\back\src\server.js)

Endpoint manual:

- `POST /api/ia/installations/audit-ura-snapshots`

Providers cobertos:

- `alpha7`
- `trier`
- `vannon`
- `vetor`

## Variaveis importantes da URA do `alpha7`

No `alpha7`, o primeiro JS da URA costuma carregar variaveis como:

- `url_cliente_var`
- `api_key_var`
- `nome_cliente_var`
- `ip_cliente`
- `porta_cliente_var`
- `unidade_negocio_var`
- `qtd_produtos`

Observacoes:

- `ip_cliente` costuma vir fixo no fluxo;
- `qtd_produtos` foi introduzido com default `3`;
- o backend limita esse valor em `7` para novas instalacoes;
- para instalacoes existentes, foi aplicado patch seguro com valor `3`.

## Frontend administrativo relevante

Paginas principais de operacao:

- [c:\dev\unicointegracompleto\front\src\pages\AiPage\AiPage.tsx](c:\dev\unicointegracompleto\front\src\pages\AiPage\AiPage.tsx)
- [c:\dev\unicointegracompleto\front\src\pages\AiPage\AiTemplateManagerPage.tsx](c:\dev\unicointegracompleto\front\src\pages\AiPage\AiTemplateManagerPage.tsx)
- [c:\dev\unicointegracompleto\front\src\pages\AiPage\AiVersionsPage.tsx](c:\dev\unicointegracompleto\front\src\pages\AiPage\AiVersionsPage.tsx)

Servicos do front:

- [c:\dev\unicointegracompleto\front\src\services\aiInstallations.service.ts](c:\dev\unicointegracompleto\front\src\services\aiInstallations.service.ts)
- [c:\dev\unicointegracompleto\front\src\services\aiTemplateManager.service.ts](c:\dev\unicointegracompleto\front\src\services\aiTemplateManager.service.ts)

Regras importantes na UI:

- autenticacao manual deve aparecer apenas como fallback quando a automacao falhar;
- `requestedBy` deve usar o login do usuario autenticado;
- `URA IA` e `URA AB` nao devem aparecer como componentes atualizaveis;
- no update em lote, `skipped` deve ser tratado como ignorado por falta de dados e nao como erro.

## Troubleshooting rapido

### `AUTH_004`

Indica erro de autenticacao na instancia.

Checar:

- usuario tecnico correto;
- senha correta;
- secret TOTP correto;
- se o TOTP realmente pertence ao mesmo usuario;
- se o 2FA ja foi ativado/confirmado na conta.

### `O campo "username" e obrigatorio`

Se a conta tecnica estiver configurada, isso nao deve aparecer no fluxo normal.

Checar:

- se o backend foi reiniciado apos mudancas;
- se `INSTANCE_SERVICE_USERNAME`, `INSTANCE_SERVICE_PASSWORD` e `INSTANCE_SERVICE_TOTP_SECRET` estao presentes no `.env` do `back`.

### `Nao foi possivel ler os blocos atuais da URA`

Normalmente indica:

- `uraIaId` errado no banco;
- ou retorno inesperado do endpoint `GET /ivrs/{id}`.

### Instalacao aparece como desatualizada mas nao atualiza

Checar:

- se o pacote atual publicado do provider realmente contem a mudanca esperada;
- se o registro local tem IDs completos;
- se `canUpdate` esta `true`;
- se o componente ainda participa do fluxo de update.

## Recomendacoes operacionais

1. Antes de rollout em lote, valide uma instancia de teste.
2. Nunca sobrescreva `URA IA` inteira por template sem necessidade.
3. Use patch seguro quando a mudanca for so no primeiro JavaScript.
4. Mantenha o banco coerente com a realidade das instancias.
5. Para providers gerenciados, publique primeiro o template no backend e so depois rode update nas instalacoes.
6. Quando um fluxo esperado nao entra em producao, confirme se o pacote atual do banco contem a alteracao.

