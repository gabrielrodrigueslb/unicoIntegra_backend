import axios from 'axios';
import loginInstance from './loginInstance.js';
import { alpha7Functions } from './aiFunctions.js';

export async function createAi(instance, token) {
  try {
    if (!instance) {
      throw new Error('Informe a instância para criar a IA.');
    }
    const installResponse = await axios.post(
      `${instance}/assistants/createItem`,
      { name: 'Novo assistente' },
      {
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
      },
    );

    console.log('IA criada com sucesso!:', installResponse.data);
    return installResponse.data;
  } catch (error) {
    console.error(
      'Falha ao criar a IA:',
      error.response ? error.response.data : error.message,
    );
    throw error;
  }
}

export async function createAiAlpha(instance, username, password, code2fa, name, context, dbName, queueId, apiKey) {
  console.log('Primeira req de login')
  const loginData = await loginInstance(instance, username, password, code2fa);
  const aiData = await createAi(instance, loginData.token);

  const ivrIds = await alpha7Functions(
    instance,
    loginData.token,
    dbName,
    queueId,
    apiKey,
  );

  const iaPayload = {
    id: aiData.id,
    name: 'IA Vendas requisição',
    internaldescription: '',
    signaturename: name,
    type: 11,
    description: context || 'Você é um assistente de vendas em uma farmácia brasileira chamada [NOME DA FARMACIA] que conecta a uma API de ERP via functions. \n\nNão forneça dados ou informações que não sejam prescritas aqui. Em hipótese alguma receite remédios. Siga apenas o que lhe foi instruído.\n\nQuando tiver qualquer comportamento que precise da interferência de um humano (Ex.: o cliente ficou insatisfeito ou quer tirar uma duvida) transfira para o marcador de saída atendente (informe que está transferindo).\n\nVocê pode utilizar emojis nas mensagens para deixar mais amigável e estético .\n\nSeu fluxo de trabalho : \n\nInicie perguntando o que o cliente deseja informe que o cliente pode digitar, enviar audios ou fotos de receitas para buscar por um produto, sempre que o cliente informar um produto execute a function busca_produtos com o item buscado .\napós o cliente selecionou um produto, pergunte se precisa de outro, caso sim execute a function busca_produtos com o item buscado novamente caso não prossiga para os outros dados do pedido\nnome e cpf do cliente\nmétodo de entrega \ncaso não opte por retirar na loja endereço de entrega\nmétodo de pagamento (pix, cartão ou dinheiro)\n\napós tudo isso mostre um resumo do carrinho com todos os dados coletados e após ele dar o ok encerre sua participação '
,
    kbdescription: '',
    condenseddescription: '',
    condensedkbdescription: '',
    preautomation: ivrIds.adicionaItemId,
    postautomation: 0,
    waitfornewmsgs: 4,
    msgslimit: 100,
    functions: [
      {
        id: 'busca_produtos',
        name: 'busca_produtos',
        attrs: [
          {
            key: 'produto',
            type: 0,
            required: true,
            description:
              'Nome buscável do produto. Ex.: quero um dipirona"="dipirona" ',
          },
        ],
        automation: ivrIds.envioItemsId,
        description: '',
      },
    ],
    exittags: ['atendente'],
    faqs: [],
    faqgroups: [],
    lookinproducts: 0,
    usebuttons: 0,
    multiplemessasgesreply: 0,
    allowdirectmessage: 0,
    explanationmessages: 0,
    enablelog: 0,
    optimizedescription: 0,
    files: [],
  };
  try {
    const createAlphaAiResponse = await axios.post(
      `${instance}/assistants/updateItem`,
      iaPayload,
      {
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${loginData.token}`,
        },
      },
    );
    console.log('IA Alpha7 criada com sucesso!:', createAlphaAiResponse.data);
    return createAlphaAiResponse.data;
  } catch (error) {
    console.error(
      'Falha ao criar a IA Alpha7:',
      error.response ? error.response.data : error.message,
    );
    throw error;
  }
}

export async function createDefaultAi(instance,username, password, code2fa, name, context) {
  const loginData = await loginInstance(instance,username, password, code2fa);

  let installResponse;
  let aiData;

  // 1️⃣ Cria o pré-processamento
  try {
     const automationPayload = {
    "name":"Pré processamento",
   "type":2,
   "version":1,
   "initialtext":"a95510d90",
   "description":null,
   "listitems":"[]",
   "options":"[{\"id\":\"a396132f0\",\"type\":0,\"x\":89,\"y\":154,\"info\":\"\",\"config\":{\"nextElementId\":\"\",\"text\":\"{{message_button_id}} teste id\",\"fileChooseType\":0,\"fileId\":\"\"},\"configured\":true},{\"id\":\"aa7c877e0\",\"type\":11,\"x\":79,\"y\":177,\"info\":\"\",\"config\":{\"nextElementId\":\"a5538fc90\",\"value\":\"{{message_button_id}}\",\"options\":[{\"id\":\"ab0914f00\",\"conditionValue\":\"0\",\"conditionArray\":[\"Nova condição\"],\"conditionOperator\":\"not null\",\"nextElementId\":\"aa66580b0\"}]},\"configured\":true},{\"id\":\"ab9b42d00\",\"type\":78,\"x\":1096,\"y\":292,\"info\":\"\",\"config\":{\"context\":\"erro ao adicionar produto\",\"nextElementId\":\"\"},\"configured\":true},{\"id\":\"aa66580b0\",\"type\":12,\"x\":297,\"y\":502,\"info\":\"\",\"config\":{\"varPrefix\":\"addproduto\",\"dataType\":\"jsonraw\",\"method\":\"post\",\"retrys\":1,\"url\":\"https://atacadaodrogacenter.com.br/api/whatsapp/pedido/adicionar-produtos-pedido/{{pedido}}\",\"data\":{},\"testData\":{},\"numberFields\":[],\"dataRaw\":\"{\\n  \\\"produtos\\\": [\\n    {\\n      \\\"codigoBarras\\\": \\\"{{currentCode}}\\\",\\n      \\\"quantidade\\\": 1\\n    }\\n  ]\\n}\",\"headers\":{\"Authorization\":\"Bearer {{token}}\"},\"testHeaders\":{\"Authorization\":\"\"},\"timeout\":15000,\"expectedContentType\":0,\"textPreProcessor\":0,\"textPreProcessorSeparator\":\"\",\"textPostProcessorSeparator\":\"\",\"textResponseVariable\":\"\",\"nextElementId\":\"ac4852460\"},\"configured\":true},{\"id\":\"ac4852460\",\"type\":11,\"x\":627,\"y\":533,\"info\":\"\",\"config\":{\"nextElementId\":\"aee151880\",\"value\":\"{{addproduto_httpStatus}}\",\"options\":[{\"id\":\"adfa67c30\",\"conditionValue\":\"200\",\"conditionArray\":[\"Nova condição\"],\"conditionOperator\":\"!=\",\"nextElementId\":\"ab9b42d00\"}]},\"configured\":true},{\"id\":\"aee151880\",\"type\":78,\"x\":600,\"y\":353,\"info\":\"\",\"config\":{\"context\":\"produto de sku {{message_button_id}} foi adicionado ao carrinho \\n\",\"nextElementId\":\"\"},\"configured\":true,\"out\":\"\"},{\"id\":\"a5538fc90\",\"type\":11,\"x\":560,\"y\":81,\"info\":\"\",\"config\":{\"nextElementId\":\"\",\"value\":\"{{message_file.file_id}}\",\"options\":[{\"id\":\"a6d396550\",\"conditionValue\":\"0\",\"conditionArray\":[\"Nova condição\"],\"conditionOperator\":\">\",\"nextElementId\":\"a77b36ee0\"}]},\"configured\":true},{\"id\":\"a77b36ee0\",\"type\":79,\"x\":586,\"y\":252,\"info\":\"\",\"config\":{\"model\":0,\"fileId\":\"{{message_file.file_id}}\",\"instruction\":\"Transcreva em apenas um termo o conteúdo presente nessa foto, se for uma receita médica o principal remédio da mesma exemplo \\\"dorflex\\\", ou se for foto de um produto o nome do produto \",\"includeAllMessages\":false,\"resultVariableName\":\"ai_result\",\"nextElementId\":\"a8a7538b0\",\"outputAsJson\":true},\"configured\":true},{\"id\":\"a8a7538b0\",\"type\":3,\"x\":809,\"y\":253,\"info\":\"\",\"config\":{\"nextElementId\":\"a99720b40\",\"text\":\"Traduzindo documento {{ai_result}}\",\"fileChooseType\":0,\"fileId\":\"\"},\"configured\":true},{\"id\":\"a99720b40\",\"type\":78,\"x\":793,\"y\":363,\"info\":\"\",\"config\":{\"context\":\"Dado transcrito da imagem ou áudio : {{ai_result}}, pergunte se seria isso e se sim siga o fluxo de busca\\n\",\"nextElementId\":\"\"},\"configured\":true}]",
   "finishtext":"",
   "fk_visualgroup":0,
   "timeouttags":"[]",
   "notfoundtext":null,
   "allowagentstart":0,
   "executionwithoutconfirmation":0,
   "allowcontactexecution":0,
   "allowopportunityfileexecution":0,
   "allowtaskfileexecution":0,
   "allowmsgexecution":0,
   "waitmsgaiprocess":1,
   "audiomsg":0,
   "videomsg":0,
   "locationmsg":0,
   "textmsg":0,
   "allowopportunity":0,
   "pdfmsg":0,
   "informationmsg":0,
   "imagemsg":0,
   "allmsgs":0,
   "requestdataform":0,
   "timeout":600,
   "timeoutaction":0,
   "buttons":"[]"
    }


    installResponse = await axios.post(
      `${instance}/ivrs/`,
      automationPayload,
      {
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${loginData.token}`,
        },
      },
    );
  } catch (error) {
    console.error(
      'Falha instalar o pré processador:',
      error.response ? error.response.data : error.message,
    );
    throw error;
  }

  // 2️⃣ Cria a IA base
  try {
    aiData = await createAi(instance, loginData.token);
  } catch (error) {
    throw error;
  }

  // 3️⃣ Atualiza a IA com a automation
  try {
    const iaPayload = {
      id: aiData.id,
      name: `${name}`,
      signaturename: name,
      type: 11,
      description: context,
      preautomation: installResponse.data.id,
      postautomation: 0,
      waitfornewmsgs: 4,
      msgslimit: 100,
      functions: [],
      files: [],
    };

    const createAiResponse = await axios.post(
      `${instance}/assistants/updateItem`,
      iaPayload,
      {
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${loginData.token}`,
        },
      },
    );

    return createAiResponse.data;
  } catch (error) {
    console.error(
      'Falha ao criar a IA:',
      error.response ? error.response.data : error.message,
    );
    throw error;
  }
}

