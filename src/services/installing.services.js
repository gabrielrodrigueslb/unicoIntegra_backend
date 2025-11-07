// installing.services.js
import axios from 'axios';
import loginInstance from './loginInstance.js';

export async function installingIntegration(instance, integrationData) {
  try {
    const loginData = await loginInstance(instance);

    const installResponse = await axios.post(
      `${instance}/ivrs/`,
      integrationData,
      {
        headers: {
          'Allow-Control-Allow-Origin': 'https://unico-integra.vercel.app',
          'Allow-Control-Allow-Methods': 'POST',
          'Content-Type': 'application/json',
          Authorization: `Bearer ${loginData.token}`,
        },
      },
    );

    console.log('Integration installation successful:', installResponse.data);
    return installResponse.data;
  } catch (error) {
    console.error(
      'Login or installation failed:',
      error.response ? error.response.data : error.message,
    );
    throw error;
  }
}
