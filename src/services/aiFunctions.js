import axios from 'axios';

export async function alpha7Functions(instance, token, dbName, queueId, apiKey) {
    // =====================================================================
    // CONFIGURAÇÃO GERAL
    // =====================================================================
    const axiosConfig = {
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`,
        },
    };

    // =====================================================================
    // PAYLOAD 1: Adiciona Item
    // =====================================================================
    const payloadAdicionaItem = {
        name: 'Adiciona Item',
        type: 2,
        version: 1,
        initialtext: 'aa7c877e0',
        description: null,
        listitems: '[]',
        options: '[{"id":"ad2cba7f0","type":5,"x":230,"y":39,"info":"","config":{"destinationType":2,"destinationId":"78","filter":[]},"configured":true},{"id":"aa7c877e0","type":11,"x":119,"y":177,"info":"","config":{"nextElementId":"a5538fc90","value":"{{message_button_id}}","options":[{"id":"ab0914f00","conditionValue":"0","conditionArray":["Nova condição"],"conditionOperator":"not null","nextElementId":"aee151880"}]},"configured":true},{"id":"ab9b42d00","type":78,"x":518,"y":567,"info":"","config":{"context":"erro ao adicionar produto","nextElementId":""},"configured":true},{"id":"aa66580b0","type":12,"x":659,"y":398,"info":"","config":{"varPrefix":"addproduto","dataType":"jsonraw","method":"post","retrys":1,"url":"https://{{clientEndpoint}}.com.br/api/whatsapp/pedido/adicionar-produtos-pedido/{{pedido}}","data":{},"testData":{},"numberFields":[],"dataRaw":"{\\n  \\"produtos\\": [\\n    {\\n      \\"codigoBarras\\": \\"{{message_button_id}}\\",\\n      \\"quantidade\\": 1\\n    }\\n  ]\\n}","headers":{"Authorization":"Bearer {{token}}"},"testHeaders":{"Authorization":""},"timeout":15000,"expectedContentType":0,"textPreProcessor":0,"textPreProcessorSeparator":"","textPostProcessorSeparator":"","textResponseVariable":"","nextElementId":""},"configured":true},{"id":"ac4852460","type":11,"x":94,"y":427,"info":"","config":{"nextElementId":"","value":"{{addproduto_httpStatus}}","options":[{"id":"adfa67c30","conditionValue":"200","conditionArray":["Nova condição"],"conditionOperator":"!=","nextElementId":"ab9b42d00"}]},"configured":true},{"id":"aee151880","type":78,"x":614,"y":299,"info":"","config":{"context":"produto de id {{message_button_id}} adicionado ao carrinho.\\n\\n","nextElementId":""},"configured":true,"out":""},{"id":"a5538fc90","type":11,"x":563,"y":79,"info":"","config":{"nextElementId":"","value":"{{message_file.file_id}}","options":[{"id":"a6d396550","conditionValue":"0","conditionArray":["Nova condição"],"conditionOperator":">","nextElementId":"a77b36ee0"}]},"configured":true},{"id":"a77b36ee0","type":79,"x":983,"y":157,"info":"","config":{"model":0,"fileId":"{{message_file.file_id}}","instruction":"Transcreva em apenas um termo o conteúdo presente nessa foto, se for uma receita médica o principal remédio da mesma exemplo \\"dorflex\\", ou se for foto de um produto o nome do produto ","includeAllMessages":false,"resultVariableName":"ai_result","nextElementId":"a8a7538b0","outputAsJson":true},"configured":true},{"id":"a8a7538b0","type":3,"x":805,"y":222,"info":"","config":{"nextElementId":"a99720b40","text":"Traduzindo documento {{ai_result}}","fileChooseType":0,"fileId":""},"configured":true},{"id":"a99720b40","type":78,"x":1194,"y":231,"info":"","config":{"context":"Dado transcrito da imagem ou áudio : {{ai_result}}, pergunte se seria isso e se sim siga o fluxo de busca\\n","nextElementId":""},"configured":true},{"id":"aa4453090","type":3,"x":1243,"y":357,"info":"","config":{"nextElementId":"","text":"pedidoID: {{pedido}}\\nproduto de sku {{message_button_id}} adicionado\\ntotal do pedido: {{carrinhoTotal}}\\nquantidade de itens: {{carrinhoQuantidade}}","fileChooseType":0,"fileId":""},"configured":true},{"id":"afef6f260","type":21,"x":1397,"y":422,"info":"","config":{"code":"vars[\'resumoPedido\'] = vars[\'getcarrinho_rawBody\'];\\nvars[\'carrinhoProdutos\'] = vars[\'resumoPedido\'][\'produtos\'];\\nvars[\'carrinhoTotal\'] = vars[\'resumoPedido\'][\'valorTotal\'];\\nvars[\'carrinhoQuantidade\'] = vars[\'carrinhoProdutos\'].length;\\n\\nconst fmt = n => Number(n).toLocaleString(\'pt-BR\', { style: \'currency\', currency: \'BRL\' });\\nconst NL = \'\\\\u000A\';\\n\\nif (!vars[\'carrinhoProdutos\'].length) {\\n  vars[\'pedidoResumo\'] = \'ߧꠃarrinho vazio.\';\\n} else {\\n  const linhas = vars[\'carrinhoProdutos\'].map((item, i) => {\\n    const p = Number(item.precoPor) || 0;\\n    const q = Number(item.quantidadeUnidade) || 0;\\n    const subtotal = p * q;\\n    // WhatsApp suporta *negrito* e _itálico_\\n    return `${i + 1}. _${item.nome}_ x ${q} = *${fmt(subtotal)}*${NL}`;\\n  });\\n\\n  const total = vars[\'carrinhoTotal\'];\\n\\n  // Use \\\\u000A (line feed real) para evitar aparecer \\"\\\\n\\" literal\\n  const resumo = [\\n    `ߧ꠪Resumo do pedido*${NL}`,\\n    `ߒࠔotal: *${fmt(total)}*${NL}`,\\n    `${NL}ߓrodutos${NL}`,\\n    ...linhas,\\n  ].join(NL);\\n\\n  vars[\'pedidoResumo\'] = resumo;\\n}\\n\\nvars[\'qtdProdCar\'] = vars[\'carrinhoProdutos\'].length","nextElementId":""},"configured":true},{"id":"af91f22a0","type":12,"x":919,"y":336.6000003814697,"info":"","config":{"varPrefix":"getcarrinho","dataType":"json","method":"get","retrys":1,"url":"https://{{clientEndpoint}}.com.br/api/whatsapp/pedido/obter-resumo-pedido/{{pedido}}","data":{},"testData":{},"numberFields":[],"dataRaw":"","headers":{"Authorization":"Bearer {{token}}"},"testHeaders":{"Authorization":""},"timeout":15000,"expectedContentType":0,"textPreProcessor":0,"textPreProcessorSeparator":"","textPostProcessorSeparator":"","textResponseVariable":"","nextElementId":"aa4453090"},"configured":true},{"id":"a8c158c50","type":0,"x":890.4000015258789,"y":524.3999996185303,"info":"","config":{"nextElementId":"","text":"{{pedidoResumo}}","fileChooseType":0,"fileId":""},"configured":true}]',
        finishtext: '',
        fk_visualgroup: 0,
        timeouttags: '[]',
        notfoundtext: null,
        allowagentstart: 0,
        executionwithoutconfirmation: 0,
        allowcontactexecution: 0,
        allowopportunityfileexecution: 0,
        allowtaskfileexecution: 0,
        allowmsgexecution: 0,
        waitmsgaiprocess: 0,
        audiomsg: 0,
        videomsg: 0,
        locationmsg: 0,
        textmsg: 0,
        allowopportunity: 0,
        pdfmsg: 0,
        informationmsg: 0,
        imagemsg: 0,
        allmsgs: 0,
        requestdataform: 0,
        timeout: 600,
        timeoutaction: 0,
        buttons: '[]',
    };

    // =====================================================================
    // PAYLOAD 2: Envio de Itens
    // =====================================================================
    // NOTA: Adicionei uma barra '/' antes de 'int/sendMessageToChat' para garantir que a URL fique correta
    // mesmo se a variável 'instance' não tiver uma barra no final.
    const payloadEnvioItems = {
        "name": "Envio de Itens ",
        "type": 2,
        "version": 1,
        "initialtext": "a95510d90",
        "description": null,
        "listitems": "[]",
        "options": `[{\"id\":\"a50882990\",\"type\":12,\"x\":365,\"y\":40,\"info\":\"\",\"config\":{\"varPrefix\":\"itens\",\"dataType\":\"jsonraw\",\"method\":\"post\",\"retrys\":1,\"url\":\"http://unicocontato.tech:12537/executaQuery\",\"data\":{},\"testData\":{},\"numberFields\":[],\"dataRaw\":\"{\\n      \\\"dbName\\\": \\\"${dbName}\\\",\\n    \\\"query\\\": \\\"SELECT * FROM public.out_embalagem WHERE (o_estoque > 0) AND (o_descricao ILIKE '%{{assistant_produto}}%') LIMIT 4 ;\\\"\\n}\",\"headers\":{\"x-api-key\":\"unicoxalpha7\"},\"testHeaders\":{\"x-api-key\":\"unicoxalpha7\"},\"timeout\":15000,\"expectedContentType\":0,\"textPreProcessor\":0,\"textPreProcessorSeparator\":\"\",\"textPostProcessorSeparator\":\"\",\"textResponseVariable\":\"\",\"nextElementId\":\"a70925f30\"},\"configured\":true},{\"id\":\"a70925f30\",\"type\":21,\"x\":125,\"y\":133,\"info\":\"\",\"config\":{\"code\":\"// Obter lista de produtos da variável de entrada\\nconst produtos = vars['itens_rawBody']?.['data'] || [];\\nconst productList = [];\\n\\nfor (let i = 0; i <= 6; i++) {\\n\\n    if (\\n        i < produtos.length &&\\n        produtos[i] &&\\n        produtos[i].o_descricao &&\\n        parseFloat(produtos[i].o_estoque) > 0\\n    ) {\\n        const produto = produtos[i];\\n        const nomeCompleto = produto.o_descricao ||'Produto indisponível'\\n\\n        // Obter preços\\n        const preco = produto.o_precovenda || '0';\\n        \\n        // Obter código de barras\\n        const codigo = produto.o_codigobarras || '-';\\n\\n        // Obter estoque e fabricante\\n        const estoque = produto.o_estoque || '0';\\n        const fabricante = produto.o_nomefabricante || '';\\n\\n        // Criar descrição do produto\\n        const estoqueNum = parseFloat(estoque);\\n        const precoNum = parseFloat(preco);\\n        const descricao = \`\${nomeCompleto} - \${fabricante} - R$ \${precoNum.toFixed(\\n            2\\n        )} - Estoque: \${estoqueNum.toFixed(0)} unidades\`;\\n\\n        // Adicionar à lista de produtos\\n        productList.push({\\n            desc: descricao,\\n            price: precoNum,\\n            id: codigo,\\n        });\\n        }}\\n\\n    //     // Definir variáveis individuais\\n    //     vars[\`descproduto\${i}\`] =\\n    //         descricao.length > 50\\n    //             ? descricao.substring(0, 50).trim() + '...'\\n    //             : descricao;\\n    //     vars[\`codeproduto\${i}\`] = codigo || '0';\\n    //     vars[\`precoproduto\${i}\`] = precoPor;\\n    // } else {\\n    //     // Produto não disponível\\n    //     vars[\`descproduto\${i}\`] = 'Produto não disponível';\\n    //     vars[\`codeproduto\${i}\`] = '';\\n    //     vars[\`precoproduto\${i}\`] = '0';\\n    // }\\n// }\\n\\n// Definir variáveis globais\\nvars['listaProdutos'] = productList;\\nvars['listaProdutosQuantidade'] = productList.length;\\nvars['currentMessageIndex'] = 0;\",\"nextElementId\":\"abbaa67c0\"},\"configured\":true},{\"id\":\"a9ba83000\",\"type\":11,\"x\":149,\"y\":354,\"info\":\"\",\"config\":{\"nextElementId\":\"a1f6aa490\",\"value\":\"{{listaProdutosQuantidade}}\",\"options\":[{\"id\":\"aa1c68090\",\"conditionValue\":\"Nova condição\",\"conditionArray\":[\"0\"],\"conditionOperator\":\"=\",\"nextElementId\":\"ab5d2a4b0\"}]},\"configured\":true},{\"id\":\"ab5d2a4b0\",\"type\":78,\"x\":455,\"y\":545,\"info\":\"\",\"config\":{\"context\":\"Nenhum item foi encontrado, instrua o cliente a procurar por algo mais especifico e ajude ele a isso\\n\",\"nextElementId\":\"\"},\"configured\":true},{\"id\":\"ac53b6300\",\"type\":21,\"x\":1150,\"y\":175,\"info\":\"\",\"config\":{\"code\":\"// Escreva seu código aqui\\nvars['currentMessageIndex'] = vars['currentMessageIndex']+ 1;\",\"nextElementId\":\"a22cae5d0\"},\"configured\":true},{\"id\":\"a378978c0\",\"type\":21,\"x\":737,\"y\":174,\"info\":\"\",\"config\":{\"code\":\"// Escreva seu código aqui\\nvars['currentMessageText'] = ''\\nvars['currentImageLink'] = ''\\nvars['hasMoreMessages'] = true;\\n\\n// if (!vars['listaProdutos'] || !Array.isArray(vars['listaProdutos'])) {\\n//     vars['listaProdutos'] = [\\n//         {\\\"name\\\": \\\"Olá, seja bem-vindo ao nosso catálogo!\\\", \\\"desc\\\": \\\"Catálogo de produtos\\\", \\\"image\\\": \\\"\\\"},\\n//         {\\\"name\\\": \\\"Aqui você encontra nossos produtos e serviços.\\\", \\\"desc\\\": \\\"Produtos e serviços\\\", \\\"image\\\": \\\"\\\"},\\n//         {\\\"name\\\": \\\"Qualquer dúvida, nossa equipe está à disposição!\\\", \\\"desc\\\": \\\"Suporte disponível\\\", \\\"image\\\": \\\"\\\"}\\n//     ];\\n// }\\n\\nif (vars['listaProdutos'].length >= vars['currentMessageIndex']) {\\n    const currentProduct = vars['listaProdutos'][vars['currentMessageIndex']];\\n    vars['currentMessageText'] = currentProduct.desc || '-';\\n    vars['currentCode'] = currentProduct.id || '-';\\n    vars['hasMoreMessages'] = true;\\n} else {\\n    vars['hasMoreMessages'] = false;\\n}\",\"nextElementId\":\"ac33219f0\"},\"configured\":true},{\"id\":\"a22cae5d0\",\"type\":11,\"x\":804,\"y\":437,\"info\":\"\",\"config\":{\"nextElementId\":\"a51559aa0\",\"value\":\"{{hasMoreMessages}}\",\"options\":[{\"id\":\"a26e35440\",\"conditionValue\":\"Nova condição\",\"conditionArray\":[\"true\"],\"conditionOperator\":\"=\",\"nextElementId\":\"a378978c0\"}]},\"configured\":true},{\"id\":\"ab18c27c0\",\"type\":3,\"x\":1578,\"y\":374,\"info\":\"\",\"config\":{\"nextElementId\":\"\",\"text\":\"Lista de produtos enviada com sucesso ! apenas Pergunte para o cliente qual item ele deseja \",\"fileChooseType\":0,\"fileId\":\"\"},\"configured\":true},{\"id\":\"ac33219f0\",\"type\":12,\"x\":950,\"y\":175,\"info\":\"\",\"config\":{\"varPrefix\":\"messageSended\",\"dataType\":\"jsonraw\",\"method\":\"post\",\"retrys\":1,\"url\":\"${instance}/int/sendMessageToChat\",\"data\":{},\"testData\":{},\"numberFields\":[],\"dataRaw\":\"{\\n    \\\"queueId\\\": ${queueId},\\n  \\\"apiKey\\\": \\\"${apiKey}\\\",\\n  \\\"chatId\\\": {{chat_id}},\\n  \\\"text\\\": \\\"{{currentMessageText}}\\\",\\n  \\\"fileId\\\": 0,\\n  \\\"info\\\": false,  \\n  \\\"title\\\": \\\"string\\\",\\n    \\\"buttonsConfig\\\": {\\n    \\\"title\\\": \\\"adicionar\\\",\\n    \\\"buttons\\\": [\\n  \\n      {\\n        \\\"text\\\": \\\"adicionar ߛ✜\",\\n        \\\"id\\\": \\\"{{currentCode}}\\\"\\n      }\\n     \\n    ]\\n  },\\n  \\\"hidden\\\": false\\n}\",\"headers\":{},\"testHeaders\":{},\"timeout\":15000,\"expectedContentType\":0,\"textPreProcessor\":0,\"textPreProcessorSeparator\":\"\",\"textPostProcessorSeparator\":\"\",\"textResponseVariable\":\"\",\"nextElementId\":\"ac53b6300\"},\"configured\":true},{\"id\":\"a1f6aa490\",\"type\":78,\"x\":340,\"y\":152,\"info\":\"\",\"config\":{\"context\":\"produtos encontrados : {{listaProdutos}}\",\"nextElementId\":\"a378978c0\"},\"configured\":true},{\"id\":\"a95510d90\",\"type\":3,\"x\":157,\"y\":40,\"info\":\"\",\"config\":{\"nextElementId\":\"a50882990\",\"text\":\"buscando por {{assistant_produto}}\",\"fileChooseType\":0,\"fileId\":\"\"},\"configured\":true},{\"id\":\"abbaa67c0\",\"type\":3,\"x\":129,\"y\":249,\"info\":\"\",\"config\":{\"nextElementId\":\"a9ba83000\",\"text\":\"{{listaProdutosQuantidade}} produtos encontrados\\n{{listaProdutos}}\",\"fileChooseType\":0,\"fileId\":\"\"},\"configured\":true},{\"id\":\"a51559aa0\",\"type\":78,\"x\":1243,\"y\":424,\"info\":\"\",\"config\":{\"context\":\"Lista de produtos enviada com sucesso ! apenas Pergunte para o cliente qual item ele deseja \",\"nextElementId\":\"\"},\"configured\":true}]`,
        "finishtext": "",
        "fk_visualgroup": 0,
        "timeouttags": "[]",
        "notfoundtext": null,
        "allowagentstart": 0,
        "executionwithoutconfirmation": 0,
        "allowcontactexecution": 0,
        "allowopportunityfileexecution": 0,
        "allowtaskfileexecution": 0,
        "allowmsgexecution": 0,
        "waitmsgaiprocess": 1,
        "audiomsg": 0,
        "videomsg": 0,
        "locationmsg": 0,
        "textmsg": 0,
        "allowopportunity": 0,
        "pdfmsg": 0,
        "informationmsg": 0,
        "imagemsg": 0,
        "allmsgs": 0,
        "requestdataform": 0,
        "timeout": 600,
        "timeoutaction": 0,
        "buttons": "[]"
    };

    // =====================================================================
    // EXECUÇÃO
    // =====================================================================
    try {
        console.log('Iniciando instalação: Adiciona Item...');
        const adicionaItemResponse = await axios.post(`${instance}/ivrs/`, payloadAdicionaItem, axiosConfig);
        
        if (!adicionaItemResponse.data?.id) throw new Error('Resposta inválida ao criar Adiciona Item');
        console.log('Adiciona Item criado. ID:', adicionaItemResponse.data.id);

        console.log('Iniciando instalação: Envio de Itens...');
        const envioItemsResponse = await axios.post(`${instance}/ivrs/`, payloadEnvioItems, axiosConfig);
        
        if (!envioItemsResponse.data?.id) throw new Error('Resposta inválida ao criar Envio de Itens');
        console.log('Envio de Itens criado. ID:', envioItemsResponse.data.id);

        // Retorna os dois IDs como solicitado
        return {
            success: true,
            adicionaItemId: adicionaItemResponse.data.id,
            envioItemsId: envioItemsResponse.data.id
        };

    } catch (error) {
        console.error('Erro em alpha7Functions:', error.response?.data || error.message);
        throw error;
    }
}