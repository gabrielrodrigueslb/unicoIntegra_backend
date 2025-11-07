import axios from 'axios';

export async function loginInstance(instance) {
  const postData = {
    username: 'rl--gabrielag',
    password: '@Caio0305',
    code: '',
    trusted: false,
  };

  try {
    const loginResponse = await axios.post(`${instance}/login`, postData, {
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json', // Solicita explicitamente JSON ao servidor
      },
    });

    // Validação: Verifica se recebemos um token válido
    if (!loginResponse.data || !loginResponse.data.token) {
        // Se a resposta for uma string (provavelmente HTML), limita o log para não poluir o terminal
        const responseDataSample = typeof loginResponse.data === 'string'
            ? loginResponse.data.substring(0, 100) + '...'
            : JSON.stringify(loginResponse.data);

        throw new Error(`Login falhou: Servidor não retornou um token. Resposta: ${responseDataSample}`);
    }

    console.log('Login bem-sucedido, token recebido.');
    return loginResponse.data;
  } catch (error) {
    console.error('Erro fatal no loginInstance:', error.message);
    throw error;
  }
}
export default loginInstance;