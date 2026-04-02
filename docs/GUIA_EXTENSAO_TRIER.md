# Guia da Extensão Trier

## Objetivo

Este documento descreve o processo completo da **Extensão Trier** em pt-BR:

1. quais dados precisam ser informados;
2. como gerar o ZIP da extensão na plataforma;
3. o que fazer depois do download;
4. como instalar a extensão no Google Chrome;
5. como validar se a instalação ficou correta.

## Importante: Extensão Trier não é IA Trier

Este guia é da **Extensão Trier**.

Ela é um fluxo separado da **IA Trier** e, para gerar o build, precisa somente de:

- `instance_url`
- `client_token`

Não confundir com o fluxo da IA, que exige outros dados de implantação.

## O que a extensão faz

A extensão foi criada para operar no contexto da instância do cliente e permitir:

- login de operador na instância;
- sincronização de produtos da Trier;
- montagem de orçamento;
- preenchimento de endereço de entrega, quando necessário;
- envio da mensagem final para um chat aberto da instância.

## Dados necessários antes de começar

Antes de gerar a extensão, confirme estes dados:

- **URL da instância do cliente**
- **Token de integração da Trier**
- acesso à plataforma Unico Contato
- acesso ao Google Chrome na máquina do cliente

## Regra mais importante: a URL informada deve ser a URL da instância do cliente

O campo que deve ser preenchido é a **URL da instância do cliente**.

Exemplo correto:

```text
https://cliente.atenderbem.com/
```

Exemplo também aceito pelo sistema:

```text
https://cliente.atenderbem.com
```

Observações:

- o backend normaliza a URL automaticamente e adiciona `/` no final se ela vier sem a barra;
- mesmo assim, o ideal é informar a URL completa da instância do cliente;
- não é para usar URL interna, URL de teste aleatória ou outro endereço que não seja a instância real do cliente.

## Resumo do fluxo operacional

O fluxo correto é este:

1. receber a **URL da instância do cliente** e o **token da Trier**;
2. acessar a área **Serviços > Extensão Trier**;
3. gerar o ZIP final da extensão;
4. baixar o ZIP;
5. **depois do download, solicitar ao cliente o AnyDesk dele**;
6. passar o ZIP para a máquina do cliente;
7. extrair o ZIP na máquina do cliente;
8. adicionar a extensão no Google Chrome como extensão descompactada;
9. testar login, sincronização, orçamento e envio em chat.

## Como gerar a extensão na plataforma

### 1. Acessar o gerador

Na plataforma, vá em:

```text
Serviços > Extensão Trier
```

Essa tela gera o ZIP final da extensão a partir de dois campos:

- `URL da Instância`
- `Token da Trier`

### 2. Preencher os dados

No formulário:

- em **URL da Instância**, informe a **URL da instância do cliente**;
- em **Token da Trier**, cole o token de integração enviado para aquele cliente.

Exemplo de preenchimento:

```text
URL da Instância: https://cliente.atenderbem.com/
Token da Trier: <token de integração do cliente>
```

### 3. Iniciar a geração

Clique em **Iniciar Geração**.

O processo faz automaticamente:

- preparação do template da extensão;
- aplicação da `instance_url`;
- aplicação do `client_token`;
- instalação de dependências;
- build da extensão;
- empacotamento dos arquivos finais em ZIP.

### 4. Baixar o ZIP gerado

Ao final, o navegador baixa um arquivo `.zip`.

Esse ZIP contém apenas os arquivos finais da extensão, prontos para instalação no Chrome.

O conteúdo esperado, após extrair, é algo como:

- `manifest.json`
- `index.html`
- `background.js`
- pasta `assets`
- arquivos de imagem da extensão

## Etapa operacional após o download

Esta parte é importante porque **não acontece automaticamente pela plataforma**.

Depois de baixar o ZIP:

1. solicite ao cliente o **AnyDesk** dele;
2. acesse a máquina do cliente;
3. passe o arquivo `.zip` para a máquina do cliente;
4. salve o ZIP em uma pasta fácil de localizar, como `Downloads` ou `Área de Trabalho`.

Recomendação prática:

- crie uma pasta com um nome simples, por exemplo `Extensao Trier`;
- deixe o ZIP e a pasta extraída organizados no mesmo local;
- não tente instalar a extensão diretamente do arquivo `.zip`.

## Como extrair o ZIP na máquina do cliente

Na máquina do cliente:

1. localize o arquivo `.zip` baixado;
2. clique com o botão direito no arquivo;
3. escolha **Extrair Tudo...** no Windows, ou use o descompactador disponível;
4. conclua a extração.

Ao final, deve existir uma pasta extraída com os arquivos da extensão.

Confirme se dentro da pasta extraída existe o arquivo:

```text
manifest.json
```

Se o `manifest.json` não estiver na pasta selecionada, o Chrome não vai carregar a extensão.

## Como instalar no Google Chrome

### 1. Abrir a tela de extensões

No Google Chrome da máquina do cliente, acesse:

```text
chrome://extensions
```

### 2. Ativar o modo desenvolvedor

No canto superior direito da tela de extensões, ative a opção:

