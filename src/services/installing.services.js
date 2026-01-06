// installing.services.js
import axios from 'axios';
import loginInstance from './loginInstance.js';

export async function installingIntegration(instance, username, password, code, integrationData) {
  try {
    const loginData = await loginInstance(instance, username, password, code);

    const installResponse = await axios.post(
      `${instance}/ivrs/`,
      integrationData,
      {
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${loginData.token}`,
        },
      },
    );

    console.log('Integration installation successful:', installResponse.data);
    return installResponse.data;
  } catch (error) {
    const errorMessage = error.response?.data?.message || error.response?.data || error.message;
    
    console.error('Falha detalhada:', errorMessage);
    
    // Lança um erro personalizado para o controller pegar
    throw new Error(JSON.stringify(errorMessage));
  }
}
