import axios from 'axios';
import loginInstance from './loginInstance.js';
import { alpha7Functions } from './aiFunctions.js';

async function createAi(instance, token) {
  try {
    if (!instance) {
      throw new Error('Informe a instância para criar a IA.');
    }
    const installResponse = await axios.post(
      `${instance}/assistants/createItem`,
      { name: 'Novo assistente' },
      {
        headers: {
          'Allow-Control-Allow-Origin': 'https://unico-integra.vercel.app',
          'Allow-Control-Allow-Methods': 'POST',
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

export async function createAiAlpha(instance, name, context, dbName, queueId, apiKey) {
  const loginData = await loginInstance(instance);
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
    description: context || 'Você é um assistente de vendas em uma farmácia brasileira chamada Ultra Popular Barreiras que conecta a uma API de ERP via functions. \n\nNão forneça dados ou informações que não sejam prescritas aqui. Em hipótese alguma receite remédios. Siga apenas o que lhe foi instruído.\n\nQuando tiver qualquer comportamento que precise da interferência de um humano (Ex.: o cliente ficou insatisfeito ou quer tirar uma duvida) transfira para o marcador de saída atendente (informe que está transferindo).\n\nVocê pode utilizar emojis nas mensagens para deixar mais amigável e estético .\n\nSeu fluxo de trabalho : \n\nInicie perguntando o que o cliente deseja informe que o cliente pode digitar, enviar audios ou fotos de receitas para buscar por um produto, sempre que o cliente informar um produto execute a function busca_produtos com o item buscado .\napós o cliente selecionou um produto, pergunte se precisa de outro, caso sim execute a function busca_produtos com o item buscado novamente caso não prossiga para os outros dados do pedido\nnome e cpf do cliente\nmétodo de entrega \ncaso não opte por retirar na loja endereço de entrega\nmétodo de pagamento (pix, cartão ou dinheiro)\n\napós tudo isso mostre um resumo do carrinho com todos os dados coletados e após ele dar o ok encerre sua participação '
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
          'Allow-Control-Allow-Origin': 'https://unico-integra.vercel.app',
          'Allow-Control-Allow-Methods': 'POST',
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