```text
Modo do desenvolvedor
```

### 3. Carregar a extensão

Depois disso:

1. clique em **Carregar sem compactação**;
2. selecione a pasta extraída da extensão;
3. confirme a seleção.

## Pasta correta para selecionar no Chrome

A pasta correta é a pasta que contém diretamente os arquivos da extensão, principalmente:

- `manifest.json`
- `index.html`
- `background.js`

Não selecione:

- o arquivo `.zip`;
- uma pasta acima da pasta real da extensão;
- uma subpasta errada que não contenha o `manifest.json`.

## Como confirmar que a instalação deu certo

Após carregar a extensão:

- ela deve aparecer na lista do `chrome://extensions`;
- o Chrome não deve mostrar erro de manifesto;
- o ícone da extensão deve ficar disponível na barra de extensões;
- ao clicar no ícone, o popup da extensão deve abrir.

Se quiser facilitar o uso:

1. clique no ícone de extensões do Chrome;
2. fixe a extensão da Trier na barra do navegador.

## Como usar a extensão pela primeira vez

Depois da instalação:

1. clique no ícone da extensão;
2. a tela de login será exibida;
3. faça login com um **usuário operador da instância do cliente**.

Importante:

- usuários administradores não podem usar esse login pela extensão;
- se o login for de administrador, a extensão bloqueia o acesso.

## O que acontece depois do login

Depois que o operador faz login:

- a extensão inicia a sincronização inicial dos produtos;
- pode aparecer uma tela de carregamento enquanto os dados são baixados;
- depois disso, a tela de orçamento é liberada;
- a extensão também mantém sincronização periódica em segundo plano.

Além da sincronização automática, existe um botão manual de sincronização no cabeçalho da extensão.

## Como testar a extensão

O teste mínimo deve validar o fluxo completo.

### 1. Teste de login

Verifique se:

- o login foi aceito;
- a extensão saiu da tela de login;
- a tela principal abriu sem erro.

### 2. Teste de sincronização

Verifique se:

- a sincronização inicial concluiu;
- a lista de produtos ficou disponível;
- a busca por nome ou código de barras retorna itens.

Se necessário, clique no botão de sincronização manual da extensão e confirme se ela conclui sem erro.

### 3. Teste de orçamento

Na tela principal:

1. selecione um produto;
2. informe quantidade;
3. informe desconto, se necessário;
4. clique para adicionar ao orçamento.

Valide se:

- o item aparece na lista;
- o valor final é calculado;
- é possível avançar para a próxima etapa.

### 4. Teste com e sem delivery

Faça duas validações, quando possível:

- teste sem marcar `Delivery`;
- teste marcando `Delivery`.

Quando marcar `Delivery`, valide:

- preenchimento do CEP;
- preenchimento ou carregamento de endereço;
- preenchimento da taxa de entrega;
- avanço para a etapa de chats.

### 5. Teste de seleção de chat

Na tela de chats:

- confirme se existem chats abertos para o operador logado;
- selecione um chat;
- escolha a forma de pagamento;
- preencha o CPF do cliente;
- clique em **Finalizar**.

Importante:

- para esse teste funcionar corretamente, o operador precisa ter fila associada;
- também precisa existir ao menos um chat aberto disponível para aquele operador.

### 6. Validação final

Considere a homologação básica concluída quando:

- a extensão abre normalmente;
- o login funciona;
- os produtos carregam;
- o orçamento é montado;
- o chat é selecionado;
- a mensagem final é enviada sem erro.

## Problemas mais comuns

### O Chrome não aceita a extensão

Causas mais comuns:

- foi selecionado o `.zip` em vez da pasta extraída;
- foi selecionada a pasta errada;
- a pasta não contém o `manifest.json`.

### O login não funciona

Verifique:

- se a URL usada na geração era realmente a **URL da instância do cliente**;
- se o operador digitou usuário e senha corretos;
- se a conta usada não é de administrador.

### Os produtos não aparecem

Verifique:

- se o token da Trier informado na geração está correto;
- se a sincronização inicial terminou;
- se a sincronização manual conclui sem erro.

### Não aparecem chats para finalizar

Verifique:

- se o operador possui filas vinculadas;
- se existe chat aberto atribuído ao operador;
- se a instância do cliente está respondendo normalmente.

## Checklist final de implantação

- URL informada é a **URL da instância do cliente**
- token da Trier confirmado
- ZIP da extensão gerado com sucesso
- AnyDesk do cliente solicitado
- ZIP transferido para a máquina do cliente
- ZIP extraído
- extensão carregada no `chrome://extensions`
- login validado
- sincronização validada
- orçamento validado
- envio em chat validado

## Resumo executivo

O processo correto da Extensão Trier é:

1. gerar o ZIP com a **URL da instância do cliente** e o **token da Trier**;
2. baixar esse ZIP;
3. pedir o **AnyDesk** do cliente;
4. mover o ZIP para a máquina dele;
5. extrair o conteúdo;
6. instalar no Chrome por `chrome://extensions` usando **Carregar sem compactação**;
7. testar login, produtos, orçamento e envio para chat.
